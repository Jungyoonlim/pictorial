use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[wasm_bindgen]
impl Point {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64) -> Point {
        Point { x, y }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f64 {
        self.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f64 {
        self.y
    }

    #[wasm_bindgen(setter)]
    pub fn set_x(&mut self, x: f64) {
        self.x = x;
    }

    #[wasm_bindgen(setter)]
    pub fn set_y(&mut self, y: f64) {
        self.y = y;
    }

    pub fn distance_to(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }

    pub fn add(&self, other: &Point) -> Point {
        Point {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }

    pub fn subtract(&self, other: &Point) -> Point {
        Point {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }

    pub fn scale(&self, factor: f64) -> Point {
        Point {
            x: self.x * factor,
            y: self.y * factor,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[wasm_bindgen]
impl BoundingBox {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> BoundingBox {
        BoundingBox { x, y, width, height }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f64 {
        self.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f64 {
        self.y
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> f64 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> f64 {
        self.height
    }

    pub fn center(&self) -> Point {
        Point {
            x: self.x + self.width / 2.0,
            y: self.y + self.height / 2.0,
        }
    }

    pub fn contains_point(&self, point: &Point) -> bool {
        point.x >= self.x 
            && point.x <= self.x + self.width 
            && point.y >= self.y 
            && point.y <= self.y + self.height
    }

    pub fn intersects(&self, other: &BoundingBox) -> bool {
        !(self.x + self.width < other.x 
            || other.x + other.width < self.x 
            || self.y + self.height < other.y 
            || other.y + other.height < self.y)
    }

    pub fn union(&self, other: &BoundingBox) -> BoundingBox {
        let min_x = self.x.min(other.x);
        let min_y = self.y.min(other.y);
        let max_x = (self.x + self.width).max(other.x + other.width);
        let max_y = (self.y + self.height).max(other.y + other.height);
        
        BoundingBox {
            x: min_x,
            y: min_y,
            width: max_x - min_x,
            height: max_y - min_y,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Transform {
    pub translate_x: f64,
    pub translate_y: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub rotation: f64,
    pub skew_x: f64,
    pub skew_y: f64,
}

#[wasm_bindgen]
impl Transform {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Transform {
        Transform::identity()
    }

    pub fn identity() -> Transform {
        Transform {
            translate_x: 0.0,
            translate_y: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
            rotation: 0.0,
            skew_x: 0.0,
            skew_y: 0.0,
        }
    }

    pub fn translate(x: f64, y: f64) -> Transform {
        Transform {
            translate_x: x,
            translate_y: y,
            ..Transform::identity()
        }
    }

    pub fn scale(sx: f64, sy: f64) -> Transform {
        Transform {
            scale_x: sx,
            scale_y: sy,
            ..Transform::identity()
        }
    }

    pub fn rotate(angle: f64) -> Transform {
        Transform {
            rotation: angle,
            ..Transform::identity()
        }
    }

    pub fn compose(&self, other: &Transform) -> Transform {
        // Simplified composition - would need proper matrix math for full accuracy
        Transform {
            translate_x: self.translate_x + other.translate_x,
            translate_y: self.translate_y + other.translate_y,
            scale_x: self.scale_x * other.scale_x,
            scale_y: self.scale_y * other.scale_y,
            rotation: self.rotation + other.rotation,
            skew_x: self.skew_x + other.skew_x,
            skew_y: self.skew_y + other.skew_y,
        }
    }

    pub fn transform_point(&self, point: &Point) -> Point {
        let cos_r = self.rotation.cos();
        let sin_r = self.rotation.sin();
        
        // Apply scale
        let scaled_x = point.x * self.scale_x;
        let scaled_y = point.y * self.scale_y;
        
        // Apply rotation
        let rotated_x = scaled_x * cos_r - scaled_y * sin_r;
        let rotated_y = scaled_x * sin_r + scaled_y * cos_r;
        
        // Apply translation
        Point {
            x: rotated_x + self.translate_x,
            y: rotated_y + self.translate_y,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BezierCurve {
    pub start: Point,
    pub control1: Point,
    pub control2: Point,
    pub end: Point,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PathSegment {
    #[serde(rename = "move")]
    Move { point: Point },
    #[serde(rename = "line")]
    Line { point: Point },
    #[serde(rename = "curve")]
    Curve { curve: BezierCurve },
    #[serde(rename = "arc")]
    Arc { 
        center: Point, 
        radius: f64, 
        start_angle: f64, 
        end_angle: f64,
        clockwise: bool 
    },
    #[serde(rename = "close")]
    Close,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VectorPath {
    pub id: String,
    pub segments: Vec<PathSegment>,
    pub closed: bool,
    pub fill_color: Option<String>,
    pub stroke_color: Option<String>,
    pub stroke_width: Option<f64>,
    pub opacity: Option<f64>,
}

impl VectorPath {
    pub fn new() -> Self {
        VectorPath {
            id: Uuid::new_v4().to_string(),
            segments: Vec::new(),
            closed: false,
            fill_color: None,
            stroke_color: None,
            stroke_width: None,
            opacity: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FillType {
    #[serde(rename = "solid")]
    Solid { color: String },
    #[serde(rename = "gradient")]
    Gradient {
        gradient_type: GradientType,
        stops: Vec<ColorStop>,
        angle: Option<f64>,
    },
    #[serde(rename = "pattern")]
    Pattern {
        url: String,
        repeat: PatternRepeat,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GradientType {
    Linear,
    Radial,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PatternRepeat {
    Repeat,
    NoRepeat,
    RepeatX,
    RepeatY,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColorStop {
    pub offset: f64,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineCap {
    Butt,
    Round,
    Square,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineJoin {
    Miter,
    Round,
    Bevel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Stroke {
    pub color: String,
    pub width: f64,
    pub dash_array: Option<Vec<f64>>,
    pub line_cap: LineCap,
    pub line_join: LineJoin,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Shadow {
    pub offset_x: f64,
    pub offset_y: f64,
    pub blur: f64,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Style {
    pub fill: Option<FillType>,
    pub stroke: Option<Stroke>,
    pub shadow: Option<Shadow>,
    pub opacity: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum VectorElement {
    #[serde(rename = "path")]
    Path {
        id: String,
        transform: Transform,
        style: Style,
        bounding_box: BoundingBox,
        visible: bool,
        locked: bool,
        z_index: i32,
        path: VectorPath,
        parent: Option<String>,
    },
    #[serde(rename = "shape")]
    Shape {
        id: String,
        transform: Transform,
        style: Style,
        bounding_box: BoundingBox,
        visible: bool,
        locked: bool,
        z_index: i32,
        shape: VectorShape,
        parent: Option<String>,
    },
    #[serde(rename = "text")]
    Text {
        id: String,
        transform: Transform,
        style: Style,
        bounding_box: BoundingBox,
        visible: bool,
        locked: bool,
        z_index: i32,
        text: VectorText,
        parent: Option<String>,
    },
    #[serde(rename = "group")]
    Group {
        id: String,
        transform: Transform,
        style: Style,
        bounding_box: BoundingBox,
        visible: bool,
        locked: bool,
        z_index: i32,
        children: Vec<String>,
        parent: Option<String>,
    },
}

impl VectorElement {
    pub fn id(&self) -> &str {
        match self {
            VectorElement::Path { id, .. } => id,
            VectorElement::Shape { id, .. } => id,
            VectorElement::Text { id, .. } => id,
            VectorElement::Group { id, .. } => id,
        }
    }

    pub fn transform(&self) -> &Transform {
        match self {
            VectorElement::Path { transform, .. } => transform,
            VectorElement::Shape { transform, .. } => transform,
            VectorElement::Text { transform, .. } => transform,
            VectorElement::Group { transform, .. } => transform,
        }
    }

    pub fn bounding_box(&self) -> &BoundingBox {
        match self {
            VectorElement::Path { bounding_box, .. } => bounding_box,
            VectorElement::Shape { bounding_box, .. } => bounding_box,
            VectorElement::Text { bounding_box, .. } => bounding_box,
            VectorElement::Group { bounding_box, .. } => bounding_box,
        }
    }

    pub fn is_visible(&self) -> bool {
        match self {
            VectorElement::Path { visible, .. } => *visible,
            VectorElement::Shape { visible, .. } => *visible,
            VectorElement::Text { visible, .. } => *visible,
            VectorElement::Group { visible, .. } => *visible,
        }
    }

    pub fn is_locked(&self) -> bool {
        match self {
            VectorElement::Path { locked, .. } => *locked,
            VectorElement::Shape { locked, .. } => *locked,
            VectorElement::Text { locked, .. } => *locked,
            VectorElement::Group { locked, .. } => *locked,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "shape_type")]
pub enum VectorShape {
    #[serde(rename = "rectangle")]
    Rectangle { width: f64, height: f64 },
    #[serde(rename = "circle")]
    Circle { radius: f64 },
    #[serde(rename = "ellipse")]
    Ellipse { radius_x: f64, radius_y: f64 },
    #[serde(rename = "polygon")]
    Polygon { points: Vec<Point> },
    #[serde(rename = "star")]
    Star { 
        sides: u32, 
        outer_radius: f64, 
        inner_radius: f64 
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FontWeight {
    Normal,
    Bold,
    W100,
    W200,
    W300,
    W400,
    W500,
    W600,
    W700,
    W800,
    W900,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FontStyle {
    Normal,
    Italic,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TextAlign {
    Left,
    Center,
    Right,
    Justify,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VectorText {
    pub content: String,
    pub font_family: String,
    pub font_size: f64,
    pub font_weight: FontWeight,
    pub font_style: FontStyle,
    pub text_align: TextAlign,
    pub letter_spacing: f64,
    pub line_height: f64,
    pub path: Option<VectorPath>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Selection {
    pub elements: Vec<String>,
    pub bounds: BoundingBox,
    pub transform: Transform,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GridSettings {
    pub enabled: bool,
    pub size: f64,
    pub color: String,
    pub opacity: f64,
    pub snap: bool,
}

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
    pub width: f64,
    pub height: f64,
}

#[wasm_bindgen]
impl Viewport {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, zoom: f64, width: f64, height: f64) -> Viewport {
        Viewport { x, y, zoom, width, height }
    }

    pub fn pan(&mut self, dx: f64, dy: f64) {
        self.x += dx;
        self.y += dy;
    }

    pub fn zoom_at(&mut self, zoom_factor: f64, center: &Point) {
        let old_zoom = self.zoom;
        self.zoom *= zoom_factor;
        
        // Adjust position to zoom towards the center point
        self.x = center.x - (center.x - self.x) * (self.zoom / old_zoom);
        self.y = center.y - (center.y - self.y) * (self.zoom / old_zoom);
    }

    pub fn screen_to_world(&self, screen_point: &Point) -> Point {
        Point {
            x: (screen_point.x / self.zoom) + self.x,
            y: (screen_point.y / self.zoom) + self.y,
        }
    }

    pub fn world_to_screen(&self, world_point: &Point) -> Point {
        Point {
            x: (world_point.x - self.x) * self.zoom,
            y: (world_point.y - self.y) * self.zoom,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HistoryItem {
    pub id: String,
    pub timestamp: u64,
    pub action: String,
    pub data: serde_json::Value,
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CollaborationCursor {
    pub user_id: String,
    pub user_name: String,
    pub color: String,
    pub position: Point,
    pub tool: String,
} 