import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  timeout: 60_000,
  // One page at a time: software WebGL is slow, and parallel pages starve each other of frames.
  workers: 1,
  use: {
    baseURL: 'http://localhost:5181',
    viewport: { width: 1280, height: 720 },
    // Software WebGL so headless runs work without a GPU.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5181 --strictPort',
    url: 'http://localhost:5181',
    reuseExistingServer: false,
  },
});
