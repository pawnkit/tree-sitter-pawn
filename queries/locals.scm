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
; This is a lexical reference candidate, not semantic name resolution. Definitions
; may also match; locals consumers use the more specific definition capture and
; scope information to classify them. Linters and LSPs should resolve identifiers
; from the syntax tree rather than treating every capture as a proven variable use.
(identifier) @local.reference
