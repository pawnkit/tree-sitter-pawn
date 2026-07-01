# Generated parser size

Run `npm run diagnose:parser` after generation to print the size and line count
of `src/parser.c`. As of July 2026, Tree-sitter CLI 0.25.10 generates a 56 MiB
file with 1,750,123 lines. Its generated constants are:

```text
STATE_COUNT 30932
SYMBOL_COUNT 501
ALIAS_COUNT 0
TOKEN_COUNT 140
```

Run the diagnostic after every experiment; it reports the file size, line count,
and these constants. The generator version is pinned to Tree-sitter CLI 0.25.10.

Repository history locates the major increase in commit `13e350e`: the parser
grew from 9.8 MiB and 6,061 states to 50.0 MiB and 26,144 states. That change
introduced context-specific conditional groups for top-level items, blocks,
arguments, array literals, enums, parameters, and variable declarators, together
with conditional function/body variants. Later macro and naming refactors changed
the total much less; the parser has remained between 50 and 59 MiB.

This points to the Cartesian product of conditional context variants as the main
growth driver, rather than `macro_iterator_loop_statement` alone. Simplification
should therefore start by sharing or hiding those conditional list and statement
forms while preserving their corpus trees. Removing individual macro shapes
without measuring generated state count is unlikely to yield the same benefit.

The public `conditional_*` statement wrappers were reviewed against
`test/corpus/preprocessor_wrapping_cases.txt`. They encode materially different
shared-header, shared-tail, split-else, loop, and function layouts, and dozens of
expected trees currently name them. Simply hiding or aliasing them would be a
breaking public-tree change without reducing the underlying context-specific parse
states. They are therefore retained for this release. A safe reduction needs a
versioned tree migration plus a grammar experiment that consolidates the internal
context variants; renaming the visible nodes alone is not such a reduction.

Tightening iterator-shaped macro calls in July 2026 changed the parser from
31,112 to 31,260 states. That small increase confirms that this macro rule is not
the dominant size driver and provides a baseline for future isolation work.

## Experiments

The iterator recovery change was a controlled grammar experiment: the iterator
header was tightened to require `new`, while a semicolon-terminated iterator-shaped
call received a generic invocation recovery path. Corpus and query tests passed,
as did all 45 external fixtures. The result was an increase of 148 states and
7,918 generated lines, so the change was retained for correctness but not as a
size optimization.

Adding `_declaration` and `_directive` allowed top-level alternatives to share
categories. With all corpus and query tests passing, the parser fell from 31,260
to 30,932 states and from 1,772,780 to 1,750,123 lines. The three additional
symbols are the two supertypes and supporting generated metadata. This reduction
is retained because it improves both tooling and parser size.

An experiment removing six conditional wrapper alternatives reduced the parser to
29,407 states, but was rejected because `nex-ac` then parsed as one file-wide
`ERROR`. This confirms that corpus absence is not proof that a recovery alternative
is unused. Reducing that real-world trigger is a prerequisite to simplifying these
wrappers safely.

A follow-up removed only the three alternatives with no observed final-tree node.
That parser passed the local corpus at 30,126 states, but `ultimate-creator` became
one file-wide `ERROR`. The alternatives were restored. Future conditional cleanup
must compare full parse behavior, not just count which node types appear in a
successful tree.

History provides a second useful isolation point. Commit `13e350e` introduced the
context-specific conditional families and moved the parser from 6,061 to 26,144
states. Later changes to macro shapes account for a much smaller fraction. This is
why list-condition sharing and neutral scanner boundaries are the next worthwhile
experiments; removing macro recovery rules at random is not.

### Array-literal conditional family

A detached-worktree experiment removed only the array-literal conditional family
and parsed array items as a normal comma-separated list. The generated parser fell
from 31,260 to 30,935 states, from 1,772,780 to 1,751,571 lines, and from 498 to
491 symbols. This confirms that even one duplicated list context has a measurable
cost.

The experiment was rejected because the dedicated `split array literals` corpus
case failed: directive leaves and branch values no longer formed the expected
conditional list structure. A safe reduction must therefore share conditional
machinery across list contexts while preserving that tree, rather than dropping
conditional support from a context.

The size report is diagnostic rather than a hard limit. A future limit should be
based on a deliberate grammar reduction so routine Tree-sitter generator changes
do not fail CI spuriously.
