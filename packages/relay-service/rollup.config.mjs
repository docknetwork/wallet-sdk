import json from '@rollup/plugin-json';
import _multiInput from 'rollup-plugin-multi-input';

const multiInput = _multiInput.default || _multiInput;
import commonjs from '@rollup/plugin-commonjs';
import {terser} from 'rollup-plugin-terser';
import flow from 'rollup-plugin-flow';
import {babel} from '@rollup/plugin-babel';

const presets = ['@babel/preset-env'];

export default async function () {
  return [
    {
      presets,
      plugins: [multiInput(), json(), babel({ babelHelpers: 'bundled' }), flow({all: true}), commonjs()],
      input: ['src/**/*.js', '!src/**/*.test.js'],
      output: [
        {
          dir: 'lib',
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        {
          dir: 'lib',
          format: 'esm',
          entryFileNames: '[name].mjs',
        },
      ],
    },
  ];
}
