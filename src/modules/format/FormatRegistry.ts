import type { FormatRegistryInterface } from '../../interfaces/FormatRegistryInterface.js';
import type { FormatPredicateType } from '../../types/FormatPredicateType.js';
import {
  DIGITS_ONLY, IPV6_DOUBLE_COLON_MARKER, IPV6_FULL, IPV6_MIXED, IPV6_MIXED_COMPRESSED, IPV6_WITH_DOUBLE_COLON
} from '../../constants/FORMAT_REGEXES.js';
import {
  BASE64_CHUNK_SIZE, BASE64_MAXIMUM_PADDING, DATE_DAY_MAXIMUM,
  DATE_DAY_OFFSET_1, DATE_DAY_OFFSET_2, DATE_DAY_SEPARATOR_OFFSET,
  DATE_MONTH_MAXIMUM, DATE_MONTH_OFFSET_1, DATE_MONTH_OFFSET_2,
  DATE_STRING_LENGTH, DATE_YEAR_DIGIT_COUNT,
  DAYS_IN_APR, DAYS_IN_AUG, DAYS_IN_DEC, DAYS_IN_FEB_COMMON,
  DAYS_IN_JAN, DAYS_IN_JUL, DAYS_IN_JUN, DAYS_IN_MAR,
  DAYS_IN_MAY, DAYS_IN_NOV, DAYS_IN_OCT, DAYS_IN_SEP,
  DECIMAL_RADIX, HOSTNAME_LABEL_MAXIMUM_LENGTH,
  IPV4_OCTET_MAXIMUM_LENGTH, IPV4_OCTET_MAXIMUM_VALUE, IPV4_PARTS_COUNT, IPV6_MAXIMUM_GROUPS,
  TIME_BASE_LENGTH, TIME_HOUR_MAXIMUM, TIME_MINUTE_MAXIMUM,
  TIME_OFFSET_COLON, TIME_OFFSET_HOUR1, TIME_OFFSET_HOUR2,
  TIME_OFFSET_MINUTE1, TIME_OFFSET_MINUTE2, TIME_SECOND_MAXIMUM,
  TIME_SECONDS_COLON_OFFSET, TIME_SECONDS_DIGIT_1_OFFSET,
  TIME_SECONDS_DIGIT_2_OFFSET, TIME_ZONE_OFFSET_LENGTH,
  UUID_DASH_POS_1, UUID_DASH_POS_2, UUID_DASH_POS_3, UUID_DASH_POS_4,
  UUID_STRING_LENGTH, UUID_VARIANT_POS, UUID_VERSION_POS
} from '../../constants/FORMAT_VALIDATION.js';

const DAYS_IN_MONTH: readonly number[] = Object.freeze([
  DAYS_IN_JAN,
  DAYS_IN_FEB_COMMON,
  DAYS_IN_MAR,
  DAYS_IN_APR,
  DAYS_IN_MAY,
  DAYS_IN_JUN,
  DAYS_IN_JUL,
  DAYS_IN_AUG,
  DAYS_IN_SEP,
  DAYS_IN_OCT,
  DAYS_IN_NOV,
  DAYS_IN_DEC
]);

/**
 * Low-level string/date/uuid/ip/hostname parsing predicates behind the
 * built-in `format` validators.
 *
 * Grouped as a static-method-only class so every low-level parser used to
 * build {@link STRING_FORMAT_VALIDATORS} lives under one cohesive internal
 * namespace rather than as scattered module-scope functions.
 */
class FormatValidators {
  static advancePastFractionalSeconds(value: string, pos: number): false | number {
    if (pos >= value.length || !FormatValidators.isDigit(FormatValidators.codeAt(value, pos))) {
      return false;
    }

    return FormatValidators.consumeDigits(value, pos);
  }

  static advancePastFractionalSecondsInFormat(value: string, startPos: number): number {
    const result = FormatValidators.consumeDigits(value, startPos);

    return result;
  }

  static binary(value: string): boolean {
    if (value.length === 0 || value.length % 2 !== 0) {
      return false;
    }

    const valueLength = value.length;

    for (let i = 0; i < valueLength; i++) {
      if (!FormatValidators.isHexChar(FormatValidators.codeAt(value, i))) {
        return false;
      }
    }

    return true;
  }

