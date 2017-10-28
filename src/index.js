// @flow
import Nodes from './util/Nodes';

import parser from './_parser';

import QueryProcessor from './processors/QueryProcessor';
import MutationProcessor from './processors/MutationProcessor';

const dql = flavor =>
    function(strings: string[]) {
        const args = Array.from(arguments);
        const literals = args[0];

        // We always get literals[0] and then matching post literals for each arg given
        let result = typeof literals === 'string' ? literals : literals[0];

        // Interpolate all variables and get document string
        for (let i = 1; i < args.length; i++) {
            result += args[i];
            result += literals[i];
        }

        // Parse the string into a set of trees
        const trees = parser.parse(result);

        return function() {
            let name = null;
            let config = {};
            let as_string = false;

            switch (arguments.length) {
                case 1:
                    config = arguments[0];
                    break;
                case 2:
                    if (typeof arguments[0] === 'string') {
                        name = arguments[0];
                        config = arguments[1];
                    } else {
                        config = arguments[0];
                        as_string = arguments[1];
                    }
                    break;
                case 3:
                    name = arguments[0];
                    config = arguments[1];
                    as_string = arguments[2];
                    break;
            }

            const entry_index =
                name !== null
                    ? trees.findIndex(x => x.name === name)
                    : trees.length - 1;

            if (name !== null && entry_index < 0)
                throw new Error(`Could not find document \`${name}\``);

            const ast = trees[entry_index];

            let processed = null;

            switch (ast.type) {
                case Nodes.QUERY:
                    processed = QueryProcessor(flavor).process(
                        trees,
                        ast,
                        config
                    );
                    break;
                case Nodes.MUTATION:
                    processed = MutationProcessor(flavor).process(
                        trees,
                        ast,
                        config
                    );
                    break;
                default:
                    throw new Error('Unrecognized document type');
            }

            if (processed !== null)
                return as_string ? processed.toString() : processed.toParam();
            else throw new Error('An error occurred processing the document');
        };
    };

export const postgres = dql('postgres');
export const mysql = dql('mysql');
export const mssql = dql('mssql');
