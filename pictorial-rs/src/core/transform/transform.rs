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

