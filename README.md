# tree-sitter-pawn

[![Maturity: preview](https://img.shields.io/badge/maturity-preview-blue)](.pawnkit/support.json)

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Pawn 3,
including the syntax used by SA-MP and open.mp projects.

## Install

For Node.js:

```sh
npm install tree-sitter @pawnkit/tree-sitter-pawn
```

```js
const Parser = require("tree-sitter");
const Pawn = require("@pawnkit/tree-sitter-pawn");

const parser = new Parser();
parser.setLanguage(Pawn);
const tree = parser.parse("main() { return 0; }");
```

Go projects can import `github.com/pawnkit/tree-sitter-pawn/bindings/go`.

The package also ships highlight, locals, and tags queries. Editor integrations
should use the `pawn` language scope for `.pwn` and `.inc` files.

## Development

Requires Node.js 18 or newer and a C toolchain.

```sh
npm install
npm run generate       # regenerate parser artifacts
npm test               # run corpus tests
npm run test:queries   # test shipped queries
npm run diagnose:parser # check parser size and complexity
npm run check          # run the full local check
npm run pack:check     # inspect the npm package
```

The external suite checks recovery against real community projects:

```sh
npm run check:external
```

## What it does not do

- Macro expansion and semantic analysis are out of scope.
- Macro replacement bodies remain opaque `preproc_text` nodes.
- Deeply interleaved preprocessor branches may require error recovery.

## Contributing

Small grammar fixes and real Pawn syntax cases are welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md).
