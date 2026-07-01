; Declarations
(function_definition
  name: (identifier) @function)
(function_declaration
  name: (identifier) @function)
(prefixed_function_declaration
  name: (identifier) @function)
[
  (function_definition
    name: (operator_name) @function)
  (function_declaration
    name: (operator_name) @function)
  (function_definition
    name: (at_identifier) @function)
  (function_declaration
    name: (at_identifier) @function)
]
(function_declaration
  name: (member_expression
    property: (identifier) @function))
[
  (function_definition
    prefix: (identifier) @function.macro)
  (prefixed_function_declaration
    prefix: (identifier) @function.macro)
]
(preproc_define
  name: (identifier) @function.macro)
(macro_parameter) @parameter
(variadic_parameter) @parameter
(tag_wildcard) @type.builtin
(parameter_declaration
  name: (identifier) @variable.parameter)
(variable_declarator
  name: (identifier) @variable)
(enum_declaration
  name: (identifier) @type)
(enum_entry
  name: (identifier) @constant)
(label_statement
  label: (identifier) @label)
(goto_statement
  label: (identifier) @label)
(state_name) @label
(packed_storage) @type.builtin

; Tags
(variadic_tag_set
  (identifier) @type)
(tagged_type
  tag: (identifier) @type)
(tagged_expression
  type: (tagged_type
    tag: (tag_wildcard) @type.builtin))
(tagged_expression
  type: (tagged_type
    tag: (identifier) @type.cast))

; Directives
[
  (preproc_include)
  (preproc_tryinclude)
  (preproc_define)
  (preproc_if)
  (preproc_elseif)
  (preproc_else)
  (preproc_endif)
] @preproc

; Literals
(integer_literal) @number
(hex_literal) @number
(float_literal) @float
(string_literal) @string
(char_literal) @character
(boolean_literal) @constant.builtin
(null_literal) @constant.builtin
(system_lib_string) @string.special
(escape_sequence) @string.escape

; Comments
(comment) @comment

; Common constants
((identifier) @constant
 (#match? @constant "^[A-Z][A-Z0-9_]+$"))

; Calls
(call_expression
  function: (identifier) @function.call)
(call_expression
  function: (member_expression
    property: (identifier) @function.call))
(call_expression
  function: (callback_member_expression
    name: (identifier) @function.call))
(call_expression
  function: (subscript_expression
    array: (identifier) @function.call))
(macro_invocation_statement
  name: (identifier) @function.call)
(macro_invocation_block_statement
  name: (identifier) @function.call)
(macro_iterator_loop_statement
  name: (identifier) @function.call)
(prefixed_call_statement
  prefix: (identifier) @function.macro)
(macro_reference_expression
  name: (identifier) @function)
(sizeof_expression) @function.builtin
(preproc_call_expression
  function: (identifier) @function.call
  (#not-match? @function.call "^(if|for|while|switch)$"))
(preproc_sizeof_expression) @function.builtin

; Preprocessor expressions
(preproc_defined
  name: (identifier) @constant)
(preproc_pragma
  name: (identifier) @attribute)
(preproc_text) @string.special

; Keywords
[
  "break"
  "case"
  "const"
  "continue"
  "default"
  "do"
  "else"
  "enum"
  "for"
  "forward"
  "goto"
  "if"
  "native"
  "new"
  "public"
  "return"
  "static"
  "stock"
  "switch"
  "while"
] @keyword

; Delimiters
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ";"
] @punctuation.delimiter

; Operators
[
  "="
  "+="
  "-="
  "*="
  "/="
  "%="
  "<<="
  ">>="
  "&="
  "|="
  "^="
  "+"
  "-"
  "*"
  "/"
  "%"
  "<<"
  ">>"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "&&"
  "||"
  "!"
  "~"
  "&"
  "|"
  "^"
  "?"
  ":"
  ".."
  "++"
  "--"
  "..."
] @operator
