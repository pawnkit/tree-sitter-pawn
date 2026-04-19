const PREC = {
  ASSIGNMENT: 1,
  TERNARY: 2,
  LOGICAL_OR: 3,
  LOGICAL_AND: 4,
  BITWISE_OR: 5,
  BITWISE_XOR: 6,
  BITWISE_AND: 7,
  EQUALITY: 8,
  RELATIONAL: 9,
  SHIFT: 10,
  ADD: 11,
  MULTIPLY: 12,
  CAST: 13,
  SIZEOF: 14,
  UNARY: 15,
  CALL: 16,
  SUBSCRIPT: 17,
};

module.exports = grammar({
  name: "pawn",

  extras: ($) => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  word: ($) => $.identifier,

  conflicts: ($) => [
    [$.visibility_modifier, $.function_modifier],
    [$.declaration_qualifier, $.function_modifier],
  ],

  supertypes: ($) => [
    $._expression,
    $._statement,
  ],

  rules: {
    source_file: ($) => repeat($._top_level_item),

    _top_level_item: ($) => choice(
      $.function_definition,
      $.function_declaration,
      $.enum_declaration,
      $.variable_declaration,
      $.directive_include,
      $.directive_tryinclude,
      $.directive_define,
      $.directive_emit,
      $.directive_pragma,
      $.directive_undef,
      $.directive_assert,
      $.directive_error,
      $.directive_warning,
      $.directive_line,
      $.directive_file,
      $.directive_endinput,
      $.directive_if,
      $.directive_elseif,
      $.directive_else,
      $.directive_endif,
    ),

    function_definition: ($) => seq(
      repeat($.function_modifier),
      optional(field("return_type", $.type)),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional(field("state", $.state_classifier)),
      field("body", $.block),
    ),

    function_declaration_kind: ($) => choice("forward", "native"),

    function_declaration: ($) => seq(
      field("kind", $.function_declaration_kind),
      optional(field("return_type", $.type)),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional(field("state", $.state_classifier)),
      optional(seq("=", field("alias", $.identifier))),
      ";",
    ),

    _visibility_keyword: ($) => choice("public", "stock"),

    visibility_modifier: ($) => $._visibility_keyword,

    function_modifier: ($) => choice(
      $._visibility_keyword,
      "static",
    ),

    parameter_qualifier: ($) => choice("const", "stock"),

    state_classifier: ($) => seq(
      "<",
      commaSep1($.state_name),
      ">",
    ),

    state_name: ($) => token(choice("default", /[A-Za-z_][A-Za-z0-9_]*/)),

    _conditional_directive: ($) => choice(
      $.directive_if,
      $.directive_elseif,
      $.directive_else,
      $.directive_endif,
    ),

    reference_modifier: ($) => "&",

    parameter_list: ($) => seq(
      "(",
      optional($._parameter_list_items),
      ")",
    ),

    _parameter_list_items: ($) => seq(
      repeat($._conditional_directive),
      choice($.parameter_declaration, $.variadic_parameter),
      repeat(seq(
        ",",
        repeat($._conditional_directive),
        choice($.parameter_declaration, $.variadic_parameter),
      )),
      optional(","),
      repeat($._conditional_directive),
    ),

    parameter_declaration: ($) => seq(
      repeat($.parameter_qualifier),
      optional($.reference_modifier),
      optional(field("type", $.type)),
      optional($.reference_modifier),
      field("name", $.identifier),
      repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
      optional(seq("=", field("default_value", $._expression))),
    ),

    variadic_parameter: ($) => choice(
      "...",
      seq(
        field("tag_set", $.variadic_tag_set),
        "...",
      ),
    ),

    variadic_tag_set: ($) => seq(
      "{",
      commaSep1(choice(alias($.identifier, $.tag), $.tag_wildcard)),
      "}",
      token.immediate(":"),
    ),

    tag_wildcard: ($) => "_",

    variable_declaration: ($) => choice(
      seq(
        optional($.visibility_modifier),
        $._qualified_variable_declaration_clause,
        ";",
      ),
      seq(
        $.visibility_modifier,
        commaSep1($.variable_declarator),
        ";",
      ),
    ),

    _qualified_variable_declaration_clause: ($) => prec.left(seq(
      repeat1($.declaration_qualifier),
      commaSep1($.variable_declarator),
    )),

    declaration_qualifier: ($) => choice(
      "new",
      "const",
      "static",
    ),

    variable_declarator: ($) => seq(
      optional(field("type", $.type)),
      field("name", $.identifier),
      repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
      optional(seq("=", field("initializer", choice($.array_literal, $._expression)))),
    ),

    enum_declaration: ($) => seq(
      "enum",
      optional(field("name", $.identifier)),
      optional(field("increment", $.enum_increment_clause)),
      "{",
      optional($._enum_entries),
      "}",
      optional(";"),
    ),

    enum_increment_clause: ($) => seq(
      "(",
      field("operator", choice(
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "<<=",
        ">>=",
        "&=",
        "|=",
        "^=",
      )),
      field("value", choice($.expression_list, $._expression)),
      ")",
    ),

    _enum_entries: ($) => seq(
      repeat($._conditional_directive),
      $.enum_entry,
      repeat(seq(
        ",",
        repeat($._conditional_directive),
        $.enum_entry,
      )),
      optional(","),
      repeat($._conditional_directive),
    ),

    enum_entry: ($) => seq(
      optional(field("type", $.type)),
      field("name", $.identifier),
      repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
      optional(seq("=", field("value", $._expression))),
    ),

    type: ($) => $.tagged_type,

    tagged_type: ($) => seq(
      field("tag", choice(alias($.identifier, $.tag), $.tag_wildcard)),
      token.immediate(":"),
    ),

    dimension: ($) => seq("[", "]"),

    fixed_dimension: ($) => seq("[", field("size", choice($.expression_list, $._expression)), "]"),

    packed_dimension: ($) => seq(
      "[",
      field("size", choice($.expression_list, $._expression)),
      field("storage", $.packed_storage),
      "]",
    ),

    packed_storage: ($) => "char",

    block: ($) => seq(
      "{",
      repeat($._statement),
      "}",
    ),

    _statement: ($) => choice(
      $.block,
      $.variable_declaration,
      $.if_statement,
      $.switch_statement,
      $.while_statement,
      $.do_while_statement,
      $.for_statement,
      $.goto_statement,
      $.label_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.expression_statement,
      $.directive_include,
      $.directive_tryinclude,
      $.directive_define,
      $.directive_emit,
      $.directive_pragma,
      $.directive_undef,
      $.directive_assert,
      $.directive_error,
      $.directive_warning,
      $.directive_line,
      $.directive_file,
      $.directive_endinput,
      $.directive_if,
      $.directive_elseif,
      $.directive_else,
      $.directive_endif,
    ),

    if_statement: ($) => prec.right(seq(
      "if",
      "(",
      field("condition", choice($.expression_list, $._expression)),
      ")",
      field("consequence", $._statement),
      optional(seq("else", field("alternative", $._statement))),
    )),

    switch_statement: ($) => seq(
      "switch",
      "(",
      field("condition", choice($.expression_list, $._expression)),
      ")",
      "{",
      repeat(choice($.case_statement, $.default_statement)),
      "}",
    ),

    case_statement: ($) => seq(
      "case",
      field("value", choice($.case_value_list, $._case_value)),
      ":",
      repeat($._statement),
    ),

    _case_value: ($) => choice(
      $.case_range,
      $._expression,
    ),

    case_range: ($) => seq(
      field("start", $._expression),
      "..",
      field("end", $._expression),
    ),

    case_value_list: ($) => seq(
      field("left", $._case_value),
      repeat1(seq(",", field("right", $._case_value))),
    ),

    default_statement: ($) => seq(
      "default",
      ":",
      repeat($._statement),
    ),

    while_statement: ($) => seq(
      "while",
      "(",
      field("condition", choice($.expression_list, $._expression)),
      ")",
      field("body", $._statement),
    ),

    do_while_statement: ($) => seq(
      "do",
      field("body", $._statement),
      "while",
      "(",
      field("condition", choice($.expression_list, $._expression)),
      ")",
      ";",
    ),

    for_statement: ($) => seq(
      "for",
      "(",
      field("initializer", optional(choice($._qualified_variable_declaration_clause, $.expression_list, $._expression))),
      ";",
      field("condition", optional(choice($.expression_list, $._expression))),
      ";",
      field("update", optional(choice($.expression_list, $._expression))),
      ")",
      field("body", $._statement),
    ),

    goto_statement: ($) => seq(
      "goto",
      field("label", $.identifier),
      ";",
    ),

    label_statement: ($) => prec(1, choice(
      seq(
        field("label", alias($.identifier, $.statement_label)),
        token.immediate(/:[ \t]*(\r?\n)+/),
      ),
      seq(
        field("label", alias($.identifier, $.statement_label)),
        token.immediate(":"),
        field("statement", $.inline_labeled_statement),
      ),
    )),

    inline_labeled_statement: ($) => choice(
      $.block,
      $.variable_declaration,
      $.if_statement,
      $.switch_statement,
      $.while_statement,
      $.do_while_statement,
      $.for_statement,
      $.goto_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.directive_include,
      $.directive_tryinclude,
      $.directive_define,
      $.directive_emit,
      $.directive_pragma,
      $.directive_undef,
      $.directive_assert,
      $.directive_error,
      $.directive_warning,
      $.directive_line,
      $.directive_file,
      $.directive_endinput,
      $.directive_if,
      $.directive_elseif,
      $.directive_else,
      $.directive_endif,
    ),

    return_statement: ($) => seq(
      "return",
      optional(field("value", choice($.expression_list, $._expression))),
      ";",
    ),

    break_statement: ($) => seq("break", ";"),

    continue_statement: ($) => seq("continue", ";"),

    expression_statement: ($) => seq(
      field("expression", choice($.expression_list, $._expression)),
      ";",
    ),

    expression_list: ($) => prec.left(seq(
      field("left", $._expression),
      repeat1(seq(",", field("right", $._expression))),
    )),

    _expression: ($) => choice(
      $.assignment_expression,
      $.ternary_expression,
      $.binary_expression,
      $.tagged_expression,
      $.sizeof_expression,
      $.unary_expression,
      $.update_expression,
      $.call_expression,
      $.subscript_expression,
      $.parenthesized_expression,
      $.identifier,
      $._literal,
    ),

    sizeof_expression: ($) => prec(PREC.SIZEOF, choice(
      seq(
        "sizeof",
        field("argument", prec(PREC.SUBSCRIPT, $.subscript_expression)),
      ),
      seq(
        "sizeof",
        field("argument", $.identifier),
      ),
      seq(
        "sizeof",
        "(",
        field("argument", $.subscript_expression),
        ")",
      ),
      seq(
        "sizeof",
        "(",
        field("argument", $.identifier),
        ")",
      ),
    )),

    assignment_expression: ($) => prec.right(PREC.ASSIGNMENT, seq(
      field("left", choice($.identifier, $.subscript_expression)),
      field("operator", choice(
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "<<=",
        ">>=",
        "&=",
        "|=",
        "^=",
      )),
      field("right", $._expression),
    )),

    ternary_expression: ($) => prec.right(PREC.TERNARY, seq(
      field("condition", $._expression),
      "?",
      field("consequence", $._expression),
      ":",
      field("alternative", $._expression),
    )),

    binary_expression: ($) => binaryExpression($._expression, [
      ["||", PREC.LOGICAL_OR],
      ["&&", PREC.LOGICAL_AND],
      ["|", PREC.BITWISE_OR],
      ["^", PREC.BITWISE_XOR],
      ["&", PREC.BITWISE_AND],
      ["==", PREC.EQUALITY],
      ["!=", PREC.EQUALITY],
      ["<", PREC.RELATIONAL],
      ["<=", PREC.RELATIONAL],
      [">", PREC.RELATIONAL],
      [">=", PREC.RELATIONAL],
      ["<<", PREC.SHIFT],
      [">>", PREC.SHIFT],
      ["+", PREC.ADD],
      ["-", PREC.ADD],
      ["...", PREC.ADD],
      ["*", PREC.MULTIPLY],
      ["/", PREC.MULTIPLY],
      ["%", PREC.MULTIPLY],
    ]),

    unary_expression: ($) => prec.left(PREC.UNARY, seq(
      field("operator", choice("!", "~", "-", "+")),
      field("argument", $._expression),
    )),

    update_expression: ($) => choice(
      prec.left(PREC.UNARY, seq(
        field("argument", choice($.identifier, $.subscript_expression)),
        field("operator", choice("++", "--")),
      )),
      prec.right(PREC.UNARY, seq(
        field("operator", choice("++", "--")),
        field("argument", choice($.identifier, $.subscript_expression)),
      )),
    ),

    call_expression: ($) => prec.left(PREC.CALL, seq(
      field("function", choice(
        $.identifier,
        $.parenthesized_expression,
        $.subscript_expression,
        $.tagged_expression,
      )),
      field("arguments", $.argument_list),
    )),

    argument_list: ($) => seq(
      "(",
      optional($._argument_list_items),
      ")",
    ),

    _argument_list_items: ($) => seq(
      repeat($._conditional_directive),
      choice($.array_literal, $._expression),
      repeat(seq(
        ",",
        repeat($._conditional_directive),
        choice($.array_literal, $._expression),
      )),
      optional(","),
      repeat($._conditional_directive),
    ),

    subscript_expression: ($) => prec.left(PREC.SUBSCRIPT, seq(
      field("array", choice(
        $.identifier,
        $.call_expression,
        $.subscript_expression,
        $.parenthesized_expression,
      )),
      "[",
      field("index", choice($.expression_list, $._expression)),
      "]",
    )),

    tagged_expression: ($) => prec.right(PREC.CAST, seq(
      field("type", $.type),
      field("value", choice(
        $.identifier,
        $.parenthesized_expression,
        $.call_expression,
        $.subscript_expression,
        $.unary_expression,
        $._literal,
      )),
    )),

    parenthesized_expression: ($) => seq(
      "(",
      field("expression", choice($.expression_list, $._expression)),
      ")",
    ),

    array_literal: ($) => seq(
      "{",
      optional($._array_literal_items),
      "}",
    ),

    _array_literal_items: ($) => seq(
      repeat($._conditional_directive),
      choice($.array_literal, $._expression, $.ellipsis),
      repeat(seq(
        ",",
        repeat($._conditional_directive),
        choice($.array_literal, $._expression, $.ellipsis),
      )),
      optional(","),
      repeat($._conditional_directive),
    ),

    ellipsis: ($) => "...",

    directive_include: ($) => seq(
      preprocessor("include"),
      field("path", choice($.string_literal, $.system_lib_string)),
    ),

    directive_tryinclude: ($) => seq(
      preprocessor("tryinclude"),
      field("path", choice($.string_literal, $.system_lib_string)),
    ),

    directive_define: ($) => choice(
      seq(
        preprocessor("define"),
        field("name", $.identifier),
        field("parameters", $.macro_parameter_list),
        optional(seq(
          $._macro_value_separator,
          field("value", choice($.macro_replacement, $.preproc_text)),
        )),
      ),
      seq(
        preprocessor("define"),
        field("name", $.identifier),
        optional(seq(
          $._define_value_separator,
          field("value", choice($.macro_replacement, $.preproc_text)),
        )),
      ),
    ),

    macro_replacement: ($) => choice(
      $.preproc_do_while_expression,
      $.macro_if_statement,
      $.macro_switch_statement,
      $.macro_while_statement,
      $.macro_for_statement,
      $.macro_return_statement,
      $.macro_goto_statement,
      $.macro_break_statement,
      $.macro_continue_statement,
      $.macro_block,
      $.preproc_expression,
    ),

    directive_emit: ($) => seq(
      preprocessor("emit"),
      field("value", $.preproc_text),
    ),

    directive_pragma: ($) => seq(
      preprocessor("pragma"),
      field("name", $.identifier),
      optional(seq(
        token.immediate(/[ \t]+/),
        field("value", $.preproc_text),
      )),
    ),

    directive_undef: ($) => seq(
      preprocessor("undef"),
      field("name", $.identifier),
    ),

    directive_assert: ($) => seq(
      preprocessor("assert"),
      field("condition", $.preproc_expression),
    ),

    directive_error: ($) => seq(
      preprocessor("error"),
      optional(seq(
        token.immediate(/[ \t]+/),
        field("message", $.preproc_text),
      )),
    ),

    directive_warning: ($) => seq(
      preprocessor("warning"),
      optional(seq(
        token.immediate(/[ \t]+/),
        field("message", $.preproc_text),
      )),
    ),

    directive_line: ($) => seq(
      preprocessor("line"),
      field("number", $.integer_literal),
    ),

    directive_file: ($) => seq(
      preprocessor("file"),
      field("path", $.string_literal),
    ),

    directive_endinput: ($) => preprocessor("endinput"),

    _define_value_separator: ($) => token.immediate(/[ \t]+/),

    macro_parameter_list: ($) => seq(
      token.immediate("("),
      commaSep(choice($.macro_parameter, $.identifier)),
      ")",
    ),

    _macro_value_separator: ($) => token.immediate(/[ \t]+/),

    macro_parameter: ($) => token(seq("%", /[A-Za-z0-9_]+/)),

    directive_if: ($) => seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
    ),

    directive_elseif: ($) => seq(
      preprocessor("elseif"),
      field("condition", $.preproc_expression),
    ),

    directive_else: ($) => preprocessor("else"),

    directive_endif: ($) => preprocessor("endif"),

    preproc_expression: ($) => choice(
      $.preproc_assignment_expression,
      $.preproc_ternary_expression,
      $.preproc_binary_expression,
      $.preproc_unary_expression,
      $.preproc_sizeof_expression,
      $.preproc_call_expression,
      $.preproc_subscript_expression,
      $.preproc_parenthesized_expression,
      $.preproc_defined,
      $.macro_parameter,
      $.identifier,
      $.integer_literal,
      $.hex_literal,
      $.float_literal,
      $.string_literal,
      $.char_literal,
      $.boolean_literal,
      $.null_literal,
    ),

    preproc_assignment_expression: ($) => prec.right(PREC.ASSIGNMENT, seq(
      field("left", choice(
        $.identifier,
        $.macro_parameter,
        $.preproc_subscript_expression,
        $.preproc_parenthesized_expression,
      )),
      field("operator", choice(
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "<<=",
        ">>=",
        "&=",
        "|=",
        "^=",
      )),
      field("right", $.preproc_expression),
    )),

    preproc_ternary_expression: ($) => prec.right(PREC.TERNARY, seq(
      field("condition", $.preproc_expression),
      "?",
      field("consequence", $.preproc_expression),
      ":",
      field("alternative", $.preproc_expression),
    )),

    preproc_binary_expression: ($) => binaryExpression($.preproc_expression, [
      ["||", PREC.LOGICAL_OR],
      ["&&", PREC.LOGICAL_AND],
      ["|", PREC.BITWISE_OR],
      ["^", PREC.BITWISE_XOR],
      ["&", PREC.BITWISE_AND],
      ["==", PREC.EQUALITY],
      ["!=", PREC.EQUALITY],
      ["<", PREC.RELATIONAL],
      ["<=", PREC.RELATIONAL],
      [">", PREC.RELATIONAL],
      [">=", PREC.RELATIONAL],
      ["<<", PREC.SHIFT],
      [">>", PREC.SHIFT],
      ["+", PREC.ADD],
      ["-", PREC.ADD],
      ["*", PREC.MULTIPLY],
      ["/", PREC.MULTIPLY],
      ["%", PREC.MULTIPLY],
    ]),

    preproc_unary_expression: ($) => prec.left(PREC.UNARY, seq(
      field("operator", choice("!", "~", "-", "+")),
      field("argument", $.preproc_expression),
    )),

    preproc_parenthesized_expression: ($) => seq(
      "(",
      field("expression", $.preproc_expression),
      ")",
    ),

    preproc_sizeof_expression: ($) => seq(
      "sizeof",
      "(",
      field("argument", $.preproc_expression),
      ")",
    ),

    preproc_do_while_expression: ($) => seq(
      "do",
      field("body", $.macro_block),
      "while",
      "(",
      field("condition", $.preproc_expression),
      ")",
    ),

    macro_block: ($) => seq(
      "{",
      repeat($.macro_statement),
      "}",
    ),

    macro_statement: ($) => choice(
      $.macro_if_statement,
      $.macro_switch_statement,
      $.macro_while_statement,
      $.macro_for_statement,
      $.macro_return_statement,
      $.macro_goto_statement,
      $.macro_break_statement,
      $.macro_continue_statement,
      $.macro_expression_statement,
      $.macro_block,
    ),

    macro_if_statement: ($) => prec.right(seq(
      "if",
      "(",
      field("condition", $.preproc_expression),
      ")",
      field("consequence", $.macro_control_statement),
      optional(seq(
        "else",
        field("alternative", $.macro_control_statement),
      )),
    )),

    macro_switch_statement: ($) => seq(
      "switch",
      "(",
      field("condition", $.preproc_expression),
      ")",
      "{",
      repeat(choice($.macro_case_statement, $.macro_default_statement)),
      "}",
    ),

    macro_case_statement: ($) => seq(
      "case",
      field("value", choice($.macro_case_value_list, $.macro_case_value)),
      ":",
      repeat($.macro_statement),
    ),

    macro_case_value: ($) => choice(
      $.macro_case_range,
      $.preproc_expression,
    ),

    macro_case_range: ($) => seq(
      field("start", $.preproc_expression),
      "..",
      field("end", $.preproc_expression),
    ),

    macro_case_value_list: ($) => seq(
      field("left", $.macro_case_value),
      repeat1(seq(",", field("right", $.macro_case_value))),
    ),

    macro_default_statement: ($) => seq(
      "default",
      ":",
      repeat($.macro_statement),
    ),

    macro_control_statement: ($) => choice(
      $.macro_block,
      $.macro_if_statement,
      $.macro_switch_statement,
      $.macro_while_statement,
      $.macro_for_statement,
      $.macro_return_statement,
      $.macro_goto_statement,
      $.macro_break_statement,
      $.macro_continue_statement,
      $.macro_expression_statement,
    ),

    macro_return_statement: ($) => choice(
      seq(
        "return",
        field("value", $.preproc_expression),
        optional(";"),
      ),
      seq("return", ";"),
    ),

    macro_while_statement: ($) => seq(
      "while",
      "(",
      field("condition", $.preproc_expression),
      ")",
      field("body", $.macro_control_statement),
    ),

    macro_for_statement: ($) => seq(
      "for",
      "(",
      field("initializer", optional($.preproc_expression)),
      ";",
      field("condition", optional($.preproc_expression)),
      ";",
      field("update", optional($.preproc_expression)),
      ")",
      field("body", $.macro_control_statement),
    ),

    macro_goto_statement: ($) => seq(
      "goto",
      field("label", choice($.identifier, $.macro_parameter)),
      optional(";"),
    ),

    macro_break_statement: ($) => seq("break", optional(";")),

    macro_continue_statement: ($) => seq("continue", optional(";")),

    macro_expression_statement: ($) => seq(
      field("expression", $.preproc_expression),
      ";",
    ),

    preproc_subscript_expression: ($) => prec.left(PREC.SUBSCRIPT, seq(
      field("array", choice(
        $.identifier,
        $.macro_parameter,
        $.preproc_call_expression,
        $.preproc_subscript_expression,
        $.preproc_parenthesized_expression,
      )),
      "[",
      field("index", $.preproc_expression),
      "]",
    )),

    preproc_call_expression: ($) => prec.left(PREC.CALL, seq(
      field("function", choice($.identifier, $.macro_parameter)),
      "(",
      commaSep($.preproc_expression),
      ")",
    )),

    preproc_defined: ($) => choice(
      seq("defined", field("name", $.identifier)),
      seq("defined", "(", field("name", $.identifier), ")"),
    ),

    preproc_text: ($) => token(prec(-1, /([^\\\r\n]|\\\r?\n|\\)+/)),

    _literal: ($) => choice(
      $.integer_literal,
      $.hex_literal,
      $.float_literal,
      $.string_literal,
      $.char_literal,
      $.boolean_literal,
      $.null_literal,
    ),

    integer_literal: ($) => token(/[0-9][0-9_]*/),

    hex_literal: ($) => token(/0[xX][0-9a-fA-F][0-9a-fA-F_]*/),

    float_literal: ($) => token(choice(
      /[0-9][0-9_]*\.[0-9][0-9_]*([eE][+-]?[0-9][0-9_]*)?/,
      /[0-9][0-9_]*[eE][+-]?[0-9][0-9_]*/,
    )),

    string_literal: ($) => seq(
      '"',
      repeat(choice($.escape_sequence, token.immediate(/[^"\\\r\n]+/))),
      '"',
    ),

    char_literal: ($) => seq(
      "'",
      repeat1(choice($.escape_sequence, token.immediate(/[^'\\\r\n]+/))),
      "'",
    ),

    escape_sequence: ($) => token.immediate(seq(
      "\\",
      choice(/[^xu]/, /x[0-9a-fA-F]{2}/, /u[0-9a-fA-F]{4}/),
    )),

    boolean_literal: ($) => choice("true", "false"),

    null_literal: ($) => "null",

    system_lib_string: ($) => token(seq("<", /[^>\r\n]+/, ">")),

    identifier: ($) => /[A-Za-z_][A-Za-z0-9_]*/,

    comment: ($) => token(choice(
      seq("//", /.*/),
      seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
    )),
  },
});

function preprocessor(keyword) {
  return token(seq("#", /[ \t]*/, keyword));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function binaryExpression(rule, table) {
  return choice(
    ...table.map(([operator, precedence]) => prec.left(precedence, seq(
      field("left", rule),
      field("operator", operator),
      field("right", rule),
    ))),
  );
}
