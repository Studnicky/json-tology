/**
 * Homomorphic identity mapped type — structurally identical to `T` for every
 * consumer, but its own AST shape is a mapped type rather than an inline
 * object literal.
 *
 * @remarks
 * Wrap a type literal that genuinely cannot be derived from JSON Schema
 * (phantom brands keyed by a `unique symbol`, a bag of callback fields, a
 * field holding a behavioral interface or a non-JSON collection like `Set`)
 * as `IdentityType<{ ... }>` at the type alias's top level. The type
 * annotation `IdentityType<{ ... }>` is itself a type reference, and the
 * object literal only appears as its type argument — never as the alias's
 * own top-level shape.
 *
 * @example
 * ```ts
 * export type ComputedExtensionBrandType<TFields> = IdentityType<{
 *   '~jt:computedFields': TFields;
 * }>;
 * ```
 *
 * @category Type Utilities
 * @since 0.28.0
 * @group Type Utilities
 *
 * @typeParam T - The shape to preserve unchanged.
 */
export type IdentityType<T> = { [K in keyof T]: T[K] };
