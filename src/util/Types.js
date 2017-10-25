// @flow
/**
 * Basic Types
 * ===========
 */
export type QueryCallNode = {
    type: 'QUERY_CALL',
    name: string,
    params: string[]
};

export type TextNode = {
    type: 'TEXT',
    value: string
};

export type FieldNode = {
    type: 'FIELD',
    value: string,
    alias: string
};

export type VariableNode = {
    type: 'VARIABLE',
    value: string
};

export type NumberNode = {
    type: 'NUMBER',
    value: number
};

export type BuiltInNode = {
    type: 'BUILT_IN',
    value: string
};

/**
 * Join-Related Nodes
 * ==================
 */
export type OperationNode = {
    type: 'OPERATION',
    a:
        | OperationNode
        | TextNode
        | NumberNode
        | VariableNode
        | QueryCallNode
        | BuiltInNode,
    op: string,
    b:
        | OperationNode
        | TextNode
        | NumberNode
        | VariableNode
        | QueryCallNode
        | BuiltInNode
};

export type JoinNode = {
    type: 'JOIN',
    table: string,
    on: OperationNode[],
    nodes: JoinNode[]
};

/**
 * Top-Level Nodes
 * ===============
 */
export type TableNode = {
    type: 'TABLE',
    name: string,
    params: string[],
    nodes: FieldNode[] | JoinNode[]
};

export type DocumentNode = {
    type: 'QUERY' | 'MUTATION',
    name: string,
    variables: {}[],
    nodes: TableNode[]
};

/**
 * Non-Node Types
 * ==============
 */
export type Config = {
    variables: {},
    orderBy: string,
    descending: boolean,
    groupBy: string
};
