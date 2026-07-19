# Pawn syntax support

This page records the grammar's current boundaries. “Recovery” means Tree-sitter
still returns a useful tree, but it may contain error or missing nodes.

## Statements

- Supports `assert`, `break`, `continue`, `do`, `exit`, `for`, `goto`, `if`,
  `return`, `sleep`, `state`, `switch`, `while`, blocks, expression statements,
  and empty statements.
- Handles explicit semicolons and supported newline-terminated forms.
- Incomplete statements and deeply split conditional layouts may
  contain recovery nodes.

## Declarations

- Supports `new`, `static`, `const`, `stock`, `public`, `forward`, `native`,
  enums, stateful variables, and global/local variables.
- Accepts identifier-prefixed declarations when the remaining syntax
  clearly forms a declaration.

## Functions

- Supports normal and braceless bodies, operators, callback-like and `@` names,
  member-like forwards, aliases, array/tagged returns, and generic prefixed forms.
- Recovers incomplete signatures and bodies for editor use.

## Types and tags

- Supports normal tags, wildcard `_:` tags, tag sets, tagged arrays,
  parameters, expressions, and return types.

## Expressions

- Supports tag casts, `sizeof`, `tagof`, packed and normal subscripts, chained
  tags, ternaries, assignments and compound assignments, updates, calls,
  member-like calls, adjacent strings, and switch ranges.

## Literals, arrays, and enums

- Supports integers, floats, strings, characters, escapes, packed strings,
  ellipsis fillers, nested arrays, trailing commas, and enum arrays.

## Preprocessor

- Supports `#include`, `#tryinclude`, `#define`, `#undef`, `#if`, `#elseif`,
  `#else`, `#endif`, `#assert`, `#error`, `#warning`, `#emit`, `#file`, `#line`,
  `#pragma`, `#endinput`, and line continuations.
- Supports common conditional expressions using `defined`, identifiers, literals,
  tagged constants, parentheses, unary operators, and binary operators.
- Replacement text remains opaque `preproc_text`; the grammar does not
  attempt to interpret replacement programs.
- Handles conditional regions containing complete top-level items, block
  statements, switch items, or list elements.
- Constructs assembled across several conditional branches may
  contain localized recovery nodes; token-stream reconstruction is out of scope.

## Generic macro-shaped syntax

- Supports invocation statements, invocation blocks, iterator-shaped loops,
  and macro-prefixed declarations/functions.
- Recovers incomplete calls and unsupported iterator-like argument shapes.

## Non-goals

- Library-specific macro names and framework semantics.
- Macro expansion, include resolution, semantic type checking,
  compile-time symbol evaluation, or compiler compatibility validation.
- Source forms that need semantic information for disambiguation are
  intentionally left opaque or represented with recovery nodes.
