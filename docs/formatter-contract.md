# Formatter contract

This document describes the tree guarantees that formatters and other source
rewriters can rely on. `src/node-types.json` remains the authoritative node and
field reference.

## Source ranges and comments

Whitespace and comments are extras. Comments appear as named nodes, but their
attachment to surrounding syntax is not encoded as a field. Tools should attach
trivia by byte range and line position:

- Attach a leading comment to the next named node.
- Attach an end-of-line comment to the previous named node on that line.
- Keep detached comments and their blank-line grouping in place.
- Preserve block-comment contents unless block-comment formatting is explicitly
  supported.
- Do not move comments across preprocessor branch boundaries.
- Do not rewrite comments contained by an opaque `preproc_text` range.

Always reconstruct untouched text from source byte ranges. Named children alone
are not enough to preserve punctuation, whitespace, or comments.

## Declarations and directives

Use the `_declaration` and `_directive` supertypes instead of maintaining local
lists of their subtypes. Conditional layouts can contain declarations or directive
leaves inside wrapper nodes, so walkers should recurse through wrappers rather
than assuming declarations only occur directly under `source_file`.

## Macro replacement text

`preproc_text` is an opaque formatting boundary. Copy its source range exactly;
do not tokenize, indent, wrap, or rewrite text inside it.

`macro_replacement` means the grammar found a structured replacement. A formatter
may format structured children, but should fall back to byte-for-byte preservation
if recovery nodes occur or delimiters cannot be reconstructed safely. Neither node
represents macro expansion.

## Conditional wrappers

Public `conditional_*` nodes preserve layouts where directives split an ordinary
Pawn construct. Treat them as one of these logical categories:

- statement or expression branch;
- block branch or split block boundary;
- loop header/body branch;
- function signature/body branch;
- list branch (arguments, parameters, arrays, enums, or declarators).

Preserve every `preproc_if`, `preproc_elseif`, `preproc_else`, and `preproc_endif`
boundary. Format branch contents independently and never move syntax between
branches. The node-by-node mapping is in `conditional-wrappers.md`.

## Semicolons and newlines

The scanner accepts newlines as terminators only in grammar-approved positions.
The terminator may therefore be absent from the named tree even though the source
line ends a statement.

A formatter may preserve semicolonless syntax or normalize eligible statements to
semicolons. It must reparse the result and confirm that statement and function-body
structure did not change. In particular, preserve deliberate braceless function
bodies, line-terminated calls, state statements, macro continuations, and incomplete
editor input unless the selected style explicitly and safely normalizes them.

## Validation loop

For formatter development, use this minimum loop:

1. Parse the original source and reject unexpected `ERROR` or `MISSING` nodes.
2. Format using source ranges plus the syntax tree.
3. Parse the output again.
4. Reject new `ERROR` or `MISSING` nodes and compare the significant tree shape.

The files under `test/fixtures/formatter` are deterministic smoke-test inputs for
this workflow.
