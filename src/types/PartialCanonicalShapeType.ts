import type { JsonTologyReferencesInterface } from '../interfaces/JsonTologyReferencesInterface.js';
import type { CanonicalShapeType } from './Infer.js';

/**
 * Homomorphic optional-property mapping over a naked type parameter. Kept as a
 * distinct, unnamed-utility helper (rather than `Partial<T>`) so mapping over
 * {@link CanonicalShapeType} preserves the homomorphic contextual-typing
 * behavior TypeScript gives mapped types over a naked generic parameter —
 * mapping directly over `keyof CanonicalShapeType<...>` loses that and breaks
 * inference at generic call sites like `Transform.create`'s `decode`.
 */
type OptionalPropertiesType<TShape> = { [Key in keyof TShape]?: TShape[Key] };

/**
 * Partial form of {@link CanonicalShapeType} — every top-level property optional.
 *
 * Named explicitly (rather than `Partial<CanonicalShapeType<...>>` at each call
 * site) so the partial shape `materialize`/`decode` accepts is a single,
 * spelled-out type rather than a positionally-derived subset — see
 * `whole-canonical-types`.
 *
 * @typeParam TSchema - The schema to resolve.
 * @typeParam TReferences - Cross-schema references map for `$ref` resolution.
 */
export type PartialCanonicalShapeType<TSchema, TReferences = JsonTologyReferencesInterface>
  = OptionalPropertiesType<CanonicalShapeType<TSchema, TReferences>>;
