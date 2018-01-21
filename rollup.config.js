import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-es';

const common = {
  input: 'src/index.js',
  plugins: [
    babel({
      babelrc: false,
      exclude: 'node_modules/**',
      presets: [
        [
          'env',
          {
            modules: false,
            targets: {
              node: '6'
            }
          }
        ],
        'flow',
        'stage-2'
      ],
      plugins: ['external-helpers'],
      runtimeHelpers: true
    }),
    commonjs(),
    resolve()
  ],
  external: ['fs', 'path']
};

export default [
  {
    ...common,
    output: {
      file: 'bin/dql.js',
      format: 'cjs'
    }
  },
  {
    ...common,
    output: {
      file: 'bin/dql.min.js',
      format: 'cjs'
    },
    plugins: [...common.plugins, uglify({}, minify)]
  }
];