  static byte(value: string): boolean {
    if (value.length === 0) {
      return true;
    }
    if (value.length % BASE64_CHUNK_SIZE !== 0) {
      return false;
    }
    const padStart = value.indexOf('=');
    const contentEnd = padStart === -1 ? value.length : padStart;

    for (let i = 0; i < contentEnd; i++) {
      if (!FormatValidators.isBase64Char(FormatValidators.codeAt(value, i))) {
        return false;
      }
    }
    if (padStart !== -1) {
      const paddingLength = value.length - padStart;

      if (paddingLength > BASE64_MAXIMUM_PADDING) {
        return false;
      }
      const valueLength = value.length;

      for (let i = padStart; i < valueLength; i++) {
        // '='
        if (FormatValidators.codeAt(value, i) !== 0x3D) {
          return false;
        }
      }
    }

    return true;
  }

  static codeAt(value: string, index: number): number {
    return value.codePointAt(index) ?? 0;
  }

  static consumeDigits(value: string, start: number): number {
    let cur = start;

    while (cur < value.length && FormatValidators.isDigit(FormatValidators.codeAt(value, cur))) {
      cur++;
    }

    return cur;
  }

  static countIPv6Groups(value: string): number {
    const withoutDC = value.replaceAll('::', ':').replaceAll(IPV6_DOUBLE_COLON_MARKER, '');

    return withoutDC.length === 0 ? 0 : withoutDC.split(':').length;
  }

  static date(value: string, offset: number): boolean {
    if (offset + DATE_STRING_LENGTH > value.length) {
      return false;
    }
    if (!FormatValidators.dateDigitsAndSeparators(value, offset)) {
      return false;
    }
    const month
      = (FormatValidators.codeAt(value, offset + DATE_MONTH_OFFSET_1) - 0x30) * DECIMAL_RADIX
      + (FormatValidators.codeAt(value, offset + DATE_MONTH_OFFSET_2) - 0x30);
    const day
      = (FormatValidators.codeAt(value, offset + DATE_DAY_OFFSET_1) - 0x30) * DECIMAL_RADIX
      + (FormatValidators.codeAt(value, offset + DATE_DAY_OFFSET_2) - 0x30);

    return month >= 1 && month <= DATE_MONTH_MAXIMUM && day >= 1 && day <= DATE_DAY_MAXIMUM;
  }

  static dateDigitsAndSeparators(value: string, offset: number): boolean {
    for (let i = 0; i < DATE_YEAR_DIGIT_COUNT; i++) {
      if (!FormatValidators.isDigit(FormatValidators.codeAt(value, offset + i))) {
        return false;
      }
    }
    // '-'
    if (FormatValidators.codeAt(value, offset + DATE_YEAR_DIGIT_COUNT) !== 0x2D) {
      return false;
    }
    if (!FormatValidators.isDigit(FormatValidators.codeAt(value, offset + DATE_MONTH_OFFSET_1)) || !FormatValidators.isDigit(FormatValidators.codeAt(value, offset + DATE_MONTH_OFFSET_2))) {
      return false;
    }
    if (FormatValidators.codeAt(value, offset + DATE_DAY_SEPARATOR_OFFSET) !== 0x2D) {
      return false;
    }

    return FormatValidators.isDigit(FormatValidators.codeAt(value, offset + DATE_DAY_OFFSET_1)) && FormatValidators.isDigit(FormatValidators.codeAt(value, offset + DATE_DAY_OFFSET_2));
  }

  static dateFormat(value: string): boolean {
    if (value.length !== DATE_STRING_LENGTH) {
      return false;
    }
    if (!FormatValidators.date(value, 0)) {
      return false;
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const maximumDay = month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];

    if (maximumDay === undefined) {
      return false;
    }

    return day >= 1 && day <= maximumDay;
  }

