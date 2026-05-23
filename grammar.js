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

  extras: ($) => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  word: ($) => $.identifier,

  externals: ($) => [
    $._callback_signature_start,
    $._statement_line_terminator,
    $._conditional_if_else_preamble,
    $._conditional_if_else_if_preamble,
    $._conditional_if_block_preamble,
    $._conditional_if_else_block_preamble,
    $._conditional_if_preamble,
    $._conditional_if_wrapped_else_preamble,
    $._conditional_if_else_closing,
    $._conditional_if_closing,
    $._unsupported_define_header,
    $._unsupported_macro_parameter_list,
    $._opaque_define_value,
  ],

  inline: ($) => [
    $._expression_not_binary,
    $._top_level_shared_tail_function_alternative_body_statement_base,
    $._top_level_conditional_block_statement_base,
    $._block_conditional_item_base,
    $._block_statement_base,
    $._statement_base,
    $._nonblock_statement_base,
  ],

  conflicts: ($) => [
    [$._declaration_qualifier, $._function_modifier],
    [$._function_modifier, $.variable_declaration],
    [$._callback_named_identifier, $.variable_declarator],
    [$._callback_named_identifier, $.variable_declarator, $._state_variable_declarator],
    [$.variable_declarator, $._state_variable_declarator],
    // A generic top-level macro invocation and a bare function signature both start with `identifier(`.
    [$.macro_invocation_statement, $._function_name],
    [$._function_name, $.tagged_type],
    ...directiveListElseConflicts($, [
      "argument",
      "array_literal",
      "enum",
      "parameter",
      "variable_declarator",
    ]),
    [$._top_level_conditional_block, $._top_level_shared_tail_function_block],
    [$.if_statement, $._if_header],
    [$._statement, $._conditional_else_expression_branch],
    [$._statement, $._conditional_else_if_branch],
    [$._loop_header, $.foreach_statement],
    [$._loop_header, $.for_statement],
    [$._direct_loop_statement_variant, $._loop_header],
    [$._sizeof_subscript_expression, $.subscript_expression],
    // Semicolonless braceless return bodies expose the existing `sizeof value[...]`
    // ambiguity between a complete sizeof-expression and a longer sizeof-subscript tail.
    [$.sizeof_expression, $._sizeof_subscript_expression],
    [$._preproc_sizeof_subscript_expression, $.preproc_subscript_expression],
    [$.preproc_parenthesized_expression, $.preproc_sizeof_expression],
    [$.expression_list, $._argument_list_item],
    [$.parenthesized_expression, $._argument_list_item],
    [$._statement, $._nonblock_statement],
    [$._block_conditional_item, $._conditional_if_split_wrapped_else_setup_statement],
    [$._prefixed_function_definition_signature, $.variable_declaration],
  ],

  supertypes: ($) => [
    $._expression,
    $._statement,
  ],

  rules: {
    source_file: ($) => repeat($._top_level_item),

    _top_level_item: ($) => choice(
      $.top_level_shared_tail_function_branch,
      $.top_level_conditional,
      $._top_level_item_base,
      $.conditional_function_definition,
    ),

    _top_level_item_base: ($) => choice(
      $.function_definition,
      $._top_level_nonfunction_item,
    ),

    _top_level_nonfunction_item: ($) => choice(
      $.hook_forward_statement,
      $.macro_invocation_statement,
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
    ),

    ...directiveIfGroup({
      ifName: "top_level_conditional",
      elseifName: "top_level_elseif",
      elseName: "top_level_else",
    }, ($) => $._top_level_conditional_item),

    ...directiveIfGroup({
      ifName: "block_conditional",
      elseifName: "block_elseif",
      elseName: "block_else",
    }, ($) => $._block_conditional_item, 1),

    ...directiveListGroup("enum", ($) => $.enum_entry),

    ...directiveListGroup("argument", ($) => $._argument_list_item),

    ...directiveListGroup("array_literal", ($) => $._array_literal_item),

    ...directiveListGroup("parameter", ($) => $._parameter_list_item),

    ...directiveListGroup("variable_declarator", ($) => $.variable_declarator),

    _top_level_conditional_item: ($) => choice(
      $.top_level_shared_tail_function_branch,
      $.top_level_conditional,
      alias($.top_level_conditional_function_definition, $.function_definition),
      $.conditional_function_definition,
      $._top_level_nonfunction_item,
    ),

    _block_conditional_item: ($) => blockConditionalChoice($, $._block_conditional_item_base),

    _block_conditional_item_base: ($) => blockStatementBaseChoice($),

    function_definition: ($) => functionDefinitionWithBody($, $._function_body),

    top_level_shared_tail_function_branch: ($) => seq(
      $.directive_if,
      alias($.top_level_shared_tail_function_definition, $.function_definition),
    ),

    top_level_shared_tail_function_definition: ($) => functionDefinitionWithBody(
      $,
      alias($._top_level_shared_tail_function_block, $.block),
    ),

    top_level_conditional_function_definition: ($) => functionDefinitionWithBody(
      $,
      $._top_level_conditional_function_body,
    ),

    conditional_function_definition: directiveBranchChain({
      ifBuilder: ($) => field("signature", $._function_definition_signature),
      elseifBuilder: ($) => field("elseif_signature", $._function_definition_signature),
      elseBuilder: ($) => field("alternative_signature", $._function_definition_signature),
      tailBuilder: ($) => field("body", $._function_body),
    }),

    _prefixed_function_definition_signature: ($) => seq(
      repeat($._function_modifier),
      field("prefix", $.identifier),
      prefixedFunctionSignatureTail($),
    ),

    _hook_function_definition_signature: ($) => seq(
      "hook",
      functionSignatureTail($),
    ),

    _plain_function_definition_signature: ($) => seq(
      repeat($._function_modifier),
      functionSignatureTail($),
    ),

    _bare_function_definition_signature: ($) => functionSignatureTail($),

    _alternative_function_definition_signature: ($) => seq(
      repeat1(choice("public", "stock")),
      repeat("static"),
      functionSignatureTail($),
    ),

    _function_definition_signature: ($) => choice(
      $._hook_function_definition_signature,
      $._prefixed_function_definition_signature,
      $._plain_function_definition_signature,
    ),

    _function_body: ($) => functionBodyChoice($, {
      blockRule: $.block,
      conditionalRule: $.block_conditional,
    }),

    _top_level_conditional_function_body: ($) => functionBodyChoice($, {
      blockRule: alias($._top_level_conditional_block, $.block),
      conditionalRule: $.block_conditional,
    }),

    macro_invocation_statement: ($) => seq(
      field("name", macroNamedIdentifier($)),
      field("arguments", $.argument_list),
      optional(";"),
    ),

    macro_invocation_block_statement: ($) => seq(
      field("name", macroNamedIdentifier($)),
      field("arguments", $.argument_list),
      field("body", $.block),
    ),

    function_declaration: ($) => seq(
      field("kind", choice("forward", "native")),
      choice(
        functionDeclarationSignatureTail($),
        seq(
          field("name", alias($._function_member_name, $.member_expression)),
          field("parameters", choice($.parameter_list, $.parameter_list_reference)),
        ),
      ),
      optional(seq("=", field("alias", $.identifier))),
      ";",
    ),

    hook_forward_statement: ($) => choice(
      seq(
        "hook",
        functionDeclarationSignatureTail($),
        ";",
      ),
      prec.dynamic(5, seq(
        field("return_type", $.tagged_type),
        $._function_named_identifier,
        field("parameters", $.parameter_list),
        "=",
        field("value", choice($.expression_list, $._expression)),
        ";",
      )),
    ),

    _function_modifier: ($) => choice(
      "public",
      "stock",
      "static",
    ),

    state_classifier: ($) => seq(
      "<",
      optional(commaSep1(choice($.scoped_state_entry, $.state_name))),
      ">",
    ),

    scoped_state_entry: ($) => seq(
      field("scope", $.state_name),
      ":",
      field("state", $.state_name),
    ),

    state_name: ($) => token(choice("default", /[A-Za-z_][A-Za-z0-9_]*/)),

    callback_signature: ($) => seq(
      $._callback_signature_start,
      optional(field("types", choice($.identifier, $.tag_wildcard, $.macro_parameter))),
      ">",
    ),

    _function_name: ($) => choice(
      $.identifier,
      $.at_identifier,
      $.operator_name,
    ),

    _function_named_identifier: ($) => seq(
      field("name", $._function_name),
      optional(field("callback_signature", $.callback_signature)),
    ),

    _callback_named_identifier: ($) => seq(
      field("name", $.identifier),
      optional(field("callback_signature", $.callback_signature)),
    ),

    parameter_list: ($) => seq(
      "(",
      optional($._parameter_list_items),
      ")",
    ),

    parameter_list_reference: ($) => choice(
      $.identifier,
      $.macro_pasted_identifier,
    ),

    _parameter_list_item: ($) => choice(
      $.parameter_declaration,
      $.variadic_parameter,
    ),

    _parameter_list_items: ($) => directiveListItems($, {
      item: $._parameter_list_item,
      conditional: $.parameter_conditional,
      conditionalNoComma: $.parameter_conditional_no_comma,
    }),

    parameter_declaration: ($) => seq(
      repeat(choice("const", "stock")),
      optional("&"),
      optional(field("type", choice($.tagged_type, $.tag_set_type))),
      optional("&"),
      $._callback_named_identifier,
      repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
      optional(seq("=", field("default_value", choice($.array_literal, $._expression)))),
    ),

    variadic_parameter: ($) => choice(
      "...",
      seq(
        field("type", $.tagged_type),
        "...",
      ),
      seq(
        field("tag_set", $.variadic_tag_set),
        "...",
      ),
    ),

    tag_set_type: ($) => seq(
      "{",
      commaSep1(choice($.identifier, $.tag_wildcard)),
      "}",
      token.immediate(":"),
    ),

    variadic_tag_set: ($) => seq(
      "{",
      commaSep1(choice($.identifier, $.tag_wildcard)),
      "}",
      token.immediate(":"),
    ),

    tag_wildcard: ($) => "_",

    variable_declaration: ($) => choice(
      seq(
        repeat(field("prefix", $.identifier)),
        $._variable_declaration_prefix,
        repeat(field("qualifier_reference", $.declaration_qualifier_reference)),
        $._variable_declarator_list,
        ";",
      ),
      prec(1, seq(
        repeat(field("prefix", $.identifier)),
        $._variable_declaration_prefix,
        repeat(field("qualifier_reference", $.declaration_qualifier_reference)),
        alias($._state_variable_declarator, $.variable_declarator),
        statementTerminator($),
      )),
    ),

    _variable_declaration_prefix: ($) => repeat1(choice(
      $._declaration_qualifier,
      "public",
      "stock",
    )),

    _qualified_variable_declaration_clause: ($) => prec.left(seq(
      repeat1($._declaration_qualifier),
      commaSep1($.variable_declarator),
    )),

    declaration_qualifier_reference: ($) => choice(
      $.identifier,
      $.macro_pasted_identifier,
    ),

    _variable_declarator_list: ($) => directiveListItems($, {
      item: $.variable_declarator,
      conditional: $.variable_declarator_conditional,
      conditionalNoComma: $.variable_declarator_conditional_no_comma,
    }),

    _declaration_qualifier: ($) => choice(
      "new",
      "const",
      "static",
    ),

    variable_declarator: ($) => choice(
      seq(
        optional(field("type", $.tagged_type)),
        $._callback_named_identifier,
        repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
        optional(seq("=", field("initializer", choice($.array_literal, $._expression)))),
      ),
      seq(
        optional(field("type", $.tagged_type)),
        field("name", $.identifier),
        repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
        field("state", $.state_classifier),
      ),
    ),

    _state_variable_declarator: ($) => seq(
      optional(field("type", $.tagged_type)),
      field("name", $.identifier),
      repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
      field("state", $.state_classifier),
    ),

    enum_declaration: ($) => seq(
      "enum",
      optional(field("name", $.identifier)),
      optional(seq(
        ":",
        optional(field("type", choice($.identifier, $.tag_wildcard))),
      )),
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

    _enum_entries: ($) => directiveListItems($, {
      item: $.enum_entry,
      conditional: $.enum_conditional,
      conditionalNoComma: $.enum_conditional_no_comma,
    }),

    enum_entry: ($) => seq(
      optional(field("type", $.tagged_type)),
      $._callback_named_identifier,
      repeat(choice($.dimension, $.fixed_dimension, $.packed_dimension)),
      optional(seq("=", field("value", $._expression))),
    ),

    tagged_type: ($) => seq(
      field("tag", choice($.identifier, $.tag_wildcard)),
      optional(field("callback_signature", $.callback_signature)),
      token.immediate(":"),
    ),

    preproc_tagged_type: ($) => seq(
      field("tag", choice($.identifier, $.macro_at_identifier, $.tag_wildcard)),
      optional(field("callback_signature", $.callback_signature)),
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
      repeat($._block_statement),
      "}",
    ),

    _top_level_conditional_block: ($) => seq(
      "{",
      repeat($._top_level_conditional_block_statement),
      "}",
    ),

    _top_level_shared_tail_function_block: ($) => seq(
      "{",
      repeat(choice(
        $._top_level_conditional_block_statement,
        $._if_header,
      )),
      choice(
        $.function_initializer_alternative_statement,
        $.top_level_shared_tail_function_alternative_statement,
      ),
      repeat($._block_statement),
      "}",
    ),

    top_level_shared_tail_function_alternative_statement: ($) => directiveElseAlternative($, {
      signature: field("alternative_signature", $._bare_function_definition_signature),
      body: ["{", repeat($._top_level_shared_tail_function_alternative_body_statement)],
    }),

    _top_level_shared_tail_function_alternative_body_statement: ($) => blockConditionalChoice(
      $,
      $._top_level_shared_tail_function_alternative_body_statement_base,
    ),

    _top_level_shared_tail_function_alternative_body_statement_base: ($) => statementChoice($, {
      includeTopLevelConditionalBlock: true,
      includeTopLevelSharedTailIfHeader: true,
      ...wrapperFirstStatementOptions(),
    }),

    _top_level_conditional_block_statement: ($) => blockConditionalChoice(
      $,
      alias($._top_level_conditional_block, $.block),
      $._top_level_conditional_block_statement_base,
    ),

    _top_level_conditional_block_statement_base: ($) => statementChoice($, {
      includeTopLevelConditionalBlock: true,
      ...wrapperFirstConditionalElseStatementOptions(),
    }),

    _block_statement: ($) => blockConditionalChoice($, $._block_statement_base),

    _block_statement_base: ($) => blockStatementBaseChoice($),

    _statement: ($) => blockConditionalChoice($, $._statement_base),

    _statement_base: ($) => blockStatementBaseChoice($),

    _nonblock_statement: ($) => blockConditionalChoice($, $._nonblock_statement_base),

    _nonblock_statement_base: ($) => statementChoice($, {
      ...wrappedNonblockStatementOptions(),
    }),

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
      repeat($._switch_item),
      "}",
    ),

    ...directiveIfGroup({
      ifName: "switch_item_conditional",
      elseifName: "switch_item_elseif",
      elseName: "switch_item_else",
    }, ($) => $._switch_item_base),

    _switch_item: ($) => choice(
      $.switch_item_conditional,
      $._switch_item_base,
    ),

    _switch_item_base: ($) => choice(
      $.case_statement,
      $.default_statement,
    ),

    case_statement: ($) => prec.right(1, seq(
      "case",
      field("value", choice($.case_value_list, $._case_value)),
      ":",
      repeat($._statement),
    )),

    _case_value: ($) => choice(
      $.case_range,
      $._case_expression,
    ),

    _case_expression: ($) => choice(
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

    case_range: ($) => seq(
      field("start", $._case_expression),
      "..",
      field("end", $._case_expression),
    ),

    case_value_list: ($) => seq(
      field("left", $._case_value),
      repeat1(seq(",", field("right", $._case_value))),
    ),

    default_statement: ($) => prec.right(1, seq(
      "default",
      ":",
      repeat($._statement),
    )),

    state_statement: ($) => seq(
      "state",
      optional(field("condition", $.parenthesized_expression)),
      field("scope", $.state_name),
      optional(seq(
        ":",
        commaSep1($.state_name),
      )),
      optional(";"),
    ),

    function_initializer_alternative_statement: ($) => directiveElseAlternative($, {
      signature: field("alternative_signature", $._alternative_function_definition_signature),
      body: ["{", field("alternative_initializer", choice($.variable_declaration, $.block_conditional))],
    }),

    conditional_else_statement: ($) => prec.right(1, seq(
      $.directive_if,
      "else",
      field("alternative", $._statement),
      $.directive_endif,
    )),

    conditional_else_block_statement: ($) => prec.right(1, seq(
      $.directive_if,
      "else",
      "{",
      $.directive_endif,
      repeat($._statement),
      $.directive_if,
      "}",
      $.directive_endif,
    )),

    conditional_else_expression_statement: directiveBranchChain({
      dynamicPrecedence: 2,
      ifBuilder: ($) => field("consequence", $._conditional_else_expression_branch),
      elseBuilder: ($) => field("alternative", $._conditional_else_expression_branch),
    }),

    _conditional_else_expression_branch: ($) => prec.dynamic(1, seq(
      "else",
      $.expression_statement,
    )),

    conditional_else_if_branch_statement: directiveBranchChain({
      dynamicPrecedence: 2,
      ifBuilder: ($) => field("consequence", $._conditional_else_if_branch),
      elseifBuilder: ($) => field("elseif", $._conditional_else_if_branch),
      elseBuilder: ($) => field("alternative", $._conditional_else_if_branch),
      tailBuilder: ($) => optional(seq(
        "else",
        field("shared_alternative", $._statement),
      )),
    }),

    _conditional_else_if_branch: ($) => prec.dynamic(1, seq(
      "else",
      $.if_statement,
    )),

    conditional_else_if_statement: directiveBranchChain({
      ifBuilder: ($) => field("consequence", $._conditional_else_if_header),
      elseifBuilder: ($) => field("elseif", $._conditional_else_if_header),
      elseBuilder: ($) => field("alternative", $._conditional_else_if_header),
      tailBuilder: ($) => field("body", $._statement),
    }),

    conditional_if_else_if_statement: ($) => prec.dynamic(10, prec.right(2, seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
      $._conditional_if_else_if_preamble,
      "else",
      field("alternative", $.if_statement),
    ))),

    conditional_if_block_statement: ($) => prec.dynamic(10, prec.right(2, seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
      $._conditional_if_block_preamble,
      field("consequence", $.block),
    ))),

    conditional_if_else_block_statement: ($) => prec.dynamic(10, prec.right(2, seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
      $._conditional_if_else_block_preamble,
      repeat($._statement),
      $._conditional_if_closing,
    ))),

    _conditional_else_if_header: ($) => seq(
      "else",
      $._if_header,
    ),

    conditional_if_else_statement: ($) => prec.dynamic(10, prec.right(2, seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
      $._conditional_if_else_preamble,
      field("consequence", $.block),
      "else",
      field("alternative", $._statement),
    ))),

    conditional_if_wrapped_else_statement: ($) => prec.dynamic(5, prec.right(2, seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
      $._conditional_if_wrapped_else_preamble,
      repeat($._statement),
      $._conditional_if_else_closing,
      "else",
      field("alternative", $._statement),
      $.directive_endif,
    ))),

    conditional_if_split_wrapped_else_statement: ($) => prec.dynamic(5, prec.right(2, seq(
      $.directive_if,
      repeat($._conditional_if_split_wrapped_else_setup_statement),
      field("consequence", seq($._if_header, "{")),
      $.directive_else,
      repeat1(field("alternative", $._conditional_if_split_wrapped_else_setup_statement)),
      $.directive_endif,
      repeat($._statement),
      $.directive_if,
      "}",
      "else",
      field("shared_alternative", $._statement),
      $.directive_endif,
    ))),

    _conditional_if_split_wrapped_else_setup_statement: ($) => choice(
      $.expression_statement,
      $.if_statement,
    ),

    conditional_if_statement: ($) => prec.dynamic(20, prec.right(2, seq(
      preprocessor("if"),
      field("condition", $.preproc_expression),
      $._conditional_if_preamble,
      repeat($._statement),
      $._conditional_if_closing,
    ))),

    conditional_loop_fallback_statement: directiveBranchChain({
      ifBuilder: ($) => field("consequence", choice($.foreach_statement, $.for_statement)),
      elseifBuilder: ($) => field("elseif", choice($.foreach_statement, $.for_statement)),
      elseBuilder: ($) => repeat1(field("alternative", $._statement)),
    }),

    conditional_loop_variant_statement: directiveBranchChain({
      ifBuilder: ($) => field("consequence", $._direct_loop_statement_variant),
      elseifBuilder: ($) => field("elseif", $._direct_loop_statement_variant),
      elseBuilder: ($) => field("alternative", $._loop_statement_variant),
    }),

    conditional_loop_statement: directiveBranchChain({
      ifBuilder: ($) => field("consequence", $._direct_loop_preamble),
      elseifBuilder: ($) => field("elseif", $._direct_loop_preamble),
      elseBuilder: ($) => field("alternative", $.loop_preamble),
      tailBuilder: ($) => [repeat($._statement), "}"],
    }),

    _loop_body_statement: ($) => loopBodyStatementChoice($),

    _direct_loop_statement_variant: ($) => choice(
      seq(
        $._foreach_header,
        field("body", $._nonblock_statement),
      ),
      seq(
        $._for_header,
        field("body", $._nonblock_statement),
      ),
    ),

    _loop_statement_variant: ($) => choice(
      $._direct_loop_statement_variant,
      $.loop_header_selection_statement,
    ),

    loop_header_selection_statement: ($) => directiveSignatureChain($, {
      signature: field("signature", $._loop_header),
      elseifSignature: field("elseif_signature", $._loop_header),
      elseSignature: field("alternative_signature", $._loop_header),
      tail: field("body", $.block),
    }),

    _direct_loop_preamble: ($) => seq(
      $._loop_header,
      "{",
      repeat($._loop_body_statement),
    ),

    loop_body_conditional_if_statement: directiveBranchChain({
      ifBuilder: ($) => field("consequence", $._preproc_branch_if_statement),
      elseifBuilder: ($) => field("elseif", $._preproc_branch_if_statement),
      elseBuilder: ($) => field("alternative", $._preproc_branch_if_statement),
    }),

    _preproc_branch_if_statement: ($) => seq(
      $._if_header,
      field("consequence", $._statement),
    ),

    _if_header: ($) => seq(
      "if",
      "(",
      field("condition", choice($.expression_list, $._expression)),
      ")",
    ),

    loop_preamble: ($) => prec.right(choice(
      $._direct_loop_preamble,
      directiveSignatureChain($, {
        signature: field("signature", $._loop_header),
        elseifSignature: field("elseif_signature", $._loop_header),
        elseSignature: field("alternative_signature", $._loop_header),
        tail: ["{", repeat($._loop_body_statement)],
      }),
    )),

    _loop_header: ($) => choice(
      $._foreach_header,
      $._for_header,
    ),

    while_statement: ($) => seq(
      "while",
      "(",
      field("condition", choice($.expression_list, $._expression)),
      ")",
      field("body", $._statement),
    ),

    _foreach_header: ($) => seq(
      "foreach",
      "(",
      field("iterator", $.foreach_iterator),
      ")",
    ),

    foreach_statement: ($) => prec.right(seq(
      $._foreach_header,
      field("body", $._statement),
    )),

    foreach_iterator: ($) => seq(
      choice(
        seq(
          optional("new"),
          optional(field("type", $.tagged_type)),
          field("name", $.identifier),
          ":",
          field("collection", $.identifier),
        ),
        seq(
          field("collection", $.identifier),
          ",",
          field("name", $.identifier),
        ),
      ),
    ),

    _for_header: ($) => seq(
      "for",
      "(",
      field("initializer", optional(choice($._qualified_variable_declaration_clause, $.expression_list, $._expression))),
      ";",
      field("condition", optional(choice($.expression_list, $._expression))),
      ";",
      field("update", optional(choice($.expression_list, $._expression))),
      ")",
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

    for_statement: ($) => prec.right(seq(
      $._for_header,
      field("body", $._statement),
    )),

    goto_statement: ($) => seq(
      "goto",
      field("label", $.identifier),
      ";",
    ),

    label_statement: ($) => prec(1, choice(
      seq(
        field("label", $.identifier),
        token.immediate(/:[ \t]*(\r?\n)+/),
      ),
      seq(
        field("label", $.identifier),
        token.immediate(":"),
        field("statement", $.inline_labeled_statement),
      ),
    )),

    inline_labeled_statement: ($) => choice(
      $.block_conditional,
      $.block,
      $.variable_declaration,
      $.inline_callback_definition,
      $.call_statement,
      $.assert_statement,
      $.exit_statement,
      $.sleep_statement,
      $.conditional_else_statement,
      $.if_statement,
      $.switch_statement,
      $.conditional_loop_fallback_statement,
      $.conditional_loop_variant_statement,
      $.conditional_loop_statement,
      $.while_statement,
      $.foreach_statement,
      $.do_while_statement,
      $.for_statement,
      $.goto_statement,
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
    ),

    return_statement: ($) => seq(
      "return",
      optional(field("value", choice($.expression_list, $._expression))),
      ";",
    ),

    _unterminated_return_statement: ($) => prec.right(1, seq(
      "return",
      field("value", $._unterminated_return_value),
    )),

    break_statement: ($) => seq("break", ";"),

    continue_statement: ($) => seq("continue", ";"),

    inline_callback_definition: ($) => seq(
      "inline",
      optional(field("qualifier", "const")),
      field("name", $._function_name),
      field("parameters", $.parameter_list),
      field("body", $.block),
    ),

    defer_statement: ($) => seq(
      "defer",
      field("call", $.call_expression),
      ";",
    ),

    assert_statement: ($) => seq(
      "assert",
      field("condition", choice($.expression_list, $._expression)),
      statementTerminator($),
    ),

    exit_statement: ($) => seq(
      "exit",
      optional(field("value", choice($.expression_list, $._expression))),
      statementTerminator($),
    ),

    sleep_statement: ($) => seq(
      "sleep",
      optional(field("value", choice($.expression_list, $._expression))),
      statementTerminator($),
    ),

    call_statement: ($) => prec.dynamic(5, seq(
      field("call", alias($._bare_call_expression, $.call_expression)),
      statementTerminator($),
    )),

    expression_statement: ($) => seq(
      field("expression", choice($.statement_expression_list, $._statement_expression)),
      statementTerminator($),
    ),

    expression_list: ($) => prec.left(seq(
      field("left", $._expression),
      repeat1(seq(",", field("right", $._expression))),
    )),

    statement_expression_list: ($) => prec.left(seq(
      field("left", $._statement_expression),
      repeat1(seq(",", field("right", $._statement_expression))),
    )),

    _expression: ($) => choice(
      $._expression_not_binary,
      $.binary_expression,
    ),

    _statement_expression: ($) => choice(
      $._statement_expression_not_binary,
      $.binary_expression,
    ),

    _expression_not_binary: ($) => choice(
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

    _statement_expression_not_binary: ($) => choice(
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

    _unterminated_return_value: ($) => choice(
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

    _adjacent_string_atom: ($) => choice(
      $.identifier,
      $.string_literal,
      $.function_reference_expression,
    ),

    adjacent_string_expression: ($) => prec.left(PREC.ADD, choice(
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
        field("left", choice(
          $.identifier,
          $.string_literal,
        )),
        field("right", $.string_literal),
        repeat(field("right", $._adjacent_string_atom)),
      ),
      seq(
        field("left", $.string_literal),
        field("right", choice(
          $.identifier,
          $.function_reference_expression,
        )),
        repeat(field("right", $._adjacent_string_atom)),
      ),
    )),

    function_reference_expression: ($) => prec(PREC.UNARY, seq(
      "#",
      field("argument", $._function_name),
    )),

    sizeof_expression: ($) => prec(PREC.SIZEOF, choice(
      seq(
        "sizeof",
        field("argument", prec(PREC.SUBSCRIPT, $._sizeof_subscript_expression)),
      ),
      seq(
        "sizeof",
        field("argument", $.identifier),
      ),
      seq(
        "sizeof",
        "(",
        field("argument", $._sizeof_subscript_expression),
        ")",
      ),
      seq(
        "sizeof",
        "(",
        field("argument", $.identifier),
        ")",
      ),
    )),

    _sizeof_subscript_expression: ($) => prec.left(PREC.SUBSCRIPT, seq(
      field("array", choice(
        $.identifier,
        $.call_expression,
        $._sizeof_subscript_expression,
        $.subscript_expression,
        $.parenthesized_expression,
      )),
      "[",
      optional(field("index", choice($.expression_list, $._expression))),
      "]",
    )),

    assignment_expression: ($) => prec.right(PREC.ASSIGNMENT, seq(
      field("left", choice(
        $.identifier,
        $.subscript_expression,
        $.packed_subscript_expression,
        $.tagged_expression,
        $.member_expression,
        $.callback_member_expression,
      )),
      field("operator", choice(...ASSIGNMENT_OPERATORS)),
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
      [">>>", PREC.SHIFT],
      [">>", PREC.SHIFT],
      ["+", PREC.ADD],
      ["-", PREC.ADD],
      ["...", PREC.ADD],
      ["*", PREC.MULTIPLY],
      ["/", PREC.MULTIPLY],
      ["%", PREC.MULTIPLY],
    ]),

    unary_expression: ($) => prec.left(PREC.UNARY, seq(
      field("operator", choice(...UNARY_OPERATORS)),
      field("argument", $._expression),
    )),

    update_expression: ($) => choice(
      prec.left(PREC.UNARY, seq(
        field("argument", choice($.identifier, $.subscript_expression)),
        field("operator", choice(...UPDATE_OPERATORS)),
      )),
      prec.right(PREC.UNARY, seq(
        field("operator", choice(...UPDATE_OPERATORS)),
        field("argument", choice($.identifier, $.subscript_expression)),
      )),
    ),

    callback_member_expression: ($) => prec(PREC.CALL, seq(
      "@",
      ".",
      field("name", $.identifier),
    )),

    _function_member_name: ($) => seq(
      field("object", $.identifier),
      ".",
      field("property", $.identifier),
    ),

    callback_suffix_expression: ($) => prec.left(PREC.CALL, seq(
      field("value", choice(
        $.tagged_expression,
        $.identifier,
        $.member_expression,
        $.call_expression,
        $.subscript_expression,
        $.parenthesized_expression,
        $._literal,
      )),
      field("callback_signature", $.callback_signature),
    )),

    member_expression: ($) => prec.left(PREC.CALL, seq(
      field("object", choice(
        $.identifier,
        $.call_expression,
        $.subscript_expression,
        $.member_expression,
        $.parenthesized_expression,
      )),
      ".",
      field("property", $.identifier),
    )),

    call_expression: ($) => prec.left(PREC.CALL, seq(
      field("function", choice(
        $.identifier,
        $.callback_member_expression,
        $.member_expression,
        $.parenthesized_expression,
        $.subscript_expression,
        $.tagged_expression,
      )),
      field("arguments", $.argument_list),
    )),

    _bare_call_expression: ($) => prec.dynamic(1, prec.left(PREC.CALL, seq(
      field("function", choice(
        $.identifier,
        $.callback_member_expression,
        $.member_expression,
        $.subscript_expression,
        $.tagged_expression,
      )),
      field("arguments", alias($._bare_argument_list, $.argument_list)),
    ))),

    _bare_call_argument: ($) => choice(
      $.array_literal,
      $.named_argument,
      $.using_inline_expression,
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

    _bare_argument_list: ($) => seq(
      $._bare_call_argument,
      repeat(seq(",", $._bare_call_argument)),
    ),

    argument_list: ($) => seq(
      "(",
      optional($._argument_list_items),
      ")",
    ),

    _argument_list_item: ($) => choice(
      $.array_literal,
      $.named_argument,
      $.using_inline_expression,
      $.operator_symbol,
      $.tag_wildcard,
      $._expression,
    ),

    using_inline_expression: ($) => seq(
      "using",
      "inline",
      field("name", $.identifier),
    ),

    _argument_list_items: ($) => directiveListItems($, {
      item: $._argument_list_item,
      conditional: $.argument_conditional,
      conditionalNoComma: $.argument_conditional_no_comma,
    }),

    named_argument: ($) => seq(
      ".",
      field("name", $.identifier),
      "=",
      field("value", $._expression),
    ),

    subscript_expression: ($) => prec.left(PREC.SUBSCRIPT, seq(
      field("array", choice(
        $.identifier,
        $.call_expression,
        $.member_expression,
        $.subscript_expression,
        $.parenthesized_expression,
      )),
      "[",
      field("index", choice($.expression_list, $._expression)),
      "]",
    )),

    packed_subscript_expression: ($) => prec.left(PREC.SUBSCRIPT, seq(
      field("array", choice(
        $.identifier,
        $.call_expression,
        $.member_expression,
        $.subscript_expression,
        $.packed_subscript_expression,
        $.parenthesized_expression,
      )),
      token.immediate("{"),
      field("index", choice($.expression_list, $._expression)),
      "}",
    )),

    tagged_expression: ($) => prec.right(PREC.CAST, seq(
      field("type", $.tagged_type),
      field("value", choice(
        $.tagged_expression,
        $.identifier,
        $.parenthesized_expression,
        $.call_expression,
        $.subscript_expression,
        $.unary_expression,
        $._literal,
      )),
    )),

    tagof_expression: ($) => prec(PREC.SIZEOF, choice(
      seq(
        "tagof",
        field("argument", $.identifier),
      ),
      seq(
        "tagof",
        field("argument", $.bare_type_expression),
      ),
      seq(
        "tagof",
        "(",
        field("argument", choice($.identifier, $.bare_type_expression)),
        ")",
      ),
    )),

    packed_storage_expression: ($) => prec.right(PREC.CAST, seq(
      field("value", choice(
        $.identifier,
        $.parenthesized_expression,
        $.call_expression,
        $.subscript_expression,
      )),
      field("storage", $.packed_storage),
    )),

    bare_type_expression: ($) => seq(
      field("type", $.tagged_type),
    ),

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

    _array_literal_item: ($) => choice(
      $.array_literal,
      $._expression,
      "...",
    ),

    _array_literal_items: ($) => directiveListItems($, {
      item: $._array_literal_item,
      conditional: $.array_literal_conditional,
      conditionalNoComma: $.array_literal_conditional_no_comma,
    }),

    directive_include: ($) => includeDirective($, "include"),

    directive_tryinclude: ($) => includeDirective($, "tryinclude"),

    directive_define: ($) => choice(
      defineDirective($,
        field("unsupported_header", alias($._unsupported_define_header, $.preproc_text)),
        optional(seq(
          $._macro_value_separator,
          field("value", $.preproc_text),
        )),
      ),
      defineDirective($,
        token.immediate("("),
        token.immediate(/[ \t]+/),
        field("value", $.preproc_text),
      ),
      defineDirective($,
        field("parameters", $.complex_macro_parameter_list),
        optional(seq(
          $._macro_value_separator,
          field("value", $.preproc_text),
        )),
      ),
      defineDirective($,
        field("parameters", $.structured_macro_parameter_list),
        optional(seq(
          $._macro_value_separator,
          field("value", $.preproc_text),
        )),
      ),
      prec.right(1, defineDirective($,
        field("unsupported_parameters", alias($._unsupported_macro_parameter_list, $.preproc_text)),
        field("value", $.preproc_text),
      )),
      prec.right(1, defineDirective($,
        field("parameters", $.macro_parameter_list),
        field("value", $.preproc_text),
      )),
      defineDirective($,
        field("parameters", $.macro_parameter_list),
        optional(seq(
          $._macro_value_separator,
          field("value", defineValue($)),
        )),
      ),
      defineDirective($,
        optional(seq(
          $._macro_value_separator,
          field("value", defineValue($)),
        )),
      ),
    ),

    macro_replacement: ($) => choice(
      $.macro_declaration_sequence,
      $.macro_function_sequence,
      $.macro_expression_sequence,
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
      $.preproc_expression_list,
      $.preproc_expression,
    ),

    macro_declaration_sequence: ($) => seq(
      $.macro_variable_declaration,
      repeat($.macro_expression_statement),
      field("tail", $.preproc_expression),
    ),

    _macro_variable_declaration_body: ($) => seq(
      "new",
      optional(field("type", $.tagged_type)),
      field("name", choice($.identifier, $.macro_parameter)),
      optional(seq("=", field("initializer", $.preproc_expression))),
    ),

    macro_variable_declaration: ($) => seq(
      $._macro_variable_declaration_body,
      ";",
    ),

    macro_function_sequence: ($) => choice(
      prec.right(2, seq(
        repeat1($.macro_terminated_function_statement),
        field("tail", $._macro_unterminated_function_statement),
      )),
      prec.left(-1, repeat1($.macro_terminated_function_statement)),
      $.macro_function_statement,
    ),

    _macro_unterminated_function_statement: ($) => choice(
      alias($.macro_forward_parameter_declaration_statement, $.macro_function_statement),
      alias($.macro_forward_macro_parameter_statement, $.macro_function_statement),
      $.macro_function_definition_statement,
      $.macro_function_statement,
      $.macro_bare_function_statement,
    ),

    macro_terminated_function_statement: ($) => choice(
      prec(1, seq(
        alias($.macro_forward_parameter_declaration_statement, $.macro_function_statement),
        token.immediate(";"),
      )),
      prec(1, seq(
        alias($.macro_forward_macro_parameter_statement, $.macro_function_statement),
        token.immediate(";"),
      )),
      seq(
        $.macro_function_statement,
        token.immediate(";"),
      ),
    ),

    macro_forward_parameter_declaration_statement: ($) => prec.dynamic(1, seq(
      "forward",
      macroFunctionSignature($, {
        name: field("name", macroCallableIdentifier($)),
        parameters: field("parameters", $.parameter_list),
      }),
    )),

    macro_forward_macro_parameter_statement: ($) => seq(
      "forward",
      macroFunctionSignature($, {
        name: field("name", macroCallableIdentifier($, { allowAt: false })),
        parameters: field("parameters", alias($._macro_function_parameter_list, $.macro_parameter_list)),
      }),
    ),

    macro_function_statement: ($) => choice(
      prec(1, macroFunctionSignature($, {
        kind: macroFunctionKind(),
        name: field("name", macroCallableIdentifier($)),
        parameters: field("parameters", $.parameter_list),
      })),
      macroFunctionSignature($, {
        kind: macroFunctionKind(),
        name: field("name", macroCallableIdentifier($, { allowAt: false })),
        parameters: field("parameters", alias($._macro_function_parameter_list, $.macro_parameter_list)),
      }),
    ),

    macro_function_definition_statement: ($) => choice(
      prec(2, seq(
        macroFunctionSignature($, {
          kind: macroFunctionKind(),
          name: field("name", macroCallableIdentifier($)),
          parameters: field("parameters", $.parameter_list),
        }),
        field("body", $.macro_block),
      )),
      prec(2, seq(
        macroFunctionSignature($, {
          kind: macroFunctionKind(),
          name: field("name", macroCallableIdentifier($, { allowAt: false })),
          parameters: field("parameters", alias($._macro_function_parameter_list, $.macro_parameter_list)),
        }),
        field("body", $.macro_block),
      )),
      prec(2, seq(
        macroFunctionSignature($, {
          name: field("name", macroCallableIdentifier($)),
          parameters: field("parameters", $.parameter_list),
        }),
        field("body", $.macro_block),
      )),
      prec(2, seq(
        macroFunctionSignature($, {
          name: field("name", macroCallableIdentifier($, { allowAt: false })),
          parameters: field("parameters", alias($._macro_function_parameter_list, $.macro_parameter_list)),
        }),
        field("body", $.macro_block),
      )),
    ),

    macro_bare_function_statement: ($) => choice(
      macroFunctionSignature($, {
        name: field("name", macroBareCallableIdentifier($)),
        parameters: field("parameters", $.parameter_list),
      }),
      macroFunctionSignature($, {
        name: field("name", macroBareCallableIdentifier($, { allowAt: false })),
        parameters: field("parameters", alias($._macro_function_parameter_list, $.macro_parameter_list)),
      }),
    ),

    macro_expression_sequence: ($) => seq(
      repeat1($.macro_expression_statement),
      field("tail", $.preproc_expression),
    ),

    directive_emit: ($) => seq(
      preprocessor("emit"),
      field("value", $.preproc_text),
    ),

    directive_pragma: ($) => namedDirective($, "pragma",
      optional(seq(
        token.immediate(/[ \t]+/),
        field("value", $.preproc_text),
      )),
    ),

    directive_undef: ($) => namedDirective($, "undef"),

    directive_assert: ($) => seq(
      preprocessor("assert"),
      field("condition", $.preproc_expression),
    ),

    directive_error: ($) => messageDirective($, "error"),

    directive_warning: ($) => messageDirective($, "warning"),

    directive_line: ($) => seq(
      preprocessor("line"),
      field("number", $.integer_literal),
    ),

    directive_file: ($) => seq(
      preprocessor("file"),
      field("path", $.string_literal),
    ),

    directive_endinput: ($) => preprocessor("endinput"),

    macro_parameter_list: ($) => seq(
      token.immediate("("),
      commaSep(choice(
        $.macro_parameter,
        $.identifier,
        $.macro_colon_parameter,
      )),
      ")",
    ),

    _macro_function_parameter_list: ($) => seq(
      token.immediate("("),
      commaSep(choice($.macro_parameter, $.macro_colon_parameter)),
      ")",
    ),

    structured_macro_parameter_list: ($) => seq(
      token.immediate("("),
      $.braced_macro_parameter,
      repeat1(choice($.macro_parameter, $.braced_macro_parameter)),
      ")",
    ),

    complex_macro_parameter_list: ($) => seq(
      token.immediate("("),
      field("left", $.complex_macro_parameter_header),
      repeat(seq(
        ",",
        field("right", choice(
          $.macro_parameter,
          $.identifier,
          $.complex_macro_parameter_header,
        )),
      )),
      ")",
    ),

    _macro_value_separator: ($) => token.immediate(/[ \t]+/),

    macro_parameter: ($) => token(seq("%", /[A-Za-z0-9_]+/)),

    macro_colon_parameter: ($) => seq(
      field("left", choice($.macro_parameter, $.identifier)),
      ":",
      field("right", choice($.macro_parameter, $.identifier, $.macro_colon_parameter)),
    ),

    complex_macro_parameter_header: ($) => choice(
      seq(
        field("type", $.tagged_type),
        field("parameters", $.macro_parameter_list),
      ),
      seq(
        field("name", choice($.identifier, $.macro_parameter, $.macro_pasted_identifier)),
        field("parameters", $.macro_parameter_list),
      ),
    ),

    braced_macro_parameter: ($) => seq(
      "{",
      $.macro_parameter,
      "}",
    ),

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
      $.preproc_adjacent_string_expression,
      $.preproc_stringify_expression,
      $.preproc_binary_expression,
      $.preproc_unary_expression,
      $.preproc_sizeof_expression,
      $.preproc_call_expression,
      $.preproc_member_expression,
      $.preproc_subscript_expression,
      $.preproc_tagged_expression,
      $.preproc_dollar_expression,
      $.preproc_tag_set,
      $.preproc_parenthesized_expression,
      $.preproc_defined,
      $.operator_symbol,
      $.macro_at_identifier,
      $.macro_pasted_identifier,
      $.macro_parameter,
      $.identifier,
      $.tag_wildcard,
      $.integer_literal,
      $.hex_literal,
      $.float_literal,
      $.string_literal,
      $.char_literal,
      $.boolean_literal,
      $.null_literal,
    ),

    preproc_tag_set: ($) => seq(
      "{",
      commaSep1(choice(
        $.identifier,
        $.macro_parameter,
        $.macro_pasted_identifier,
        $.tag_wildcard,
      )),
      "}",
    ),

    preproc_expression_list: ($) => prec.left(seq(
      field("left", $.preproc_expression),
      repeat1(seq(",", field("right", $.preproc_expression))),
    )),

    preproc_assignment_expression: ($) => prec.right(PREC.ASSIGNMENT, seq(
      field("left", choice(
        $.identifier,
        $.macro_parameter,
        $.preproc_subscript_expression,
        $.preproc_parenthesized_expression,
      )),
      field("operator", choice(...ASSIGNMENT_OPERATORS)),
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
      [">>>", PREC.SHIFT],
      [">>", PREC.SHIFT],
      ["+", PREC.ADD],
      ["-", PREC.ADD],
      ["*", PREC.MULTIPLY],
      ["/", PREC.MULTIPLY],
      ["%", PREC.MULTIPLY],
    ]),

    preproc_unary_expression: ($) => prec.left(PREC.UNARY, seq(
      field("operator", choice(...UNARY_OPERATORS)),
      field("argument", $.preproc_expression),
    )),

    preproc_stringify_expression: ($) => prec.left(PREC.UNARY, seq(
      "#",
      field("argument", choice($.macro_parameter, $.identifier)),
    )),

    preproc_dollar_expression: ($) => prec.left(PREC.UNARY, seq(
      "$",
      field("argument", choice(
        $.macro_parameter,
        $.identifier,
        $.integer_literal,
      )),
    )),


    preproc_adjacent_string_expression: ($) => prec.left(PREC.ADD, choice(
      seq(
        field("left", $.preproc_stringify_expression),
        field("right", $.string_literal),
        repeat(field("right", choice($.identifier, $.preproc_stringify_expression, $.string_literal))),
      ),
      seq(
        field("left", $.identifier),
        field("right", $.string_literal),
        repeat(field("right", choice($.identifier, $.preproc_stringify_expression, $.string_literal))),
      ),
      seq(
        field("left", $.string_literal),
        field("right", $.preproc_stringify_expression),
        repeat(field("right", choice($.identifier, $.preproc_stringify_expression, $.string_literal))),
      ),
      seq(
        field("left", $.string_literal),
        field("right", $.identifier),
        repeat(field("right", choice($.identifier, $.preproc_stringify_expression, $.string_literal))),
      ),
      seq(
        field("left", $.string_literal),
        field("right", $.string_literal),
        repeat(field("right", choice($.identifier, $.preproc_stringify_expression, $.string_literal))),
      ),
    )),
    preproc_parenthesized_expression: ($) => seq(
      "(",
      optional(field("expression", choice($.preproc_expression_list, $.preproc_expression))),
      optional(","),
      ")",
    ),

    preproc_sizeof_expression: ($) => choice(
      seq(
        "sizeof",
        field("argument", $.identifier),
      ),
      seq(
        "sizeof",
        field("argument", $._preproc_sizeof_subscript_expression),
      ),
      seq(
        "sizeof",
        "(",
        field("argument", choice($.preproc_expression, $._preproc_sizeof_subscript_expression)),
        ")",
      ),
    ),

    _preproc_sizeof_subscript_expression: ($) => prec.left(PREC.SUBSCRIPT, seq(
      field("array", choice(
        $.identifier,
        $.macro_pasted_identifier,
        $.macro_parameter,
        $.preproc_call_expression,
        $._preproc_sizeof_subscript_expression,
        $.preproc_subscript_expression,
        $.preproc_parenthesized_expression,
      )),
      "[",
      optional(field("index", $.preproc_expression)),
      "]",
    )),

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

    macro_open_if_statement: ($) => prec(-1, seq(
      "if",
      "(",
      field("condition", $.preproc_expression),
      ")",
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
      $.macro_open_if_statement,
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

    macro_for_statement: ($) => choice(
      prec.right(1, seq(
        "for",
        "(",
        field("initializer", optional(choice($.preproc_expression, $._macro_variable_declaration_body))),
        ";",
        field("condition", optional($.preproc_expression)),
        ";",
        field("update", optional($.preproc_expression)),
        ")",
        field("body", $.macro_control_statement),
      )),
      seq(
        "for",
        "(",
        field("initializer", optional(choice($.preproc_expression, $._macro_variable_declaration_body))),
        ";",
        field("condition", optional($.preproc_expression)),
        ";",
        field("update", optional($.preproc_expression)),
        ")",
      ),
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
        $.macro_pasted_identifier,
        $.macro_parameter,
        $.preproc_dollar_expression,
        $.preproc_call_expression,
        $.preproc_member_expression,
        $.preproc_subscript_expression,
        $.preproc_parenthesized_expression,
      )),
      "[",
      field("index", $.preproc_expression),
      "]",
    )),

    preproc_member_expression: ($) => prec.left(PREC.CALL, seq(
      field("object", choice(
        $.identifier,
        $.macro_pasted_identifier,
        $.macro_parameter,
        $.preproc_dollar_expression,
        $.preproc_call_expression,
        $.preproc_subscript_expression,
        $.preproc_member_expression,
        $.preproc_parenthesized_expression,
      )),
      ".",
      field("property", choice(
        $.identifier,
        $.macro_parameter,
        $.preproc_dollar_expression,
      )),
    )),

    preproc_tagged_expression: ($) => prec.right(PREC.CAST, seq(
      field("type", alias($.preproc_tagged_type, $.tagged_type)),
      field("value", choice(
        $.preproc_tagged_expression,
        $.preproc_unary_expression,
        $.preproc_call_expression,
        $.preproc_member_expression,
        $.preproc_subscript_expression,
        $.preproc_dollar_expression,
        $.preproc_parenthesized_expression,
        $.macro_at_identifier,
        $.macro_pasted_identifier,
        $.macro_parameter,
        $.identifier,
        $.integer_literal,
        $.binary_literal,
        $.hex_literal,
        $.float_literal,
        $.string_literal,
        $.char_literal,
        $.boolean_literal,
        $.null_literal,
      )),
    )),

    preproc_call_expression: ($) => prec.left(PREC.CALL, seq(
      field("function", macroCallableIdentifier($)),
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
      $.binary_literal,
      $.hex_literal,
      $.float_literal,
      $.string_literal,
      $.char_literal,
      $.boolean_literal,
      $.null_literal,
    ),

    integer_literal: ($) => token(/[0-9][0-9_]*/),

    binary_literal: ($) => token(/0[bB][01][01_]*/),

    hex_literal: ($) => token(/0[xX][0-9a-fA-F][0-9a-fA-F_]*/),

    float_literal: ($) => token(choice(
      /[0-9][0-9_]*\.[0-9][0-9_]*([eE][+-]?[0-9][0-9_]*)?/,
      /[0-9][0-9_]*[eE][+-]?[0-9][0-9_]*/,
    )),

    string_literal: ($) => seq(
      '"',
      repeat(choice($.escape_sequence, token.immediate(prec(1, /[^"\\\r\n]+/)))),
      '"',
    ),

    char_literal: ($) => seq(
      "'",
      repeat1(choice($.escape_sequence, token.immediate(prec(1, /[^'\\\r\n]+/)))),
      "'",
    ),

    escape_sequence: ($) => token.immediate(seq(
      "\\",
      choice(/[^xu]/, /x(?:[0-9a-fA-F]{2})?/, /u[0-9a-fA-F]{4}/),
    )),

    boolean_literal: ($) => choice("true", "false"),

    null_literal: ($) => "null",

    system_lib_string: ($) => token(seq("<", /[^>\r\n]+/, ">")),

    macro_pasted_identifier: ($) => token(choice(
      /[A-Za-z_][A-Za-z0-9_]*%[A-Za-z0-9_]+(?:[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z0-9_]+)*/,
      /%[A-Za-z0-9_]+[A-Za-z_][A-Za-z0-9_]*(?:[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z0-9_]+)*/,
    )),

    at_identifier: ($) => seq(
      "@",
      $.identifier,
    ),

    macro_at_identifier: ($) => seq(
      "@",
      macroNamedIdentifier($),
    ),

    define_at_identifier: ($) => seq(
      "@",
      choice(
        $.identifier,
        $.macro_pasted_identifier,
        $.define_at_identifier,
      ),
    ),

    operator_name: ($) => seq(
      "operator",
      token.immediate(operatorSymbol()),
    ),

    operator_symbol: () => operatorSymbol(),

    identifier: ($) => /[A-Za-z_][A-Za-z0-9_]*(?:@+[A-Za-z0-9_]*)*/,

    comment: ($) => token(choice(
      seq("//", /.*/),
      seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"),
    )),
  },
});

function preprocessor(keyword) {
  return token(seq("#", /[ \t]*/, keyword));
}

function functionDefinitionWithBody($, body) {
  return seq(
    $._function_definition_signature,
    field("body", body),
  );
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

function blockConditionalChoice($, ...items) {
  return choice(
    $.block_conditional,
    ...items,
  );
}

function macroFunctionSignature($, { kind = null, name, parameters }) {
  return seq(
    ...(kind === null ? [] : [kind]),
    optional(field("return_type", $.tagged_type)),
    name,
    parameters,
  );
}

function macroCallableIdentifier($, { allowAt = true } = {}) {
  return choice(
    macroNamedIdentifier($),
    $.operator_name,
    $.macro_parameter,
    ...(allowAt ? [$.macro_at_identifier] : []),
  );
}

function macroBareCallableIdentifier($, { allowAt = true } = {}) {
  return choice(
    $.operator_name,
    $.macro_parameter,
    ...(allowAt ? [$.macro_at_identifier] : []),
  );
}

function macroNamedIdentifier($) {
  return choice(
    $.identifier,
    $.macro_pasted_identifier,
  );
}

function defineName($) {
  return choice(
    macroNamedIdentifier($),
    $.define_at_identifier,
  );
}

function defineDirective($, ...items) {
  return seq(
    preprocessor("define"),
    field("name", defineName($)),
    ...items,
  );
}

function defineValue($) {
  return choice(
    $.macro_replacement,
    alias($._opaque_define_value, $.preproc_text),
    $.preproc_text,
  );
}

function includeDirective($, keyword) {
  return seq(
    preprocessor(keyword),
    field("path", choice($.string_literal, $.system_lib_string)),
  );
}

function macroFunctionKind() {
  return field("kind", choice("public", "stock", "static", "native"));
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
    optional(seq(
      token.immediate(/[ \t]+/),
      field("message", $.preproc_text),
    )),
  );
}

function namedDirective($, keyword, ...items) {
  return seq(
    preprocessor(keyword),
    field("name", $.identifier),
    ...items,
  );
}

function directiveIfGroup(names, content, precedence = 0) {
  const { ifName, elseifName, elseName } = names;
  const wrapRight = (rule) => precedence === 0 ? prec.right(rule) : prec.right(precedence, rule);

  return {
    [ifName]: ($) => wrapRight(seq(
      $.directive_if,
      repeat(content($)),
      field("alternative", optional(choice($[elseifName], $[elseName]))),
      $.directive_endif,
    )),

    [elseifName]: ($) => wrapRight(seq(
      $.directive_elseif,
      repeat(content($)),
      field("alternative", optional(choice($[elseifName], $[elseName]))),
    )),

    [elseName]: ($) => seq(
      $.directive_else,
      repeat(content($)),
    ),
  };
}

function directiveListGroup(baseName, item) {
  return {
    ...directiveIfGroup({
      ifName: `${baseName}_conditional`,
      elseifName: `${baseName}_elseif`,
      elseName: `${baseName}_else`,
    }, ($) => choice(
      seq(item($), ","),
      $[`${baseName}_conditional`],
    )),

    ...directiveIfGroup({
      ifName: `${baseName}_conditional_no_comma`,
      elseifName: `${baseName}_elseif_no_comma`,
      elseName: `${baseName}_else_no_comma`,
    }, item, -1),
  };
}

function directiveListItems($, { item, conditional, conditionalNoComma }) {
  return choice(
    seq(
      repeat(choice(
        seq(item, ","),
        conditional,
      )),
      choice(
        item,
        conditionalNoComma,
      ),
    ),
    repeat1(choice(
      seq(item, ","),
      conditional,
    )),
  );
}

function directiveListElseConflicts($, baseNames) {
  return baseNames.map((baseName) => [
    $[`${baseName}_else`],
    $[`${baseName}_else_no_comma`],
  ]);
}

function directiveBranchChain({
  precedence = 1,
  dynamicPrecedence = null,
  ifBuilder,
  elseifBuilder = ifBuilder,
  elseBuilder = null,
  tailBuilder = null,
}) {
  return ($) => {
    const tail = tailBuilder ? tailBuilder($) : [];
    const sequence = seq(
      $.directive_if,
      ifBuilder($),
      repeat(seq($.directive_elseif, elseifBuilder($))),
      ...(elseBuilder ? [optional(seq($.directive_else, elseBuilder($)))] : []),
      $.directive_endif,
      ...(Array.isArray(tail) ? tail : [tail]),
    );
    const rule = prec.right(precedence, sequence);
    return dynamicPrecedence === null ? rule : prec.dynamic(dynamicPrecedence, rule);
  };
}

function directiveElseAlternative($, { signature, body, precedence = 1 }) {
  return prec.right(precedence, seq(
    $.directive_else,
    signature,
    ...(Array.isArray(body) ? body : [body]),
    $.directive_endif,
  ));
}

function directiveSignatureChain($, {
  signature,
  elseifSignature,
  elseSignature,
  tail = null,
}) {
  return seq(
    $.directive_if,
    signature,
    repeat(seq($.directive_elseif, elseifSignature)),
    optional(seq($.directive_else, elseSignature)),
    $.directive_endif,
    ...(tail === null ? [] : (Array.isArray(tail) ? tail : [tail])),
  );
}

function directiveStatementChoices($, {
  includeConditionalIf = true,
  includeConditionalElseif = true,
  includeConditionalClosings = false,
} = {}) {
  return [
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
    ...conditionalDirectiveChoices($, {
      includeIf: includeConditionalIf,
      includeElseif: includeConditionalElseif,
      includeClosings: includeConditionalClosings,
    }),
  ];
}

function conditionalDirectiveChoices($, {
  includeIf = true,
  includeElseif = true,
  includeClosings = false,
} = {}) {
  return [
    ...(includeIf ? [$.directive_if] : []),
    ...(includeElseif ? [$.directive_elseif] : []),
    ...(includeClosings ? [$.directive_else, $.directive_endif] : []),
  ];
}

function statementTerminator($) {
  return choice(
    ";",
    $._statement_line_terminator,
  );
}

function functionBodyChoice($, {
  blockRule,
  conditionalRule = null,
}) {
  return choice(
    blockRule,
    ...(conditionalRule ? [conditionalRule] : []),
    $.macro_invocation_block_statement,
    $.if_statement,
    $.switch_statement,
    $.while_statement,
    $.foreach_statement,
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
    $.defer_statement,
    $.expression_statement,
    ...nonBranchDirectiveStatementChoices($),
  );
}

function statementChoice($, {
  includeBlock = false,
  includeTopLevelConditionalBlock = false,
  includeTopLevelSharedTailIfHeader = false,
  includeFunctionInitializerAlternative = false,
  includeLoopHeaderSelection = false,
  includeConditionalElseExpression = false,
  includeConditionalElseIfBranch = false,
  includeConditionalElseIfStatement = false,
  includeConditionalIfElseIf = false,
  includeConditionalIf = true,
  includeConditionalElseif = true,
  includeConditionalClosings = false,
} = {}) {
  return choice(
    ...(includeBlock ? [$.block] : []),
    ...(includeTopLevelConditionalBlock ? [alias($._top_level_conditional_block, $.block)] : []),
    ...(includeTopLevelSharedTailIfHeader ? [$._if_header] : []),
    $.inline_callback_definition,
    $.variable_declaration,
    $.state_statement,
    ...(includeFunctionInitializerAlternative ? [$.function_initializer_alternative_statement] : []),
    ...(includeLoopHeaderSelection ? [$.loop_header_selection_statement] : []),
    ...(includeConditionalElseExpression ? [$.conditional_else_expression_statement] : []),
    $.macro_invocation_block_statement,
    $.conditional_else_block_statement,
    $.conditional_else_statement,
    ...(includeConditionalElseIfBranch ? [$.conditional_else_if_branch_statement] : []),
    ...(includeConditionalElseIfStatement ? [$.conditional_else_if_statement] : []),
    ...(includeConditionalIfElseIf ? [$.conditional_if_else_if_statement] : []),
    $.conditional_if_block_statement,
    $.conditional_if_else_block_statement,
    $.conditional_if_else_statement,
    $.conditional_if_split_wrapped_else_statement,
    $.conditional_if_wrapped_else_statement,
    $.conditional_if_statement,
    $.if_statement,
    $.switch_statement,
    $.conditional_loop_fallback_statement,
    $.conditional_loop_variant_statement,
    $.conditional_loop_statement,
    $.while_statement,
    $.foreach_statement,
    $.do_while_statement,
    $.for_statement,
    $.goto_statement,
    $.call_statement,
    $.assert_statement,
    $.exit_statement,
    $.sleep_statement,
    $.label_statement,
    $.return_statement,
    $.break_statement,
    $.continue_statement,
    $.defer_statement,
    $.expression_statement,
    ...directiveStatementChoices($, {
      includeConditionalIf,
      includeConditionalElseif,
      includeConditionalClosings,
    }),
  );
}

function blockStatementBaseChoice($) {
  return statementChoice($, {
    includeBlock: true,
    includeLoopHeaderSelection: true,
    ...wrapperFirstConditionalElseStatementOptions(),
    includeConditionalIfElseIf: true,
  });
}

function loopBodyStatementChoice($) {
  return choice(
    $.block,
    $.variable_declaration,
    $.conditional_else_block_statement,
    $.conditional_else_statement,
    $.if_statement,
    $.switch_statement,
    $.loop_body_conditional_if_statement,
    $.conditional_loop_fallback_statement,
    $.conditional_loop_statement,
    $.while_statement,
    $.foreach_statement,
    $.do_while_statement,
    $.for_statement,
    $.goto_statement,
    $.label_statement,
    $.return_statement,
    $.break_statement,
    $.continue_statement,
    $.expression_statement,
    ...nonBranchDirectiveStatementChoices($),
  );
}

function nonBranchDirectiveStatementChoices($) {
  return directiveStatementChoices($, {
    includeConditionalIf: false,
    includeConditionalElseif: false,
    includeConditionalClosings: false,
  });
}

function wrapperFirstStatementOptions() {
  return {
    includeConditionalIf: false,
    includeConditionalElseif: false,
  };
}

function conditionalElseStatementOptions() {
  return {
    includeConditionalElseExpression: true,
    includeConditionalElseIfBranch: true,
    includeConditionalElseIfStatement: true,
  };
}

function wrapperFirstConditionalElseStatementOptions() {
  return {
    ...conditionalElseStatementOptions(),
    ...wrapperFirstStatementOptions(),
  };
}

function wrappedNonblockStatementOptions() {
  return {
    includeFunctionInitializerAlternative: true,
    ...wrapperFirstConditionalElseStatementOptions(),
  };
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
