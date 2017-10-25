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
            exclude: 'node_modules/**'
        }),
        commonjs(),
        resolve()
        // uglify({}, minify)
    ],
    external: ['fs', 'path']
};