  static dateTime(value: string): boolean {
    // Minimum RFC 3339 date-time: YYYY-MM-DDThh:mm:ssZ = 20 chars
    if (value.length < DATE_STRING_LENGTH + 1 + TIME_BASE_LENGTH + 1) {
      return false;
    }
    // Validate full-date portion (chars 0–9): digit pattern, separators, and basic month/day ranges
    if (!FormatValidators.date(value, 0)) {
      return false;
    }
    // Leap-year-aware day bounds — allocation-free digit extraction
    const year = (FormatValidators.codeAt(value, 0) - 0x30) * 1000
      + (FormatValidators.codeAt(value, 1) - 0x30) * 100
      + (FormatValidators.codeAt(value, 2) - 0x30) * 10
      + (FormatValidators.codeAt(value, 3) - 0x30);
    const month = (FormatValidators.codeAt(value, DATE_MONTH_OFFSET_1) - 0x30) * DECIMAL_RADIX
      + (FormatValidators.codeAt(value, DATE_MONTH_OFFSET_2) - 0x30);
    const day = (FormatValidators.codeAt(value, DATE_DAY_OFFSET_1) - 0x30) * DECIMAL_RADIX
      + (FormatValidators.codeAt(value, DATE_DAY_OFFSET_2) - 0x30);
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const maximumDay = month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];

    if (maximumDay === undefined || day < 1 || day > maximumDay) {
      return false;
    }
    // RFC 3339 allows 'T' or 't' as the date-time separator (index 10)
    const sep = FormatValidators.codeAt(value, DATE_STRING_LENGTH);

    if (sep !== 0x54 && sep !== 0x74) {
      return false;
    }
    // Time portion begins immediately after the separator (index 11)
    const timeStart = DATE_STRING_LENGTH + 1;

    if (FormatValidators.timeHM(value, timeStart) === false) {
      return false;
    }
    if (!FormatValidators.timeSeconds(value, timeStart)) {
      return false;
    }
    // Advance past the base time (HH:MM:SS)
    let pos = timeStart + TIME_BASE_LENGTH;

    // Optional fractional seconds: '.' followed by one or more digits
    if (pos < value.length && FormatValidators.codeAt(value, pos) === 0x2E) {
      const afterDot = pos + 1;

      pos = FormatValidators.advancePastFractionalSecondsInFormat(value, afterDot);
      // Require at least one digit after '.'
      if (pos === afterDot) {
        return false;
      }
    }
    // RFC 3339 requires a time offset — accept uppercase or lowercase 'Z'
    if (pos >= value.length) {
      return false;
    }
    const tzChar = FormatValidators.codeAt(value, pos);

    // Handle lowercase 'z' (RFC 3339 §5.6 allows it)
    if (tzChar === 0x7A) {
      return pos + 1 === value.length;
    }

