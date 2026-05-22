(function_definition
  name: (identifier) @name) @definition.function

(function_declaration
  name: (identifier) @name) @definition.function

(directive_define
  name: (identifier) @name) @definition.macro

(label_statement
  label: (identifier) @name) @definition.label

(enum_declaration
  name: (identifier) @name) @definition.type

(variable_declarator
  name: (identifier) @name) @definition.variable

(enum_entry
  name: (identifier) @name) @definition.constant

(call_expression
  function: (identifier) @name) @reference.call

(preproc_call_expression
  function: (identifier) @name
  (#not-match? @name "^(if|for|while|switch)$")) @reference.call

(goto_statement
  label: (identifier) @name) @reference.label
