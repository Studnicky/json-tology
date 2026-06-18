/**
 * Serialization context for the literal-serializer helpers.
 *
 * @remarks
 * Bundles the pad and innerPad strings with the current indent depth so
 * the array and object serializer helpers do not need separate parameters.
 *
 * @example
 * ```ts
 * const ctx: SerializeContextType = { pad, innerPad, indent };
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toTypeScript}
 * @group OWL Codegen
 */
export type SerializeContextType = {
  /** Current indentation depth (number of spaces). */
  readonly 'indent': number;
  /** Inner padding string for one level deeper. */
  readonly 'innerPad': string;
  /** Outer padding string for the current level. */
  readonly 'pad': string;
};
