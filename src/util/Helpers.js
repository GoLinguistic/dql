// Flow has to ignore this file because of the recursion in builderOperationStringHelper()
import Nodes from './Nodes';
import FilterString from './FilterString';

class Helpers {
    /**
     * Gets all the fields from a table node
     *
     * @param node  Table node
     * @private
     */
    static getFieldsFromTable(node) {
        const { name, nodes } = node;

        return nodes.filter(x => x.type === Nodes.FIELD).map(x => ({
            ...x,
            name: `${name}.${x.name}`
        }));
    }

    /**
     * Returns anything that can be identified as a "field" in an operator tree
     * Careful – any text that doesn't conform to a set grammar can be identified as a field
     * Better to keep your selectors simple for now
     *
     * @param node          Base node of operator tree
     * @param variables     Variables passed to query
     * @param initial       Initial array to add values to
     * @returns {*}
     */
    static getFieldsFromOperationString(node, variables, initial) {
        if (node.type === Nodes.OPERATION) {
            const a = node.a;

            initial = [
                ...initial,
                ...this.getFieldsFromOperationString(a, variables, initial)
            ];

            return initial;
        } else if (node.type === Nodes.VARIABLE) {
            return [variables[node]];
        } else {
            return [node];
        }
    }

    /**
     * Gets the whole recursion thing for buildOperationStringHelper going
     * @param root
     * @param table
     * @param node
     * @param variables
     * @returns {{text, variables}}
     */
    static buildFilterString(root, table, node, variables, aliases, flavor) {
        return new FilterString(
            root,
            table,
            node,
            variables,
            aliases,
            flavor
        ).toString();
    }

    /**
     * Interpolates variables into strings using '?' like Squel does
     *
     * @param string        String containing '?''s
     * @param variables     Array of variables
     * @returns {*}
     */
    static interpolateVariables(string, variables) {
        const regex = /(\s+\?\s+)|(^\?\s+)|(\s+\?$)/g;

        let iterator = 0;
        let last_index = 0;
        let message = '';
        let match = regex.exec(string);

        if (match === null) return string;

        while (match !== null) {
            const v = variables[iterator];

            if (typeof v === 'undefined')
                throw new Error('Missing variable. Cannot interpolate.');

            message += `${string.substring(last_index, match.index)} ${v}`;
            last_index = match.index + (match.index === 0 ? 1 : 2);
            iterator++;
            match = regex.exec(string);
        }

        message += string.substring(last_index, string.length);

        return message;
    }
}

export default Helpers;