    return FormatValidators.timeOffset(value, pos);
  }

  static domainToAscii(value: string): null | string {
    try {
      return new URL(`https://${value}`).hostname;
    } catch {
      return null;
    }
  }

  static duration(value: string): boolean {
    // 'P'
    if (value.length < 2 || FormatValidators.codeAt(value, 0) !== 0x50) {
      return false;
    }
    let pos = 1;
    let hasContent = false;
    let inTime = false;

    while (pos < value.length) {
      const charCode = FormatValidators.codeAt(value, pos);

      // 'T'
      if (charCode === 0x54 && !inTime) {
        inTime = true;
        pos++;
        continue;
      }
      if (!FormatValidators.isDigit(charCode)) {
        return false;
      }
      const next = FormatValidators.durationUnit(value, pos, inTime);

      if (next === false) {
        return false;
      }
      pos = next;
      hasContent = true;
    }

    return hasContent;
  }

  static durationUnit(value: string, pos: number, inTime: boolean): false | number {
    const cur = FormatValidators.consumeDigits(value, pos);

    if (cur >= value.length) {
      return false;
    }
    const unit = FormatValidators.codeAt(value, cur);

    // '.' for fractional seconds
    if (unit === 0x2E && inTime) {
      return FormatValidators.fractionalSeconds(value, cur + 1);
    }

    return cur + 1;
  }

  static email(value: string): boolean {
    const at = value.indexOf('@');

    if (at < 1 || at === value.length - 1) {
      return false;
    }
    const dot = value.indexOf('.', at + 2);

    if (dot < 0 || dot === value.length - 1) {
      return false;
    }
    const valueLength = value.length;

    for (let i = 0; i < valueLength; i++) {
      if (FormatValidators.codeAt(value, i) <= 0x20) {
        return false;
      }
    }

    return true;
  }

  static fractionalSeconds(value: string, afterDot: number): false | number {
    if (afterDot >= value.length || !FormatValidators.isDigit(FormatValidators.codeAt(value, afterDot))) {
      return false;
    }
    const cur = FormatValidators.consumeDigits(value, afterDot);

    // 'S'
    if (cur >= value.length || FormatValidators.codeAt(value, cur) !== 0x53) {
      return false;
    }

    return cur + 1;
  }

  static hasBalancedBraces(value: string): boolean {
    let depth = 0;

    for (const char of value) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth < 0) {
          return false;
        }
      }
    }

    return depth === 0;
  }

  static idnEmail(value: string): boolean {
    const at = value.lastIndexOf('@');

    if (at < 1 || at === value.length - 1) {
      return false;
    }
    const valueLength = value.length;

    for (let i = 0; i < valueLength; i++) {
      const charCode = FormatValidators.codeAt(value, i);

      // whitespace or duplicate @
      if (charCode <= 0x20 || (charCode === 0x40 && i !== at)) {
        return false;
      }
    }
    const domain = value.slice(at + 1);
    const ascii = FormatValidators.domainToAscii(domain);

    return ascii !== null && ascii.length > 0;
  }

  static ipv4Octet(part: string): boolean {
    if (part.length === 0 || part.length > IPV4_OCTET_MAXIMUM_LENGTH) {
      return false;
    }
    if (part.length > 1 && part.startsWith('0')) {
      return false;
    }
    if (!DIGITS_ONLY.test(part)) {
      return false;
    }

    return Number(part) <= IPV4_OCTET_MAXIMUM_VALUE;
  }

  static isAlphanumeric(code: number): boolean {
    return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A);
  }

  static isAsciiHostname(value: string): boolean {
    if (value.length === 0) {
      return false;
    }
    let labelLength = 0;
    const valueLength = value.length;

    for (let i = 0; i < valueLength; i++) {
      const charCode = FormatValidators.codeAt(value, i);

      if (charCode === 0x2E) {
        if (!FormatValidators.isLabelSeparator(value, i, labelLength)) {
          return false;
        }
        labelLength = 0;
        continue;
      }
      if (!FormatValidators.isValidLabelChar(charCode, labelLength)) {
        return false;
      }
      labelLength++;
      if (labelLength > HOSTNAME_LABEL_MAXIMUM_LENGTH) {
        return false;
      }
    }

    return labelLength > 0 && FormatValidators.isAlphanumeric(FormatValidators.codeAt(value, value.length - 1));
  }

  // '+' or '/'
  static isBase64Char(code: number): boolean {
    return FormatValidators.isAlphanumeric(code) || code === 0x2B || code === 0x2F;
  }

  static isDigit(code: number): boolean {
    return code >= 0x30 && code <= 0x39;
  }

  static isHexChar(code: number): boolean {
    return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
  }

  static isIPv4(value: string): boolean {
    const parts = value.split('.');

    if (parts.length !== IPV4_PARTS_COUNT) {
      return false;
    }
    for (const part of parts) {
      if (!FormatValidators.ipv4Octet(part)) {
        return false;
      }
    }

    return true;
  }

  static isIPv6(value: string): boolean {
    if (value.length === 0) {
      return false;
    }
    if (IPV6_FULL.test(value)) {
      return true;
    }
    if (IPV6_MIXED.test(value) || IPV6_MIXED_COMPRESSED.test(value)) {
      return true;
    }
    const firstDC = value.indexOf('::');

    if (firstDC !== -1 && value.includes('::', firstDC + 2)) {
      return false;
    }
    if (IPV6_WITH_DOUBLE_COLON.test(value)) {
      return FormatValidators.countIPv6Groups(value) <= IPV6_MAXIMUM_GROUPS;
    }

    return false;
  }

  static isLabelSeparator(value: string, i: number, labelLength: number): boolean {
    if (labelLength === 0) {
      return false;
    }

    return FormatValidators.isAlphanumeric(FormatValidators.codeAt(value, i - 1));
  }

  static isUriLike(value: string): boolean {
    try {
      new URL(value);

      return true;
    } catch {
      return false;
    }
  }

  static isUriReference(value: string): boolean {
    if (value === '') {
      return true;
    }

    try {
      new URL(value);

      return true;
    } catch {
      try {
        new URL(value, 'https://example.invalid');

        return !value.includes(' ');
      } catch {
        return false;
      }
    }
  }

  static isValidLabelChar(charCode: number, labelLength: number): boolean {
    if (labelLength === 0) {
      return FormatValidators.isAlphanumeric(charCode);
    }

    // '-'
    return FormatValidators.isAlphanumeric(charCode) || charCode === 0x2D;
  }

  static jsonPointer(value: string): boolean {
    if (value.length === 0) {
      return true;
    }
    // '/'
    if (FormatValidators.codeAt(value, 0) !== 0x2F) {
      return false;
    }

    const valueLength = value.length;

    for (let i = 1; i < valueLength; i++) {
      // '~'
      if (FormatValidators.codeAt(value, i) === 0x7E) {
        i++;
        if (i >= value.length) {
          return false;
        }
        const next = FormatValidators.codeAt(value, i);

        // must be '0' or '1'
        if (next !== 0x30 && next !== 0x31) {
          return false;
        }
      }
    }

    return true;
  }

  static regex(value: string): boolean {
    try {
      new RegExp(value, 'u');

      return true;
    } catch {
      return false;
    }
  }

  static time(value: string, offset: number): boolean {
    if (offset + TIME_BASE_LENGTH > value.length) {
      return false;
    }
    if (FormatValidators.timeHM(value, offset) === false) {
      return false;
    }
    if (!FormatValidators.timeSeconds(value, offset)) {
      return false;
    }
    let pos = offset + TIME_BASE_LENGTH;

    // fractional seconds
    if (pos < value.length && FormatValidators.codeAt(value, pos) === 0x2E) {
      const advanced = FormatValidators.advancePastFractionalSeconds(value, pos + 1);

      if (advanced === false) {
        return false;
      }
      pos = advanced;
    }

    // no timezone required for bare time check
    return pos === value.length;
  }

  static timeFormat(value: string): boolean {
    if (value.length < TIME_BASE_LENGTH) {
      return false;
    }
    if (!FormatValidators.time(value, 0)) {
      return false;
    }
    let pos = TIME_BASE_LENGTH;

    // skip fractional seconds
    if (pos < value.length && FormatValidators.codeAt(value, pos) === 0x2E) {
      pos = FormatValidators.advancePastFractionalSecondsInFormat(value, pos + 1);
    }
    // no timezone is valid
    if (pos === value.length) {
      return true;
    }

    return FormatValidators.timeOffset(value, pos);
  }

  static timeHM(value: string, offset: number): false | number {
    const h1 = FormatValidators.codeAt(value, offset); const
      h2 = FormatValidators.codeAt(value, offset + 1);

    if (!FormatValidators.isDigit(h1) || !FormatValidators.isDigit(h2)) {
      return false;
    }
    const hour = (h1 - 0x30) * DECIMAL_RADIX + (h2 - 0x30);

    if (hour > TIME_HOUR_MAXIMUM) {
      return false;
    }
    // ':'
    if (FormatValidators.codeAt(value, offset + 2) !== 0x3A) {
      return false;
    }
    const m1 = FormatValidators.codeAt(value, offset + 3); const
      m2 = FormatValidators.codeAt(value, offset + 4);

    if (!FormatValidators.isDigit(m1) || !FormatValidators.isDigit(m2)) {
      return false;
    }
    if ((m1 - 0x30) * DECIMAL_RADIX + (m2 - 0x30) > TIME_MINUTE_MAXIMUM) {
      return false;
    }

    return (m1 - 0x30) * DECIMAL_RADIX + (m2 - 0x30);
  }

  static timeOffset(value: string, pos: number): boolean {
    const tzChar = FormatValidators.codeAt(value, pos);

    // 'Z'
    if (tzChar === 0x5A) {
      return pos + 1 === value.length;
    }
    // '+' or '-'
    if (tzChar !== 0x2B && tzChar !== 0x2D) {
      return false;
    }
    // +HH:MM
    if (pos + TIME_ZONE_OFFSET_LENGTH !== value.length) {
      return false;
    }
    if (!FormatValidators.isDigit(FormatValidators.codeAt(value, pos + TIME_OFFSET_HOUR1)) || !FormatValidators.isDigit(FormatValidators.codeAt(value, pos + TIME_OFFSET_HOUR2))) {
      return false;
    }
    if (FormatValidators.codeAt(value, pos + TIME_OFFSET_COLON) !== 0x3A) {
      return false;
    }

    return FormatValidators.isDigit(FormatValidators.codeAt(value, pos + TIME_OFFSET_MINUTE1)) && FormatValidators.isDigit(FormatValidators.codeAt(value, pos + TIME_OFFSET_MINUTE2));
  }

  static timeSeconds(value: string, offset: number): boolean {
    if (FormatValidators.codeAt(value, offset + TIME_SECONDS_COLON_OFFSET) !== 0x3A) {
      return false;
    }
    const s1 = FormatValidators.codeAt(value, offset + TIME_SECONDS_DIGIT_1_OFFSET); const
      s2 = FormatValidators.codeAt(value, offset + TIME_SECONDS_DIGIT_2_OFFSET);

    if (!FormatValidators.isDigit(s1) || !FormatValidators.isDigit(s2)) {
      return false;
    }

    // 60 for leap second
    return (s1 - 0x30) * DECIMAL_RADIX + (s2 - 0x30) <= TIME_SECOND_MAXIMUM;
  }

  static uuid(value: string): boolean {
    if (value.length !== UUID_STRING_LENGTH) {
      return false;
    }
    if (FormatValidators.codeAt(value, UUID_DASH_POS_1) !== 0x2D || FormatValidators.codeAt(value, UUID_DASH_POS_2) !== 0x2D
      || FormatValidators.codeAt(value, UUID_DASH_POS_3) !== 0x2D || FormatValidators.codeAt(value, UUID_DASH_POS_4) !== 0x2D) {
      return false;
    }
    if (!FormatValidators.uuidVersion(value)) {
      return false;
    }
    if (!FormatValidators.uuidVariant(value)) {
      return false;
    }

    return FormatValidators.uuidHexPositions(value);
  }

  static uuidHexPositions(value: string): boolean {
    for (let i = 0; i < UUID_STRING_LENGTH; i++) {
      if (i === UUID_DASH_POS_1 || i === UUID_DASH_POS_2 || i === UUID_DASH_POS_3 || i === UUID_DASH_POS_4) {
        continue;
      }
      if (!FormatValidators.isHexChar(FormatValidators.codeAt(value, i))) {
        return false;
      }
    }

    return true;
  }

  static uuidVariant(value: string): boolean {
    const variant = FormatValidators.codeAt(value, UUID_VARIANT_POS);

    return (variant >= 0x38 && variant <= 0x39)
      || variant === 0x61 || variant === 0x62
      || variant === 0x41 || variant === 0x42;
  }

  static uuidVersion(value: string): boolean {
    const version = FormatValidators.codeAt(value, UUID_VERSION_POS);

    return version >= 0x31 && version <= 0x38;
  }
}

