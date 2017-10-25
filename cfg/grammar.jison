/* description: Parses DQL markup */

/* lexical grammar */

%lex
%%

\s+                 /* skip whitespace */
\d+\b               return 'NUMBER';
query|mutation\b    return 'DEFINITION';
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

/lex

/* operator associations and precedence */

%left 'OPERATOR'
%right 'OPERATOR'

%start Root

%% /* language grammar */

Text
    : STRING
        {$$ = $1;}
    | Text '.' STRING
        {$$ = $1 + '.' + $3;}
;

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

Number
    : NUMBER
        {$$ = $1;}
;

Join
    : JOIN_OP
        {$$ = $1;}
;

Definition
    : DEFINITION
        {$$ = $1;}
;

Root
    : DocumentList
        {return $$ = $1;}
;

Document
    : Definition Text Variables Block
        {$$ = { type: $1.toUpperCase(), name: $2, variables: $3, nodes: $4 };}
    | Definition Text Block
        {$$ = { type: $1.toUpperCase(), name: $2, variables: [], nodes: $3 };}
;

DocumentList
    : DocumentList Document
        {$$ = $1; $1.push($2);}
    | Document
        {$$ = [$1];}
;

QueryCall
    : Text Params
        {$$ = { type: 'QUERY_CALL', name: $1, params: $2 };}
;

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

Params
    : '(' ParamList ')'
        {$$ = $2;}
;

Variable
    : '$' Text
        {$$ = $2;}
;

Variables
    : '(' ')'
        {$$ = [];}
    | '(' VariableList ')'
        {$$ = $2;}
;

VariableList
    : Variable
        {$$ = [$1];}
    | VariableList ',' Variable
        {$$ = $1; $1.push($3);}
;

BuiltInFunc
    : Text "'" TextString "'"
        {$$ = $1 + " '" + $3 + "'";}
    | Text '"' TextString '"'
        {$$ = $1 + " '" + $3 + "'";}
;

Equation
    : Text
        {$$ = { type: 'TEXT', value: $1 };}
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

EquationList
    : Equation
        {$$ = [$1];}
    | EquationList ',' Equation
        {$$ = $1; $1.push($3);}
;

Selectors
    : '(' EquationList ')'
        {$$ = $2;}
;

Block
    : '{' BlockContent '}'
        {$$ = $2;}
;

BlockContent
    : Content
        {$$ = [$1];}
    | BlockContent Content
        {$$ = $1; $1.push($2);}
;

Content
    : JoinOperation
        {$$ = $1;}
    | TableOperation
        {$$ = $1;}
    | Text
        {$$ = { type: 'FIELD', value: $1, alias: null };}
    | Text '[' Text ']'
        {$$ = { type: 'FIELD', value: $1, alias: $3 };}
;

TableOperation
    : Text Selectors Block
        {$$ = { type: 'TABLE', name: $1.trim(), params: $2, nodes: $3 };}
    | Text Block
        {$$ = { type: 'TABLE', name: $1.trim(), params: [], nodes: $2 };}
;

JoinOperation
    : Join Text Selectors Block
        {$$ = { type: 'JOIN', table: $2.trim(), on: $3, nodes: $4 };}
;
