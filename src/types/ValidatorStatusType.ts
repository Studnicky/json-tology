/**
 * Internal status code returned by scalar/structure validator helpers on the hot path.
 *
 * Using a numeric return instead of `{earlyExit, valid}` object literals eliminates
 * per-value heap allocations in the compiled validation hot path.
 *
 * Encoding:
 *   `0` — valid (no earlyExit, valid = true)
 *   `-1` — invalid, earlyExit (stop processing; collectErrors = false)
 *   `-2` — invalid, no earlyExit (continue collecting errors; collectErrors = true)
 */
export type ValidatorStatusType = -2 | -1 | 0;

/** Precomputed status constants — avoid magic numbers at call sites. */
export const VS_VALID = 0 as const;
export const VS_EARLY_EXIT = -1 as const;
export const VS_INVALID = -2 as const;
