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
 *   if (depth > MAX_DEFAULT_DEPTH) return;
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
export const MAX_DEFAULT_DEPTH = 256;

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
