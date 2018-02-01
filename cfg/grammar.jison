/* description: Parses DQL markup */

/* lexical grammar */

%lex
%%

"-"                                             return '-';
([\+*\/%&|^=><]+)|(\![=<>]+)|(\-=)|(\s+in\s+)   return 'OPERATOR';
\s+                                             /* skip whitespace */
\"(.*?)\"                                       return 'LONG_STRING';
\d+\b                                           return 'NUMBER';
query|mutation\b                                return 'DEFINITION';
false|true\b                                    return 'BOOLEAN';
[\w\_\d]+                                       return 'STRING';
"{"                                             return '{';
"}"                                             return '}';
"("                                             return '(';
")"                                             return ')';
\.{3}\s*on                                      return 'JOIN_OP';
","                                             return ',';
"'"                                             return '\'';
\"                                              return '"';
"."                                             return '.';
"$"                                             return '$';
"["                                             return '[';
"]"                                             return ']';
":"                                             return ':';
"!"                                             return '!';

/lex

/* operator associations and precedence */

%left 'OPERATOR', '-'
%right 'OPERATOR', '-'

%start Root

%% /* language grammar */

/***************
 * BASIC TYPES *
 ***************/

// RawString
// =========
// A string without quotation marks
RawString
    : STRING
        {$$ = { type: 'RAW', value: $1 };}
;

// Field Reference
// ===============
// Any reference to a table-specific field using dot notation
FieldRef
    : STRING '.' STRING
            {$$ = { type: 'FIELD_REF', value: $1 + '.' + $3 };}
;

// RawLongString
// =============
// Collection of unquoted strings or numbers
RawLongString
    : STRING
        {$$ = $1;}
    | NUMBER
        {$$ = $1;}
    | RawLongString NUMBER
        {$$ = $1 + ' ' + $2;}
    | RawLongString STRING
        {$$ = $1 + ' ' + $2;}
;

// LongString
// ==========
// Collection of quoted strings or numbers
LongString
    : LONG_STRING
        {$$ = { type: 'LONG_STRING', value: $1.substr(1, $1.length - 2) };}
;

// Number
// ======
// Any number
Number
    : NUMBER
        {$$ = { type: 'NUMBER', value: Number($1) };}
;

// Boolean
// =======
// True or false
Boolean
    : BOOLEAN
        {$$ = { type: 'BOOLEAN', value: $1 === 'true' };}
;

// Join
// ====
// The prefix for join operations ("...on")
Join
    : JOIN_OP
        {$$ = $1;}
;

// Definition
// ==========
// Document definition types (mutation, query, etc.)
Definition
    : DEFINITION
        {$$ = $1;}
;

/*********
 * ROOTS *
 *********/

// Root
// ====
// The entry point of the document
Root
    : DocumentList
        {return $$ = $1;}
;

// Document
// ========
// Any block in the form of [definition] [name] ( [params] ) {
Document
    : Definition STRING Variables Block
        {$$ = { type: $1.toUpperCase(), name: $2, variables: $3, nodes: $4 };}
    | Definition STRING Block
        {$$ = { type: $1.toUpperCase(), name: $2, variables: [], nodes: $3 };}
;

// Document List
// =============
// List of documents
DocumentList
    : DocumentList Document
        {$$ = $1; $1.push($2);}
    | Document
        {$$ = [$1];}
;

/***************
 * QUERY CALLS *
 ***************/

// Query Call
// ==========
// A query call is a call to a nested query
QueryCall
    : STRING Params
        {$$ = { type: 'QUERY_CALL', name: $1, params: $2 };}
;

// Parameter List
// ==============
// Comma-separated list of parameters to pass to a query call
ParamList
    :
        {$$ = [''];}
    | Param
        {$$ = [$1];}
    | ParamList ',' Param
        {$$ = $1; $1.push($3);}
;

// Parameters
// ==========
// Parameter list surrounded by parens ()
Params
    : '(' ParamList ')'
        {$$ = $2;}
;

// Parameter
// =========
// Single parameter type
Param
    : LongString
        {$$ = $1;}
    | Number
        {$$ = $1;}
    | Boolean
        {$$ = $1;}
    | Variable
        {$$ = $1;}
    | QueryCall
        {$$ = $1;}
;

// Array List
// ==============
// Comma-separated list of values contained in brackets
ArrayList
    :
        {$$ = [''];}
    | ArrayElement
        {$$ = [$1];}
    | ArrayList ',' ArrayElement
        {$$ = $1; $1.push($3);}
;

// Array
// ==========
// ArrayList surrounded by parens []
Array
    : '[' ArrayList ']'
        {$$ = { type: 'ARRAY', value: $2 };}
