# tree-sitter-pawn

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Pawn 3.
It supports `.pwn` and `.inc` files, including common Pawn syntax such as tags,
states, callbacks, operator overloads, preprocessor directives, and macro-shaped
constructs.

The grammar describes Pawn syntax only. It does not expand macros or assign
special meaning to names from particular libraries.

## Install

Add the package to a project that uses Tree-sitter:

```sh
npm install tree-sitter-pawn
```

The package includes the grammar, generated parser sources, node types, and
highlight, locals, and tags queries. Editor integrations should use the `pawn`
language scope for `.pwn` and `.inc` files.

## Syntax trees

Preprocessor nodes use the `preproc_*` naming convention. For example, a define
is represented by `preproc_define`, with `name`, optional `parameters`, and a
`value`. Replacement text is either parsed as `macro_replacement` or retained as
`preproc_text` when a more specific tree would be unreliable.

Macro-like declarations and iterator-shaped loops are parsed generically as
`prefixed_function_declaration` and `macro_iterator_loop_statement`. No library
or framework names are built into the grammar.

`src/node-types.json` is the authoritative reference for public nodes and fields.

## Development

Requires Node.js 18 or newer and a C toolchain.

```sh
npm install
npm run generate       # regenerate parser artifacts
npm test               # run corpus tests
npm run test:queries   # test shipped queries
npm run check          # run the full local check
npm run pack:check     # inspect the npm package
```

External compatibility fixtures are kept separate from the normal test suite:

```sh
npm run check:external
```

Parser-size findings and the future conditional-wrapper migration are documented
in [docs/parser-size.md](docs/parser-size.md) and
[docs/conditional-wrappers.md](docs/conditional-wrappers.md).

## Limitations

- Macro expansion and semantic analysis are out of scope.
- Ambiguous macro replacement bodies may remain as `preproc_text`.
- Deeply interleaved preprocessor branches may require error recovery.