const STRING_FORMAT_VALIDATORS: Record<string, FormatPredicateType> = {
  'binary': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.binary(value);
  },
  'byte': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.byte(value);
  },
  'date': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.dateFormat(value);
  },
  'duration': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.duration(value);
  },
  'email': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.email(value);
  },
  'hostname': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.isAsciiHostname(value);
  },
  'ipv4': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.isIPv4(value);
  },
  'ipv6': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.isIPv6(value);
  },
  'iri': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.isUriLike(value);
  },
  'regex': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.regex(value);
  },
  'time': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.timeFormat(value);
  },
  'uri': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.isUriLike(value);
  },
  'uuid': (value: unknown): boolean => {
    return typeof value === 'string' && FormatValidators.uuid(value);
  }
};

STRING_FORMAT_VALIDATORS['date-time'] = (value: unknown): boolean => {
  return typeof value === 'string' && FormatValidators.dateTime(value);
};
STRING_FORMAT_VALIDATORS['idn-email'] = (value: unknown): boolean => {
  return typeof value === 'string' && FormatValidators.idnEmail(value);
};
STRING_FORMAT_VALIDATORS['idn-hostname'] = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const ascii = FormatValidators.domainToAscii(value);

  return ascii !== null && ascii.length > 0;
};
STRING_FORMAT_VALIDATORS['iri-reference'] = (value: unknown): boolean => {
  return typeof value === 'string' && FormatValidators.isUriReference(value);
};
STRING_FORMAT_VALIDATORS['json-pointer'] = (value: unknown): boolean => {
  return typeof value === 'string' && FormatValidators.jsonPointer(value);
};
STRING_FORMAT_VALIDATORS['uri-reference'] = (value: unknown): boolean => {
  return typeof value === 'string' && FormatValidators.isUriReference(value);
};
STRING_FORMAT_VALIDATORS['uri-template'] = (value: unknown): boolean => {
  return typeof value === 'string' && FormatValidators.isUriReference(value) && FormatValidators.hasBalancedBraces(value);
};

