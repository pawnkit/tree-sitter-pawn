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

const ASSIGNMENT_OPERATORS = [
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
];

const UNARY_OPERATORS = ["!", "~", "-", "+"];
const UPDATE_OPERATORS = ["++", "--"];

module.exports = grammar({
  name: "pawn",

  extras: ($) => [/\s|\\\r?\n/, $.comment],

  word: ($) => $.identifier,

  externals: ($) => [
    $._callback_signature_start,
    $._statement_line_terminator,
    $._directive_line_terminator,
    $._unsupported_define_header,
    $._unsupported_macro_parameter_list,
  ],

  inline: ($) => [
    $._expression_not_binary,
    $._block_statement_base,
    $._statement_base,
    $._nonblock_statement_base,
  ],

  conflicts: ($) => [
    [$._declaration_qualifier, $._function_modifier],
    [$._function_modifier, $.variable_declaration],
    [$._callback_named_identifier, $.variable_declarator],
    [
      $._callback_named_identifier,
      $.variable_declarator,
      $._state_variable_declarator,
    ],
    [$.variable_declarator, $._state_variable_declarator],
    // A generic top-level macro invocation and a bare function signature both start with `identifier(`.
    [$.macro_invocation_statement, $._function_name],
    [$._function_name, $.tagged_type],
    [$._sizeof_subscript_expression, $.subscript_expression],
    // Semicolonless braceless return bodies expose the existing `sizeof value[...]`
    // ambiguity between a complete sizeof-expression and a longer sizeof-subscript tail.
    [$.sizeof_expression, $._sizeof_subscript_expression],
    [$.expression_list, $._argument_list_item],
    [$.parenthesized_expression, $._argument_list_item],
    [
      $._prefixed_function_definition_signature,
      $.prefixed_function_declaration,
      $.variable_declaration,
    ],
    [$._prefixed_function_definition_signature, $.variable_declaration],
    [$.macro_iterator, $._expression],
    [$._macro_iterator_argument_list, $.macro_iterator],
  ],

  supertypes: ($) => [
    $._expression,
    $._statement,
    $._declaration,
    $._type,
    $._literal,
    $._preproc_expression,
  ],

  rules: {
    // Root and top-level forms
    source_file: ($) => optional($._source_file_items),

    _source_file_items: ($) =>
      choice($._top_level_item, seq($._top_level_item, $._source_file_items)),

    _declaration: ($) =>
      choice(
        $.function_definition,
        $.function_declaration,
        $.prefixed_function_declaration,
        $.variable_declaration,
        $.enum_declaration,
      ),

    _top_level_item: ($) =>
      choice($.top_level_conditional, $._top_level_item_base),

    _top_level_item_base: ($) =>
      choice(
        $._declaration,
        $.macro_invocation_statement,
        ...nonBranchDirectiveStatementChoices($),
      ),

    ...directiveIfGroup(
      {
        ifName: "top_level_conditional",
        elseifName: "top_level_elseif",
        elseName: "top_level_else",
      },
      ($) => $._top_level_item,
    ),

    ...directiveIfGroup(
      {
        ifName: "block_conditional",
        elseifName: "block_elseif",
        elseName: "block_else",
      },
      ($) => $._block_conditional_item,
      1,
    ),

    _block_conditional_item: ($) =>
      choice($.block_conditional, $._block_statement_base),

    _preproc_list_directives: ($) =>
      prec.right(
        choice(
          $._preproc_list_directive,
          seq($._preproc_list_directive, $._preproc_list_directives),
        ),
      ),

    _preproc_list_directive: ($) =>
      choice($.preproc_if, $.preproc_elseif, $.preproc_else, $.preproc_endif),

    // Function and declaration forms
    function_definition: ($) => functionDefinitionWithBody($, $._function_body),

    _prefixed_function_definition_signature: ($) =>
      choice(
        seq(
          repeat($._function_modifier),
          field("prefix", $.identifier),
          prefixedFunctionSignatureTail($),
        ),
        seq(
          field("prefix", $.identifier),
          repeat1($._function_modifier),
          prefixedFunctionSignatureTail($),
        ),
      ),

    _plain_function_definition_signature: ($) =>
      seq(repeat($._function_modifier), functionSignatureTail($)),

    _bare_function_definition_signature: ($) => functionSignatureTail($),

    _alternative_function_definition_signature: ($) =>
      seq(
        repeat1(choice("public", "stock")),
        repeat("static"),
        functionSignatureTail($),
      ),

    _function_definition_signature: ($) =>
      choice(
        $._prefixed_function_definition_signature,
        $._plain_function_definition_signature,
      ),

    _function_body: ($) => functionBodyChoice($, { blockRule: $.block }),

    macro_invocation_statement: ($) =>
      prec.right(
        seq(
          field("name", macroNamedIdentifier($)),
          field("arguments", $.argument_list),
          optional(";"),
        ),
      ),

    _macro_iterator_invocation_statement: ($) =>
      prec.dynamic(
        2,
        seq(
          field("name", macroNamedIdentifier($)),
          field(
            "arguments",
            alias($._macro_iterator_argument_list, $.argument_list),
          ),
          ";",
        ),
      ),

    _macro_iterator_argument_list: ($) => seq("(", $._new_macro_iterator, ")"),

    macro_invocation_block_statement: ($) =>
      seq(
        field("name", macroNamedIdentifier($)),
        field("arguments", $.argument_list),
        field("body", $.block),
      ),

    function_declaration: ($) =>
      seq(
        field("kind", choice("forward", "native")),
        choice(
          functionDeclarationSignatureTail($),
          seq(
            field("name", alias($._function_member_name, $.member_expression)),
            field(
              "parameters",
              choice($.parameter_list, $.parameter_list_reference),
            ),
          ),
        ),
        optional(seq("=", field("alias", $.identifier))),
        ";",
      ),

    prefixed_function_declaration: ($) =>
      choice(
        seq(
          field("prefix", $.identifier),
          functionDeclarationSignatureTail($),
          ";",
        ),
        prec.dynamic(
          5,
          seq(
            field("return_type", $.tagged_type),
            $._function_named_identifier,
            field("parameters", $.parameter_list),
            "=",
            field("value", choice($.expression_list, $._expression)),
            ";",
          ),
        ),
      ),

    _function_modifier: ($) => choice("public", "stock", "static"),

    state_classifier: ($) =>
      seq(
        "<",
        optional(commaSep1(choice($.scoped_state_entry, $.state_name))),
        ">",
      ),

    scoped_state_entry: ($) =>
      seq(field("scope", $.state_name), ":", field("state", $.state_name)),

    state_name: ($) => token(choice("default", /[A-Za-z_][A-Za-z0-9_]*/)),

    callback_signature: ($) =>
      seq(
        $._callback_signature_start,
        optional(
          field(
            "types",
            choice($.identifier, $.tag_wildcard, $.macro_parameter),
          ),
        ),
        ">",
      ),

    _function_name: ($) =>
      choice($.identifier, $.at_identifier, $.operator_name),

    _function_named_identifier: ($) =>
      seq(
        field("name", $._function_name),
        optional(field("callback_signature", $.callback_signature)),
      ),

    _callback_named_identifier: ($) =>
      seq(
        field("name", $.identifier),
        optional(field("callback_signature", $.callback_signature)),
      ),

    parameter_list: ($) => seq("(", optional($._parameter_list_items), ")"),

    parameter_list_reference: ($) =>
      choice($.identifier, $.macro_pasted_identifier),

    _parameter_list_item: ($) =>
      choice($.parameter_declaration, $.variadic_parameter),

    _parameter_list_items: ($) =>
      directiveSeparatedList($, $._parameter_list_item, $._parameter_list_tail),

    _parameter_list_tail: ($) =>
      directiveSeparatedListTail(
        $,
        $._parameter_list_item,
        $._parameter_list_tail,
      ),

    parameter_declaration: ($) =>
      seq(
        repeat(choice("const", "stock")),
        optional("&"),
        optional(field("type", $._type)),
        optional("&"),
        $._callback_named_identifier,
        repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
        optional(
          seq(
            "=",
            field("default_value", choice($.array_literal, $._expression)),
          ),
        ),
      ),

    variadic_parameter: ($) =>
      choice(
        "...",
        seq(field("type", $.tagged_type), "..."),
        seq(field("tag_set", $.variadic_tag_set), "..."),
      ),

    tag_set_type: ($) =>
      seq(
        "{",
        commaSep1(choice($.identifier, $.tag_wildcard)),
        "}",
        token.immediate(":"),
      ),

    variadic_tag_set: ($) =>
      seq(
        "{",
        commaSep1(choice($.identifier, $.tag_wildcard)),
        "}",
        token.immediate(":"),
      ),

    tag_wildcard: ($) => "_",

    variable_declaration: ($) =>
      choice(
        seq(
          repeat(field("prefix", $.identifier)),
          $._variable_declaration_prefix,
          repeat(
            field("qualifier_reference", $.declaration_qualifier_reference),
          ),
          $._variable_declarator_list,
          ";",
        ),
        prec(
          1,
          seq(
            repeat(field("prefix", $.identifier)),
            $._variable_declaration_prefix,
            repeat(
              field("qualifier_reference", $.declaration_qualifier_reference),
            ),
            alias($._state_variable_declarator, $.variable_declarator),
            statementTerminator($),
          ),
        ),
      ),

    _variable_declaration_prefix: ($) =>
      repeat1(choice($._declaration_qualifier, "public", "stock")),

    _qualified_variable_declaration_clause: ($) =>
      prec.left(
        seq(
          repeat1($._declaration_qualifier),
          commaSep1($.variable_declarator),
        ),
      ),

    declaration_qualifier_reference: ($) =>
      prec(-1, choice($.identifier, $.macro_pasted_identifier)),

    _variable_declarator_list: ($) =>
      prec(
        1,
        directiveSeparatedList(
          $,
          $.variable_declarator,
          $._variable_declarator_list_tail,
        ),
      ),

    _variable_declarator_list_tail: ($) =>
      directiveSeparatedListTail(
        $,
        $.variable_declarator,
        $._variable_declarator_list_tail,
      ),

    _declaration_qualifier: ($) => choice("new", "const", "static"),

    variable_declarator: ($) =>
      choice(
        seq(
          optional(field("type", $.tagged_type)),
          $._callback_named_identifier,
          repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
          optional(
            seq(
              "=",
              field("initializer", choice($.array_literal, $._expression)),
            ),
          ),
        ),
        seq(
          optional(field("type", $.tagged_type)),
          field("name", $.identifier),
          repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
          field("state", $.state_classifier),
        ),
      ),

    _state_variable_declarator: ($) =>
      seq(
        optional(field("type", $.tagged_type)),
        field("name", $.identifier),
        repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
        field("state", $.state_classifier),
      ),

    enum_declaration: ($) =>
      prec.right(
        seq(
          "enum",
          optional(field("name", $.identifier)),
          optional(
            seq(
              ":",
              optional(field("type", choice($.identifier, $.tag_wildcard))),
            ),
          ),
          optional(field("increment", $.enum_increment_clause)),
          "{",
          optional($._enum_entries),
          "}",
          optional(";"),
        ),
      ),

    enum_increment_clause: ($) =>
      seq(
        "(",
        field(
          "operator",
          choice(
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
          ),
        ),
        field("value", choice($.expression_list, $._expression)),
        ")",
      ),

    _enum_entries: ($) =>
      directiveSeparatedList($, $.enum_entry, $._enum_entries_tail),

    _enum_entries_tail: ($) =>
      directiveSeparatedListTail($, $.enum_entry, $._enum_entries_tail),

    enum_entry: ($) =>
      seq(
        optional(field("type", $.tagged_type)),
        $._callback_named_identifier,
        repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
        optional(seq("=", field("value", $._expression))),
      ),

    // Types and tags
    tagged_type: ($) =>
      seq(
        field("tag", choice($.identifier, $.tag_wildcard)),
        optional(field("callback_signature", $.callback_signature)),
        token.immediate(":"),
      ),

    dimension: ($) => seq("[", "]"),

    fixed_dimension: ($) =>
      seq("[", field("size", choice($.expression_list, $._expression)), "]"),

    packed_dimension: ($) =>
      seq(
        "[",
        field("size", choice($.expression_list, $._expression)),
        field("storage", $.packed_storage),
        "]",
      ),

    packed_storage: ($) => "char",

    // Statements and conditional statement layouts
    block: ($) => seq("{", repeat($._block_statement), "}"),

    _block_statement: ($) =>
      choice($.block_conditional, $._block_statement_base),

    _block_statement_base: ($) => blockStatementBaseChoice($),

    _statement: ($) => choice($.block_conditional, $._statement_base),

    _statement_base: ($) => blockStatementBaseChoice($),

    _nonempty_statement: ($) =>
      prec(1, choice($.block_conditional, $._nonempty_statement_base)),

    _nonempty_statement_base: ($) =>
      prec(1, blockStatementBaseChoice($, { includeEmpty: false })),

    _nonblock_statement: ($) =>
      choice($.block_conditional, $._nonblock_statement_base),

    _nonblock_statement_base: ($) => statementChoice($),

    if_statement: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("condition", choice($.expression_list, $._expression)),
          ")",
          field("consequence", $._statement),
          optional(seq("else", field("alternative", $._statement))),
        ),
      ),

    switch_statement: ($) =>
      seq(
        "switch",
        "(",
        field("condition", choice($.expression_list, $._expression)),
        ")",
        "{",
        repeat($._switch_item),
        "}",
      ),

    ...directiveIfGroup(
      {
        ifName: "switch_item_conditional",
        elseifName: "switch_item_elseif",
        elseName: "switch_item_else",
      },
      ($) => $._switch_item_base,
    ),

    _switch_item: ($) => choice($.switch_item_conditional, $._switch_item_base),

    _switch_item_base: ($) => choice($.case_statement, $.default_statement),

    case_statement: ($) =>
      prec.right(
        1,
        seq(
          "case",
          field("value", choice($.case_value_list, $._case_value)),
          ":",
          repeat($._statement),
        ),
      ),

    _case_value: ($) => choice($.case_range, $._case_expression),

    _case_expression: ($) =>
      choice(
        $.ternary_expression,
        $.binary_expression,
        $.sizeof_expression,
        $.unary_expression,
        $.update_expression,
        $.call_expression,
        $.subscript_expression,
        $.parenthesized_expression,
        alias($._case_identifier, $.identifier),
        $._literal,
      ),

    _case_identifier: ($) => token(prec(1, /[A-Za-z_][A-Za-z0-9_]*/)),

    case_range: ($) =>
      seq(
        field("start", $._case_expression),
        "..",
        field("end", $._case_expression),
      ),

    case_value_list: ($) =>
      seq(
        field("left", $._case_value),
        repeat1(seq(",", field("right", $._case_value))),
      ),

    default_statement: ($) =>
      prec.right(1, seq("default", ":", repeat($._statement))),

    state_statement: ($) =>
      prec.right(
        seq(
          "state",
          optional(field("condition", $.parenthesized_expression)),
          field("scope", $.state_name),
          optional(seq(":", commaSep1($.state_name))),
          optional(";"),
        ),
      ),

    while_statement: ($) =>
      seq(
        "while",
        "(",
        field("condition", choice($.expression_list, $._expression)),
        ")",
        field("body", $._statement),
      ),

    _macro_iterator_loop_header: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        field("iterator", $.macro_iterator),
        ")",
      ),

    macro_iterator_loop_statement: ($) =>
      prec.right(
        seq(
          $._macro_iterator_loop_header,
          field("body", $._nonempty_statement),
        ),
      ),

    _new_macro_iterator: ($) =>
      seq(
        "new",
        optional(field("type", $.tagged_type)),
        field("name", $.identifier),
        ":",
        field("collection", $.identifier),
      ),

    macro_iterator: ($) =>
      choice(
        $._new_macro_iterator,
        seq(
          field("collection", $.identifier),
          ",",
          field("name", $.identifier),
        ),
      ),

    _for_header: ($) =>
      seq(
        "for",
        "(",
        field(
          "initializer",
          optional(
            choice(
              $._qualified_variable_declaration_clause,
              $.expression_list,
              $._expression,
            ),
          ),
        ),
        ";",
        field("condition", optional(choice($.expression_list, $._expression))),
        ";",
        field("update", optional(choice($.expression_list, $._expression))),
        ")",
      ),

    do_while_statement: ($) =>
      seq(
        "do",
        field("body", $._statement),
        "while",
        "(",
        field("condition", choice($.expression_list, $._expression)),
        ")",
        ";",
      ),

    for_statement: ($) =>
      prec.right(seq($._for_header, field("body", $._statement))),

    goto_statement: ($) => seq("goto", field("label", $.identifier), ";"),

    label_statement: ($) =>
      prec(
        1,
        choice(
          seq(field("label", $.identifier), token.immediate(/:[ \t]*(\r?\n)+/)),
          seq(
            field("label", $.identifier),
            token.immediate(":"),
            field("statement", $.inline_labeled_statement),
          ),
        ),
      ),

    inline_labeled_statement: ($) =>
      choice(
        $.block,
        $.variable_declaration,
        $.inline_callback_definition,
        $.call_statement,
        $.assert_statement,
        $.exit_statement,
        $.sleep_statement,
        $.if_statement,
        $.switch_statement,
        $.while_statement,
        $.macro_iterator_loop_statement,
        $.do_while_statement,
        $.for_statement,
        $.goto_statement,
        $.return_statement,
        $.break_statement,
        $.continue_statement,
        $.expression_statement,
        $.preproc_include,
        $.preproc_tryinclude,
        $.preproc_define,
        $.preproc_emit,
        $.preproc_pragma,
        $.preproc_undef,
        $.preproc_assert,
        $.preproc_error,
        $.preproc_warning,
        $.preproc_line,
        $.preproc_file,
        $.preproc_endinput,
      ),

    return_statement: ($) =>
      seq(
        "return",
        optional(field("value", choice($.expression_list, $._expression))),
        ";",
      ),

    _unterminated_return_statement: ($) =>
      prec.right(
        1,
        seq("return", field("value", $._unterminated_return_value)),
      ),

    break_statement: ($) => seq("break", ";"),

    continue_statement: ($) => seq("continue", ";"),

    inline_callback_definition: ($) =>
      seq(
        "inline",
        optional(field("qualifier", "const")),
        field("name", $._function_name),
        field("parameters", $.parameter_list),
        field("body", $.block),
      ),

    prefixed_call_statement: ($) =>
      prec(
        1,
        seq(
          field("prefix", $.identifier),
          field("call", $.call_expression),
          ";",
        ),
      ),

    assert_statement: ($) =>
      seq(
        "assert",
        field("condition", choice($.expression_list, $._expression)),
        statementTerminator($),
      ),

    exit_statement: ($) =>
      seq(
        "exit",
        optional(field("value", choice($.expression_list, $._expression))),
        statementTerminator($),
      ),

    sleep_statement: ($) =>
      seq(
        "sleep",
        optional(field("value", choice($.expression_list, $._expression))),
        statementTerminator($),
      ),

    empty_statement: ($) => ";",

    call_statement: ($) =>
      prec.dynamic(
        5,
        seq(
          field("call", alias($._bare_call_expression, $.call_expression)),
          statementTerminator($),
        ),
      ),

    expression_statement: ($) =>
      seq(
        field(
          "expression",
          choice($.statement_expression_list, $._statement_expression),
        ),
        statementTerminator($),
      ),

    expression_list: ($) =>
      prec.left(
        seq(
          field("left", $._expression),
          repeat1(seq(",", field("right", $._expression))),
        ),
      ),

    statement_expression_list: ($) =>
      prec.left(
        seq(
          field("left", $._statement_expression),
          repeat1(seq(",", field("right", $._statement_expression))),
        ),
      ),

    // Expressions and literals
    _expression: ($) => choice($._expression_not_binary, $.binary_expression),

    _statement_expression: ($) =>
      choice($._statement_expression_not_binary, $.binary_expression),

    _expression_not_binary: ($) =>
      choice(
        $.assignment_expression,
        $.ternary_expression,
        $.adjacent_string_expression,
        $.bare_type_expression,
        $.packed_storage_expression,
        $.callback_suffix_expression,
        $.tagged_expression,
        $.tagof_expression,
        $.function_reference_expression,
        $.sizeof_expression,
        $.unary_expression,
        $.update_expression,
        $.member_expression,
        $.call_expression,
        $.callback_member_expression,
        $.packed_subscript_expression,
        $.subscript_expression,
        $.parenthesized_expression,
        $.identifier,
        $._literal,
      ),

    _statement_expression_not_binary: ($) =>
      choice(
        $.assignment_expression,
        $.ternary_expression,
        $.bare_type_expression,
        $.packed_storage_expression,
        $.callback_suffix_expression,
        $.tagged_expression,
        $.tagof_expression,
        $.function_reference_expression,
        $.sizeof_expression,
        $.unary_expression,
        $.update_expression,
        $.member_expression,
        $.call_expression,
        $.callback_member_expression,
        $.packed_subscript_expression,
        $.subscript_expression,
        $.parenthesized_expression,
        $.identifier,
        $._literal,
      ),

    _unterminated_return_value: ($) =>
      choice(
        $.expression_list,
        $.binary_expression,
        $.assignment_expression,
        $.ternary_expression,
        $.adjacent_string_expression,
        $.bare_type_expression,
        $.packed_storage_expression,
        $.callback_suffix_expression,
        $.tagged_expression,
        $.tagof_expression,
        $.function_reference_expression,
        $.unary_expression,
        $.update_expression,
        $.member_expression,
        $.call_expression,
        $.callback_member_expression,
        $.packed_subscript_expression,
        $.subscript_expression,
        $.parenthesized_expression,
        $.identifier,
        $._literal,
      ),

    _adjacent_string_atom: ($) =>
      choice($.identifier, $.string_literal, $.function_reference_expression),

    adjacent_string_expression: ($) =>
      prec.left(
        PREC.ADD,
        choice(
          seq(
            field("left", $.function_reference_expression),
            field("right", $.string_literal),
            repeat(field("right", $._adjacent_string_atom)),
          ),
          seq(
            field("left", $.identifier),
            field("right", $.identifier),
            repeat(field("right", $._adjacent_string_atom)),
          ),
          seq(
            field("left", choice($.identifier, $.string_literal)),
            field("right", $.string_literal),
            repeat(field("right", $._adjacent_string_atom)),
          ),
          seq(
            field("left", $.string_literal),
            field(
              "right",
              choice($.identifier, $.function_reference_expression),
            ),
            repeat(field("right", $._adjacent_string_atom)),
          ),
        ),
      ),

    function_reference_expression: ($) =>
      prec(PREC.UNARY, seq("#", field("argument", $._function_name))),

    sizeof_expression: ($) =>
      prec(
        PREC.SIZEOF,
        choice(
          seq(
            "sizeof",
            field(
              "argument",
              prec(PREC.SUBSCRIPT, $._sizeof_subscript_expression),
            ),
          ),
          seq("sizeof", field("argument", $.identifier)),
          seq(
            "sizeof",
            "(",
            field("argument", $._sizeof_subscript_expression),
            ")",
          ),
          seq("sizeof", "(", field("argument", $.identifier), ")"),
        ),
      ),

    _sizeof_subscript_expression: ($) =>
      prec.left(
        PREC.SUBSCRIPT,
        seq(
          field(
            "array",
            choice(
              $.identifier,
              $.call_expression,
              $._sizeof_subscript_expression,
              $.subscript_expression,
              $.parenthesized_expression,
            ),
          ),
          "[",
          optional(field("index", choice($.expression_list, $._expression))),
          "]",
        ),
      ),

    assignment_expression: ($) =>
      prec.right(
        PREC.ASSIGNMENT,
        seq(
          field(
            "left",
            choice(
              $.identifier,
              $.subscript_expression,
              $.packed_subscript_expression,
              $.tagged_expression,
              $.member_expression,
              $.callback_member_expression,
            ),
          ),
          field("operator", choice(...ASSIGNMENT_OPERATORS)),
          field("right", $._expression),
        ),
      ),

    ternary_expression: ($) =>
      prec.right(
        PREC.TERNARY,
        seq(
          field("condition", $._expression),
          "?",
          field("consequence", $._expression),
          ":",
          field("alternative", $._expression),
        ),
      ),

    binary_expression: ($) =>
      binaryExpression($._expression, [
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
        [">>>", PREC.SHIFT],
        [">>", PREC.SHIFT],
        ["+", PREC.ADD],
        ["-", PREC.ADD],
        ["...", PREC.ADD],
        ["*", PREC.MULTIPLY],
        ["/", PREC.MULTIPLY],
        ["%", PREC.MULTIPLY],
      ]),

    unary_expression: ($) =>
      prec.left(
        PREC.UNARY,
        seq(
          field("operator", choice(...UNARY_OPERATORS)),
          field("argument", $._expression),
        ),
      ),

    update_expression: ($) =>
      choice(
        prec.left(
          PREC.UNARY,
          seq(
            field("argument", choice($.identifier, $.subscript_expression)),
            field("operator", choice(...UPDATE_OPERATORS)),
          ),
        ),
        prec.right(
          PREC.UNARY,
          seq(
            field("operator", choice(...UPDATE_OPERATORS)),
            field("argument", choice($.identifier, $.subscript_expression)),
          ),
        ),
      ),

    callback_member_expression: ($) =>
      prec(PREC.CALL, seq("@", ".", field("name", $.identifier))),

    _function_member_name: ($) =>
      seq(field("object", $.identifier), ".", field("property", $.identifier)),

    callback_suffix_expression: ($) =>
      prec.left(
        PREC.CALL,
        seq(
          field(
            "value",
            choice(
              $.tagged_expression,
              $.identifier,
              $.member_expression,
              $.call_expression,
              $.subscript_expression,
              $.parenthesized_expression,
              $._literal,
            ),
          ),
          field("callback_signature", $.callback_signature),
        ),
      ),

    member_expression: ($) =>
      prec.left(
        PREC.CALL,
        seq(
          field(
            "object",
            choice(
              $.identifier,
              $.call_expression,
              $.subscript_expression,
              $.member_expression,
              $.parenthesized_expression,
            ),
          ),
          ".",
          field("property", $.identifier),
        ),
      ),

    call_expression: ($) =>
      prec.left(
        PREC.CALL,
        seq(
          field(
            "function",
            choice(
              $.identifier,
              $.callback_member_expression,
              $.member_expression,
              $.parenthesized_expression,
              $.subscript_expression,
              $.tagged_expression,
            ),
          ),
          field("arguments", $.argument_list),
        ),
      ),

    _bare_call_expression: ($) =>
      prec.dynamic(
        1,
        prec.left(
          PREC.CALL,
          seq(
            field(
              "function",
              choice(
                $.identifier,
                $.callback_member_expression,
                $.member_expression,
                $.subscript_expression,
                $.tagged_expression,
              ),
            ),
            field("arguments", alias($._bare_argument_list, $.argument_list)),
          ),
        ),
      ),

    _bare_call_argument: ($) =>
      choice(
        $.array_literal,
        $.named_argument,
        $.macro_reference_expression,
        $.tag_wildcard,
        $.bare_type_expression,
        $.packed_storage_expression,
        $.callback_suffix_expression,
        $.tagged_expression,
        $.tagof_expression,
        $.function_reference_expression,
        $.sizeof_expression,
        $.update_expression,
        $.member_expression,
        $.call_expression,
        $.callback_member_expression,
        $.packed_subscript_expression,
        $.subscript_expression,
        $.identifier,
        $._literal,
      ),

    _bare_argument_list: ($) =>
      seq($._bare_call_argument, repeat(seq(",", $._bare_call_argument))),

    argument_list: ($) => seq("(", optional($._argument_list_items), ")"),

    _argument_list_item: ($) =>
      choice(
        $.array_literal,
        $.named_argument,
        $.macro_reference_expression,
        $.operator_symbol,
        $.tag_wildcard,
        $._expression,
      ),

    macro_reference_expression: ($) =>
      prec(
        1,
        seq(
          field("prefix", $.identifier),
          field("modifier", $.identifier),
          field("name", $.identifier),
        ),
      ),

    _argument_list_items: ($) =>
      directiveSeparatedList($, $._argument_list_item, $._argument_list_tail),

    _argument_list_tail: ($) =>
      directiveSeparatedListTail(
        $,
        $._argument_list_item,
        $._argument_list_tail,
      ),

    named_argument: ($) =>
      seq(".", field("name", $.identifier), "=", field("value", $._expression)),

    subscript_expression: ($) =>
      prec.left(
        PREC.SUBSCRIPT,
        seq(
          field(
            "array",
            choice(
              $.identifier,
              $.call_expression,
              $.member_expression,
              $.subscript_expression,
              $.parenthesized_expression,
            ),
          ),
          "[",
          field("index", choice($.expression_list, $._expression)),
          "]",
        ),
      ),

    packed_subscript_expression: ($) =>
      prec.left(
        PREC.SUBSCRIPT,
        seq(
          field(
            "array",
            choice(
              $.identifier,
              $.call_expression,
              $.member_expression,
              $.subscript_expression,
              $.packed_subscript_expression,
              $.parenthesized_expression,
            ),
          ),
          token.immediate("{"),
          field("index", choice($.expression_list, $._expression)),
          "}",
        ),
      ),

    tagged_expression: ($) =>
      prec.right(
        PREC.CAST,
        seq(
          field("type", $.tagged_type),
          field(
            "value",
            choice(
              $.tagged_expression,
              $.identifier,
              $.parenthesized_expression,
              $.call_expression,
              $.subscript_expression,
              $.unary_expression,
              $._literal,
            ),
          ),
        ),
      ),

    tagof_expression: ($) =>
      prec(
        PREC.SIZEOF,
        choice(
          seq("tagof", field("argument", $.identifier)),
          seq("tagof", field("argument", $.bare_type_expression)),
          seq(
            "tagof",
            "(",
            field("argument", choice($.identifier, $.bare_type_expression)),
            ")",
          ),
        ),
      ),

    packed_storage_expression: ($) =>
      prec.right(
        PREC.CAST,
        seq(
          field(
            "value",
            choice(
              $.identifier,
              $.parenthesized_expression,
              $.call_expression,
              $.subscript_expression,
            ),
          ),
          field("storage", $.packed_storage),
        ),
      ),

    bare_type_expression: ($) => seq(field("type", $.tagged_type)),

    parenthesized_expression: ($) =>
      seq(
        "(",
        field("expression", choice($.expression_list, $._expression)),
        ")",
      ),

    array_literal: ($) => seq("{", optional($._array_literal_items), "}"),

    _array_literal_item: ($) => choice($.array_literal, $._expression, "..."),

    _array_literal_items: ($) =>
      directiveSeparatedList(
        $,
        $._array_literal_item,
        $._array_literal_items_tail,
      ),

    _array_literal_items_tail: ($) =>
      directiveSeparatedListTail(
        $,
        $._array_literal_item,
        $._array_literal_items_tail,
      ),

    // Preprocessor directives
    preproc_include: ($) => includeDirective($, "include"),

    preproc_tryinclude: ($) => includeDirective($, "tryinclude"),

    preproc_define: ($) =>
      choice(
        defineDirective(
          $,
          field(
            "unsupported_header",
            alias($._unsupported_define_header, $.preproc_text),
          ),
          optional(
            seq($._macro_value_separator, field("value", $.preproc_text)),
          ),
        ),
        defineDirective(
          $,
          token.immediate("("),
          token.immediate(/[ \t]+/),
          field("value", $.preproc_text),
        ),
        defineDirective(
          $,
          field("parameters", $.complex_macro_parameter_list),
          optional(
            seq($._macro_value_separator, field("value", $.preproc_text)),
          ),
        ),
        defineDirective(
          $,
          field("parameters", $.structured_macro_parameter_list),
          optional(
            seq($._macro_value_separator, field("value", $.preproc_text)),
          ),
        ),
        prec.right(
          1,
          defineDirective(
            $,
            field(
              "unsupported_parameters",
              alias($._unsupported_macro_parameter_list, $.preproc_text),
            ),
            field("value", $.preproc_text),
          ),
        ),
        prec.right(
          1,
          defineDirective(
            $,
            field(
              "unsupported_parameters",
              alias($._unsupported_macro_parameter_list, $.preproc_text),
            ),
            $._directive_line_terminator,
          ),
        ),
        prec.right(
          1,
          defineDirective(
            $,
            field("parameters", $.macro_parameter_list),
            field("value", $.preproc_text),
          ),
        ),
        defineDirective(
          $,
          field("parameters", $.macro_parameter_list),
          optional(
            seq($._macro_value_separator, field("value", defineValue($))),
          ),
        ),
        defineDirective(
          $,
          optional(
            seq($._macro_value_separator, field("value", defineValue($))),
          ),
        ),
      ),

    preproc_emit: ($) =>
      seq(preprocessor("emit"), field("value", $.preproc_text)),

    preproc_pragma: ($) =>
      namedDirective(
        $,
        "pragma",
        optional(
          seq(token.immediate(/[ \t]+/), field("value", $.preproc_text)),
        ),
      ),

    preproc_undef: ($) => namedDirective($, "undef"),

    preproc_assert: ($) =>
      seq(preprocessor("assert"), field("condition", $.preproc_expression)),

    preproc_error: ($) => messageDirective($, "error"),

    preproc_warning: ($) => messageDirective($, "warning"),

    preproc_line: ($) =>
      seq(preprocessor("line"), field("number", $.integer_literal)),

    preproc_file: ($) =>
      seq(preprocessor("file"), field("path", $.string_literal)),

    preproc_endinput: ($) => preprocessor("endinput"),

    macro_parameter_list: ($) =>
      seq(
        token.immediate("("),
        commaSep(
          choice($.macro_parameter, $.identifier, $.macro_colon_parameter),
        ),
        ")",
      ),

    structured_macro_parameter_list: ($) =>
      seq(
        token.immediate("("),
        $.braced_macro_parameter,
        repeat1(choice($.macro_parameter, $.braced_macro_parameter)),
        ")",
      ),

    complex_macro_parameter_list: ($) =>
      seq(
        token.immediate("("),
        field("left", $.complex_macro_parameter_header),
        repeat(
          seq(
            ",",
            field(
              "right",
              choice(
                $.macro_parameter,
                $.identifier,
                $.complex_macro_parameter_header,
              ),
            ),
          ),
        ),
        ")",
      ),

    _macro_value_separator: ($) => token.immediate(/[ \t]+/),

    macro_parameter: ($) => token(seq("%", /[A-Za-z0-9_]+/)),

    macro_colon_parameter: ($) =>
      seq(
        field("left", choice($.macro_parameter, $.identifier)),
        ":",
        field(
          "right",
          choice($.macro_parameter, $.identifier, $.macro_colon_parameter),
        ),
      ),

    complex_macro_parameter_header: ($) =>
      choice(
        seq(
          field("type", $.tagged_type),
          field("parameters", $.macro_parameter_list),
        ),
        seq(
          field(
            "name",
            choice($.identifier, $.macro_parameter, $.macro_pasted_identifier),
          ),
          field("parameters", $.macro_parameter_list),
        ),
      ),

    braced_macro_parameter: ($) => seq("{", $.macro_parameter, "}"),

    preproc_if: ($) =>
      seq(preprocessor("if"), field("condition", $.preproc_expression)),

    preproc_elseif: ($) =>
      seq(preprocessor("elseif"), field("condition", $.preproc_expression)),

    preproc_else: ($) => preprocessor("else"),

    preproc_endif: ($) => preprocessor("endif"),

    preproc_expression: ($) => $._preproc_expression,

    _preproc_expression: ($) =>
      choice(
        $.preproc_binary_expression,
        $.preproc_unary_expression,
        $.preproc_tagged_constant,
        $.preproc_parenthesized_expression,
        $.preproc_defined,
        $.identifier,
        $.integer_literal,
        $.binary_literal,
        $.hex_literal,
        $.float_literal,
        $.string_literal,
        $.char_literal,
        $.boolean_literal,
        $.null_literal,
      ),

    preproc_binary_expression: ($) =>
      binaryExpression($.preproc_expression, [
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
        [">>>", PREC.SHIFT],
        [">>", PREC.SHIFT],
        ["+", PREC.ADD],
        ["-", PREC.ADD],
        ["*", PREC.MULTIPLY],
        ["/", PREC.MULTIPLY],
        ["%", PREC.MULTIPLY],
      ]),

    preproc_unary_expression: ($) =>
      prec.left(
        PREC.UNARY,
        seq(
          field("operator", choice(...UNARY_OPERATORS)),
          field("argument", $.preproc_expression),
        ),
      ),

    preproc_tagged_constant: ($) =>
      seq(
        field("tag", $.identifier),
        token.immediate(":"),
        field("value", choice($.integer_literal, $.identifier)),
      ),

    preproc_parenthesized_expression: ($) =>
      seq("(", field("expression", $.preproc_expression), ")"),

    preproc_defined: ($) =>
      choice(
        seq("defined", field("name", $.identifier)),
        seq("defined", "(", field("name", $.identifier), ")"),
      ),

    preproc_text: ($) => token(prec(-1, /([^\\\r\n]|\\\r?\n|\\)+/)),

    _literal: ($) =>
      choice(
        $.integer_literal,
        $.binary_literal,
        $.hex_literal,
        $.float_literal,
        $.string_literal,
        $.char_literal,
        $.boolean_literal,
        $.null_literal,
      ),

    _type: ($) => choice($.tagged_type, $.tag_set_type),

    integer_literal: ($) => token(/[0-9][0-9_]*/),

    binary_literal: ($) => token(/0[bB][01][01_]*/),

    hex_literal: ($) => token(/0[xX][0-9a-fA-F][0-9a-fA-F_]*/),

    float_literal: ($) =>
      token(
        choice(
          /[0-9][0-9_]*\.[0-9][0-9_]*([eE][+-]?[0-9][0-9_]*)?/,
          /[0-9][0-9_]*[eE][+-]?[0-9][0-9_]*/,
        ),
      ),

    string_literal: ($) =>
      seq(
        '"',
        repeat(
          choice($.escape_sequence, token.immediate(prec(1, /[^"\\\r\n]+/))),
        ),
        '"',
      ),

    char_literal: ($) =>
      seq(
        "'",
        repeat1(
          choice($.escape_sequence, token.immediate(prec(1, /[^'\\\r\n]+/))),
        ),
        "'",
      ),

    escape_sequence: ($) =>
      token.immediate(
        seq("\\", choice(/[^xu]/, /x(?:[0-9a-fA-F]{2})?/, /u[0-9a-fA-F]{4}/)),
      ),

    boolean_literal: ($) => choice("true", "false"),

    null_literal: ($) => "null",

    system_lib_string: ($) => token(seq("<", /[^>\r\n]+/, ">")),

    macro_pasted_identifier: ($) =>
      token(
        choice(
          /[A-Za-z_][A-Za-z0-9_]*%[A-Za-z0-9_]+(?:[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z0-9_]+)*/,
          /%[A-Za-z0-9_]+[A-Za-z_][A-Za-z0-9_]*(?:[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z0-9_]+)*/,
        ),
      ),

    at_identifier: ($) => seq("@", $.identifier),

    define_at_identifier: ($) =>
      seq(
        "@",
        choice($.identifier, $.macro_pasted_identifier, $.define_at_identifier),
      ),

    operator_name: ($) => seq("operator", token.immediate(operatorSymbol())),

    operator_symbol: () => operatorSymbol(),

    // Lexical tokens
    identifier: ($) => /[A-Za-z_][A-Za-z0-9_]*(?:@+[A-Za-z0-9_]*)*/,

    comment: ($) =>
      token(
        choice(seq("//", /.*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
      ),
  },
});

function preprocessor(keyword) {
  return token(seq("#", /[ \t]*/, keyword));
}

function functionDefinitionWithBody($, body) {
  return seq($._function_definition_signature, field("body", body));
}

function functionSignatureTail($) {
  return seq(
    optional(field("return_type", $.tagged_type)),
    repeat(field("return_size", $.fixed_dimension)),
    $._function_named_identifier,
    field("parameters", $.parameter_list),
    optional(field("state", $.state_classifier)),
  );
}

function prefixedFunctionSignatureTail($) {
  return seq(
    optional(field("return_type", $.tagged_type)),
    repeat(field("return_size", $.fixed_dimension)),
    $._function_named_identifier,
    optional(field("interval", $.fixed_dimension)),
    field("parameters", $.parameter_list),
    optional(field("state", $.state_classifier)),
  );
}

function functionDeclarationSignatureTail($) {
  return seq(
    optional(field("return_type", $.tagged_type)),
    repeat(field("return_size", $.fixed_dimension)),
    $._function_named_identifier,
    field("parameters", choice($.parameter_list, $.parameter_list_reference)),
    optional(field("state", $.state_classifier)),
  );
}

function macroNamedIdentifier($) {
  return choice($.identifier, $.macro_pasted_identifier);
}

function defineName($) {
  return choice(macroNamedIdentifier($), $.define_at_identifier);
}

function defineDirective($, ...items) {
  return seq(preprocessor("define"), field("name", defineName($)), ...items);
}

function defineValue($) {
  return $.preproc_text;
}

function includeDirective($, keyword) {
  return seq(
    preprocessor(keyword),
    field("path", choice($.string_literal, $.system_lib_string)),
  );
}

function operatorSymbol() {
  return choice(
    "++",
    "--",
    "+",
    "-",
    "*",
    "/",
    "%",
    "||",
    "&&",
    "|",
    "^",
    "&",
    "~",
    "==",
    "!=",
    ">",
    ">=",
    "<=",
    "<",
    "<<",
    ">>",
    ">>>",
    "!",
    "=",
  );
}

function messageDirective($, keyword) {
  return seq(
    preprocessor(keyword),
    optional(seq(token.immediate(/[ \t]+/), field("message", $.preproc_text))),
  );
}

function namedDirective($, keyword, ...items) {
  return seq(preprocessor(keyword), field("name", $.identifier), ...items);
}

function directiveIfGroup(
  names,
  content,
  precedence = 0,
  fieldAlternatives = true,
) {
  const { ifName, elseifName, elseName } = names;
  const wrapRight = (rule) =>
    precedence === 0 ? prec.right(rule) : prec.right(precedence, rule);

  return {
    [ifName]: ($) =>
      wrapRight(
        seq(
          $.preproc_if,
          repeat(content($)),
          ...(fieldAlternatives
            ? [
                field(
                  "alternative",
                  optional(choice($[elseifName], $[elseName])),
                ),
              ]
            : [optional(choice($[elseifName], $[elseName]))]),
          $.preproc_endif,
        ),
      ),

    [elseifName]: ($) =>
      wrapRight(
        seq(
          $.preproc_elseif,
          repeat(content($)),
          ...(fieldAlternatives
            ? [
                field(
                  "alternative",
                  optional(choice($[elseifName], $[elseName])),
                ),
              ]
            : [optional(choice($[elseifName], $[elseName]))]),
        ),
      ),

    [elseName]: ($) => seq($.preproc_else, repeat(content($))),
  };
}

function directiveSeparatedList($, item, tail) {
  return seq(
    optional($._preproc_list_directives),
    item,
    optional(choice(tail, $._preproc_list_directives)),
  );
}

function directiveSeparatedListTail($, item, tail) {
  return prec.right(
    seq(
      ",",
      optional($._preproc_list_directives),
      optional(seq(item, optional(choice(tail, $._preproc_list_directives)))),
    ),
  );
}

function directiveStatementChoices(
  $,
  {
    includeConditionalIf = true,
    includeConditionalElseif = true,
    includeConditionalClosings = false,
  } = {},
) {
  return [
    $.preproc_include,
    $.preproc_tryinclude,
    $.preproc_define,
    $.preproc_emit,
    $.preproc_pragma,
    $.preproc_undef,
    $.preproc_assert,
    $.preproc_error,
    $.preproc_warning,
    $.preproc_line,
    $.preproc_file,
    $.preproc_endinput,
    ...conditionalDirectiveChoices($, {
      includeIf: includeConditionalIf,
      includeElseif: includeConditionalElseif,
      includeClosings: includeConditionalClosings,
    }),
  ];
}

function conditionalDirectiveChoices(
  $,
  { includeIf = true, includeElseif = true, includeClosings = false } = {},
) {
  return [
    ...(includeIf ? [$.preproc_if] : []),
    ...(includeElseif ? [$.preproc_elseif] : []),
    ...(includeClosings ? [$.preproc_else, $.preproc_endif] : []),
  ];
}

function statementTerminator($) {
  return choice(";", $._statement_line_terminator);
}

function functionBodyChoice($, { blockRule, conditionalRule = null }) {
  return choice(
    blockRule,
    ...(conditionalRule ? [conditionalRule] : []),
    $.macro_invocation_block_statement,
    $.if_statement,
    $.switch_statement,
    $.while_statement,
    $.macro_iterator_loop_statement,
    $.do_while_statement,
    $.for_statement,
    $.goto_statement,
    $.state_statement,
    $.call_statement,
    $.assert_statement,
    $.exit_statement,
    $.sleep_statement,
    alias($._unterminated_return_statement, $.return_statement),
    $.return_statement,
    $.break_statement,
    $.continue_statement,
    $.prefixed_call_statement,
    $.expression_statement,
    ...nonBranchDirectiveStatementChoices($),
  );
}

function statementChoice(
  $,
  { includeBlock = false, includeEmpty = true } = {},
) {
  return choice(
    ...(includeBlock ? [$.block] : []),
    $.inline_callback_definition,
    $.variable_declaration,
    $.state_statement,
    $.macro_invocation_block_statement,
    alias($._macro_iterator_invocation_statement, $.macro_invocation_statement),
    $.if_statement,
    $.switch_statement,
    $.while_statement,
    $.macro_iterator_loop_statement,
    $.do_while_statement,
    $.for_statement,
    $.goto_statement,
    $.call_statement,
    $.assert_statement,
    $.exit_statement,
    $.sleep_statement,
    ...(includeEmpty ? [$.empty_statement] : []),
    $.label_statement,
    $.return_statement,
    $.break_statement,
    $.continue_statement,
    $.prefixed_call_statement,
    $.expression_statement,
    ...nonBranchDirectiveStatementChoices($),
  );
}

function blockStatementBaseChoice($, { includeEmpty = true } = {}) {
  return statementChoice($, {
    includeBlock: true,
    includeEmpty,
  });
}

function nonBranchDirectiveStatementChoices($) {
  return directiveStatementChoices($, {
    includeConditionalIf: false,
    includeConditionalElseif: false,
    includeConditionalClosings: false,
  });
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function binaryExpression(rule, table) {
  return choice(
    ...table.map(([operator, precedence]) =>
      prec.left(
        precedence,
        seq(
          field("left", rule),
          field("operator", operator),
          field("right", rule),
        ),
      ),
    ),
  );
}
