import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-es';

export default {
    input: 'src/index.js',
    output: {
        file: 'bin/dql.js',
        format: 'cjs'
    },
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
                            node: '8'
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
        resolve(),
        uglify({}, minify)
    ],
    external: ['fs', 'path']
};
