/**
 * Named return type for {@link buildNameMap}.
 *
 * `nameMap` is an IRI-to-PascalCase-name map.  `collisions` is the set of
 * base names for which at least two IRIs produced the same local name — those
 * entries are suffixed with `_2`, `_3`, etc. in `nameMap`.
 *
 * @remarks
 * Used internally by `OwlCodegen.toTypeScript` and `OwlCodegen.toRegistryFiles` to
 * ensure every OWL class gets a unique TypeScript identifier.
 *
 * @example
 * ```ts
 * const { nameMap, collisions } = buildNameMap(iris);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type BuildNameMapResultType = {
  /** Set of base names that collided (used for banner warnings). */
  'collisions': Set<string>;
  /** Map from IRI to its assigned PascalCase identifier. */
  'nameMap': Map<string, string>;
};
