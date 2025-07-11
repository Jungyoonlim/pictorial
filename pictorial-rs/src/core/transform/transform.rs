use crate::math::{Point, Matrix3, Bounds, Vector2};
use rustc_hash::FxHashMap as Map;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TransformError {
    AlreadyTransforming,
    UnknownElement,
    InvalidParameters,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HandleType {
    TopLeft,
    TopCenter,
    TopRight,
    MiddleLeft,
    MiddleRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
    Rotation,
    Center,
}

#[derive(Debug)]
pub struct Handle { 
    pub handle_type: HandleType,
    pub position: Point, 
    pub bounds: Bounds,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ConstraintType { 
    SnapToGrid,
    SnapToObject,
    MaintainAspectRatio,
    LockRotation,
    LockScale,
}

#[derive(Debug, Clone)]
pub struct Constraint {
    pub constraint_type: ConstraintType,
    pub enabled: bool,
}

#[derive(Debug)]
pub struct AlignmentGuide { 
    pub id: u32,
    pub orientation: Orientation,
    pub position: f32, 
    pub element_ids: Vec<u32>,
}

#[derive(Debug, Clone, Copy)]
pub enum Orientation { 
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone)]
pub struct TransformEngine { 
    grid_size: f32, 
    snap_threshold: f32, 
    constraints: Map<ConstraintType, Constraint>,
    active_guides: Vec<AlignmentGuide>, 
    current_transform: Option<TransformSession>,
}

#[derive(Clone)]
struct TransformSession { 
    element_ids: Vec<u32>,
    start_point: Point, 
    origin: Point, 
    handle_type: HandleType,
    initial_states: Map<u32, ElementState>,
    current_transforms: Map<u32, Matrix3>,
}

#[derive(Clone)]
struct ElementState {
    transform: Matrix3, 
    bounds: Bounds,
}

impl TransformEngine { 
    pub fn new() -> Self {
        let mut constraints = Map::default();
        constraints.insert(ConstraintType::SnapToGrid, Constraint {
            constraint_type: ConstraintType::SnapToGrid,
            enabled: false,
        });
        constraints.insert(ConstraintType::MaintainAspectRatio, Constraint {
            constraint_type: ConstraintType::MaintainAspectRatio,
            enabled: false,
        });
        constraints.insert(ConstraintType::LockRotation, Constraint {
            constraint_type: ConstraintType::LockRotation,
            enabled: false,
        });
        constraints.insert(ConstraintType::LockScale, Constraint {
            constraint_type: ConstraintType::LockScale,
            enabled: false,
        });
        
        Self {
            grid_size: 10.0,
            snap_threshold: 5.0,
            constraints,
            active_guides: Vec::new(),
            current_transform: None,
        }
    }

    pub fn start_transform(&mut self, element_ids: Vec<u32>, handle_type: HandleType, start_point: Point, element_bounds: Map<u32, (Matrix3, Bounds)>) -> Result<(), TransformError> {
        if self.current_transform.is_some() {
            return Err(TransformError::AlreadyTransforming);
        }

        if element_ids.is_empty() {
            return Err(TransformError::InvalidParameters);
        }

        // Check that all element IDs exist in the provided bounds
        for &id in &element_ids {
            if !element_bounds.contains_key(&id) {
                return Err(TransformError::UnknownElement);
            }
        }

        // Calculate origin based on handle type - use opposite corner for scaling
        let origin = if element_ids.len() == 1 {
            // For single element, use opposite corner of bounds
            let first_id = element_ids[0];
            if let Some((_, bounds)) = element_bounds.get(&first_id) {
                match handle_type {
                    HandleType::TopLeft => Point::new(bounds.max.x, bounds.max.y),
                    HandleType::TopRight => Point::new(bounds.min.x, bounds.max.y),
                    HandleType::BottomLeft => Point::new(bounds.max.x, bounds.min.y),
                    HandleType::BottomRight => Point::new(bounds.min.x, bounds.min.y),
                    HandleType::TopCenter => Point::new((bounds.min.x + bounds.max.x) / 2.0, bounds.max.y),
                    HandleType::BottomCenter => Point::new((bounds.min.x + bounds.max.x) / 2.0, bounds.min.y),
                    HandleType::MiddleLeft => Point::new(bounds.max.x, (bounds.min.y + bounds.max.y) / 2.0),
                    HandleType::MiddleRight => Point::new(bounds.min.x, (bounds.min.y + bounds.max.y) / 2.0),
                    HandleType::Center => Point::new((bounds.min.x + bounds.max.x) / 2.0, (bounds.min.y + bounds.max.y) / 2.0),
                    HandleType::Rotation => Point::new((bounds.min.x + bounds.max.x) / 2.0, (bounds.min.y + bounds.max.y) / 2.0),
                }
            } else {
                start_point
            }
        } else {
            // For multiple elements, use the combined bounds with appropriate origin
            if let Some(combined_bounds) = Self::calculate_combined_bounds(&element_bounds) {
                match handle_type {
                    HandleType::TopLeft => Point::new(combined_bounds.max.x, combined_bounds.max.y),
                    HandleType::TopRight => Point::new(combined_bounds.min.x, combined_bounds.max.y),
                    HandleType::BottomLeft => Point::new(combined_bounds.max.x, combined_bounds.min.y),
                    HandleType::BottomRight => Point::new(combined_bounds.min.x, combined_bounds.min.y),
                    HandleType::TopCenter => Point::new((combined_bounds.min.x + combined_bounds.max.x) / 2.0, combined_bounds.max.y),
                    HandleType::BottomCenter => Point::new((combined_bounds.min.x + combined_bounds.max.x) / 2.0, combined_bounds.min.y),
                    HandleType::MiddleLeft => Point::new(combined_bounds.max.x, (combined_bounds.min.y + combined_bounds.max.y) / 2.0),
                    HandleType::MiddleRight => Point::new(combined_bounds.min.x, (combined_bounds.min.y + combined_bounds.max.y) / 2.0),
                    _ => Point::new((combined_bounds.min.x + combined_bounds.max.x) / 2.0, 
                                  (combined_bounds.min.y + combined_bounds.max.y) / 2.0),
                }
            } else {
                start_point
            }
        };

        let initial_states = element_bounds
            .iter()
            .map(|(&id, &(transform, bounds))| (id, ElementState { transform, bounds }))
            .collect();

        let current_transforms = element_bounds
            .iter()
            .map(|(&id, &(transform, _))| (id, transform))
            .collect();

        self.current_transform = Some(TransformSession {
            element_ids,
            start_point,
            origin,
            handle_type,
            initial_states,
            current_transforms,
        });

        Ok(())
    }

    pub fn update_transform(&mut self, current_point: Point) -> Option<Map<u32, Matrix3>> {
        let session = self.current_transform.as_mut()?;
        let mut transforms = Map::default();

        let delta = Vector2::new(
            current_point.x - session.start_point.x,
            current_point.y - session.start_point.y,
        );

        for &element_id in &session.element_ids {
            if let Some(initial_state) = session.initial_states.get(&element_id) {
                let mut new_transform = initial_state.transform;

                match session.handle_type {
                    HandleType::Center => {
                        new_transform = Matrix3::translation(delta.x, delta.y) * new_transform;
                    }
                    HandleType::TopLeft | HandleType::TopRight | HandleType::BottomLeft | HandleType::BottomRight |
                    HandleType::TopCenter | HandleType::BottomCenter | HandleType::MiddleLeft | HandleType::MiddleRight => {
                        if !self.is_constraint_enabled(ConstraintType::LockScale) {
                            // Guard against divide-by-zero
                            let denom_x = (session.start_point.x - session.origin.x).abs();
                            let denom_y = (session.start_point.y - session.origin.y).abs();
                            
                            // Early return identity scale if denominator is too small
                            if denom_x < 1e-4 || denom_y < 1e-4 {
                                // Keep original transform (identity scale)
                            } else {
                                let scale_x = (current_point.x - session.origin.x) / (session.start_point.x - session.origin.x);
                                let scale_y = (current_point.y - session.origin.y) / (session.start_point.y - session.origin.y);
                                
                                // For edge handles, constrain scaling to one axis
                                let (mut final_scale_x, mut final_scale_y) = match session.handle_type {
                                    HandleType::TopCenter | HandleType::BottomCenter => (1.0, scale_y),
                                    HandleType::MiddleLeft | HandleType::MiddleRight => (scale_x, 1.0),
                                    _ => (scale_x, scale_y), // Corner handles
                                };

                                // Apply aspect ratio constraint if enabled (even for edge handles)
                                if self.is_constraint_enabled(ConstraintType::MaintainAspectRatio) {
                                    let sign_x = final_scale_x.signum();
                                    let sign_y = final_scale_y.signum();
                                    let uniform = final_scale_x.abs().max(final_scale_y.abs());
                                    final_scale_x = uniform * sign_x;
                                    final_scale_y = uniform * sign_y;
                                }
                                
                                let scale = Matrix3::scale(final_scale_x, final_scale_y);
                                new_transform = scale * new_transform;
                            }
                        }
                    }
                    HandleType::Rotation => {
                        if !self.is_constraint_enabled(ConstraintType::LockRotation) {
                            let start_angle = (session.start_point.y - session.origin.y)
                                .atan2(session.start_point.x - session.origin.x);
                            let current_angle = (current_point.y - session.origin.y)
                                .atan2(current_point.x - session.origin.x);
                            let delta_angle = current_angle - start_angle;
                            let rotation = Matrix3::rotation(delta_angle);
                            new_transform = rotation * new_transform;
                        }
                    }
                    _ => {}
                }

                if self.is_constraint_enabled(ConstraintType::SnapToGrid) {
                    new_transform = self.snap_to_grid(new_transform);
                }

                transforms.insert(element_id, new_transform);
            }
        }

        // Store the computed transforms in the session
        session.current_transforms = transforms.clone();
        Some(transforms)
    }

    pub fn finish_transform(&mut self) -> Option<Map<u32, Matrix3>> {
        let final_transforms = if let Some(ref session) = self.current_transform {
            session.current_transforms.clone()
        } else {
            return None;
        };

        self.current_transform = None;
        Some(final_transforms)
    }

    /// Cancels the current transformation and returns the original (pre-transform) matrices.
    /// This allows callers to revert elements to their initial state.
    pub fn cancel_transform(&mut self) -> Option<Map<u32, Matrix3>> {
        let initial_transforms = if let Some(ref session) = self.current_transform {
            session.initial_states.iter()
                .map(|(&id, state)| (id, state.transform))
                .collect()
        } else {
            return None;
        };

        self.current_transform = None;
        Some(initial_transforms)
    }

    pub fn is_constraint_enabled(&self, constraint_type: ConstraintType) -> bool {
        self.constraints.get(&constraint_type)
            .map(|c| c.enabled)
            .unwrap_or(false)
    }

    pub fn set_constraint(&mut self, constraint_type: ConstraintType, enabled: bool) {
        if let Some(constraint) = self.constraints.get_mut(&constraint_type) {
            constraint.enabled = enabled;
        }
    }

    /// Snaps the translation component of a transform to the grid.
    /// Note: This only affects translation - scale and rotation are untouched.
    fn snap_to_grid(&self, transform: Matrix3) -> Matrix3 {
        let translation = transform.translation();
        let snapped_x = (translation.x / self.grid_size).round() * self.grid_size;
        let snapped_y = (translation.y / self.grid_size).round() * self.grid_size;
        
        let mut snapped_transform = transform;
        snapped_transform.set_translation(Vector2::new(snapped_x, snapped_y));
        snapped_transform
    }

    pub fn calculate_handles(&self, bounds: &Bounds) -> Vec<Handle> {
        let mut handles = Vec::new();
        let handle_size = 8.0;
        
        let left = bounds.min.x;
        let right = bounds.max.x;
        let top = bounds.min.y;
        let bottom = bounds.max.y;
        let center_x = (left + right) / 2.0;
        let center_y = (top + bottom) / 2.0;

        let handle_bounds = Bounds::new(
            Point::new(-handle_size / 2.0, -handle_size / 2.0),
            Point::new(handle_size / 2.0, handle_size / 2.0),
        );

        handles.push(Handle {
            handle_type: HandleType::TopLeft,
            position: Point::new(left, top),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::TopCenter,
            position: Point::new(center_x, top),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::TopRight,
            position: Point::new(right, top),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::MiddleLeft,
            position: Point::new(left, center_y),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::MiddleRight,
            position: Point::new(right, center_y),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::BottomLeft,
            position: Point::new(left, bottom),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::BottomCenter,
            position: Point::new(center_x, bottom),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::BottomRight,
            position: Point::new(right, bottom),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::Center,
            position: Point::new(center_x, center_y),
            bounds: handle_bounds,
        });

        handles.push(Handle {
            handle_type: HandleType::Rotation,
            position: Point::new(center_x, top - 20.0),
            bounds: handle_bounds,
        });

        handles
    }

    pub fn hit_test_handle(&self, point: Point, handles: &[Handle]) -> Option<HandleType> {
        for handle in handles {
            let handle_bounds = Bounds::new(
                Point::new(handle.position.x + handle.bounds.min.x, handle.position.y + handle.bounds.min.y),
                Point::new(handle.position.x + handle.bounds.max.x, handle.position.y + handle.bounds.max.y),
            );
            
            if handle_bounds.contains_point(point) {
                return Some(handle.handle_type);
            }
        }
        None
    }

    pub fn cursor_for_handle(&self, handle_type: HandleType) -> &'static str {
        match handle_type {
            HandleType::TopLeft | HandleType::BottomRight => "nw-resize",
            HandleType::TopRight | HandleType::BottomLeft => "ne-resize",
            HandleType::TopCenter | HandleType::BottomCenter => "n-resize",
            HandleType::MiddleLeft | HandleType::MiddleRight => "e-resize",
            HandleType::Center => "move",
            HandleType::Rotation => "crosshair",
        }
    }

    pub fn snap_point_to_guides(&self, point: Point, element_bounds: &[Bounds]) -> Point {
        let mut snapped_point = point;
        let threshold = self.snap_threshold;

        for guide in &self.active_guides {
            match guide.orientation {
                Orientation::Horizontal => {
                    if (point.y - guide.position).abs() < threshold {
                        snapped_point.y = guide.position;
                    }
                }
                Orientation::Vertical => {
                    if (point.x - guide.position).abs() < threshold {
                        snapped_point.x = guide.position;
                    }
                }
            }
        }

        if self.is_constraint_enabled(ConstraintType::SnapToObject) {
            for bounds in element_bounds {
                let edges = [
                    bounds.min.x, bounds.max.x, bounds.min.y, bounds.max.y,
                    (bounds.min.x + bounds.max.x) / 2.0,
                    (bounds.min.y + bounds.max.y) / 2.0,
                ];

                for &edge in &edges {
                    if (point.x - edge).abs() < threshold {
                        snapped_point.x = edge;
                    }
                    if (point.y - edge).abs() < threshold {
                        snapped_point.y = edge;
                    }
                }
            }
        }

        snapped_point
    }

    pub fn add_alignment_guide(&mut self, orientation: Orientation, position: f32, element_ids: Vec<u32>) -> u32 {
        let id = self.active_guides.len() as u32;
        self.active_guides.push(AlignmentGuide {
            id,
            orientation,
            position,
            element_ids,
        });
        id
    }

    pub fn remove_alignment_guide(&mut self, guide_id: u32) {
        self.active_guides.retain(|guide| guide.id != guide_id);
    }

    pub fn clear_alignment_guides(&mut self) {
        self.active_guides.clear();
    }

    pub fn guides(&self) -> &[AlignmentGuide] {
        &self.active_guides
    }

    pub fn set_grid_size(&mut self, size: f32) {
        self.grid_size = size;
    }

    pub fn set_snap_threshold(&mut self, threshold: f32) {
        self.snap_threshold = threshold;
    }

    pub fn grid_size(&self) -> f32 {
        self.grid_size
    }

    pub fn snap_threshold(&self) -> f32 {
        self.snap_threshold
    }

    pub fn is_transforming(&self) -> bool {
        self.current_transform.is_some()
    }

    pub fn transforming_elements(&self) -> Option<&[u32]> {
        self.current_transform.as_ref().map(|s| s.element_ids.as_slice())
    }

    fn calculate_combined_bounds(element_bounds: &Map<u32, (Matrix3, Bounds)>) -> Option<Bounds> {
        if element_bounds.is_empty() {
            return None;
        }

        let mut min_x = f32::INFINITY;
        let mut min_y = f32::INFINITY;
        let mut max_x = f32::NEG_INFINITY;
        let mut max_y = f32::NEG_INFINITY;

        for &(_, ref bounds) in element_bounds.values() {
            min_x = min_x.min(bounds.min.x);
            min_y = min_y.min(bounds.min.y);
            max_x = max_x.max(bounds.max.x);
            max_y = max_y.max(bounds.max.y);
        }

        Some(Bounds::new(
            Point::new(min_x, min_y),
            Point::new(max_x, max_y),
        ))
    }
}