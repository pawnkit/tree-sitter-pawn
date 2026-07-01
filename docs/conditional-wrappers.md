# Conditional wrapper audit

These public nodes model layouts in which preprocessor branches split ordinary
Pawn constructs; they are not Pawn keywords. The `preproc_if`, `preproc_elseif`,
`preproc_else`, `preproc_endif`, and `preproc_condition` nodes represent the
directive syntax itself.

## Current nodes

| Node | Why it exists | Direction |
| --- | --- | --- |
| `conditional_function_definition` | Selects function signatures before one shared body. | Retain until signatures have a branch container. |
| `conditional_else_statement` | Enables an `else` statement through a directive branch. | Merge candidate. |
| `conditional_else_block_statement` | Splits an `else` block's braces across directives. | Merge candidate after scanner-layout tests exist. |
| `conditional_else_expression_statement` | Selects alternate `else` expressions. | Merge into a branch-list container. |
| `conditional_else_if_branch_statement` | Selects complete `else if` branches and an optional shared `else`. | Merge into a branch-list container. |
| `conditional_else_if_statement` | Selects `else if` headers before one shared body. | Retain until shared tails have a common representation. |
| `conditional_if_else_if_statement` | Joins a selected `if` header to an ordinary `else if`. | Merge candidate. |
| `conditional_if_block_statement` | Joins a selected `if` header to a shared block. | Merge candidate after scanner token replacement. |
| `conditional_if_else_block_statement` | Handles a shared `if`/`else` block with a scanner-detected close. | Retain while scanner layout remains specialized. |
| `conditional_if_else_statement` | Joins a selected `if` header and block to an ordinary `else`. | Merge candidate. |
| `conditional_if_split_wrapped_else_statement` | Handles setup statements and braces split across two directive groups. | Retain; it is structurally distinct recovery syntax. |
| `conditional_if_statement` | Handles an `if` header and close split by directives. | Merge candidate after scanner token replacement. |
| `conditional_if_wrapped_else_statement` | Splits an `if` close and ordinary `else` across directives. | Merge candidate after scanner token replacement. |
| `conditional_loop_fallback_statement` | Selects iterator/`for` loops with a non-loop fallback. | Merge into a branch-list container. |
| `conditional_loop_statement` | Selects loop preambles before a shared braced body. | Retain until shared tails have a common representation. |
| `conditional_loop_variant_statement` | Selects complete loop variants. | Merge into a branch-list container. |
| `loop_body_conditional_if_statement` | Selects `if` statements in a shared loop body. | Hide candidate once statement choices are unified. |

Some nodes lack a dedicated one-node fixture even though their layouts participate
in broader wrapper rules. Before migration, add reduced fixtures for every node
and record its fields. Existing concentrated coverage lives in
`test/corpus/preprocessor_wrapping_cases.txt`; conditional function coverage also
appears in `test/corpus/classic_constructs.txt`.

### Fixture status

The following nodes have direct assertions in the existing corpus:

- `conditional_function_definition`
- `conditional_else_expression_statement`
- `conditional_else_if_branch_statement`
- `conditional_if_block_statement`
- `conditional_if_else_block_statement`
- `conditional_if_else_if_statement`
- `conditional_if_split_wrapped_else_statement`
- `conditional_if_statement`
- `conditional_if_wrapped_else_statement`
- `conditional_loop_fallback_statement`
- `conditional_loop_statement`

Six generated alternatives do not yet have a stable reduced input that selects
them over a higher-precedence neighboring wrapper:

| Node | Why no dedicated fixture is committed |
| --- | --- |
| `conditional_else_statement` | Reduced forms select the more specific expression or `else if` wrapper. |
| `conditional_else_block_statement` | Its split-brace form depends on scanner context and reduced forms select another block wrapper. |
| `conditional_else_if_statement` | Reduced shared-body forms select `conditional_else_if_branch_statement`. |
| `conditional_if_else_statement` | Reduced forms select one of the scanner-backed block wrappers. |
| `conditional_loop_variant_statement` | Known reduced loop branches select the fallback or shared-tail loop wrapper. |
| `loop_body_conditional_if_statement` | Known reduced inputs select the general conditional statement wrapper. |

Manufacturing malformed input just to force these alternatives would freeze error
recovery rather than valid syntax. Before the breaking migration, either find a
real source shape for each node and add it to the corpus, or remove the unreachable
alternative with parser-size and external-fixture measurements.

## Migration strategy

This should be a versioned, breaking-tree project rather than an ordinary fix.

1. Add reduced fixtures for every wrapper and snapshot query behavior. Record
   generated state count and parser size.
2. Introduce one hidden branch representation per context: statement, function
   signature, list item, and loop preamble.
3. Replace wrapper-specific scanner tokens with neutral boundary tokens where
   possible, measuring each replacement independently.
4. Expose a small branch container with directive leaves and named `consequence`,
   `elseif`, and `alternative` fields. Keep aliases only when fields are preserved
   and they do not retain the state product.
5. Update corpus trees, queries, and documentation together in a major release and
   publish an old-to-new node and field mapping.
6. Regenerate artifacts, validate external fixtures, and compare state count with
   the baseline in `parser-size.md`.

Merely hiding or renaming current rules would break consumer trees while leaving
their parse-table states intact. This release therefore documents candidates but
does not perform a cosmetic collapse.
