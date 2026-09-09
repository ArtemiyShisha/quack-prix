import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quack-prix-play';

export default defineConfig({
  base: `${basePath}/`,
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  define: { 'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(basePath) },
  build: { outDir: 'dist/pages', emptyOutDir: true, sourcemap: false },
});
