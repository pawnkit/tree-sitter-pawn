; Declarations
(function_definition
  name: (identifier) @function)
(function_declaration
  name: (identifier) @function)
(directive_define
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
  (directive_include)
  (directive_tryinclude)
  (directive_define)
  (directive_if)
  (directive_elseif)
  (directive_else)
  (directive_endif)
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
(sizeof_expression) @function.builtin
(preproc_call_expression
  function: (identifier) @function.call
  (#not-match? @function.call "^(if|for|while|switch)$"))
(preproc_sizeof_expression) @function.builtin

; Preprocessor expressions
(preproc_defined
  name: (identifier) @constant)
(directive_pragma
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
