export const METADATA_KEYS = new Set<string>([
  '$comment',
  '$id',
  'description',
  'examples',
  'title'
]);

/**
 * Suffixes appended to the structural hash to express nominal identity.
 *
 * A transform-bearing schema has different nominal identity from a structurally
 * identical plain schema — their hashes must not collide in the duplicate-
 * detection cache. Anonymous inline sub-shapes always use the PLAIN suffix,
 * which aligns them with plain (non-transform) top-level schemas only.
 */
export const TRANSFORM_SUFFIX = ':t';
export const PLAIN_SUFFIX = ':p';
