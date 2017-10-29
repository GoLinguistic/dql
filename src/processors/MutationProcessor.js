// @flow
import Processor from './Processor';
import QueryBuilder from '../util/QueryBuilder';
import Nodes from '../util/Nodes';
import Helpers from '../util/Helpers';
import type { TableNode, Config, DocumentNode, FieldNode } from '../util/Types';

/**
 * MutationProcessor
 * ==============
 * Processes all mutation documents (the equivalent of an INSERT or UPDATE statement)
 */
class MutationProcessor extends Processor {
    _qb: QueryBuilder;

    /**
     * Adds fields from a table to a QueryBuilder object
     *
     * @param node          The table node
     * @param variables     Global variables
     * @param qb            The QueryBuilder
     * @private
     */
    _addTableFields(node: TableNode, variables: {}, qb: QueryBuilder) {
        const fields = Helpers.getFieldsFromTable(node);
        fields.forEach(field => {
            this._verifyField(field);

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
    }

    /**
     * Verifies a field to make sure it is valid for a mutation
     *
     * @param field     The field node
     * @returns {boolean}
     * @private
     */
    _verifyField(field: FieldNode) {
        if (field.alias) throw new Error('Aliases not allowed in mutations');
        else if (field.value === null)
            throw new Error(`Value required for field '${field.name}'`);
        else return true;
    }

    /**
     * Processed an INSERT statement
     *
     * @param root          The document root
     * @param node          The table node
     * @param variables     Global variables
     * @param options       Config object
     * @returns {QueryBuilder}
     * @private
     */
    _processInsert(
        root: DocumentNode[],
        node: TableNode,
        variables: {},
        options: {
            returning: string
        }
    ) {
        const { name } = node;
        const { returning } = options;
        let qb = this._qb.insert().into(name);

        this._addTableFields(node, variables, qb);

        if (returning) qb.returning(returning);

        return qb;
    }

    /**
     * Processes an UPDATE statement
     *
     * @param root          The document root
     * @param node          The table node
     * @param variables     Global variables
     * @param options       Config object
     * @returns {QueryBuilder}
     * @private
     */
    _processUpdate(
        root: DocumentNode[],
        node: TableNode,
        variables: {},
        options: {
            returning: string,
            orderBy: boolean,
            descending: boolean,
            limit: number
        }
    ) {
        const { name, params } = node;
        const { descending, orderBy, limit } = options;

        // From the parameters, create an operator tree and generate
        // an array of selector strings to use in the WHERE() call
        const selectors = params.map(x =>
            Helpers.buildFilterString(
                root,
                null,
                x,
                variables,
                [],
                this._qb.flavour
            )
        );

        // Initialize the query builder
        let qb = this._qb.update().table(name);

        // Iterate through each field and add it to the QueryBuilder
        this._addTableFields(node, variables, qb);

        // Include selectors
        qb = qb.where(
            selectors.map(x => x.text).join(' AND '),
            ...selectors.map(x => x.variables).reduce((a, b) => a.concat(b))
        );

        // Add order
        if (typeof orderBy !== 'undefined' && orderBy !== null)
            qb.order(orderBy, !descending);

        // Add limit
        if (typeof limit !== 'undefined' && limit !== null) qb.limit(limit);

        return qb;
    }

    /**
     * Processes a table node
     *
     * @param root          The document root
     * @param node          The table node
     * @param variables     Global variables
     * @param options       Config object
     * @returns {QueryBuilder}
     * @private
     */
    _processTable(
        root: DocumentNode[],
        node: TableNode,
        variables: {},
        options: {
            returning: string,
            orderBy: boolean,
            descending: boolean,
            limit: number
        }
    ) {
        // Get the name and parameters associated with the table
        const { params, nodes } = node;

        if (nodes.filter(x => x.type === Nodes.JOIN).length > 0)
            throw new Error('Join statements are not allowed in mutations');

        let qb;

        // If we have selectors, then we're updating a row
        if (params.length > 0) {
            qb = this._processUpdate(root, node, variables, options);
        } else {
            qb = this._processInsert(root, node, variables, options);
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
