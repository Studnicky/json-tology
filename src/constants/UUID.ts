/**
 * Number of bytes in a UUID v4 random buffer.
 *
 * @remarks
 * A UUID v4 is composed of 128 bits, which equals exactly 16 bytes.
 * The random byte array produced by `crypto.getRandomValues` must be
 * exactly this length before the version and variant bits are applied.
 *
 * @example
 * ```ts
 * const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTE_LENGTH));
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VERSION_BYTE_INDEX
 * @defaultValue `16`
 * @group Constants
 */
export const UUID_BYTE_LENGTH = 16;

/**
 * Exclusive upper bound for a single UUID byte value.
 *
 * @remarks
 * Each byte occupies values 0–255. This constant is one above the maximum and
 * is used for modular arithmetic that wraps byte values back into range.
 *
 * @example
 * ```ts
 * const clampedByte = rawByte % UUID_BYTE_MAX_PLUS_ONE;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_BYTE_LENGTH
 * @defaultValue `256`
 * @group Constants
 */
export const UUID_BYTE_MAX_PLUS_ONE = 256;

/**
 * Bitmask used to clear the upper nibble of the version byte before setting the version.
 *
 * @remarks
 * Applied with bitwise AND to byte index 6 to zero out the four high-order bits,
 * making room for the UUID version nibble. After masking, `UUID_VERSION_SET` is ORed in.
 *
 * @example
 * ```ts
 * bytes[UUID_VERSION_BYTE_INDEX] = (bytes[UUID_VERSION_BYTE_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_SET;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VERSION_SET
 * @defaultValue `0x0F`
 * @group Constants
 */
export const UUID_VERSION_MASK = 0x0F;

/**
 * Bit pattern ORed into the version byte to encode UUID version 4.
 *
 * @remarks
 * After clearing the high nibble with `UUID_VERSION_MASK`, this value is
 * ORed into byte index 6 to write the version-4 indicator (`0100xxxx`).
 *
 * @example
 * ```ts
 * bytes[UUID_VERSION_BYTE_INDEX] = (bytes[UUID_VERSION_BYTE_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_SET;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VERSION_MASK
 * @defaultValue `0x40`
 * @group Constants
 */
export const UUID_VERSION_SET = 0x40;

/**
 * Bitmask used to clear the two high-order bits of the variant byte.
 *
 * @remarks
 * Applied with bitwise AND to byte index 8 to zero out the top two bits,
 * making room for the RFC 4122 variant indicator (`10xxxxxx`).
 *
 * @example
 * ```ts
 * bytes[UUID_VARIANT_BYTE_INDEX] = (bytes[UUID_VARIANT_BYTE_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_SET;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VARIANT_SET
 * @defaultValue `0x3F`
 * @group Constants
 */
export const UUID_VARIANT_MASK = 0x3F;

/**
 * Bit pattern ORed into the variant byte to encode the RFC 4122 variant.
 *
 * @remarks
 * After clearing the top two bits with `UUID_VARIANT_MASK`, this value is
 * ORed into byte index 8 to write the variant-1 indicator (`10xxxxxx`).
 *
 * @example
 * ```ts
 * bytes[UUID_VARIANT_BYTE_INDEX] = (bytes[UUID_VARIANT_BYTE_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_SET;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VARIANT_MASK
 * @defaultValue `0x80`
 * @group Constants
 */
export const UUID_VARIANT_SET = 0x80;

/**
 * Zero-based index of the version byte within a 16-byte UUID buffer.
 *
 * @remarks
 * Byte 6 stores the version in its high nibble. Version mask and set constants
 * are applied here to write the version-4 indicator.
 *
 * @example
 * ```ts
 * bytes[UUID_VERSION_BYTE_INDEX] = (bytes[UUID_VERSION_BYTE_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_SET;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VERSION_MASK
 * @defaultValue `6`
 * @group Constants
 */
export const UUID_VERSION_BYTE_INDEX = 6;

/**
 * Zero-based index of the variant byte within a 16-byte UUID buffer.
 *
 * @remarks
 * Byte 8 stores the variant in its two high-order bits. Variant mask and set
 * constants are applied here to write the RFC 4122 variant indicator.
 *
 * @example
 * ```ts
 * bytes[UUID_VARIANT_BYTE_INDEX] = (bytes[UUID_VARIANT_BYTE_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_SET;
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VARIANT_MASK
 * @defaultValue `8`
 * @group Constants
 */
export const UUID_VARIANT_BYTE_INDEX = 8;

/**
 * Number of hex characters used to represent a single byte.
 *
 * @remarks
 * Each byte is formatted as exactly two hex digits, padded with a leading zero
 * when needed. Used with `String.prototype.padStart` during UUID string assembly.
 *
 * @example
 * ```ts
 * const hex = byte.toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_BYTE_LENGTH
 * @defaultValue `2`
 * @group Constants
 */
export const UUID_HEX_PAD_LENGTH = 2;

/**
 * Byte index of the first byte in UUID segment 0 (time_low, bytes 0–3).
 *
 * @remarks
 * UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
 * Segment 0 spans bytes 0–3 and maps to the first eight hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG0_B0].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_HEX_PAD_LENGTH
 * @defaultValue `0`
 * @group Constants
 */
export const UUID_SEG0_B0 = 0;

