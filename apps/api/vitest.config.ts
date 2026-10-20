import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { testEnv } from './test/support/test-env.js';

export default defineConfig({
  // SWC emite os metadados de decorators que a injeção de dependência do Nest exige.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    env: testEnv(),
    globalSetup: ['test/support/global-setup.ts'],
    // Os testes e2e compartilham o mesmo banco: um arquivo por vez.
    fileParallelism: false,
    // Um teste ou hook travado (ex.: Redis sem responder) falha rápido em vez de ficar pendurado.
    testTimeout: 15_000,
    hookTimeout: 20_000,
    teardownTimeout: 10_000,
  },
});
