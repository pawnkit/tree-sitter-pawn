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
; Definitions may also match this broad reference pattern. Tree-sitter's locals
; consumer uses the more specific definition capture to classify them, while this
; pattern keeps references working in every expression position without an
; ever-growing enumeration of expression node shapes.
(identifier) @local.reference
