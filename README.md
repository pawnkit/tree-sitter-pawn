# tree-sitter-pawn

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Pawn 3.
It supports `.pwn` and `.inc` files, including common Pawn syntax such as tags,
states, callbacks, operator overloads, preprocessor directives, and macro-shaped
constructs.

The grammar describes Pawn syntax only.

## Install

Add the package to a project that uses Tree-sitter:

```sh
npm install tree-sitter-pawn
```

The package includes the grammar, generated parser sources, node types, and
highlight, locals, and tags queries. Editor integrations should use the `pawn`
language scope for `.pwn` and `.inc` files.

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
