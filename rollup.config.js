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

const plugins = [
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
];

const devConfig = [{
  input: 'e2e/main.import.js',
  output: { format: 'es', dir: 'e2e/public/assets' },
  plugins
}, {
  input: 'e2e/main.routers.js',
  output: [
    bundle('e2e/public/assets/main.routers.js', 'iife'),
  ],
  plugins
}, {
  input: 'e2e/main.js',
  output: [
    bundle('e2e/public/assets/main.js', 'iife'),
  ],
  plugins,
}];

const prodConfig = [{
  input: 'src/index.js',
  output: [
    bundle(pkg.main, 'cjs'),
    bundle(pkg.module, 'es'),
  ],
  plugins,
}];

export default [...(isProd ? prodConfig : devConfig)];
