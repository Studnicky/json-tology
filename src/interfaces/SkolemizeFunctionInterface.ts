/**
 * Skolemize — IRI minting strategy function shape.
 *
 * A skolemize function receives a context describing where in the
 * instance tree projection currently sits and returns either an IRI
 * for the current subject, or `undefined` to fall through to the next
 * strategy in a `Skolemize.compose` chain (or to the default
 * `Skolemize.hash` minter when used standalone).
 *
 * A call-signature interface, not schema-derived data — the rule conflict this shape resolves
 * (`@typescript-eslint/prefer-function-type` vs `@studnicky/type-alias-invariants`/
 * `folder-content-shape`) is documented in `eslint.config.mjs` and in
 * `noocodec-substrate/docs/eslint/known-issues/type-alias-invariants-prefer-function-type.md`.
 */
export interface SkolemizeFunctionInterface {
  (context: {
    'depth': number;
    'path': string;
    'value': unknown;
  }): string | undefined;
}
