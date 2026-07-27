/**
 * Maximum number of characters in a single DNS hostname label (RFC 1035).
 *
 * @remarks
 * A single label in a domain name (between dots) must not exceed 63 octets.
 * Used by the `hostname` and `idn-hostname` format validators.
 *
 * @example
 * ```ts
 * if (label.length > HOSTNAME_LABEL_MAXIMUM_LENGTH) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see {@link https://www.rfc-editor.org/rfc/rfc1035#section-2.3.4 RFC 1035 §2.3.4}
 * @defaultValue `63`
 * @group Constants
 */
export const HOSTNAME_LABEL_MAXIMUM_LENGTH = 63;

/**
 * Expected character length of an ISO 8601 date string (`YYYY-MM-DD`).
 *
 * @remarks
 * Used to validate the length of the date portion before parsing individual components.
 *
 * @example
 * ```ts
 * if (value.length !== DATE_STRING_LENGTH) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_YEAR_DIGIT_COUNT
 * @defaultValue `10`
 * @group Constants
 */
export const DATE_STRING_LENGTH = 10;

/**
 * Number of digits in the year component of an ISO 8601 date string.
 *
 * @remarks
 * The year component occupies the first four characters of the `YYYY-MM-DD` format.
 *
 * @example
 * ```ts
 * const year = value.slice(0, DATE_YEAR_DIGIT_COUNT);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_STRING_LENGTH
 * @defaultValue `4`
 * @group Constants
 */
export const DATE_YEAR_DIGIT_COUNT = 4;

/**
 * Maximum valid month value (1-based) in an ISO 8601 date string.
 *
 * @remarks
 * Used to validate that the `MM` component of a date string is in `[1, 12]`.
 *
 * @example
 * ```ts
 * if (month < 1 || month > DATE_MONTH_MAXIMUM) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_DAY_MAXIMUM
 * @defaultValue `12`
 * @group Constants
 */
export const DATE_MONTH_MAXIMUM = 12;

/**
 * Maximum valid day value (1-based) in an ISO 8601 date string.
 *
 * @remarks
 * Used as the upper bound when validating the `DD` component of a date string.
 * Months with fewer than 31 days are validated separately.
 *
 * @example
 * ```ts
 * if (day < 1 || day > DATE_DAY_MAXIMUM) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_MONTH_MAXIMUM
 * @defaultValue `31`
 * @group Constants
 */
export const DATE_DAY_MAXIMUM = 31;

/**
 * Maximum valid hour value (0-based) in an ISO 8601 time string.
 *
 * @remarks
 * Used to validate the `HH` component of a time string is in `[0, 23]`.
 *
 * @example
 * ```ts
 * if (hour > TIME_HOUR_MAXIMUM) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_MINUTE_MAXIMUM
 * @defaultValue `23`
 * @group Constants
 */
export const TIME_HOUR_MAXIMUM = 23;

/**
 * Maximum valid minute value (0-based) in an ISO 8601 time string.
 *
 * @remarks
 * Used to validate the `MM` component of a time string is in `[0, 59]`.
 *
 * @example
 * ```ts
 * if (minute > TIME_MINUTE_MAXIMUM) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_HOUR_MAXIMUM
 * @defaultValue `59`
 * @group Constants
 */
export const TIME_MINUTE_MAXIMUM = 59;

/**
 * Maximum valid second value (0-based, inclusive) in an ISO 8601 time string.
 *
 * @remarks
 * Value is 60 to accommodate leap seconds per RFC 3339. Used to validate the
 * `SS` component of a time string is in `[0, 60]`.
 *
 * @example
 * ```ts
 * if (second > TIME_SECOND_MAXIMUM) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see {@link https://www.rfc-editor.org/rfc/rfc3339#section-5.6 RFC 3339 §5.6}
 * @defaultValue `60`
 * @group Constants
 */
export const TIME_SECOND_MAXIMUM = 60;

/**
 * Character length of the base time portion `HH:MM:SS` in an ISO 8601 time string.
 *
 * @remarks
 * Used as a reference length before parsing the optional timezone offset suffix.
 *
 * @example
 * ```ts
 * const base = value.slice(0, TIME_BASE_LENGTH); // 'HH:MM:SS'
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_ZONE_OFFSET_LENGTH
 * @defaultValue `8`
 * @group Constants
 */
