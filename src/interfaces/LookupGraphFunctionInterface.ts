import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Function that resolves a schema ID to its compiled graph, or undefined if not registered.
 *
 * @remarks
 * `@typescript-eslint/prefer-function-type` flags this as a call-signature-only
 * interface, but converting it to a type alias reintroduces the
 * `@studnicky/type-alias-invariants` / `folder-content-shape` violation this
 * shape exists to satisfy. `@studnicky/eslint-config`'s own `entitySuite`
 * disables `prefer-function-type` for exactly this reason (see its README);
 * the project's `eslint.config.mjs` re-enables it globally, which reintroduces
 * the contradiction for every callable interface in `src/interfaces/`. Left as
 * a documented exception pending a scoped config fix (see
 * {@link ValidateWithErrorsFunctionInterface}).
 */
export interface LookupGraphFunctionInterface {
  (schemaId: string): SchemaGraphInterface | undefined;
}
