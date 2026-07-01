# tree-sitter-pawn

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for generic
Pawn 3 syntax, with particular attention to source found in SA-MP and open.mp
projects.

## Scope

The grammar models Pawn source, not the APIs or expansion semantics of any Pawn
library. YSI, sscanf, streamer, PawnPlus, fixes, and other projects are useful
compatibility fixtures, but their macro names are never language keywords here.
Macro-shaped declarations, statements, labels, and block openers are accepted by
their syntax alone. Declaration prefixes and iterator-style loops are represented
by `prefixed_function_declaration` and `macro_iterator_loop_statement`; names such
as `hook` and `foreach` have no privileged status in the grammar.
Modifier-before-name definitions (`SomeMacro public OnSomething()`), prefixed calls,
and multi-token references are likewise represented by their generic source shape.

The target is the Pawn 3 language described by the CompuPhase reference, plus
widely implemented compiler syntax such as tags, states, packed arrays, callbacks,
operator overloads, and optional semicolons in the narrow positions accepted by
common Pawn compilers. Compiler-specific extensions should be documented and
covered by a reduced corpus case.

## Preprocessor and macro policy

Preprocessor structure is parsed so editors can navigate conditional branches and
identify definitions. A `#define` has a name, optional parameters, and a replacement
value. The replacement is parsed structurally only when doing so is unambiguous;
otherwise it is preserved as `preproc_text`. This fallback is intentional. The
grammar does not expand macros and must not infer a library API from a macro name.
Statement-like replacement parsing uses hidden implementation rules: consumers see
the stable `macro_replacement` node and ordinary `preproc_*` expressions rather than
a parallel public taxonomy of macro-only loops, switches, declarations, and blocks.
The common well-formed public shape is:

```text
preproc_define
  name: identifier
  parameters: macro_parameter_list?
  value: macro_replacement | preproc_text
```

Recovery may additionally use the `unsupported_header` and
`unsupported_parameters` fields. `preproc_text` is an opaque leaf;
`macro_replacement` exposes fields appropriate to the replacement form. The
generated `src/node-types.json` is authoritative for every replacement variant.

Conditionals are supported at the top level, in blocks, and inside common lists
(arguments, parameters, enum entries, array literals, and variable declarators).
Stable directive leaves use the `preproc_*` naming convention. Some statement and
function layouts currently expose legacy `conditional_*` wrapper nodes. Those
nodes are public for this release because removing them would change established
corpus trees; new consumers should prefer their `preproc_*` leaves and named fields.
The complete audit and migration plan is in
[`docs/conditional-wrappers.md`](docs/conditional-wrappers.md).

Malformed or incomplete macro-heavy code should produce a useful partial tree. A
raw replacement node is preferable to a brittle, falsely precise expansion tree.
Unclosed define parameter lists are retained as `unsupported_parameters`, and a
line-incomplete invocation immediately before a closing block keeps the ordinary
`macro_invocation_statement`/`argument_list` shape for editor tooling.

## Public tree stability

Named nodes, field names, and query captures are public API. Changes to them require
corpus coverage and release notes; renames are versioned breaking changes. Hidden
rules beginning with `_` and scanner tokens are implementation details and may
change while preserving the public tree.

The grammar favors reusable categories (`_expression`, `_statement`, `_type`,
`_literal`, and `_preproc_expression`) over library-shaped nodes. New public nodes
should represent Pawn syntax or durable source structure, not one include's
expansion convention. Declaration and directive categories will only become
supertypes when they can preserve the established conditional-wrapper trees
without precedence tricks.

`prefixed_function_declaration` is the generic syntax node for a declaration with
an identifier-shaped prefix before its optional return tag and function name. It
does not assign semantics to that prefix. Ordinary `forward` and `native` forms,
including aliases, remain `function_declaration` nodes.
Its stable fields are `name` and `parameters`, with optional `prefix`,
`return_type`, `return_size`, `state`, `callback_signature`, and `value` fields.

## Development

Requirements are Node.js 18 or newer and a C toolchain.

```sh
npm install
npm run generate       # regenerate src/parser.c, grammar.json, and node-types.json
npm test               # corpus tests
npm run test:queries   # highlights, locals, and tags query assertions
npm run diagnose:parser # report generated parser size and line count
npm run check          # generation, size report, corpus, and query tests
```

Every public tree shape belongs in `test/corpus`. Real-world failures should first
be reduced to a small regression case. Query fixtures live in `test/queries`.
The current generated-parser size investigation and historical measurements are
recorded in [`docs/parser-size.md`](docs/parser-size.md).

Broader compatibility checks clone the projects listed in
`test/external/sources.tsv` and parse their Pawn files:

```sh
npm run test:external:fetch
npm run test:external
# or both:
npm run check:external
```

Fetching fixtures requires network access and is intentionally separate from the
fast normal test run.

## Queries and editor integration

The package ships `queries/highlights.scm`, `queries/locals.scm`, and
`queries/tags.scm`. Editors can associate the `pawn` scope with `.pwn`, and `.inc`
files; see `tree-sitter.json` for the authoritative metadata.

Stable capture families include `function`, `function.call`, `function.macro`,
`variable`, `variable.parameter`, `type`, `constant`, `preproc`, `attribute`, and
the standard literal, keyword, punctuation, operator, comment, locals, and tags
captures in the shipped query files. Golden files under `test/queries` record the
exact capture names and source ranges, including intentional overlaps.

For example, this source:

```pawn
#define twice(%0) ((%0) * 2)

public Float:scale(Float:value) {
    return Float:twice(value);
}
```

has a `preproc_define` containing `name`, `parameters`, and `value` fields, followed
by a `function_definition` whose return and parameter tags remain explicit. Tools
should consume fields and supertypes where possible rather than depending on every
intermediate wrapper.

## Known limitations

- Macro expansion is deliberately out of scope.
- Replacement bodies that mix declarations, unmatched delimiters, or token-pasting
  in ambiguous ways may be represented as `preproc_text`.
- Some deeply interleaved conditional layouts require recovery nodes; reduced cases
  are welcome when they improve generic behavior without adding library semantics.
- The grammar describes source syntax and does not perform type checking, symbol
  resolution, constant evaluation, or compiler compatibility validation.
