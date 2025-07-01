use wasm_bindgen::prelude::*;

// Import core modules
pub mod core {
    pub mod vector;
    pub mod transform;
    pub mod color;
    pub mod rendering;
    pub mod ai;
    pub mod collaboration;
    pub mod layer;
    pub mod performance;
    pub mod text;
    pub mod tools;
    pub mod events;
    pub mod commands;
}

pub mod components;
pub mod stores;
pub mod utils;
pub mod workers;

// Re-export commonly used types for JavaScript
pub use core::vector::*;
pub use core::transform::*;

// Initialize the console error panic hook for better debugging
#[wasm_bindgen(start)]
pub fn main() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Example function to verify WebAssembly is working
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Rust is running in WebAssembly.", name)
}

// High-level API for the vector graphics engine
#[wasm_bindgen]
pub struct PictorialEngine {
    transform_engine: core::transform::TransformEngine,
}

#[wasm_bindgen]
impl PictorialEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PictorialEngine {
        PictorialEngine {
            transform_engine: core::transform::TransformEngine::new(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn transform_engine(&self) -> core::transform::TransformEngine {
        // Note: This clone might be expensive, consider using references or Arc<Mutex<>> for shared state
        self.transform_engine.clone()
    }
}

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
