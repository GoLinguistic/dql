// @flow
import Processor from './Processor';
import QueryBuilder from '../util/QueryBuilder';
import Nodes from '../util/Nodes';
import Helpers from '../util/Helpers';
import JoinProcessor from './JoinProcessor';
import type { TableNode, Config, DocumentNode, FieldNode } from '../util/Types';

/**
 * QueryProcessor
 * ==============
 * Processes all query documents (the equivalent of a SELECT statement)
 */
class QueryProcessor extends Processor {
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
            orderBy: string,
            descending: boolean,
            groupBy: string
        }
    ) {
        // Get the name and parameters associated with the table
        const { name, params, nodes } = node;
        const { orderBy, descending, groupBy } = options;

        // From the parameters, create an operator tree and generate
        // an array of selector strings to use in the WHERE() call
        const selectors = params.map(x =>
            Helpers.buildOperationString(root, null, x, variables, [], this._qb)
        );

        // Initialize qb
        let qb = this._qb.select().from(name);

        // // Get all FIELD nodes and prepend the table name to their values
        let fields: FieldNode[] = nodes
            .filter(x => x.type === Nodes.FIELD)
            .map(x => ({
                ...x,
                name: `${name}.${x.name}`
            }));

        // Iterate through each field and add it to the QueryBuilder
        fields.forEach(field => {
            if (field.value)
                throw new Error(
                    'Values cannot be assigned to fields in a query document'
                );
            else if (field.alias) qb.field(field.name, field.alias);
            else qb.field(field.name);
        });

        // Iterate through each join and add it to the QueryBuilder
        qb = JoinProcessor(this._qb).process(root, node, variables, qb);

        // If the user has included selectors, add those too
        if (selectors.length > 0) {
            qb = qb.where(
                selectors.map(x => x.text).join(' AND '),
                ...selectors.map(x => x.variables).reduce((a, b) => a.concat(b))
            );
        }

        // Add grouping
        if (typeof groupBy !== 'undefined' && groupBy !== null)
            qb.group(groupBy);

        // Add order
        if (typeof orderBy !== 'undefined' && orderBy !== null)
            qb.order(orderBy, !descending);

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

        if (node.type !== Nodes.QUERY)
            throw new Error(
                'Only a query document node can be passed to a QueryProcessor'
            );

        req_var.forEach(v => {
            if (!variables || !variables.hasOwnProperty(v)) {
                throw new Error(`Missing required variable ${v}`);
            }
        });

        const tables = nodes.filter(x => x.type === Nodes.TABLE);

        if (tables.length < 1)
            throw new Error('Query must contain at least one table');

        tables.forEach(table => {
            qb = this._processTable(root, table, variables || {}, options);
        });

        return qb;
    }
}

export default (flavor: string) => new QueryProcessor(QueryBuilder(flavor));
