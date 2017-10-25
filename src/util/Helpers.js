// Flow has to ignore this file because of the recursion in builderOperationStringHelper()
import Nodes from './Nodes';
import QueryProcessor from '../processors/QueryProcessor';

function resolveVariable(variable, variables) {
    const v = variables[variable];

    if (typeof v === 'undefined')
        throw new Error(`Could not find variable: ${variable}`);

    return v;
}

/**
 * Builds a string from the operator tree found in selector blocks (inside parens)
 *
 * @param root          Root of the document
 * @param table         Name of table the operation is associated with
 * @param node          Base node of operator tree
 * @param variables     Variables passed to the query
 * @param left_side     Boolean denoting whether the node is on the left site of an operator
 * @returns {*}
 */
function buildOperationStringHelper(
    root,
    table,
    node,
    variables,
    params,
    left_side,
    aliases,
    qb
) {
    // If the node is an operation
    if (node.type === Nodes.OPERATION) {
        const a = node.a;
        const op = node.op;
        const b = node.b;

        // Recurse on both sides of the operand
        const a_bos = buildOperationStringHelper(
            root,
            table,
            a,
            variables,
            params,
            true,
            aliases,
            qb
        );

        const b_bos = buildOperationStringHelper(
            root,
            null,
            b,
            variables,
            params,
            false,
            aliases,
            qb
        );

        // We return text and variables separately to allow Squel
        // to sanitize the input
        return {
            text: `${a_bos.text} ${op} ${b_bos.text}`,
            variables: [...a_bos.variables, ...b_bos.variables]
        };
    } else if (node.type === Nodes.VARIABLE) {
        // If the node is a $variable
        // Resolve any variable node and return the object
        // The text just becomes '?', which tells Squel where
        // to interpolate the variable
        return {
            text: '?',
            variables: [resolveVariable(node.value, variables)]
        };
    } else if (node.type === Nodes.BUILT_IN) {
        // If the node is a built-in SQL function such as INTERVAL
        // Return built-in SQL operations as is
        // They're not special
        return {
            text: node.value,
            variables: []
        };
    } else if (node.type === Nodes.QUERY_CALL) {
        // If the node is a call to a neighboring query
        // Locate the query
        const target_query = root.filter(
            x => x.type === 'QUERY' && x.name === node.name
        )[0];

        if (typeof target_query === 'undefined')
            throw new Error(`Could not find query '${node.name}`);

        // Extract the required variables in the query declaration
        const { variables: tq_variables } = target_query;

        // Initialize a map of variables
        const vmap = {};

        // For each of the required variables
        tq_variables.forEach((v, index) => {
            const param = node.params[index];

            // If the param passed at the end of that variable is itself
            // a variable, resolve it before passing it in
            if (param.type === Nodes.VARIABLE) {
                vmap[v] = resolveVariable(param.value, variables);
            } else
                // Otherwise just pass in the param
                vmap[v] = param.value;
        });

        // Return the object and process the call
        return {
            text: '?',
            variables: [
                QueryProcessor(qb.flavour).process(root, target_query, {
                    variables: vmap
                })
            ]
        };
    } else if (left_side) {
        return {
            text:
                table !== null
                    ? typeof aliases[node.value] !== 'undefined'
                      ? node.alias
                      : `${table}.${node.value}`
                    : node.value,
            variables: []
        };
    } else {
        // Assume anything else is a field, and prepend
        // the table name if one is available
        return {
            text: '?',
            variables: [
                table !== null
                    ? typeof aliases[node.value] !== 'undefined'
                      ? node.alias
                      : `${table}.${node.value}`
                    : node.value
            ]
        };
    }
}

class Helpers {
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
    static buildOperationString(root, table, node, variables, aliases, qb) {
        // console.log(arguments);
        return buildOperationStringHelper(
            root,
            table,
            node,
            variables,
            [],
            false,
            aliases || {},
            qb
        );
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
