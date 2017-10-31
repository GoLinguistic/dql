/* description: Parses DQL markup */

/* lexical grammar */

%lex
%%

\s+                 /* skip whitespace */
\d+\b               return 'NUMBER';
query|mutation\b    return 'DEFINITION';
false|true\b        return 'BOOLEAN';
[\w\_\d]+           return 'STRING';
[\!+\-*\/%&|^=><]+  return 'OPERATOR';
"{"                 return '{';
"}"                 return '}';
"("                 return '(';
")"                 return ')';
\.{3}\s*on          return 'JOIN_OP';
","                 return ',';
"'"                 return '\'';
\"                  return '"';
"."                 return '.';
"$"                 return '$';
"["                 return '[';
"]"                 return ']';
":"                 return ':';

/lex

/* operator associations and precedence */

%left 'OPERATOR'
%right 'OPERATOR'

%start Root

%% /* language grammar */

/***************
 * BASIC TYPES *
 ***************/

// Text
// ====
// Any single string without spaces
Text
    : STRING
        {$$ = $1;}
    | Text '.' STRING
        {$$ = $1 + '.' + $3;}
;

// Text String
// ===========
// String of text or number objects
TextString
    : Text
        {$$ = $1;}
    | Number
        {$$ = $1;}
    | TextString Number
        {$$ = $1 + ' ' + $2;}
    | TextString Text
        {$$ = $1 + ' ' + $2;}
;

// Number
// ======
// Any number
Number
    : NUMBER
        {$$ = Number($1);}
;

// Boolean
// =======
// True or false
Boolean
    : BOOLEAN
        {$$ = $1;}
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
    : Definition Text Variables Block
        {$$ = { type: $1.toUpperCase(), name: $2, variables: $3, nodes: $4 };}
    | Definition Text Block
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
    : Text Params
        {$$ = { type: 'QUERY_CALL', name: $1, params: $2 };}
;

// Parameter List
// ==============
// Comma-separated list of parameters to pass to a query call
ParamList
    :
        {$$ = [''];}
    | Text
        {$$ = [{ type: 'TEXT', value: $1}];}
    | Variable
        {$$ = [{ type: 'VARIABLE', value: $1}];}
    | ParamList ',' QueryCall
        {$$ = $1; $1.push($3);}
    | ParamList ',' Text
        {$$ = $1; $1.push($3);}
;

// Parameters
// ==========
// Parameter list surrounded by parens ()
Params
    : '(' ParamList ')'
        {$$ = $2;}
;

/*************
 * VARIABLES *
 *************/

// Variable
// ========
// A single variable is any string that begins with $
Variable
    : '$' Text
        {$$ = $2;}
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
    : Variable
        {$$ = [$1];}
    | VariableList ',' Variable
        {$$ = $1; $1.push($3);}
;

// Built-In Function
// =================
// Function built-in to SQL like INTERVAL
BuiltInFunc
    : Text "'" TextString "'"
        {$$ = $1 + " '" + $3 + "'";}
    | Text '"' TextString '"'
        {$$ = $1 + " '" + $3 + "'";}
;

/*************
 * EQUATIONS *
 *************/

// Equation
// ========
// Formal equation that can be surrounded by parens () or square brackets []
Equation
    : Text
        {$$ = { type: 'RAW', value: $1 };}
    | "'" Text "'"
        {$$ = { type: 'TEXT', value: $2 };}
    | Number
        {$$ = { type: 'NUMBER', value: $1 };}
    | Variable
        {$$ = { type: 'VARIABLE', value: $1 };}
    | QueryCall
        {$$ = $1;}
    | BuiltInFunc
        {$$ = { type: 'BUILT_IN', value: $1 };}
    | Equation OPERATOR Equation
        {$$ = { type: 'OPERATION', a: $1, op: $2, b: $3 };}
    | '(' Equation ')'
        {$$ = $2;}
    | '[' Equation ']'
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
    | Text
        {$$ = { type: 'FIELD', name: $1, value: null, alias: null };}
    | Text '[' Text ']'
        {$$ = { type: 'FIELD', name: $1, value: null, alias: $3 };}
    | Text ':' Boolean
            {$$ = { type: 'FIELD', name: $1, value: $3 === 'true', alias: null };}
    | Text ':' Text
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
    | Text ':' Number
        {$$ = { type: 'FIELD', name: $1, value: $3, alias: null };}
    | Text ':' Variable
        {$$ = { type: 'FIELD', name: $1, value: { type: 'VARIABLE', value: $3 }, alias: null };}
;

/**************
 * OPERATIONS *
 **************/

// Table Operation
// ===============
// Describes which table the document op (mutation/query/etc) will be run on
TableOperation
    : Text Selectors Block
        {$$ = { type: 'TABLE', name: $1.trim(), params: $2, nodes: $3 };}
    | Text Block
        {$$ = { type: 'TABLE', name: $1.trim(), params: [], nodes: $2 };}
;

// Join Operation
// ==============
// Describes a join operation
JoinOperation
    : Join Text Selectors Block
        {$$ = { type: 'JOIN', table: $2.trim(), on: $3, nodes: $4 };}
;
