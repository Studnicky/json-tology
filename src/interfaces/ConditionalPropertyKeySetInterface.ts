/**
 * A set of conditional branch property key names from `if`/`then`/`else` traversal.
 *
 * @remarks
 * Populated during compilation of object schemas that use `if`/`then`/`else`.
 * The engine uses this set to exclude conditional-branch properties from
 * `additionalProperties` checks, preventing false negatives when a property
 * is only declared inside a conditional branch.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link InheritedPropertyKeySetInterface}
 */
export interface ConditionalPropertyKeySetInterface extends Set<string> {}
