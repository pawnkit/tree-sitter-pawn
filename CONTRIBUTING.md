# Contributing

PawnKit is maintained by volunteers, so reviews may take a little time.

Grammar fixes are welcome. Include the smallest Pawn example that demonstrates
the syntax, then add it to the corpus with the expected tree.

Install locked dependencies and run the full check:

```sh
npm ci
npm run check
npm run pack:check
```

The grammar handles syntax, not macro expansion or framework semantics. Prefer
local recovery over a broad rule that makes unrelated code ambiguous or slow.