export const TIME_BASE_LENGTH = 8;

/**
 * Character offset of the first digit of the hour in a timezone offset string (`±HH:MM`).
 *
 * @remarks
 * In a timezone offset appended to a time string, position 1 is the first digit of
 * the offset hour (after the leading `+` or `-` sign at position 0).
 *
 * @example
 * ```ts
 * const offsetHour1 = offset[TIME_OFFSET_HOUR1]; // first digit of hour
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_OFFSET_HOUR2
 * @defaultValue `1`
 * @group Constants
 */
export const TIME_OFFSET_HOUR1 = 1;

/**
 * Character offset of the second digit of the hour in a timezone offset string (`±HH:MM`).
 *
 * @remarks
 * In a timezone offset appended to a time string, position 2 is the second digit of
 * the offset hour.
 *
 * @example
 * ```ts
 * const offsetHour2 = offset[TIME_OFFSET_HOUR2]; // second digit of hour
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_OFFSET_HOUR1
 * @defaultValue `2`
 * @group Constants
 */
export const TIME_OFFSET_HOUR2 = 2;

/**
 * Character offset of the colon separator in a timezone offset string (`±HH:MM`).
 *
 * @remarks
 * In a timezone offset, position 3 must be a `:` character separating hours from minutes.
 *
 * @example
 * ```ts
 * if (offset[TIME_OFFSET_COLON] !== ':') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_OFFSET_MINUTE1
 * @defaultValue `3`
 * @group Constants
 */
export const TIME_OFFSET_COLON = 3;

/**
 * Character offset of the first digit of the minute in a timezone offset string (`±HH:MM`).
 *
 * @remarks
 * In a timezone offset, position 4 is the first digit of the offset minute component.
 *
 * @example
 * ```ts
 * const offsetMin1 = offset[TIME_OFFSET_MINUTE1]; // first digit of minute
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_OFFSET_MINUTE2
 * @defaultValue `4`
 * @group Constants
 */
export const TIME_OFFSET_MINUTE1 = 4;

/**
 * Character offset of the second digit of the minute in a timezone offset string (`±HH:MM`).
 *
 * @remarks
 * In a timezone offset, position 5 is the second digit of the offset minute component.
 *
 * @example
 * ```ts
 * const offsetMin2 = offset[TIME_OFFSET_MINUTE2]; // second digit of minute
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_OFFSET_MINUTE1
 * @defaultValue `5`
 * @group Constants
 */
export const TIME_OFFSET_MINUTE2 = 5;

/**
 * Total character length of a timezone offset string (`±HH:MM`).
 *
 * @remarks
 * A valid timezone offset is exactly 6 characters: sign + 2 hour digits + colon + 2 minute digits.
 *
 * @example
 * ```ts
 * if (offset.length !== TIME_ZONE_OFFSET_LENGTH) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_BASE_LENGTH
 * @defaultValue `6`
 * @group Constants
 */
export const TIME_ZONE_OFFSET_LENGTH = 6;

/**
 * Character offset of the first digit of the month in a `YYYY-MM-DD` date string.
 *
 * @remarks
 * In `YYYY-MM-DD`, the first digit of the month component starts at index 5.
 *
 * @example
 * ```ts
 * const month = Number(value[DATE_MONTH_OFFSET_1] + value[DATE_MONTH_OFFSET_2]);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_MONTH_OFFSET_2
 * @defaultValue `5`
 * @group Constants
 */
export const DATE_MONTH_OFFSET_1 = 5;

/**
 * Character offset of the second digit of the month in a `YYYY-MM-DD` date string.
 *
 * @remarks
 * In `YYYY-MM-DD`, the second digit of the month component is at index 6.
 *
 * @example
 * ```ts
 * const month = Number(value[DATE_MONTH_OFFSET_1] + value[DATE_MONTH_OFFSET_2]);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_MONTH_OFFSET_1
 * @defaultValue `6`
 * @group Constants
 */
export const DATE_MONTH_OFFSET_2 = 6;

