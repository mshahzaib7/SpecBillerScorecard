/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { legacySafeCss } from './build/legacyCss';

/** Oldest browsers the site must work on (JS syntax and CSS are lowered to these). */
const TARGETS = ['es2020', 'safari14', 'chrome87'];

/** Build only: rewrites the final CSS so Safari 14 / Chrome 87 read every rule (see build/legacyCss.ts). */
function legacyCss(): Plugin {
  return {
    name: 'legacy-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          file.source = legacySafeCss(String(file.source));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), legacyCss()],
  build: {
    target: TARGETS,
    cssTarget: TARGETS,
  },
  test: {
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
    environment: 'node',
  },
});
