; Functions
(function_definition
  name: (identifier) @name) @definition.function

(function_declaration
  name: (identifier) @name) @definition.function

(prefixed_function_declaration
  name: (identifier) @name) @definition.function

(prefixed_function_declaration
  name: (operator_name) @name) @definition.function

(prefixed_function_declaration
  name: (at_identifier) @name) @definition.function

(function_definition
  name: (operator_name) @name) @definition.function

(function_declaration
  name: (operator_name) @name) @definition.function

(function_definition
  name: (at_identifier) @name) @definition.function

(function_declaration
  name: (at_identifier) @name) @definition.function

(function_declaration
  name: (member_expression
    property: (identifier) @name)) @definition.function

; Preprocessor definitions
(preproc_define
  name: (identifier) @name) @definition.macro

; Labels, types, constants, and variables
(label_statement
  label: (identifier) @name) @definition.label

(enum_declaration
  name: (identifier) @name) @definition.type

(variable_declarator
  name: (identifier) @name) @definition.variable

(enum_entry
  name: (identifier) @name) @definition.constant

; Call references
(call_expression
  function: (identifier) @name) @reference.call

(call_expression
  function: (member_expression
    property: (identifier) @name)) @reference.call

(call_expression
  function: (callback_member_expression
    name: (identifier) @name)) @reference.call

(call_expression
  function: (subscript_expression
    array: (identifier) @name)) @reference.call

(macro_invocation_statement
  name: (identifier) @name) @reference.call

(macro_invocation_block_statement
  name: (identifier) @name) @reference.call

(macro_iterator_loop_statement
  name: (identifier) @name) @reference.call

(macro_reference_expression
  name: (identifier) @name) @reference.call

; Label references
(goto_statement
  label: (identifier) @name) @reference.label