;

// ArrayElement
// ============
// Single array element
ArrayElement
    : LongString
        {$$ = $1;}
    | Number
        {$$ = $1;}
    | Boolean
        {$$ = $1;}
    | Variable
        {$$ = $1;}
    | QueryCall
        {$$ = $1;}
;

/*************
 * VARIABLES *
 *************/

// VARIABLE
// ========
// A raw variable type that allows extracting of the variable name
VARIABLE
    : '$' STRING
        {$$ = $2;}
;

// Variable
// ========
// A single variable is any string that begins with $
Variable
    : VARIABLE
        {$$ = { type: 'VARIABLE', value: $1 };}
;

// Variables
// =========
// A collection of variables surrounded by parens ()
Variables
    : '(' ')'
        {$$ = [];}
    | '(' VariableList ')'
        {$$ = $2;}
;

// Variable List
// =============
// A comma-separated list of variables
VariableList
    : VARIABLE
        {$$ = [{ required: false, name: $1}];}
    | VARIABLE '!'
        {$$ = [{ required: true, name: $1 }]}
    | VariableList ',' VARIABLE
        {$$ = $1; $1.push({ required: false, name: $3 });}
    | VariableList ',' VARIABLE '!'
        {$$ = $1; $1.push({ required: true, name: $3 });}
;

// Built-In Function
// =================
// Function built-in to SQL like INTERVAL
BuiltInFunc
    : STRING "'" RawLongString "'"
        {$$ = { type: 'BUILT_IN', value: $1 + " '" + $3 + "'"};}
;

/*************
 * EQUATIONS *
 *************/

// Equation
// ========
// Formal equation that can be surrounded by parens () or square brackets []
Equation
    : FieldRef
        {$$ = $1;}
    | Variable
        {$$ = $1;}
    | QueryCall
        {$$ = $1;}
    | BuiltInFunc
        {$$ = $1;}
    | Number
        {$$ = $1;}
    | Array
        {$$ = $1;}
    | LongString
        {$$ = $1;}
    | RawString
        {$$ = $1;}
    | Equation OPERATOR Equation
        {$$ = { type: 'OPERATION', a: $1, op: $2, b: $3 };}
    | Equation '-' Equation
        {$$ = { type: 'OPERATION', a: $1, op: $2, b: $3 };}
    | '(' Equation ')'
        {$$ = $2;}
;

// Equation List
// =============
// List of equations as described above
EquationList
    : Equation
        {$$ = [$1];}
    | EquationList ',' Equation
        {$$ = $1; $1.push($3);}
;

// Selectors
// =========
// Selectors are a collection of equations used as selectors in `where` statements
Selectors
    : '(' EquationList ')'
        {$$ = $2;}
;

/**********
 * BLOCKS *
 **********/

// Block
// =====
// A section surrounded by curly brackets {}
Block
    : '{' BlockContent '}'
        {$$ = $2;}
    |  '{' '}'
        {$$ = [];}
;

// Block Content
// =============
// What's found inside curly brackets {}
BlockContent
    : Content
        {$$ = [$1];}
    | BlockContent Content
        {$$ = $1; $1.push($2);}
;

// Content
// =======
// All available operations/fields/documents allowed inside blocks
Content
    : JoinOperation
        {$$ = $1;}
    | TableOperation
        {$$ = $1;}
    | STRING
        {$$ = { type: 'FIELD', name: $1, value: null, alias: null };}
    | STRING '[' STRING ']'
        {$$ = { type: 'FIELD', name: $1, value: null, alias: $3 };}
    | STRING ':' Boolean
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
    | STRING ':' LongString
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
    | STRING ':' RawString
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
    | STRING ':' Number
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
    | STRING ':' Variable
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
;

/**************
 * OPERATIONS *
 **************/

// Table Operation
// ===============
// Describes which table the document op (mutation/query/etc) will be run on
TableOperation
    : STRING Selectors Block
        {$$ = { type: 'TABLE', name: $1.trim(), params: $2, nodes: $3, delete: false };}
    | STRING Block
        {$$ = { type: 'TABLE', name: $1.trim(), params: [], nodes: $2, delete: false };}
    | '-' STRING Selectors
        {$$ = { type: 'TABLE', name: $2.trim(), params: $3, nodes: [], delete: true };}
    | '-' STRING Selectors Block
        {$$ = { type: 'TABLE', name: $2.trim(), params: $3, nodes: $4, delete: true };}
;

// Join Operation
// ==============
// Describes a join operation
JoinOperation
    : Join STRING Selectors Block
        {$$ = { type: 'JOIN', table: $2.trim(), on: $3, nodes: $4 };}
;