/**
 * Character offset of the day separator (`-`) in a `YYYY-MM-DD` date string.
 *
 * @remarks
 * In `YYYY-MM-DD`, the second `-` separator between month and day is at index 7.
 *
 * @example
 * ```ts
 * if (value[DATE_DAY_SEPARATOR_OFFSET] !== '-') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_DAY_OFFSET_1
 * @defaultValue `7`
 * @group Constants
 */
export const DATE_DAY_SEPARATOR_OFFSET = 7;

/**
 * Character offset of the first digit of the day in a `YYYY-MM-DD` date string.
 *
 * @remarks
 * In `YYYY-MM-DD`, the first digit of the day component is at index 8.
 *
 * @example
 * ```ts
 * const day = Number(value[DATE_DAY_OFFSET_1] + value[DATE_DAY_OFFSET_2]);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_DAY_OFFSET_2
 * @defaultValue `8`
 * @group Constants
 */
export const DATE_DAY_OFFSET_1 = 8;

/**
 * Character offset of the second digit of the day in a `YYYY-MM-DD` date string.
 *
 * @remarks
 * In `YYYY-MM-DD`, the second digit of the day component is at index 9.
 *
 * @example
 * ```ts
 * const day = Number(value[DATE_DAY_OFFSET_1] + value[DATE_DAY_OFFSET_2]);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_DAY_OFFSET_1
 * @defaultValue `9`
 * @group Constants
 */
export const DATE_DAY_OFFSET_2 = 9;

/**
 * Character offset of the `:` before the seconds component in an `HH:MM:SS` time string.
 *
 * @remarks
 * In `HH:MM:SS`, the colon before seconds is at index 5.
 *
 * @example
 * ```ts
 * if (value[TIME_SECONDS_COLON_OFFSET] !== ':') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_SECONDS_DIGIT_1_OFFSET
 * @defaultValue `5`
 * @group Constants
 */
export const TIME_SECONDS_COLON_OFFSET = 5;

/**
 * Character offset of the first digit of the seconds in an `HH:MM:SS` time string.
 *
 * @remarks
 * In `HH:MM:SS`, the first digit of the seconds component is at index 6.
 *
 * @example
 * ```ts
 * const seconds = Number(value[TIME_SECONDS_DIGIT_1_OFFSET] + value[TIME_SECONDS_DIGIT_2_OFFSET]);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_SECONDS_DIGIT_2_OFFSET
 * @defaultValue `6`
 * @group Constants
 */
export const TIME_SECONDS_DIGIT_1_OFFSET = 6;

/**
 * Character offset of the second digit of the seconds in an `HH:MM:SS` time string.
 *
 * @remarks
 * In `HH:MM:SS`, the second digit of the seconds component is at index 7.
 *
 * @example
 * ```ts
 * const seconds = Number(value[TIME_SECONDS_DIGIT_1_OFFSET] + value[TIME_SECONDS_DIGIT_2_OFFSET]);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see TIME_SECONDS_DIGIT_1_OFFSET
 * @defaultValue `7`
 * @group Constants
 */
export const TIME_SECONDS_DIGIT_2_OFFSET = 7;

/**
 * Number of dot-separated parts in a valid IPv4 address string.
 *
 * @remarks
 * An IPv4 address has exactly 4 octet groups separated by `.` characters.
 * Used to validate the split result before parsing individual octets.
 *
 * @example
 * ```ts
 * const parts = value.split('.');
 * if (parts.length !== IPV4_PARTS_COUNT) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see IPV4_OCTET_MAXIMUM_VALUE
 * @defaultValue `4`
 * @group Constants
 */
export const IPV4_PARTS_COUNT = 4;

/**
 * Maximum character length of a single IPv4 octet string (e.g. `'255'`).
 *
 * @remarks
 * Each octet in an IPv4 address is represented by 1–3 decimal digits.
 * Used to reject octet strings that are too long before numeric parsing.
 *
 * @example
 * ```ts
 * if (octet.length > IPV4_OCTET_MAXIMUM_LENGTH) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see IPV4_OCTET_MAXIMUM_VALUE
 * @defaultValue `3`
 * @group Constants
 */
export const IPV4_OCTET_MAXIMUM_LENGTH = 3;

