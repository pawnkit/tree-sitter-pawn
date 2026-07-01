# Pawn syntax support

Legend: **parsed**, **recovery**, **opaque**, **unsupported**, or **non-goal**.

## Statements

- **Parsed:** `assert`, `break`, `continue`, `do`, `exit`, `for`, `goto`, `if`,
  `return`, `sleep`, `state`, `switch`, `while`, blocks, expression statements,
  and empty statements.
- **Parsed:** explicit-semicolon and supported newline-terminated forms.
- **Recovery:** incomplete statements and deeply split conditional layouts may
  contain recovery nodes.

## Declarations

- **Parsed:** `new`, `static`, `const`, `stock`, `public`, `forward`, `native`,
  enums, stateful variables, and global/local variables.
- **Parsed:** generic identifier-prefixed declarations when the remaining syntax
  clearly forms a declaration.

## Functions

- **Parsed:** normal and braceless bodies, operators, callback-like and `@` names,
  member-like forwards, aliases, array/tagged returns, and generic prefixed forms.
- **Recovery:** incomplete signatures and bodies intended for editor use.

## Types and tags

- **Parsed:** normal tags, wildcard `_:` tags, tag sets, tagged arrays,
  parameters, expressions, and return types.

## Expressions

- **Parsed:** tag casts, `sizeof`, `tagof`, packed and normal subscripts, chained
  tags, ternaries, assignments and compound assignments, updates, calls,
  member-like calls, adjacent strings, and switch ranges.

## Literals, arrays, and enums

- **Parsed:** integers, floats, strings, characters, escapes, packed strings,
  ellipsis fillers, nested arrays, trailing commas, and enum arrays.

## Preprocessor

- **Parsed:** `#include`, `#tryinclude`, `#define`, `#undef`, `#if`, `#elseif`,
  `#else`, `#endif`, `#assert`, `#error`, `#warning`, `#emit`, `#file`, `#line`,
  `#pragma`, `#endinput`, and line continuations.
- **Parsed:** unambiguous structured replacements as `macro_replacement`.
- **Opaque:** ambiguous or unsupported replacement text as `preproc_text`.
- **Recovery:** conditionals that divide statements, functions, or lists use
  public conditional wrapper nodes.

## Generic macro-shaped syntax

- **Parsed:** invocation statements, invocation blocks, iterator-shaped loops,
  and macro-prefixed declarations/functions.
- **Recovery:** incomplete calls and unsupported iterator-like argument shapes.

## Non-goals

- **Non-goal:** library-specific macro names or framework semantics.
- **Non-goal:** macro expansion, include resolution, semantic type checking,
  compile-time symbol evaluation, or compiler compatibility validation.
- **Unsupported:** source forms that require those semantics to disambiguate are
  intentionally left opaque or represented with recovery nodes.
