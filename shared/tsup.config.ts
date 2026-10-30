import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  // Keep the previous build while rebuilding: cleaning deletes index.d.ts for a few seconds
  // (JS is emitted before DTS) and the editor's TS server reports TS7016 on @palmsight/shared.
  clean: false,
  splitting: false,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
});
