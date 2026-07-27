/**
 * IPV6_FULL — matches a fully-expanded IPv6 address with exactly eight 16-bit groups separated by colons.
 *
 * @remarks
 * Accepts the canonical `h:h:h:h:h:h:h:h` form only. No compressed (`::`) or
 * mixed IPv4-tail notation is accepted. Used by the `ipv6` format validator.
 *
 * @example
 * ```ts
 * IPV6_FULL.test('2001:0db8:85a3:0000:0000:8a2e:0370:7334'); // true
 * IPV6_FULL.test('::1');                                       // false
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link IPV6_WITH_DOUBLE_COLON}
 * @group FormatRegexes
 * @defaultValue `/^[\da-f]{1,4}(?::[\da-f]{1,4}){7}$/iu`
 */
export const IPV6_FULL = /^[\da-f]{1,4}(?::[\da-f]{1,4}){7}$/iu;

/**
 * IPV6_WITH_DOUBLE_COLON — matches a compressed IPv6 address using `::` to elide one or more all-zero groups.
 *
 * @remarks
 * Accepts the `::` compressed form with up to seven explicit groups on either side.
 * Does not accept mixed IPv4-tail notation. Used by the `ipv6` format validator.
 *
 * @example
 * ```ts
 * IPV6_WITH_DOUBLE_COLON.test('::1');       // true
 * IPV6_WITH_DOUBLE_COLON.test('fe80::1');   // true
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link IPV6_FULL}
 * @group FormatRegexes
 * @defaultValue `/^(?:[\da-f]{1,4}:){0,7}:(?:[\da-f]{1,4}:){0,6}[\da-f]{0,4}$/iu`
 */
export const IPV6_WITH_DOUBLE_COLON = /^(?:[\da-f]{1,4}:){0,7}:(?:[\da-f]{1,4}:){0,6}[\da-f]{0,4}$/iu;

/**
 * IPV6_MIXED — matches a full-form IPv6 address with an IPv4 address in the final two groups.
 *
 * @remarks
 * Accepts the `h:h:h:h:h:h:d.d.d.d` mixed notation with six explicit hex groups followed
 * by a dotted-decimal IPv4 tail. No `::` compression allowed in this form.
 * Used by the `ipv6` format validator.
 *
 * @example
 * ```ts
 * IPV6_MIXED.test('::ffff:192.0.2.1');   // false (has ::)
 * IPV6_MIXED.test('0:0:0:0:0:ffff:192.0.2.1'); // true
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link IPV6_MIXED_COMPRESSED}
 * @group FormatRegexes
 * @defaultValue `/^(?:[\da-f]{1,4}:){6}(?:\d{1,3}\.){3}\d{1,3}$/iu`
 */
export const IPV6_MIXED = /^(?:[\da-f]{1,4}:){6}(?:\d{1,3}\.){3}\d{1,3}$/iu;

/**
 * IPV6_MIXED_COMPRESSED — matches a `::` compressed IPv6 address with an IPv4 address in the tail.
 *
 * @remarks
 * Accepts the `::h:h:h:h:h:d.d.d.d` compressed mixed-notation form with up to five
 * explicit hex groups after `::` followed by a dotted-decimal IPv4 tail.
 * Used by the `ipv6` format validator.
 *
 * @example
 * ```ts
 * IPV6_MIXED_COMPRESSED.test('::ffff:192.0.2.1'); // true
 * ```
 *
 * @category Constants
 * @since 0.1.0
 * @see {@link IPV6_MIXED}
 * @group FormatRegexes
 * @defaultValue `/^::(?:[\da-f]{1,4}:){0,5}(?:\d{1,3}\.){3}\d{1,3}$/iu`
 */
export const IPV6_MIXED_COMPRESSED = /^::(?:[\da-f]{1,4}:){0,5}(?:\d{1,3}\.){3}\d{1,3}$/iu;

/**
 * IPV6_DOUBLE_COLON_MARKER — matches a leading or trailing `::`-elision marker.
 *
 * @remarks
 * Used to strip the single `::` group-elision marker from an IPv6 address
 * before counting its remaining explicit groups.
 *
 * @category Constants
 * @since 0.1.0
 * @group FormatRegexes
 * @defaultValue `/^:|:$/gu`
 */
export const IPV6_DOUBLE_COLON_MARKER = /^:|:$/gu;

/**
 * DIGITS_ONLY — matches a string composed entirely of one or more ASCII digits.
 *
 * @remarks
 * Used by the `ipv4` format validator to reject non-numeric octets before
 * range-checking them.
 *
 * @category Constants
 * @since 0.1.0
 * @group FormatRegexes
 * @defaultValue `/^\d+$/u`
 */
export const DIGITS_ONLY = /^\d+$/u;