/**
 * Maximum numeric value of a single IPv4 octet.
 *
 * @remarks
 * Each octet in an IPv4 address must be in the range `[0, 255]`.
 *
 * @example
 * ```ts
 * if (octetValue > IPV4_OCTET_MAXIMUM_VALUE) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see IPV4_PARTS_COUNT
 * @defaultValue `255`
 * @group Constants
 */
export const IPV4_OCTET_MAXIMUM_VALUE = 255;

/**
 * Maximum number of colon-separated groups in a full IPv6 address.
 *
 * @remarks
 * A fully-expanded IPv6 address consists of exactly 8 groups of 4 hex digits
 * separated by `:`. Used to validate the group count in non-compressed forms.
 *
 * @example
 * ```ts
 * if (groups.length > IPV6_MAXIMUM_GROUPS) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @defaultValue `8`
 * @group Constants
 */
export const IPV6_MAXIMUM_GROUPS = 8;

/**
 * Number of days in January.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [DAYS_IN_JAN, DAYS_IN_FEB_COMMON, DAYS_IN_MAR, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_FEB_COMMON
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_JAN = 31;

/**
 * Number of days in February in a common (non-leap) year.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const feb = isLeap ? 29 : DAYS_IN_FEB_COMMON;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @defaultValue `28`
 * @group Constants
 */
export const DAYS_IN_FEB_COMMON = 28;

/**
 * Number of days in March.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [DAYS_IN_JAN, DAYS_IN_FEB_COMMON, DAYS_IN_MAR, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_JAN
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_MAR = 31;

/**
 * Number of days in April.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [DAYS_IN_JAN, DAYS_IN_FEB_COMMON, DAYS_IN_MAR, DAYS_IN_APR, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_MAR
 * @defaultValue `30`
 * @group Constants
 */
export const DAYS_IN_APR = 30;

/**
 * Number of days in May.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_APR, DAYS_IN_MAY, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_APR
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_MAY = 31;

/**
 * Number of days in June.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_MAY, DAYS_IN_JUN, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_MAY
 * @defaultValue `30`
 * @group Constants
 */
export const DAYS_IN_JUN = 30;

/**
 * Number of days in July.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_JUN, DAYS_IN_JUL, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_JUN
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_JUL = 31;

/**
 * Number of days in August.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_JUL, DAYS_IN_AUG, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_JUL
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_AUG = 31;

/**
 * Number of days in September.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_AUG, DAYS_IN_SEP, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_AUG
 * @defaultValue `30`
 * @group Constants
 */
export const DAYS_IN_SEP = 30;

/**
 * Number of days in October.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_SEP, DAYS_IN_OCT, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_SEP
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_OCT = 31;

/**
 * Number of days in November.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_OCT, DAYS_IN_NOV, ...];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_OCT
 * @defaultValue `30`
 * @group Constants
 */
export const DAYS_IN_NOV = 30;

/**
 * Number of days in December.
 *
 * @remarks
 * Used in the per-month day-count lookup when validating calendar dates.
 *
 * @example
 * ```ts
 * const daysInMonth = [..., DAYS_IN_NOV, DAYS_IN_DEC];
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DAYS_IN_NOV
 * @defaultValue `31`
 * @group Constants
 */
export const DAYS_IN_DEC = 31;

/**
 * Number of characters in each base64 chunk (every 4 characters encodes 3 bytes).
 *
 * @remarks
 * Used by the `byte` / `base64` format validator to verify that a base64 string
 * length is a multiple of this chunk size (after padding normalization).
 *
 * @example
 * ```ts
 * if (value.length % BASE64_CHUNK_SIZE !== 0) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see BASE64_MAXIMUM_PADDING
 * @defaultValue `4`
 * @group Constants
 */
export const BASE64_CHUNK_SIZE = 4;

/**
 * Maximum number of `=` padding characters at the end of a base64 string.
 *
 * @remarks
 * A valid base64 string may end with at most 2 `=` padding characters.
 * Used by the base64 format validator to reject over-padded values.
 *
 * @example
 * ```ts
 * if (paddingCount > BASE64_MAXIMUM_PADDING) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see BASE64_CHUNK_SIZE
 * @defaultValue `2`
 * @group Constants
 */
export const BASE64_MAXIMUM_PADDING = 2;

