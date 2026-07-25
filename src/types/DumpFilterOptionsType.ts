export type DumpFilterOptionsType = {
  /** Property names to drop from the output. Ignored when `include` is provided. */
  'exclude'?: string[];
  /** Drop properties whose runtime value strictly equals the schema's `default`. */
  'excludeDefaults'?: boolean;
  /** Drop properties whose runtime value is `undefined`. */
  'excludeUnset'?: boolean;
  /** Property names to keep. Takes precedence over `exclude` when both are set. */
  'include'?: string[];
};
