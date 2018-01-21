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
   * Gets the "on" selector string from an operation tree
   *
   * @param docroot       Document root
   * @param node          Join node
   * @param variables     Global variable map
   * @returns {string}
   * @private
   */
  _getOnString(docroot, node, variables, aliases) {
    const op = Helpers.buildFilterString(
      docroot,
      node.table,
      node.on[0],
      variables,
      aliases,
      this._qb.flavour
    );

    return Helpers.interpolateVariables(op.text, op.variables);
  }

  /**
   * Adds "where" selectors to QueryBuilder if possible
   *
   * @param docroot       Document root
   * @param node          Join node
   * @param variables     Global variable map
   * @param qb            QueryBuilder
   * @returns {string}
   * @private
   */
  _addSelectors(docroot, node, variables, qb) {
    const where = node.on.slice(1);

    // Spoof a table node and add a where statement
    Helpers.applyWhereStatement(
      docroot,
      {
        params: where
      },
      variables,
      qb
    );
  }

  /**
   * Adds all possible fields and subjoins in a join to a QueryBuilder
   *
   * @param docroot       Document root
   * @param node          Join node
   * @param variables     Global variable map
   * @param qb            QueryBuilder
   * @returns {string[]}  All available fields
   * @private
   */
  _addAllFieldsAndJoins(docroot, node, variables, aliases, qb) {
    const { table, on } = node;

    // Get all local fields
    const fields = Helpers.getFieldsFromNode(node);

    // Get all subjoins
    const joins = this._getAllSubjoins(docroot, node, variables, aliases);

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

    if (qb.field == null) console.log('fuck');
    // All sub-join fields to query
    joins.forEach(join => this._applyFields(qb, join.fields, aliases));

    // Get just field values
    const field_vals = fields.map(x => x.value);

    // Apply fields from the 'on' selector
    Helpers.getFieldsFromOperationString(on[0], variables, []).forEach(
      field => {
        const name = `${table}.${field.value}`;
        if (!field_vals.includes(name)) qb.field(name);
      }
    );

    // Add all sub-joins to the query
    joins.forEach(join => qb.join(join.qb, join.table, join.on));

    return [...fields, ...join_fields];
  }

  /**
   * Gets all subjoins in a join node
   *
   * @param node
   * @returns {ProcessedJoin[]}
   * @private
   */
  _getAllSubjoins(docroot, node, variables, aliases) {
    const { nodes } = node;
    const joins: ProcessedJoin[] = [];

    nodes.filter(x => x.type === Nodes.JOIN).forEach(join => {
      joins.push(this._processJoin(docroot, join, variables, aliases));
    });

    return joins;
  }

  /**
   *  Processes JOIN blocks and adds their fields to the global fields
   *
   * @param docroot          Document docroot
   * @param node          JOIN node
   * @param variables     Global variable map
   * @param aliases       Keeps track of all previously declared aliases up the stack
   * @private
   */
  _processJoin(
    docroot: DocumentNode[],
    node: JoinNode,
    variables: {},
    aliases: string[]
  ) {
    // Get basic information associated with join
    const { table } = node;

    // Start a new QueryBuilder
    const qb = this._qb.select().from(table);

    // Get 'on' selector as interpolated string
    const on = this._getOnString(docroot, node, variables, aliases);

    // Add 'where' statement if applicable
    this._addSelectors(docroot, node, variables, qb);

    // Gets and applies all fields contained in this join
    const fields = this._addAllFieldsAndJoins(
      docroot,
      node,
      variables,
      aliases,
      qb
    );

    // Return an object with info about the JOIN
    return {
      qb, // <-- QueryBuilder object
      table, // <-- table name
      fields, // <-- All fields
      on // <-- 'on' selector statement
    };
  }

  /**
   * Processes a table's JOINs
   * Should be run right after fields are defined in a table
   *
   * @param docroot          docroot of the document
   * @param node          Table node
   * @param variables     Global variables
   * @param qb            QueryBuilder object
   * @returns {*}
   */
  process(
    docroot: DocumentNode[],
    node: TableNode,
    variables: {},
    qb: QueryBuilder
  ): QueryBuilder {
    const aliases: string[] = [];
    const joins: ProcessedJoin[] = node.nodes
      .filter(x => x.type === Nodes.JOIN)
      .map((x: JoinNode) => this._processJoin(docroot, x, variables, aliases));

    if (qb.field != null)
      // Add fields from joins
      joins.forEach(join => this._applyFields(qb, join.fields, aliases));

    // Add JOIN statements from joins
    joins.forEach(join => qb.join(join.qb, join.table, join.on));

    return qb;
  }
}

export default (queryBuilder: QueryBuilder) => new JoinProcessor(queryBuilder);
