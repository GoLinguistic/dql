// @flow
import Processor from './Processor';
import Helpers from '../util/Helpers';
import Nodes from '../util/Nodes';
import type {
    TableNode,
    DocumentNode,
    FieldNode,
    JoinNode
} from '../util/Types';
import QueryBuilder from '../util/QueryBuilder';

type ProcessedJoin = {
    qb: QueryBuilder,
    table: string,
    fields: FieldNode[],
    on: string
};

class JoinProcessor extends Processor {
    /**
     * Applies fields to a QueryBuilder given an alias set
     *
     * @param qb        QueryBuilder object
     * @param fields    Collection of FIELD nodes
     * @param aliases   Array of defined aliases
     * @private
     */
    _applyFields(qb: QueryBuilder, fields: FieldNode[], aliases: string[]) {
        fields.forEach(field => {
            if (field.alias) {
                // Use an alias if one has already been defined for the field
                if (aliases.includes(field.alias)) qb.field(field.alias);
                else {
                    // Otherwise declare the alias and add it to our list of aliases
                    qb.field(field.name, field.alias);
                    aliases.push(field.alias);
                }
            } else
                // Or just add the value if there isn't an alias
                qb.field(field.name);
        });
    }

    /**
     *  Processes JOIN blocks and adds their fields to the global fields
     *
     * @param root          Document root
     * @param node          JOIN node
     * @param variables     Global variable map
     * @param aliases       Keeps track of all previously declared aliases up the stack
     * @private
     */
    _processJoin(
        root: DocumentNode[],
        node: JoinNode,
        variables: {},
        aliases: string[]
    ) {
        // Get basic information associated with join
        const { table, on, nodes } = node;

        // Get 'on' selector as interpolated string
        const selectors = on
            .map(x => {
                const op = Helpers.buildOperationString(
                    root,
                    node.table,
                    x,
                    variables,
                    aliases,
                    this._qb
                );

                return Helpers.interpolateVariables(op.text, op.variables);
            })
            .join(' AND ');

        // Get all sub-joins
        const joins: ProcessedJoin[] = [];

        nodes.filter(x => x.type === Nodes.JOIN).forEach(join => {
            joins.push(this._processJoin(root, join, variables, aliases));
        });

        // Get all local files
        const fields = ((nodes.filter(
            x => x.type === Nodes.FIELD
        ): any[]): FieldNode[]).map((x: FieldNode) => ({
            ...x,
            name: `${table}.${x.name}`
        }));

        // Start a new QueryBuilder
        const qb = this._qb.select().from(table);

        // Extract fields from all sub-joins
        const join_fields =
            joins.length > 0
                ? joins.map(x => x.fields).reduce((a, b) => a.concat(b))
                : [];

        // Add local fields to query
        fields.forEach(field => {
            if (field.value)
                throw new Error(
                    'Values cannot be assigned to fields in a query document'
                );
            qb.field(field.name);
        });

        // All sub-join fields to query
        joins.forEach(join => this._applyFields(qb, join.fields, aliases));

        const field_vals = fields.map(x => x.value);

        // Add fields used in the 'on' statement but aren't returned by the full query
        on
            .map(x => Helpers.getFieldsFromOperationString(x, variables, []))
            .reduce((a, b) => a.concat(b))
            .forEach(field => {
                const name = `${table}.${field.value}`;
                if (!field_vals.includes(name)) qb.field(name);
            });

        // Add all sub-joins to the query
        joins.forEach(join => qb.join(join.qb, join.table, join.on));

        // Return an object with info about the JOIN
        return {
            qb, // <-- QueryBuilder object
            table, // <-- table name
            fields: [...fields, ...join_fields], // <-- All fields
            on: selectors // <-- 'on' selector statement
        };
    }

    /**
     * Processes a table's JOINs
     * Should be run right after fields are defined in a table
     *
     * @param root          Root of the document
     * @param node          Table node
     * @param variables     Global variables
     * @param qb            QueryBuilder object
     * @returns {*}
     */
    process(
        root: DocumentNode[],
        node: TableNode,
        variables: {},
        qb: QueryBuilder
    ): QueryBuilder {
        const aliases: string[] = [];
        const joins: ProcessedJoin[] = node.nodes
            .filter(x => x.type === Nodes.JOIN)
            .map((x: JoinNode) =>
                this._processJoin(root, x, variables, aliases)
            );

        // Add fields from joins
        joins.forEach(join => this._applyFields(qb, join.fields, aliases));

        // Add JOIN statements from joins
        joins.forEach(join => qb.join(join.qb, join.table, join.on));

        return qb;
    }
}

export default (queryBuilder: QueryBuilder) => new JoinProcessor(queryBuilder);
