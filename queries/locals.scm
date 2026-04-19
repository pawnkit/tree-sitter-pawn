[
  (function_definition)
  (block)
] @local.scope

(parameter_declaration
  name: (identifier) @local.definition)

(block
  (variable_declaration
    (variable_declarator
      name: (identifier) @local.definition)))

(for_statement
  initializer: (variable_declarator
    name: (identifier) @local.definition))

(return_statement
  value: (identifier) @local.reference)

(expression_statement
  expression: (identifier) @local.reference)

(expression_list
  left: (identifier) @local.reference)

(expression_list
  right: (identifier) @local.reference)

(assignment_expression
  left: (identifier) @local.reference)

(assignment_expression
  right: (identifier) @local.reference)

(binary_expression
  left: (identifier) @local.reference)

(binary_expression
  right: (identifier) @local.reference)

(ternary_expression
  condition: (identifier) @local.reference)

(ternary_expression
  consequence: (identifier) @local.reference)

(ternary_expression
  alternative: (identifier) @local.reference)

(unary_expression
  argument: (identifier) @local.reference)

(update_expression
  argument: (identifier) @local.reference)

(parenthesized_expression
  expression: (identifier) @local.reference)

(subscript_expression
  array: (identifier) @local.reference)

(subscript_expression
  index: (identifier) @local.reference)

(tagged_expression
  value: (identifier) @local.reference)

(argument_list
  (identifier) @local.reference)