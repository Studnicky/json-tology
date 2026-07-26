import type { QuadInterface } from './QuadInterface.js';
import type { OwlImportContextInterface } from './OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from './OwlImportFragmentInterface.js';

/**
 * Signature of a per-axiom-group dispatcher function.
 * Receives the full quad set for a subject and the import context,
 * returns the fragment of import data it extracted.
 *
 * @remarks
 * Each dispatcher module under `importDispatch/` exports a function matching
 * this interface. The orchestrator calls each dispatcher in sequence and
 * deep-merges the returned fragments into the final `OwlImportResultInterface`.
 *
 * Authored as a call-signature interface rather than a function-type alias:
 * a bare function type is behavioral, not schema-derived data.
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
 *
 * @example
 * ```ts
 * const dispatcher: DispatcherInterface = (quads, ctx) => {
 *   return { characteristics: [], individuals: [], invariants: [], sameAs: [], schemaDeltas: new Map() };
 * };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentInterface}
 * @group Dispatchers
 */
export interface DispatcherInterface {
  (quads: QuadInterface[], context: OwlImportContextInterface): OwlImportFragmentInterface;
}