// ---------------------------------------------------------------------------
// Built-in number format validators
// ---------------------------------------------------------------------------

const NUMBER_FORMAT_VALIDATORS: Record<string, FormatPredicateType> = {
  'double': (value: unknown): boolean => {
    return typeof value === 'number' && Number.isFinite(value);
  },
  'float': (value: unknown): boolean => {
    return typeof value === 'number' && Number.isFinite(value) && Math.fround(value) === value;
  },
  'int32': (value: unknown): boolean => {
    return typeof value === 'number' && Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
  },
  'int64': (value: unknown): boolean => {
    return typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value);
  }
};

// ---------------------------------------------------------------------------
// Trust marker — applied to built-in validators at registration time
// ---------------------------------------------------------------------------

const TRUSTED_MARKER = 'trusted' as const;

/**
 * Pluggable registry for JSON Schema `format` validators.
 *
 * Each validator receives `unknown` so it can handle both string and number
 * formats in one map.  Built-in validators are registered by
 * `FormatRegistry.builtin()`.
 *
 * @remarks
 * Extend the registry at runtime by calling `set` with a custom validator.
 * The registry is consumed by `GraphEngine` during validation when
 * `formatAssertions` is enabled in the dialect plan.
 *
 * @example
 * ```ts
 * const registry = FormatRegistry.builtin();
 * registry.set('my-format', (value) => typeof value === 'string' && /^\d+$/u.test(value));
 * ```
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link FormatRegistryInterface}
 * @group Format
 */
