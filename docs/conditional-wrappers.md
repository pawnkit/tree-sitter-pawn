# Conditional wrapper nodes

Preprocessor directives can split an ordinary Pawn construct across branches. The
grammar keeps the directive leaves (`preproc_if`, `preproc_elseif`, `preproc_else`,
and `preproc_endif`) while using public wrapper nodes for the combined layout.

These wrappers are part of the current public tree:

| Node | Source shape | Tool normalization |
| --- | --- | --- |
| `conditional_function_definition` | Alternative function signatures followed by one shared body. | Conditional function/signature branch. |
| `conditional_else_statement` | A directive enables an attached `else` statement. | Conditional statement branch. |
| `conditional_else_block_statement` | Directives split the braces of an attached `else` block. | Conditional block boundary. |
| `conditional_else_expression_statement` | Directives choose an `else` expression statement. | Conditional statement branch. |
| `conditional_else_if_branch_statement` | Directives choose complete `else if` branches, optionally followed by a shared `else`. | Conditional statement branch. |
| `conditional_else_if_statement` | Directives choose `else if` headers before one shared body. | Conditional statement branch. |
| `conditional_if_block_statement` | Directives choose an `if` header before one shared block. | Conditional block branch. |
| `conditional_if_else_block_statement` | Directives split a shared `if`/`else` block close. | Conditional block boundary. |
| `conditional_if_else_if_statement` | A selected `if` header is followed by an ordinary `else if`. | Conditional statement branch. |
| `conditional_if_else_statement` | A selected `if` block is followed by an ordinary `else`. | Conditional statement branch. |
| `conditional_if_split_wrapped_else_statement` | Setup statements and braces are split across two directive groups. | Conditional block boundary. |
| `conditional_if_statement` | An `if` header and closing delimiter are split by directives. | Conditional statement branch. |
| `conditional_if_wrapped_else_statement` | An `if` close and attached `else` are divided by directives. | Conditional block boundary. |
| `conditional_loop_fallback_statement` | Directives select iterator/`for` loops with a non-loop fallback. | Conditional loop branch. |
| `conditional_loop_statement` | Directives select loop preambles before one shared body. | Conditional loop branch. |
| `conditional_loop_variant_statement` | Directives select complete loop variants. | Conditional loop branch. |
| `loop_body_conditional_if_statement` | Directives select `if` statements inside a shared loop body. | Conditional loop branch. |

Eleven wrappers have direct reduced corpus assertions. The six additional wrappers
listed above are exercised by the external compatibility suite; removing them
causes a full-file recovery failure in `nex-ac`. They remain explicit exceptions in
the node-alignment test until their real-world trigger is reduced into the corpus.

## Guidance for tools

- Preserve every directive leaf and its source order.
- Format each named branch independently.
- Prefer fields such as `condition`, `consequence`, `elseif`, `alternative`,
  `signature`, and `body` over child indexes.
- Do not move comments, commas, braces, or statements across branch boundaries.
- Shared bodies belong to the wrapper, not to an arbitrary branch.
- Reparse formatted output and compare its significant tree shape.

## Future simplification

A future breaking tree may replace these nodes with one branch container per
context: statement, function signature, list, and loop preamble. That work should
also replace wrapper-specific scanner tokens with neutral boundary tokens and must
be measured against corpus, formatter, and external fixtures. Renaming wrappers
without changing the underlying conditional machinery would not reduce parser
complexity.
