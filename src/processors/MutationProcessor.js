// @flow
import Processor from './Processor';
import QueryBuilder from '../util/QueryBuilder';
import Nodes from '../util/Nodes';
import Helpers from '../util/Helpers';
import type {
    TableNode,
    Config,
    DocumentNode,
    MutationFieldNode
} from '../util/Types';

/**
 * MutationProcessor
 * ==============
 * Processes all mutation documents (the equivalent of an INSERT or UPDATE statement)
 */
class MutationProcessor extends Processor {
    _qb: QueryBuilder;

    /**
     * Processes a table block
     *
     * @param qb         The qb object
     * @param root          The root of the document (contains all queries, mutations, etc.)
     * @param node          The table node to process
     * @param variables     All variables passed to the query
     * @returns {qb}
     * @private
     */
    _processTable(
        root: DocumentNode[],
        node: TableNode,
        variables: {},
        options: {
            returning: string,
            orderBy: boolean,
            descending: boolean
        }
    ) {
        // Get the name and parameters associated with the table
        const { name, params, nodes } = node;
        const { returning, descending, orderBy } = options;

        // Method for throwing errors for invalid fields
        const verifyField = field => {
            if (field.alias)
                throw new Error('Aliases not allowed in mutations');
            else if (field.value === null)
                throw new Error(`Value required for field '${field.name}'`);
            else return true;
        };

        let qb;

        if (nodes.filter(x => x.type === Nodes.JOIN).length > 0)
            throw new Error('Join statements are not allowed in mutations');

        // Get all FIELD nodes and prepend the table name to their values
        let fields: MutationFieldNode[] = nodes
            .filter(x => x.type === Nodes.FIELD)
            .map(x => ({
                ...x,
                name: `${name}.${x.name}`
            }));

        // If we have selectors, then we're updating a row
        if (params.length > 0) {
            // From the parameters, create an operator tree and generate
            // an array of selector strings to use in the WHERE() call
            const selectors = params.map(x =>
                Helpers.buildOperationString(
                    root,
                    null,
                    x,
                    variables,
                    [],
                    this._qb
                )
            );

            // Initialize the query builder
            qb = this._qb.update().table(name);

            // Iterate through each field and add it to the QueryBuilder
            fields.forEach(field => {
                verifyField(field);

                if (
                    typeof field.value === 'object' &&
                    field.value.type === Nodes.VARIABLE
                ) {
                    const variable = field.value.value;
                    const val = variables[variable];

                    if (typeof val === 'undefined')
                        throw new Error(`Could not find variable: ${variable}`);
                    else qb.set(field.name, val);
                } else qb.set(field.name, field.value);
            });

            // Include selectors
            qb = qb.where(
                selectors.map(x => x.text).join(' AND '),
                ...selectors.map(x => x.variables).reduce((a, b) => a.concat(b))
            );

            // Add order
            if (typeof orderBy !== 'undefined' && orderBy !== null)
                qb.order(orderBy, !descending);
        } else {
            qb = this._qb.insert().into(name);

            // Iterate through each field and add it to the QueryBuilder
            fields.forEach(field => {
                verifyField(field);

                if (
                    typeof field.value === 'object' &&
                    field.value.type === Nodes.VARIABLE
                ) {
                    const variable = field.value.value;
                    const val = variables[variable];

                    if (typeof val === 'undefined')
                        throw new Error(`Could not find variable: ${variable}`);
                    else qb.set(field.name, val);
                } else qb.set(field.name, field.value);
            });

            if (returning) qb.returning(returning);
        }

        return qb;
    }

    /**
     * Processes a query document
     *
     * @param root          Root of the document
     * @param node          Query node
     * @param variables     Global variables
     * @returns {QueryBuilder}
     */
    process(
        root: DocumentNode[],
        node: DocumentNode,
        config: Config,
        qb: QueryBuilder = this._qb
    ): QueryBuilder {
        const { variables, ...options } = config;
        const { variables: req_var, nodes } = node;

        if (node.type !== Nodes.MUTATION)
            throw new Error(
                'Only a mutation document node can be passed to a MutationProcessor'
            );

        req_var.forEach(v => {
            if (!variables || !variables.hasOwnProperty(v)) {
                throw new Error(`Missing required variable ${v.toString()}`);
            }
        });

        const tables = nodes.filter(x => x.type === Nodes.TABLE);

        if (tables.length < 1)
            throw new Error('Mutations must contain at least one table');

        tables.forEach(table => {
            qb = this._processTable(root, table, variables || {}, options);
        });

        return qb;
    }
}

export default (flavor: string) => new MutationProcessor(QueryBuilder(flavor));
