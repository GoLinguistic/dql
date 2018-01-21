// @flow
import Nodes from './util/Nodes';

import parser from './parser';

import QueryProcessor from './processors/QueryProcessor';
import MutationProcessor from './processors/MutationProcessor';

/**
 * Gets the argument object given the initially-passed arguments
 * @param args
 * @returns {{name: string|null, config: {}, as_string: boolean}}
 */
const getFunctionArgs = args => {
  let name = null;
  let config = {};
  let as_string = false;

  switch (args.length) {
    case 1:
      config = args[0];
      break;
    case 2:
      if (typeof args[0] === 'string') {
        name = args[0];
        config = args[1];
      } else {
        config = args[0];
        as_string = args[1];
      }
      break;
    case 3:
      name = args[0];
      config = args[1];
      as_string = args[2];
      break;
  }

  return { name, config, as_string };
};

/**
 * Gets the entry point AST given a document's name
 *
 * @param args      Argument object
 * @param trees     Collection of documents as a bunch of ASTs
 * @returns {AST}
 */
const getEntryPoint = (args, trees) => {
  const { name } = args;
  const entry_index =
    name !== null ? trees.findIndex(x => x.name === name) : trees.length - 1;

  if (name !== null && entry_index < 0)
    throw new Error(`Could not find document \`${name}\``);

  return trees[entry_index];
};

/**
 * Returns a processed document
 *
 * @param ast       A single document as an abstract syntax tree (AST)
 * @param trees     The collection of all documents as a bunch of ASTs
 * @param flavor    The SQL flavor to use
 * @param args      Argument object
 * @returns {string|{text: string, variables: string[]}}
 */
const getProcessedDocument = (ast, trees, flavor, args) => {
  let { config, as_string } = args;
  let processed = null;

  switch (ast.type) {
    case Nodes.QUERY:
      processed = QueryProcessor(flavor).process(trees, ast, config);
      break;
    case Nodes.MUTATION:
      processed = MutationProcessor(flavor).process(trees, ast, config);
      break;
    default:
      throw new Error('Unrecognized document type');
  }

  if (processed !== null)
    return as_string ? processed.toString() : processed.toParam();
  else throw new Error('An error occurred processing the document');
};

/**
 * Returns the function created from a document set
 *
 * @param flavor    Flavor of SQL
 * @param trees     Collection of document trees
 */
const getFunction = (flavor, trees) =>
  function() {
    const args = getFunctionArgs(Array.from(arguments));
    const ast = getEntryPoint(args, trees);

    return getProcessedDocument(ast, trees, flavor, args);
  };

const dql = flavor =>
  function(arg: string[] | object) {
    const args = Array.from(arguments);

    // Process as an AST if it is already parsed data
    if (
      args.length === 1 &&
      args[0].length > 0 &&
      typeof args[0][0] === 'object' &&
      args[0][0].hasOwnProperty('type')
    )
      return getFunction(flavor, arg);

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

    return getFunction(flavor, trees);
  };

export const postgres = dql('postgres');
export const mysql = dql('mysql');
export const mssql = dql('mssql');
export { parser };
