import type { IdentityType } from './IdentityType.js';

/**
 * Phantom brand injected onto a schema's entry in `TRefs` by `addComputed`
 * to encode per-call computed-field augmentations without a second generic
 * parameter. `ParseOutputType` extracts and intersects `TFields` so that the
 * registered computed properties appear on the inferred output type.
 *
 * @typeParam TFields - A `Record<propertyName, returnType>` map of registered
 *   computed fields accumulated by successive `addComputed` calls.
 */
export type ComputedExtensionBrandType<TFields> = IdentityType<{
  '~jt:computedFields': TFields;
}>;
