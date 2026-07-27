/**
 * Radix value for hexadecimal string conversion.
 *
 * @remarks
 * Passed to `parseInt` and `Number.prototype.toString` when encoding or decoding
 * hexadecimal strings (e.g. SHA hashes, colour values). Using a named constant
 * avoids bare magic literals and documents intent at each call site.
 *
 * @example
 * ```ts
 * const hex = byteValue.toString(HEX_RADIX);
 * const byte = parseInt(hexString, HEX_RADIX);
 * ```
 *
 * @category Numeric
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `16`
 * @group Constants
 */
export const HEX_RADIX = 16;

/** Highest ASCII control character codepoint (inclusive). */
export const CONTROL_CHAR_MAXIMUM = 0x20;

/** DEL codepoint. */
export const DEL_CODEPOINT = 0x7F;

/** Highest C1 control character codepoint (inclusive). */
export const C1_CONTROL_MAXIMUM = 0x9F;

/**
 * Default maximum traversal depth for graph walks.
 *
 * @remarks
 * Guards recursive graph algorithms against infinite cycles. Any walk that has
 * not reached a terminal node after this many steps is considered pathological
 * and is terminated. Consumers may pass a lower value to restrict depth further.
 *
 * @example
 * ```ts
 * function walk(node: GraphNode, depth = 0): void {
 *   if (depth > MAXIMUM_DEFAULT_DEPTH) return;
 *   for (const child of node.children) walk(child, depth + 1);
 * }
 * ```
 *
 * @category Numeric
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `256`
 * @group Constants
 */
export const MAXIMUM_DEFAULT_DEPTH = 256;

/**
 * Scaling factor applied to the machine epsilon when testing `multipleOf` constraints.
 *
 * @remarks
 * Floating-point arithmetic introduces rounding error. When validating that a value
 * is a multiple of a divisor, the remainder is compared against
 * `MULTIPLE_OF_EPSILON_FACTOR * Number.EPSILON * divisor` to allow for accumulated
 * rounding error while remaining strict enough to reject genuinely non-conforming
 * values.
 *
 * @example
 * ```ts
 * const tolerance = MULTIPLE_OF_EPSILON_FACTOR * Number.EPSILON * Math.abs(divisor);
 * const isMultiple = Math.abs(value % divisor) <= tolerance;
 * ```
 *
 * @category Numeric
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `10`
 * @group Constants
 */
export const MULTIPLE_OF_EPSILON_FACTOR = 10;

/** Minimum number of tokens required to form a valid N-Quad line. */
export const NQUAD_MINIMUM_TOKENS = 3;

/** Number of characters consumed by the `^^<` datatype prefix in N-Quads. */
export const NQUAD_DATATYPE_PREFIX_LENGTH = 3;

/** Separator used to join subject/predicate/object values into a flat triple-term lookup key. */
export const TRIPLE_KEY_SEP = ' ';

/** Effective-property count above which lift indexes subject quads by predicate before scanning. */
export const PREDICATE_INDEX_THRESHOLD = 3;

/**
 * Lowest HTTP status treated as a transient (retryable) server-side failure.
 *
 * @category Numeric
 * @since 0.1.0
 * @see {@link https://github.com/noocodex/json-tology json-tology}
 * @defaultValue `500`
 * @group Constants
 */
export const HTTP_SERVER_ERROR_MINIMUM = 500;
