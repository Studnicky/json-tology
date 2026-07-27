/**
 * A set of inherited property key names collected from `allOf` traversal.
 *
 * @remarks
 * Populated during compilation of object schemas that use `allOf` composition.
 * The engine uses this set to determine which properties are inherited from
 * ancestor schemas so that `additionalProperties` and `unevaluatedProperties`
 * can be evaluated correctly.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link ConditionalPropertyKeySetInterface}
 */
export interface InheritedPropertyKeySetInterface extends Set<string> {}
