import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react({
        // Enable React Fast Refresh optimizations
        fastRefresh: true,
        // Exclude node_modules from babel transformation for performance
        exclude: /node_modules/,
        // Enable automatic JSX runtime
        jsxRuntime: 'automatic'
      }),
      
      // Bundle analyzer for production builds
      ...(mode === 'production' ? [
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true
        })
      ] : [])
    ],
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@stores': resolve(__dirname, 'src/stores'),
        '@core': resolve(__dirname, 'src/core'),
        '@workers': resolve(__dirname, 'src/workers'),
        '@utils': resolve(__dirname, 'src/utils')
      }
    },
    
    // Development server configuration
    server: {
      port: 3000,
      host: true, // Allow external connections
      cors: true,
      // Proxy for API calls if needed
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    
    // Preview server configuration
    preview: {
      port: 4173,
      host: true
    },
    
    // Build optimizations
    build: {
      target: 'es2020', // Modern target for better performance
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: 'terser', // Better minification than esbuild
      
      // Chunk splitting strategy
      rollupOptions: {
        output: {
          manualChunks: {
            // React and core dependencies
            'vendor-react': ['react', 'react-dom'],
            
            // Animation libraries
            'vendor-animation': ['framer-motion', 'react-spring'],
            
            // State management
            'vendor-state': ['mobx', 'mobx-react-lite', 'immer'],
            
            // Color processing
            'vendor-color': ['chroma-js', 'culori', 'd3-color'],
            
            // UI utilities
            'vendor-ui': ['react-window', '@tanstack/react-virtual'],
            
            // AI/ML libraries (lazy loaded)
            'vendor-ai': ['onnxruntime-web', '@tensorflow/tfjs'],
            
            // 3D graphics (lazy loaded)
            'vendor-3d': ['@react-three/fiber', '@react-three/drei']
          },
          
          // File naming strategy
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
            if (facadeModuleId) {
              if (facadeModuleId.includes('worker')) {
                return 'workers/[name]-[hash].js'
              }
              if (facadeModuleId.includes('vendor')) {
                return 'vendor/[name]-[hash].js'
              }
            }
            return 'chunks/[name]-[hash].js'
          },
          
          entryFileNames: 'entry/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      
      // Terser options for better compression
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.debug'] : []
        },
        mangle: {
          safari10: true
        }
      },
      
      // Asset handling
      assetsInlineLimit: 4096, // 4kb limit for inlining
      
      // CSS code splitting
      cssCodeSplit: true,
      
      // Modern build options
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000 // Warn for chunks > 1MB
    },
    
    // Dependency optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'mobx',
        'mobx-react-lite',
        'chroma-js',
        'culori',
        'framer-motion'
      ],
      exclude: [
        // Exclude heavy dependencies from pre-bundling
        'onnxruntime-web',
        '@tensorflow/tfjs',
        '@react-three/fiber'
      ]
    },
    
    // Worker configuration
    worker: {
      format: 'es', // Use ES modules for workers
      plugins: () => [
        react() // Apply React plugin to workers too
      ]
    },
    
    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __DEV__: JSON.stringify(mode === 'development')
    },
    
    // CSS configuration
    css: {
      devSourcemap: true,
      preprocessorOptions: {
        scss: {
          additionalData: `
            @import "@/styles/variables.scss";
            @import "@/styles/mixins.scss";
          `
        }
      },
      modules: {
        localsConvention: 'camelCase'
      }
    },
    
    // Performance configurations
    esbuild: {
      target: 'es2020',
      logOverride: {
        'this-is-undefined-in-esm': 'silent'
      }
    }
  }
}) 