import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const pkg = require('./package.json');

const isDev = process.env.ROLLUP_WATCH;
const isProd = process.env.NODE_ENV === 'production';

function bundle(file, format) {
  return {
    sourcemap: false,
    name: pkg.name,
    format,
    file,
  };
}

export default {
  input: isProd ? 'src/index.js' : 'e2e/main.js',
  output: isProd ? [
    bundle(pkg.main, 'cjs'),
    bundle(pkg.module, 'es'),
    bundle(pkg.browser, 'umd'),
  ] : bundle('e2e/public/test.js', 'iife'),
  external: isProd ? ['svelte', 'svelte/store', 'svelte/internal'] : [],
  plugins: [
    svelte({
      dev: isDev,
    }),
    resolve(),
    commonjs(),
    isProd && terser(),
  ],
};
