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

