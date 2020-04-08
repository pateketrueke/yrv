import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import buble from 'rollup-plugin-buble';
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
  ] : { format: 'es', dir: 'e2e/public/assets' },
  plugins: [
    svelte({
      dev: isDev,
    }),
    resolve(),
    commonjs(),
    replace({
      USE_HASH_CHANGE: JSON.stringify(!!process.env.HASHCHANGE),
    }),
    isProd && buble({
      objectAssign: 'Object.assign',
      transforms: { dangerousForOf: true },
    }),
    isProd && terser(),
  ],
};
