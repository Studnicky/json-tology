import type { SchemaRegistryInterface } from './SchemaRegistryInterface.js';

/**
 * Callback signature for {@link SchemaRegistryInterface.forEach}.
 *
 * @remarks
 * `@typescript-eslint/prefer-function-type` flags this as a call-signature-only
 * interface, but converting it to a type alias reintroduces the
 * `@studnicky/type-alias-invariants` / `folder-content-shape` violation this
 * shape exists to satisfy. `@studnicky/eslint-config`'s own `entitySuite`
 * disables `prefer-function-type` for exactly this reason (see its README);
 * the project's `eslint.config.mjs` re-enables it globally, which reintroduces
 * the contradiction for every callable interface in `src/interfaces/`. Left as
 * a documented exception pending a scoped config fix.
 */
export interface SchemaRegistryForEachCallbackInterface {
  (schema: Record<string, unknown>, schemaId: string, registry: SchemaRegistryInterface): void;
}
