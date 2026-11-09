/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
// QA-only config: runs the tests in qa/ without touching the project's own test setup.
export default defineConfig({ test: { include: ['qa/**/*.test.ts'], environment: 'node' } });
