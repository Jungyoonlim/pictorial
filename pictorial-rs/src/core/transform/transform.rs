use crate::math::{Point, Matrix3, Bounds, Vector2};
use std::collections::HashMap;

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

pub struct Handle { 
    pub handle_type: HandleType,
    pub position: Point, 
    pub bounds: Bounds,
}

#[derive(Debug, Clone, Copy)]
pub enum ConstaintType { 
    SnapToGrid,
    SnapToObject,
    MaintainAspectRatio,
    LockRotation,
    LockScale,
}

pub struct Constraint {
    pub constraint_Type: ConstaintType,
    pub enabled: bool,
}

pub struct AlignmentGuide { 
    pub id: u32,
    pub orientation: Orientation,
    pub position: f32, 
    pub element_ids: Vec<u32>,
}

#[derivce(Debug, Clone, Copy)]
pub enum Orientation { 
    Horizontal,
    Vertical,
}

pub struct TransformEngine { 
    grid_size: f32, 
    snap_threshold: f32, 
    constraints: HashMap<ConstraintType, Constraint>,
    active_guides: Vec<AlignmentGuide>, 
    current_transform: Option<TransformSession>,
}

struct TransformSession { 
    element_ids: Vec<u32>,
    start_point: Point, 
    origin: Point, 
    handle_type: HandleType,
    initial_states: HashMap<u32, ElementState>,
}

#[derive(Clone)]
struct ElementState {
    transform: Matrix3, 
    bounds: Bounds,
}

impl TransformEngine { 
    pub fn new() -> Self { 
        let mut 
    }
}