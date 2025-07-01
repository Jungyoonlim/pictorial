use crate::core::vector::{VectorElement, Point, BoundingBox, Transform, GridSettings, Selection, Viewport};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SelectionHandle {
    pub id: String,
    pub handle_type: HandleType,
    pub position: Point,
    pub cursor: String,
    pub bounds: BoundingBox,
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum HandleType {
    Corner,
    Edge,
    Rotation,
    Center,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Constraint {
    pub constraint_type: ConstraintType,
    pub enabled: bool,
    pub params: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConstraintType {
    SnapToGrid,
    SnapToObject,
    MaintainAspect,
    LockRotation,
    LockScale,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AlignmentGuide {
    pub id: String,
    pub guide_type: AlignmentType,
    pub position: f64,
    pub elements: Vec<String>,
    pub temporary: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlignmentType {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SnapResult {
    pub snapped: bool,
    pub position: Point,
    pub offset: Point,
    pub guides: Vec<AlignmentGuide>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransformActionType {
    Translate,
    Scale,
    Rotate,
    Skew,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TransformAction {
    pub action_type: TransformActionType,
    pub element_ids: Vec<String>,
    pub delta: Transform,
    pub origin: Point,
    pub constraints_met: Vec<String>,
}

#[wasm_bindgen]
pub struct TransformEngine {
    grid: GridSettings,
    constraints: Vec<Constraint>,
    alignment_guides: Vec<AlignmentGuide>,
    snap_threshold: f64,
    viewport: Viewport,
    current_action: Option<TransformAction>,
}

#[wasm_bindgen]
impl TransformEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TransformEngine {
        TransformEngine {
            grid: GridSettings {
                enabled: false,
                size: 20.0,
                color: "#E0E0E0".to_string(),
                opacity: 0.5,
                snap: false,
            },
            constraints: vec![
                Constraint {
                    constraint_type: ConstraintType::SnapToGrid,
                    enabled: false,
                    params: None,
                },
                Constraint {
                    constraint_type: ConstraintType::SnapToObject,
                    enabled: true,
                    params: None,
                },
                Constraint {
                    constraint_type: ConstraintType::MaintainAspect,
                    enabled: false,
                    params: None,
                },
                Constraint {
                    constraint_type: ConstraintType::LockRotation,
                    enabled: false,
                    params: None,
                },
                Constraint {
                    constraint_type: ConstraintType::LockScale,
                    enabled: false,
                    params: None,
                },
            ],
            alignment_guides: Vec::new(),
            snap_threshold: 5.0,
            viewport: Viewport::new(0.0, 0.0, 1.0, 800.0, 600.0),
            current_action: None,
        }
    }

    // SELECTION HANDLES
    pub fn generate_selection_handles(&self, selection: &Selection) -> Vec<SelectionHandle> {
        let mut handles = Vec::new();
        let bounds = &selection.bounds;
        let handle_size = 8.0 / self.viewport.zoom;

        // Corner handles
        handles.extend(vec![
            SelectionHandle {
                id: "nw".to_string(),
                handle_type: HandleType::Corner,
                position: Point::new(bounds.x, bounds.y),
                cursor: "nw-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x - handle_size / 2.0,
                    bounds.y - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
            SelectionHandle {
                id: "ne".to_string(),
                handle_type: HandleType::Corner,
                position: Point::new(bounds.x + bounds.width, bounds.y),
                cursor: "ne-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x + bounds.width - handle_size / 2.0,
                    bounds.y - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
            SelectionHandle {
                id: "sw".to_string(),
                handle_type: HandleType::Corner,
                position: Point::new(bounds.x, bounds.y + bounds.height),
                cursor: "sw-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x - handle_size / 2.0,
                    bounds.y + bounds.height - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
            SelectionHandle {
                id: "se".to_string(),
                handle_type: HandleType::Corner,
                position: Point::new(bounds.x + bounds.width, bounds.y + bounds.height),
                cursor: "se-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x + bounds.width - handle_size / 2.0,
                    bounds.y + bounds.height - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
        ]);

        // Edge handles
        handles.extend(vec![
            SelectionHandle {
                id: "n".to_string(),
                handle_type: HandleType::Edge,
                position: Point::new(bounds.x + bounds.width / 2.0, bounds.y),
                cursor: "n-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x + bounds.width / 2.0 - handle_size / 2.0,
                    bounds.y - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
            SelectionHandle {
                id: "s".to_string(),
                handle_type: HandleType::Edge,
                position: Point::new(bounds.x + bounds.width / 2.0, bounds.y + bounds.height),
                cursor: "s-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x + bounds.width / 2.0 - handle_size / 2.0,
                    bounds.y + bounds.height - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
            SelectionHandle {
                id: "w".to_string(),
                handle_type: HandleType::Edge,
                position: Point::new(bounds.x, bounds.y + bounds.height / 2.0),
                cursor: "w-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x - handle_size / 2.0,
                    bounds.y + bounds.height / 2.0 - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
            SelectionHandle {
                id: "e".to_string(),
                handle_type: HandleType::Edge,
                position: Point::new(bounds.x + bounds.width, bounds.y + bounds.height / 2.0),
                cursor: "e-resize".to_string(),
                bounds: BoundingBox::new(
                    bounds.x + bounds.width - handle_size / 2.0,
                    bounds.y + bounds.height / 2.0 - handle_size / 2.0,
                    handle_size,
                    handle_size,
                ),
            },
        ]);

        // Rotation handle
        let rotation_offset = 20.0 / self.viewport.zoom;
        handles.push(SelectionHandle {
            id: "rotation".to_string(),
            handle_type: HandleType::Rotation,
            position: Point::new(bounds.x + bounds.width / 2.0, bounds.y - rotation_offset),
            cursor: "grab".to_string(),
            bounds: BoundingBox::new(
                bounds.x + bounds.width / 2.0 - handle_size / 2.0,
                bounds.y - rotation_offset - handle_size / 2.0,
                handle_size,
                handle_size,
            ),
        });

        // Center handle
        handles.push(SelectionHandle {
            id: "center".to_string(),
            handle_type: HandleType::Center,
            position: Point::new(bounds.x + bounds.width / 2.0, bounds.y + bounds.height / 2.0),
            cursor: "move".to_string(),
            bounds: BoundingBox::new(
                bounds.x + bounds.width / 2.0 - handle_size / 2.0,
                bounds.y + bounds.height / 2.0 - handle_size / 2.0,
                handle_size,
                handle_size,
            ),
        });

        handles
    }

    pub fn get_handle_at_point(&self, handles: &[SelectionHandle], point: &Point) -> Option<SelectionHandle> {
        for handle in handles {
            if handle.bounds.contains_point(point) {
                return Some(handle.clone());
            }
        }
        None
    }

    // TRANSFORMATION
    pub fn start_transform(&mut self, element_ids: Vec<String>, action_type: TransformActionType, origin: Point) {
        self.current_action = Some(TransformAction {
            action_type,
            element_ids,
            delta: Transform::identity(),
            origin,
            constraints_met: Vec::new(),
        });
    }

    pub fn update_transform(&mut self, delta: Transform, elements: &[VectorElement]) -> (Vec<VectorElement>, Vec<AlignmentGuide>) {
        if self.current_action.is_none() {
            return (elements.to_vec(), Vec::new());
        }

        // Apply constraints
        let constrained_delta = self.apply_constraints(&delta, elements);
        
        // Apply snapping
        let snap_result = self.apply_snapping(&constrained_delta, elements);
        
        // Update current action
        if let Some(ref mut action) = self.current_action {
            action.delta = if snap_result.snapped {
                self.add_transforms(&constrained_delta, &Transform {
                    translate_x: snap_result.offset.x,
                    translate_y: snap_result.offset.y,
                    scale_x: 1.0,
                    scale_y: 1.0,
                    rotation: 0.0,
                    skew_x: 0.0,
                    skew_y: 0.0,
                })
            } else {
                constrained_delta
            };
        }

        // Transform elements
        let transformed_elements: Vec<VectorElement> = elements
            .iter()
            .map(|element| {
                if let Some(ref action) = self.current_action {
                    self.transform_element(element, &action.delta, &action.origin)
                } else {
                    element.clone()
                }
            })
            .collect();

        (transformed_elements, snap_result.guides)
    }

    pub fn end_transform(&mut self) -> Option<TransformAction> {
        let action = self.current_action.take();
        self.clear_temporary_guides();
        action
    }

    pub fn cancel_transform(&mut self) {
        self.current_action = None;
        self.clear_temporary_guides();
    }

    // ELEMENT TRANSFORMATION
    pub fn transform_element(&self, element: &VectorElement, delta: &Transform, origin: &Point) -> VectorElement {
        let mut new_element = element.clone();
        
        match new_element {
            VectorElement::Path { ref mut transform, ref mut bounding_box, .. } => {
                *transform = self.combine_transforms(transform, delta, origin);
                *bounding_box = self.transform_bounds(&element.bounding_box(), transform);
            }
            VectorElement::Shape { ref mut transform, ref mut bounding_box, .. } => {
                *transform = self.combine_transforms(transform, delta, origin);
                *bounding_box = self.transform_bounds(&element.bounding_box(), transform);
            }
            VectorElement::Text { ref mut transform, ref mut bounding_box, .. } => {
                *transform = self.combine_transforms(transform, delta, origin);
                *bounding_box = self.transform_bounds(&element.bounding_box(), transform);
            }
            VectorElement::Group { ref mut transform, ref mut bounding_box, .. } => {
                *transform = self.combine_transforms(transform, delta, origin);
                *bounding_box = self.transform_bounds(&element.bounding_box(), transform);
            }
        }
        
        new_element
    }

    pub fn translate_element(&self, element: &VectorElement, offset: &Point) -> VectorElement {
        let delta = Transform {
            translate_x: offset.x,
            translate_y: offset.y,
            scale_x: 1.0,
            scale_y: 1.0,
            rotation: 0.0,
            skew_x: 0.0,
            skew_y: 0.0,
        };
        
        self.transform_element(element, &delta, &Point::new(0.0, 0.0))
    }

    pub fn scale_element(&self, element: &VectorElement, scale: &Point, origin: &Point) -> VectorElement {
        let delta = Transform {
            translate_x: 0.0,
            translate_y: 0.0,
            scale_x: scale.x,
            scale_y: scale.y,
            rotation: 0.0,
            skew_x: 0.0,
            skew_y: 0.0,
        };
        
        self.transform_element(element, &delta, origin)
    }

    pub fn rotate_element(&self, element: &VectorElement, angle: f64, origin: &Point) -> VectorElement {
        let delta = Transform {
            translate_x: 0.0,
            translate_y: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
            rotation: angle,
            skew_x: 0.0,
            skew_y: 0.0,
        };
        
        self.transform_element(element, &delta, origin)
    }

    // ALIGNMENT
    pub fn align_elements(&self, elements: &[VectorElement], alignment: &str) -> Vec<VectorElement> {
        if elements.len() < 2 {
            return elements.to_vec();
        }

        let bounds: Vec<&BoundingBox> = elements.iter().map(|el| el.bounding_box()).collect();
        
        match alignment {
            "left" => {
                let align_to = bounds.iter().map(|b| b.x).fold(f64::INFINITY, f64::min);
                elements.iter().map(|el| {
                    let offset = Point::new(align_to - el.bounding_box().x, 0.0);
                    self.translate_element(el, &offset)
                }).collect()
            }
            "center" => {
                let min_x = bounds.iter().map(|b| b.x).fold(f64::INFINITY, f64::min);
                let max_x = bounds.iter().map(|b| b.x + b.width).fold(f64::NEG_INFINITY, f64::max);
                let center_x = (min_x + max_x) / 2.0;
                
                elements.iter().map(|el| {
                    let element_center = el.bounding_box().x + el.bounding_box().width / 2.0;
                    let offset = Point::new(center_x - element_center, 0.0);
                    self.translate_element(el, &offset)
                }).collect()
            }
            "right" => {
                let align_to = bounds.iter().map(|b| b.x + b.width).fold(f64::NEG_INFINITY, f64::max);
                elements.iter().map(|el| {
                    let offset = Point::new(align_to - (el.bounding_box().x + el.bounding_box().width), 0.0);
                    self.translate_element(el, &offset)
                }).collect()
            }
            "top" => {
                let align_to = bounds.iter().map(|b| b.y).fold(f64::INFINITY, f64::min);
                elements.iter().map(|el| {
                    let offset = Point::new(0.0, align_to - el.bounding_box().y);
                    self.translate_element(el, &offset)
                }).collect()
            }
            "middle" => {
                let min_y = bounds.iter().map(|b| b.y).fold(f64::INFINITY, f64::min);
                let max_y = bounds.iter().map(|b| b.y + b.height).fold(f64::NEG_INFINITY, f64::max);
                let center_y = (min_y + max_y) / 2.0;
                
                elements.iter().map(|el| {
                    let element_center = el.bounding_box().y + el.bounding_box().height / 2.0;
                    let offset = Point::new(0.0, center_y - element_center);
                    self.translate_element(el, &offset)
                }).collect()
            }
            "bottom" => {
                let align_to = bounds.iter().map(|b| b.y + b.height).fold(f64::NEG_INFINITY, f64::max);
                elements.iter().map(|el| {
                    let offset = Point::new(0.0, align_to - (el.bounding_box().y + el.bounding_box().height));
                    self.translate_element(el, &offset)
                }).collect()
            }
            _ => elements.to_vec(),
        }
    }

    // GRID AND SNAPPING
    pub fn set_grid(&mut self, enabled: bool, size: f64, color: String, opacity: f64, snap: bool) {
        self.grid = GridSettings {
            enabled,
            size,
            color,
            opacity,
            snap,
        };
    }

    pub fn snap_to_grid(&self, point: &Point) -> Point {
        if !self.grid.enabled || !self.grid.snap {
            return *point;
        }
        
        Point::new(
            (point.x / self.grid.size).round() * self.grid.size,
            (point.y / self.grid.size).round() * self.grid.size,
        )
    }

    // VIEWPORT
    pub fn set_viewport(&mut self, viewport: Viewport) {
        self.viewport = viewport;
    }

    pub fn get_viewport(&self) -> &Viewport {
        &self.viewport
    }

    // PRIVATE HELPER METHODS
    fn apply_snapping(&self, delta: &Transform, elements: &[VectorElement]) -> SnapResult {
        let guides = Vec::new();
        let snapped_x = false;
        let snapped_y = false;
        let offset_x = 0.0;
        let offset_y = 0.0;

        if !self.is_constraint_enabled(&ConstraintType::SnapToObject) {
            return SnapResult {
                snapped: false,
                position: Point::new(delta.translate_x, delta.translate_y),
                offset: Point::new(0.0, 0.0),
                guides,
            };
        }

        // Simplified snapping logic - would need full implementation
        SnapResult {
            snapped: snapped_x || snapped_y,
            position: Point::new(delta.translate_x + offset_x, delta.translate_y + offset_y),
            offset: Point::new(offset_x, offset_y),
            guides,
        }
    }

    fn is_constraint_enabled(&self, constraint_type: &ConstraintType) -> bool {
        self.constraints
            .iter()
            .find(|c| &c.constraint_type == constraint_type)
            .map(|c| c.enabled)
            .unwrap_or(false)
    }

    fn apply_constraints(&self, delta: &Transform, _elements: &[VectorElement]) -> Transform {
        let mut constrained_delta = *delta;

        // Maintain aspect ratio
        if self.is_constraint_enabled(&ConstraintType::MaintainAspect) 
            && (delta.scale_x != 1.0 || delta.scale_y != 1.0) {
            if delta.scale_x.abs() > delta.scale_y.abs() {
                constrained_delta.scale_y = delta.scale_x;
            } else {
                constrained_delta.scale_x = delta.scale_y;
            }
        }

        // Lock rotation
        if self.is_constraint_enabled(&ConstraintType::LockRotation) {
            constrained_delta.rotation = 0.0;
        }

        // Lock scale
        if self.is_constraint_enabled(&ConstraintType::LockScale) {
            constrained_delta.scale_x = 1.0;
            constrained_delta.scale_y = 1.0;
        }

        // Snap to grid
        if self.is_constraint_enabled(&ConstraintType::SnapToGrid) {
            let snapped_translation = self.snap_to_grid(&Point::new(delta.translate_x, delta.translate_y));
            constrained_delta.translate_x = snapped_translation.x;
            constrained_delta.translate_y = snapped_translation.y;
        }

        constrained_delta
    }

    fn add_transforms(&self, a: &Transform, b: &Transform) -> Transform {
        Transform {
            translate_x: a.translate_x + b.translate_x,
            translate_y: a.translate_y + b.translate_y,
            scale_x: a.scale_x * b.scale_x,
            scale_y: a.scale_y * b.scale_y,
            rotation: a.rotation + b.rotation,
            skew_x: a.skew_x + b.skew_x,
            skew_y: a.skew_y + b.skew_y,
        }
    }

    fn combine_transforms(&self, base: &Transform, delta: &Transform, origin: &Point) -> Transform {
        let cos_r = delta.rotation.cos();
        let sin_r = delta.rotation.sin();
        
        let dx = origin.x;
        let dy = origin.y;
        
        Transform {
            translate_x: base.translate_x + delta.translate_x + dx * (delta.scale_x * cos_r - 1.0) + dy * (delta.scale_x * sin_r),
            translate_y: base.translate_y + delta.translate_y + dx * (-delta.scale_y * sin_r) + dy * (delta.scale_y * cos_r - 1.0),
            scale_x: base.scale_x * delta.scale_x,
            scale_y: base.scale_y * delta.scale_y,
            rotation: base.rotation + delta.rotation,
            skew_x: base.skew_x + delta.skew_x,
            skew_y: base.skew_y + delta.skew_y,
        }
    }

    fn transform_bounds(&self, bounds: &BoundingBox, transform: &Transform) -> BoundingBox {
        // Transform the four corners of the bounding box
        let corners = [
            Point::new(bounds.x, bounds.y),
            Point::new(bounds.x + bounds.width, bounds.y),
            Point::new(bounds.x + bounds.width, bounds.y + bounds.height),
            Point::new(bounds.x, bounds.y + bounds.height),
        ];

        let transformed_corners: Vec<Point> = corners
            .iter()
            .map(|corner| transform.transform_point(corner))
            .collect();
        
        let min_x = transformed_corners.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
        let min_y = transformed_corners.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
        let max_x = transformed_corners.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
        let max_y = transformed_corners.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);

        BoundingBox::new(min_x, min_y, max_x - min_x, max_y - min_y)
    }

    fn clear_temporary_guides(&mut self) {
        self.alignment_guides.retain(|guide| !guide.temporary);
    }
} 