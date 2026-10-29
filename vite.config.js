import { defineConfig } from 'vite';

// Relative paths, so the same build works at a site's root and under a sub-path (GitHub Pages
// serves the app at /<repo>/).
export default defineConfig({
  base: './',
});
