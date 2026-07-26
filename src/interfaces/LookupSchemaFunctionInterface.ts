/**
 * Function that resolves a schema ID to its raw JSON Schema object, or undefined if not registered.
 *
 * A call-signature interface, not schema-derived data — the rule conflict this shape resolves
 * (`@typescript-eslint/prefer-function-type` vs `@studnicky/type-alias-invariants`/
 * `folder-content-shape`) is documented in `eslint.config.mjs` and in
 * `noocodec-substrate/docs/eslint/known-issues/type-alias-invariants-prefer-function-type.md`.
 */
export interface LookupSchemaFunctionInterface {
  (id: string): Record<string, unknown> | undefined;
}
