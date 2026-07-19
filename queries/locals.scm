; Scopes
[
  (function_definition)
  (block)
] @local.scope

; Definitions
(parameter_declaration
  name: (identifier) @local.definition)

(block
  (variable_declaration
    (variable_declarator
      name: (identifier) @local.definition)))

(for_statement
  initializer: (variable_declarator
    name: (identifier) @local.definition))

; References
; A lexical candidate only. Consumers must resolve names from the syntax tree.
(identifier) @local.reference
