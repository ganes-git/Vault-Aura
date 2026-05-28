import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Absolute relative resolution for GitHub Pages
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false
  }
});
