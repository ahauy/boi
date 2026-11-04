import { join } from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Trùng TEST_TMP_DIR trong test/global-setup.ts. mongodb-memory-server tạo dữ liệu ở os.tmpdir().
const testTmpDir = join(__dirname, '.test-tmp');

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts', 'test/**/*.{spec,test}.ts'],
    passWithNoTests: true,
    fileParallelism: false,
    testTimeout: 20000,
    globalSetup: ['test/global-setup.ts'],
    env: { TEMP: testTmpDir, TMP: testTmpDir, TMPDIR: testTmpDir },
  },
});