export class FormatRegistry implements FormatRegistryInterface {
  /**
   * Create a `FormatRegistry` pre-loaded with all built-in JSON Schema format
   * validators (string formats like `date`, `email`, `uri`, etc. and number
   * formats like `int32`, `float`, etc.).
   *
   * @returns A new `FormatRegistry` instance with all built-in validators registered.
   */
  static builtin(): FormatRegistry {
    const registry = new FormatRegistry();

    for (const [
      name,
      validator
    ] of Object.entries(STRING_FORMAT_VALIDATORS)) {
      registry.setBuiltin(name, validator);
    }

    for (const [
      name,
      validator
    ] of Object.entries(NUMBER_FORMAT_VALIDATORS)) {
      registry.setBuiltin(name, validator);
    }

    return registry;
  }

  /**
   * Returns `true` when `validator` is a built-in format validator registered via
   * {@link FormatRegistry.builtin}.  Built-in validators are total functions
   * that never throw, so callers can omit the try/catch guard on the hot path.
   *
   * User-supplied validators registered via {@link FormatRegistry.set} are never
   * trusted — the try/catch guard is preserved for them.
   *
   * @param validator - Format predicate to test
   * @returns `true` when the function carries the built-in trust marker
   * @category Validation
   * @since 0.25.0
   * @group Format
   */
  static isTrustedFormatPredicate(validator: FormatPredicateType): boolean {
    const result = Object.hasOwn(validator, TRUSTED_MARKER);

    return result;
  }

  private readonly validators = new Map<string, FormatPredicateType>();

  /**
   * Look up a format validator by name.
   *
   * @param name - Format name (e.g. "email", "uri", "int32")
   * @returns Validator function, or undefined if the format is not registered
   */
  get(name: string): FormatPredicateType | undefined {
    const result = this.validators.get(name);

    return result;
  }

  /**
   * Check whether a format validator is registered under the given name.
   *
   * @param name - Format name to check
   * @returns True if the format is registered
   */
  has(name: string): boolean {
    const result = this.validators.has(name);

    return result;
  }

  /**
   * Add a format validator under the given name, replacing any previous validator.
   *
   * User-supplied validators are not trusted — the hot-path executor wraps
   * them in a try/catch to guard against validators that throw.
   *
   * @param name - Format name to register
   * @param validator - Validation function that returns true when the value matches the format
   */
  set(name: string, validator: FormatPredicateType): void {
    this.validators.set(name, validator);
  }

  /**
   * Register a built-in (trusted) format validator.
   *
   * Brands the function with a {@link TRUSTED_MARKER} property so the
   * hot-path executor can call it without a try/catch guard.
   */
  private setBuiltin(name: string, validator: FormatPredicateType): void {
    const marker: Record<string, boolean> = {};

    marker[TRUSTED_MARKER] = true;
    Object.assign(validator, marker);
    this.validators.set(name, validator);
  }
}