/**
 * Minimum character length of a valid ISO 8601 date-time string.
 *
 * @remarks
 * A date-time string must be at least 15 characters to hold the minimal
 * `YYYY-MM-DDTHH` prefix before the mandatory minutes component.
 * Used as a quick length guard before full parsing.
 *
 * @example
 * ```ts
 * if (value.length < DATETIME_MINIMUM_LENGTH) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see DATE_STRING_LENGTH
 * @defaultValue `15`
 * @group Constants
 */
export const DATETIME_MINIMUM_LENGTH = 15;

/**
 * Radix (base) used for decimal integer parsing.
 *
 * @remarks
 * Passed as the second argument to `Number.parseInt` when parsing decimal
 * numeric strings (e.g. date/time components, IP address octets).
 *
 * @example
 * ```ts
 * const octet = Number.parseInt(part, DECIMAL_RADIX);
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt MDN parseInt}
 * @defaultValue `10`
 * @group Constants
 */
export const DECIMAL_RADIX = 10;

/**
 * Expected character length of a canonical UUID string (with hyphens).
 *
 * @remarks
 * A UUID in the standard `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` format is
 * exactly 36 characters including the four `-` separators.
 *
 * @example
 * ```ts
 * if (value.length !== UUID_STRING_LENGTH) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_DASH_POS_1
 * @defaultValue `36`
 * @group Constants
 */
export const UUID_STRING_LENGTH = 36;

/**
 * Character index of the first `-` separator in a canonical UUID string.
 *
 * @remarks
 * In `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, the first hyphen is at index 8.
 *
 * @example
 * ```ts
 * if (value[UUID_DASH_POS_1] !== '-') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_DASH_POS_2
 * @defaultValue `8`
 * @group Constants
 */
export const UUID_DASH_POS_1 = 8;

/**
 * Character index of the second `-` separator in a canonical UUID string.
 *
 * @remarks
 * In `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, the second hyphen is at index 13.
 *
 * @example
 * ```ts
 * if (value[UUID_DASH_POS_2] !== '-') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_DASH_POS_1
 * @defaultValue `13`
 * @group Constants
 */
export const UUID_DASH_POS_2 = 13;

/**
 * Character index of the third `-` separator in a canonical UUID string.
 *
 * @remarks
 * In `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, the third hyphen is at index 18.
 *
 * @example
 * ```ts
 * if (value[UUID_DASH_POS_3] !== '-') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_DASH_POS_2
 * @defaultValue `18`
 * @group Constants
 */
export const UUID_DASH_POS_3 = 18;

/**
 * Character index of the fourth `-` separator in a canonical UUID string.
 *
 * @remarks
 * In `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, the fourth hyphen is at index 23.
 *
 * @example
 * ```ts
 * if (value[UUID_DASH_POS_4] !== '-') return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_DASH_POS_3
 * @defaultValue `23`
 * @group Constants
 */
export const UUID_DASH_POS_4 = 23;

/**
 * Character index of the UUID version digit in a canonical UUID string.
 *
 * @remarks
 * In `xxxxxxxx-xxxx-Mxxx-xxxx-xxxxxxxxxxxx`, the version digit `M` is at index 14.
 * Valid UUID v4 strings have `'4'` at this position.
 *
 * @example
 * ```ts
 * const version = value[UUID_VERSION_POS]; // '4' for UUID v4
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_VARIANT_POS
 * @defaultValue `14`
 * @group Constants
 */
export const UUID_VERSION_POS = 14;

/**
 * Character index of the UUID variant digit in a canonical UUID string.
 *
 * @remarks
 * In `xxxxxxxx-xxxx-xxxx-Nxxx-xxxxxxxxxxxx`, the variant digit `N` is at index 19.
 * RFC 4122 UUIDs have a variant nibble of `8`, `9`, `a`, or `b` at this position.
 *
 * @example
 * ```ts
 * const variant = value[UUID_VARIANT_POS].toLowerCase();
 * if (!'89ab'.includes(variant)) return false;
 * ```
 *
 * @category Format validation
 * @since 0.1.0
 * @see UUID_VERSION_POS
 * @defaultValue `19`
 * @group Constants
 */
export const UUID_VARIANT_POS = 19;
