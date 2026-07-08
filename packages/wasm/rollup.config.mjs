import json from '@rollup/plugin-json';
import _multiInput from 'rollup-plugin-multi-input';
import commonjs from '@rollup/plugin-commonjs';
import flow from 'rollup-plugin-flow';
import typescript from '@rollup/plugin-typescript';

const multiInput = _multiInput.default || _multiInput;

export default async function () {
  return [
    {
      plugins: [
        multiInput(),
        json(),
        flow({
          all: true,
          include: 'src/**/*.js',
        }),
        commonjs(),
        typescript(),
      ],
      input: ['src/**/*.ts', 'src/**/*.js', '!src/**/*.test.ts', '!src/**/*.test.js', '!src/**/*.d.ts'],
      external: ['assert', 'node-localstorage'],
      output: [
        {
          dir: 'lib',
          format: 'cjs',
          entryFileNames: '[name].js'
        },
        {
          dir: 'lib',
          format: 'esm',
          entryFileNames: '[name].mjs'
        },
      ],
    },
  ];
}