/**
 * Byte index of the second byte in UUID segment 0 (time_low, bytes 0–3).
 *
 * @remarks
 * Segment 0 spans bytes 0–3 and maps to the first eight hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG0_B1].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG0_B0
 * @defaultValue `1`
 * @group Constants
 */
export const UUID_SEG0_B1 = 1;

/**
 * Byte index of the third byte in UUID segment 0 (time_low, bytes 0–3).
 *
 * @remarks
 * Segment 0 spans bytes 0–3 and maps to the first eight hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG0_B2].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG0_B0
 * @defaultValue `2`
 * @group Constants
 */
export const UUID_SEG0_B2 = 2;

/**
 * Byte index of the fourth byte in UUID segment 0 (time_low, bytes 0–3).
 *
 * @remarks
 * Segment 0 spans bytes 0–3 and maps to the first eight hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG0_B3].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG0_B0
 * @defaultValue `3`
 * @group Constants
 */
export const UUID_SEG0_B3 = 3;

/**
 * Byte index of the first byte in UUID segment 1 (time_mid, bytes 4–5).
 *
 * @remarks
 * Segment 1 spans bytes 4–5 and maps to the four hex characters after the first dash.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG1_B0].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG0_B3
 * @defaultValue `4`
 * @group Constants
 */
export const UUID_SEG1_B0 = 4;

/**
 * Byte index of the second byte in UUID segment 1 (time_mid, bytes 4–5).
 *
 * @remarks
 * Segment 1 spans bytes 4–5 and maps to the four hex characters after the first dash.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG1_B1].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG1_B0
 * @defaultValue `5`
 * @group Constants
 */
export const UUID_SEG1_B1 = 5;

/**
 * Byte index of the first byte in UUID segment 2 (time_hi_and_version, bytes 6–7).
 *
 * @remarks
 * Segment 2 spans bytes 6–7 and contains the version nibble in its high bits.
 * Same index as `UUID_VERSION_BYTE_INDEX`.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG2_B0].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VERSION_BYTE_INDEX
 * @defaultValue `6`
 * @group Constants
 */
export const UUID_SEG2_B0 = 6;

/**
 * Byte index of the second byte in UUID segment 2 (time_hi_and_version, bytes 6–7).
 *
 * @remarks
 * Segment 2 spans bytes 6–7 and maps to the version segment hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG2_B1].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG2_B0
 * @defaultValue `7`
 * @group Constants
 */
export const UUID_SEG2_B1 = 7;

/**
 * Byte index of the first byte in UUID segment 3 (clock_seq, bytes 8–9).
 *
 * @remarks
 * Segment 3 spans bytes 8–9 and contains the variant bits in its high-order bits.
 * Same index as `UUID_VARIANT_BYTE_INDEX`.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG3_B0].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_VARIANT_BYTE_INDEX
 * @defaultValue `8`
 * @group Constants
 */
export const UUID_SEG3_B0 = 8;

/**
 * Byte index of the second byte in UUID segment 3 (clock_seq, bytes 8–9).
 *
 * @remarks
 * Segment 3 spans bytes 8–9 and maps to the clock sequence hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG3_B1].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG3_B0
 * @defaultValue `9`
 * @group Constants
 */
export const UUID_SEG3_B1 = 9;

/**
 * Byte index of the first byte in UUID segment 4 (node, bytes 10–15).
 *
 * @remarks
 * Segment 4 spans bytes 10–15 and maps to the final twelve hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG4_B0].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG3_B1
 * @defaultValue `10`
 * @group Constants
 */
export const UUID_SEG4_B0 = 10;

/**
 * Byte index of the second byte in UUID segment 4 (node, bytes 10–15).
 *
 * @remarks
 * Segment 4 spans bytes 10–15 and maps to the final twelve hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG4_B1].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG4_B0
 * @defaultValue `11`
 * @group Constants
 */
export const UUID_SEG4_B1 = 11;

/**
 * Byte index of the third byte in UUID segment 4 (node, bytes 10–15).
 *
 * @remarks
 * Segment 4 spans bytes 10–15 and maps to the final twelve hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG4_B2].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG4_B0
 * @defaultValue `12`
 * @group Constants
 */
export const UUID_SEG4_B2 = 12;

/**
 * Byte index of the fourth byte in UUID segment 4 (node, bytes 10–15).
 *
 * @remarks
 * Segment 4 spans bytes 10–15 and maps to the final twelve hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG4_B3].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG4_B0
 * @defaultValue `13`
 * @group Constants
 */
export const UUID_SEG4_B3 = 13;

/**
 * Byte index of the fifth byte in UUID segment 4 (node, bytes 10–15).
 *
 * @remarks
 * Segment 4 spans bytes 10–15 and maps to the final twelve hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG4_B4].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG4_B0
 * @defaultValue `14`
 * @group Constants
 */
export const UUID_SEG4_B4 = 14;

/**
 * Byte index of the sixth byte in UUID segment 4 (node, bytes 10–15).
 *
 * @remarks
 * Segment 4 spans bytes 10–15 and maps to the final twelve hex characters.
 *
 * @example
 * ```ts
 * const hex = bytes[UUID_SEG4_B5].toString(16).padStart(UUID_HEX_PAD_LENGTH, '0');
 * ```
 *
 * @category UUID
 * @since 0.1.0
 * @see UUID_SEG4_B0
 * @defaultValue `15`
 * @group Constants
 */
export const UUID_SEG4_B5 = 15;
