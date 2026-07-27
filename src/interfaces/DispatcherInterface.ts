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
 * a bare function type is behavioral, not schema-derived data. Carries a
 * `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain
 * function values still satisfy the interface structurally).
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
  readonly 'dispatcherBrand'?: unique symbol;
}
