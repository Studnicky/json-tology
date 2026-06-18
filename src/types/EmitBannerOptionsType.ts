/**
 * Options object for the {@link emitBanner} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit the auto-generated banner comment
 * block into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * emitBanner(lines, { ts, sourceLabel, collisions, header });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type EmitBannerOptionsType = {
  /** Set of IRI base names that collided during name generation. */
  readonly 'collisions': Set<string>;
  /** Extra comment lines to append after the standard banner. */
  readonly 'header': readonly string[];
  /** Human-readable source label (file path or IRI), or empty string. */
  readonly 'sourceLabel': string;
  /** ISO-8601 timestamp string. */
  readonly 'ts': string;
};
