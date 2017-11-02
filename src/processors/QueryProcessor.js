// @flow
import Processor from './Processor';
import QueryBuilder from '../util/QueryBuilder';
import Nodes from '../util/Nodes';
import Helpers from '../util/Helpers';
import JoinProcessor from './JoinProcessor';
import type { TableNode, Config, DocumentNode } from '../util/Types';

/**
 * QueryProcessor
 * ==============
 * Processes all query documents (the equivalent of a SELECT statement)
 */
class QueryProcessor extends Processor {
    _qb: QueryBuilder;

    /**
     * Adds fields from a table to a QueryBuilder object
     *
     * @param node          The table node
     * @param variables     Global variables
     * @param qb            The QueryBuilder
     * @private
     */
    _addTableFields(node: TableNode, qb: QueryBuilder) {
        const fields = Helpers.getFieldsFromNode(node);
        // Iterate through each field and add it to the QueryBuilder
        fields.forEach(field => {
            if (field.value)
                throw new Error(
                    'Values cannot be assigned to fields in a query document'
                );
            else if (field.alias) qb.field(field.name, field.alias);
            else qb.field(field.name);
        });
    }

    /**
     * Adds configuration options to a QueryBuilder object
     *
     * @param options   Options object
     * @param qb        QueryBuilder
     * @private
     */
    _addConfigOptions(options: Config, qb: QueryBuilder) {
        const { orderBy, descending, groupBy, limit, offset } = options;
        const exists = obj => typeof obj !== 'undefined' && obj !== null;

        // Add grouping
        if (exists(groupBy)) qb.group(groupBy);

        // Add sorting
        if (exists(orderBy)) qb.order(orderBy, !descending);

        // Add offset
        if (exists(offset)) qb.offset(offset);

        // Add limit
        if (exists(limit)) qb.limit(limit);
    }

    /**
     * Processes a table node
     *
     * @param qb            The QueryBuilder object
     * @param docroot          The docroot of the document (contains all queries, mutations, etc.)
     * @param node          The table node to process
     * @param variables     All variables passed to the query
     * @returns {qb}
     * @private
     */
    _processTable(
        docroot: DocumentNode[],
        node: TableNode,
        variables: {},
        options: Config
    ) {
        // Get the name and parameters associated with the table
        const { name } = node;

        // Initialize qb
        let qb = this._qb.select().from(name);

        // Add fields from table
        this._addTableFields(node, qb);

        // Iterate through each join and add it to the QueryBuilder
        qb = JoinProcessor(this._qb).process(docroot, node, variables, qb);

        // Apply a WHERE statement if applicable
        Helpers.applyWhereStatement(docroot, node, variables, qb);

        this._addConfigOptions(options, qb);

        return qb;
    }

    /**
     * Processes a query document
     *
     * @param docroot          docroot of the document
     * @param node          Query node
     * @param variables     Global variables
     * @returns {QueryBuilder}
     */
    process(
        docroot: DocumentNode[],
        node: DocumentNode,
        config: Config,
        qb: QueryBuilder = this._qb
    ): QueryBuilder {
        const { variables: req_var, nodes } = node;
        let { variables, ...options } = config;

        // Clone the variables
        variables = Object.assign({}, variables);

        if (node.type !== Nodes.QUERY)
            throw new Error(
                'Only a query document node can be passed to a QueryProcessor'
            );

        req_var.forEach(v => {
            if (variables && variables.hasOwnProperty(v.name)) {
                variables[v.name] = {
                    value: variables[v.name],
                    required: v.required
                };
            } else {
                if (v.required)
                    throw new Error(`Missing required variable ${v.name}`);
            }
        });
        const tables = nodes.filter(x => x.type === Nodes.TABLE);

        if (tables.length < 1)
            throw new Error('Query must contain at least one table');

        tables.forEach(table => {
            qb = this._processTable(docroot, table, variables || {}, options);
        });

        return qb;
    }
}

export default (flavor: string) => new QueryProcessor(QueryBuilder(flavor));
