// Flow has to ignore this file because of the recursion in builderOperationStringHelper()
import Nodes from './Nodes';
import FilterString from './FilterString';

class Helpers {
  /**
   * Gets all the fields from a table or join node
   *
   * @param node  Table or join node
   */
  static getFieldsFromNode(node) {
    const { type, table, name, nodes } = node;

    return nodes.filter(x => x.type === Nodes.FIELD).map(x => ({
      ...x,
      name: type === Nodes.JOIN ? `${table}.${x.name}` : `${name}.${x.name}`
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
   * @param docroot
   * @param table
   * @param node
   * @param variables
   * @returns {{text, variables}}
   */
  static buildFilterString(docroot, table, node, variables, aliases, flavor) {
    return new FilterString(
      docroot,
      table,
      node,
      variables,
      aliases,
      flavor
    ).toString();
  }

  /**
   * Applies a WHERE statement to a QueryBuilder object
   *
   * @param node  Table node
   * @param qb
   */
  static applyWhereStatement(docroot, node, variables, qb) {
    // Get the name and parameters associated with the table
    const { params } = node;

    // From the parameters, create an operator tree and generate
    // an array of selector strings to use in the WHERE() call
    const selectors = params.map(x =>
      Helpers.buildFilterString(docroot, null, x, variables, [], qb.flavour)
    );

    // If the user has included selectors, add those too
    if (selectors.length > 0) {
      qb = qb.where(
        selectors.map(x => x.text).join(' AND '),
        ...selectors.map(x => x.variables).reduce((a, b) => a.concat(b))
      );
    }
  }
  /**
   * Interpolates variables into strings using '?' like Squel does
   *
   * @param string        String containing '?''s
   * @param variables     Array of variables
   * @returns {*}
   */
  static interpolateVariables(string, variables) {
    // Matches all standalone question marks (?) in a string
    const regex = /(\s+\?\s+)|(^\?\s+)|(\s+\?$)/g;

    // Define an iterator to know which match we're on
    let iterator = 0;

    // Index of the last matched question mark
    let last_index = 0;

    // Our final message
    let message = '';

    // Match the first question mark
    let match = regex.exec(string);

    // Recursively match all question marks in the string
    while (match !== null) {
      // Get the variable at that index
      let v = variables[iterator];

      // If there isn't a variable available, error
      if (typeof v === 'undefined')
        throw new Error('Missing variable. Cannot interpolate.');

      // Replace the question mark with the variable value
      message += `${string.substring(last_index, match.index)} ${v}`;

      // Increment the last index
      last_index = match.index + (match.index === 0 ? 1 : 2);

      // Increment the iterator
      iterator++;

      // Match the next question mark
      match = regex.exec(string);
    }

    // Append the rest of the string, whatever that may be
    message += string.substring(last_index, string.length);

    return message;
  }
}

export default Helpers;
