#!/bin/bash

# Build script for compiling Rust to WebAssembly

echo "Building Pictorial Rust to WebAssembly..."

# Install wasm-pack if not already installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for web target
wasm-pack build --target web --out-dir ../pkg --out-name pictorial-rs

# Build for bundler target (for webpack/vite)
wasm-pack build --target bundler --out-dir ../pkg-bundler --out-name pictorial-rs

echo "Build complete! WebAssembly files generated in:"
echo "  - pkg/ (for web)"
echo "  - pkg-bundler/ (for bundlers like Vite)"

# Copy to your main project's node_modules or src directory
if [ -d "../node_modules/@pictorial/core" ]; then
    echo "Copying to node_modules..."
    cp -r pkg/* ../node_modules/@pictorial/core/
fi 