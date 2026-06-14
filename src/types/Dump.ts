export type DumpOptionsType = {
  /** Property names to drop from the output. Ignored when `include` is provided. */
  'exclude'?: readonly string[];
  /** Drop properties whose runtime value strictly equals the schema's `default`. */
  'excludeDefaults'?: boolean;
  /** Drop properties whose runtime value is `undefined`. */
  'excludeUnset'?: boolean;
  /** Property names to keep. Takes precedence over `exclude` when both are set. */
  'include'?: readonly string[];
  /** 'wire' = plain JS values; 'json' = JSON.stringify-safe (Date→ISO, etc.). Default 'wire'. */
  'mode'?: 'json' | 'wire';
};
