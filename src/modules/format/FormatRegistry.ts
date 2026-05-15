import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import {
  BASE64_CHUNK_SIZE, BASE64_MAX_PADDING, DATE_DAY_MAX,
  DATE_DAY_OFFSET_1, DATE_DAY_OFFSET_2, DATE_DAY_SEPARATOR_OFFSET,
  DATE_MONTH_MAX, DATE_MONTH_OFFSET_1, DATE_MONTH_OFFSET_2,
  DATE_STRING_LENGTH, DATE_YEAR_DIGIT_COUNT, DATETIME_MIN_LENGTH,
  DECIMAL_RADIX, HOSTNAME_LABEL_MAX_LENGTH,
  TIME_BASE_LENGTH, TIME_HOUR_MAX, TIME_MINUTE_MAX,
  TIME_OFFSET_COLON, TIME_OFFSET_HOUR1, TIME_OFFSET_HOUR2,
  TIME_OFFSET_MIN1, TIME_OFFSET_MIN2, TIME_SECOND_MAX,
  TIME_SECONDS_COLON_OFFSET, TIME_SECONDS_DIGIT_1_OFFSET,
  TIME_SECONDS_DIGIT_2_OFFSET, TIME_ZONE_OFFSET_LENGTH,
  UUID_DASH_POS_1, UUID_DASH_POS_2, UUID_DASH_POS_3, UUID_DASH_POS_4,
  UUID_STRING_LENGTH, UUID_VARIANT_POS, UUID_VERSION_POS
} from '../../constants/FORMAT_VALIDATION.js';

// ---------------------------------------------------------------------------
// Helper functions (moved from GraphEngine.ts)
// ---------------------------------------------------------------------------

function hasBalancedBraces(value: string): boolean {
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

function isAlphanumeric(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A);
}

function isHexChar(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function codeAt(value: string, index: number): number {
  return value.codePointAt(index) ?? 0;
}

function isAsciiHostname(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  let labelLen = 0;

  for (let i = 0; i < value.length; i++) {
    const charCode = codeAt(value, i);

    // '.'
    if (charCode === 0x2E) {
      if (labelLen === 0) {
        return false;
      }
      if (!isAlphanumeric(codeAt(value, i - 1))) {
        return false;
      }
      labelLen = 0;
      continue;
    }
    if (labelLen === 0 && !isAlphanumeric(charCode)) {
      return false;
    }
    // not alphanumeric or '-'
    if (!isAlphanumeric(charCode) && charCode !== 0x2D) {
      return false;
    }
    labelLen++;
    if (labelLen > HOSTNAME_LABEL_MAX_LENGTH) {
      return false;
    }
  }

  return labelLen > 0 && isAlphanumeric(codeAt(value, value.length - 1));
}

function isUriLike(value: string): boolean {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
}

function isUriReference(value: string): boolean {
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

// ---------------------------------------------------------------------------
// Browser-compatible IP and IDN helpers (no node:net / node:url)
// ---------------------------------------------------------------------------

function isIPv4(value: string): boolean {
  const parts = value.split('.');

  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
    // no leading zeros
    if (part.length > 1 && part.startsWith('0')) {
      return false;
    }
    if (!/^\d+$/u.test(part)) {
      return false;
    }
    const n = Number(part);

    if (n > 255) {
      return false;
    }
  }

  return true;
}

// Matches full IPv6 addresses including :: collapsed forms and optional
// trailing IPv4-mapped suffix (RFC 4291 §2.2).
const IPV6_FULL = /^[\da-f]{1,4}(?::[\da-f]{1,4}){7}$/iu;
const IPV6_WITH_DOUBLE_COLON = /^(?:[\da-f]{1,4}:){0,7}:(?:[\da-f]{1,4}:){0,6}[\da-f]{0,4}$/iu;
const IPV6_MIXED = /^(?:[\da-f]{1,4}:){6}(?:\d{1,3}\.){3}\d{1,3}$/iu;
const IPV6_MIXED_COMPRESSED = /^::(?:[\da-f]{1,4}:){0,5}(?:\d{1,3}\.){3}\d{1,3}$/iu;

function isIPv6(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  // Fully-expanded 8-group form
  if (IPV6_FULL.test(value)) {
    return true;
  }
  // Mixed IPv4-in-IPv6 (e.g. ::ffff:192.0.2.1)
  if (IPV6_MIXED.test(value) || IPV6_MIXED_COMPRESSED.test(value)) {
    return true;
  }
  // "::" collapsed form: at most one "::" allowed
  const doubleColonCount = (value.match(/::/gu) ?? []).length;

  if (doubleColonCount > 1) {
    return false;
  }
  if (IPV6_WITH_DOUBLE_COLON.test(value)) {
    // Count groups to ensure total ≤ 8
    const withoutDC = value.replaceAll('::', ':').replaceAll(/^:|:$/gu, '');
    const groups = withoutDC.length === 0 ? 0 : withoutDC.split(':').length;

    return groups <= 8;
  }

  return false;
}

function domainToAscii(value: string): string {
  try {
    return new URL(`https://${value}`).hostname;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Built-in string format validators
// ---------------------------------------------------------------------------

// '+' or '/'
function isBase64Char(code: number): boolean {
  return isAlphanumeric(code) || code === 0x2B || code === 0x2F;
}

function validateDate(value: string, offset: number): boolean {
  if (offset + DATE_STRING_LENGTH > value.length) {
    return false;
  }
  for (let i = 0; i < DATE_YEAR_DIGIT_COUNT; i++) {
    if (!isDigit(codeAt(value, offset + i))) {
      return false;
    }
  }
  // '-'
  if (codeAt(value, offset + DATE_YEAR_DIGIT_COUNT) !== 0x2D) {
    return false;
  }
  if (!isDigit(codeAt(value, offset + DATE_MONTH_OFFSET_1)) || !isDigit(codeAt(value, offset + DATE_MONTH_OFFSET_2))) {
    return false;
  }
  if (codeAt(value, offset + DATE_DAY_SEPARATOR_OFFSET) !== 0x2D) {
    return false;
  }
  if (!isDigit(codeAt(value, offset + DATE_DAY_OFFSET_1)) || !isDigit(codeAt(value, offset + DATE_DAY_OFFSET_2))) {
    return false;
  }
  const month
    = (codeAt(value, offset + DATE_MONTH_OFFSET_1) - 0x30) * DECIMAL_RADIX
    + (codeAt(value, offset + DATE_MONTH_OFFSET_2) - 0x30);
  const day
    = (codeAt(value, offset + DATE_DAY_OFFSET_1) - 0x30) * DECIMAL_RADIX
    + (codeAt(value, offset + DATE_DAY_OFFSET_2) - 0x30);

  return month >= 1 && month <= DATE_MONTH_MAX && day >= 1 && day <= DATE_DAY_MAX;
}

function validateTime(value: string, offset: number): boolean {
  if (offset + TIME_BASE_LENGTH > value.length) {
    return false;
  }
  const h1 = codeAt(value, offset); const
    h2 = codeAt(value, offset + 1);

  if (!isDigit(h1) || !isDigit(h2)) {
    return false;
  }
  const hour = (h1 - 0x30) * DECIMAL_RADIX + (h2 - 0x30);

  if (hour > TIME_HOUR_MAX) {
    return false;
  }
  // ':'
  if (codeAt(value, offset + 2) !== 0x3A) {
    return false;
  }
  const m1 = codeAt(value, offset + 3); const
    m2 = codeAt(value, offset + 4);

  if (!isDigit(m1) || !isDigit(m2)) {
    return false;
  }
  if ((m1 - 0x30) * DECIMAL_RADIX + (m2 - 0x30) > TIME_MINUTE_MAX) {
    return false;
  }
  if (codeAt(value, offset + TIME_SECONDS_COLON_OFFSET) !== 0x3A) {
    return false;
  }
  const s1 = codeAt(value, offset + TIME_SECONDS_DIGIT_1_OFFSET); const
    s2 = codeAt(value, offset + TIME_SECONDS_DIGIT_2_OFFSET);

  if (!isDigit(s1) || !isDigit(s2)) {
    return false;
  }
  // 60 for leap second
  if ((s1 - 0x30) * DECIMAL_RADIX + (s2 - 0x30) > TIME_SECOND_MAX) {
    return false;
  }
  let pos = offset + TIME_BASE_LENGTH;

  // fractional seconds
  if (pos < value.length && codeAt(value, pos) === 0x2E) {
    pos++;
    if (pos >= value.length || !isDigit(codeAt(value, pos))) {
      return false;
    }
    while (pos < value.length && isDigit(codeAt(value, pos))) {
      pos++;
    }
  }

  // no timezone required for bare time check
  return pos === value.length;
}

function validateBinary(value: string): boolean {
  if (value.length === 0 || value.length % 2 !== 0) {
    return false;
  }

  for (let i = 0; i < value.length; i++) {
    if (!isHexChar(codeAt(value, i))) {
      return false;
    }
  }

  return true;
}

function validateByte(value: string): boolean {
  if (value.length === 0) {
    return true;
  }
  if (value.length % BASE64_CHUNK_SIZE !== 0) {
    return false;
  }
  const padStart = value.indexOf('=');
  const contentEnd = padStart === -1 ? value.length : padStart;

  for (let i = 0; i < contentEnd; i++) {
    if (!isBase64Char(codeAt(value, i))) {
      return false;
    }
  }
  if (padStart !== -1) {
    const padLen = value.length - padStart;

    if (padLen > BASE64_MAX_PADDING) {
      return false;
    }
    for (let i = padStart; i < value.length; i++) {
      // '='
      if (codeAt(value, i) !== 0x3D) {
        return false;
      }
    }
  }

  return true;
}

const DAYS_IN_MONTH: readonly number[] = Object.freeze([
  31,
  28,
  31,
  30,
  31,
  30,
  31,
  31,
  30,
  31,
  30,
  31
]);

function validateDateFormat(value: string): boolean {
  if (value.length !== DATE_STRING_LENGTH) {
    return false;
  }
  if (!validateDate(value, 0)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];

  return day >= 1 && day <= maxDay;
}

function validateDateTime(value: string): boolean {
  return value.length > DATETIME_MIN_LENGTH && value.includes('T') && !Number.isNaN(Date.parse(value));
}

function validateDuration(value: string): boolean {
  // 'P'
  if (value.length < 2 || codeAt(value, 0) !== 0x50) {
    return false;
  }
  let pos = 1;
  let hasContent = false;
  let inTime = false;

  while (pos < value.length) {
    const charCode = codeAt(value, pos);

    // 'T'
    if (charCode === 0x54 && !inTime) {
      inTime = true;
      pos++;
      continue;
    }
    if (!isDigit(charCode)) {
      return false;
    }
    while (pos < value.length && isDigit(codeAt(value, pos))) {
      pos++;
    }
    if (pos >= value.length) {
      return false;
    }
    const unit = codeAt(value, pos);

    // '.' for fractional seconds
    if (unit === 0x2E && inTime) {
      pos++;
      if (pos >= value.length || !isDigit(codeAt(value, pos))) {
        return false;
      }
      while (pos < value.length && isDigit(codeAt(value, pos))) {
        pos++;
      }
      // 'S'
      if (pos >= value.length || codeAt(value, pos) !== 0x53) {
        return false;
      }
    }
    pos++;
    hasContent = true;
  }

  return hasContent;
}

function validateEmail(value: string): boolean {
  const at = value.indexOf('@');

  if (at < 1 || at === value.length - 1) {
    return false;
  }
  const dot = value.indexOf('.', at + 2);

  if (dot < 0 || dot === value.length - 1) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    if (codeAt(value, i) <= 0x20) {
      return false;
    }
  }

  return true;
}

function validateIdnEmail(value: string): boolean {
  const at = value.lastIndexOf('@');

  if (at < 1 || at === value.length - 1) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const charCode = codeAt(value, i);

    // whitespace or duplicate @
    if (charCode <= 0x20 || (charCode === 0x40 && i !== at)) {
      return false;
    }
  }
  const domain = value.slice(at + 1);

  return domainToAscii(domain).length > 0;
}

function validateJsonPointer(value: string): boolean {
  if (value.length === 0) {
    return true;
  }
  // '/'
  if (codeAt(value, 0) !== 0x2F) {
    return false;
  }

  for (let i = 1; i < value.length; i++) {
    // '~'
    if (codeAt(value, i) === 0x7E) {
      i++;
      if (i >= value.length) {
        return false;
      }
      const next = codeAt(value, i);

      // must be '0' or '1'
      if (next !== 0x30 && next !== 0x31) {
        return false;
      }
    }
  }

  return true;
}

function validateTimeFormat(value: string): boolean {
  if (value.length < TIME_BASE_LENGTH) {
    return false;
  }
  if (!validateTime(value, 0)) {
    return false;
  }
  // Check optional timezone after time portion
  let pos = TIME_BASE_LENGTH;

  // skip fractional seconds
  if (pos < value.length && codeAt(value, pos) === 0x2E) {
    pos++;
    while (pos < value.length && isDigit(codeAt(value, pos))) {
      pos++;
    }
  }
  // no timezone is valid
  if (pos === value.length) {
    return true;
  }
  const tzChar = codeAt(value, pos);

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
  if (!isDigit(codeAt(value, pos + TIME_OFFSET_HOUR1)) || !isDigit(codeAt(value, pos + TIME_OFFSET_HOUR2))) {
    return false;
  }
  if (codeAt(value, pos + TIME_OFFSET_COLON) !== 0x3A) {
    return false;
  }
  if (!isDigit(codeAt(value, pos + TIME_OFFSET_MIN1)) || !isDigit(codeAt(value, pos + TIME_OFFSET_MIN2))) {
    return false;
  }

  return true;
}

function validateUuid(value: string): boolean {
  if (value.length !== UUID_STRING_LENGTH) {
    return false;
  }
  // Check dash positions: 8, 13, 18, 23
  if (codeAt(value, UUID_DASH_POS_1) !== 0x2D || codeAt(value, UUID_DASH_POS_2) !== 0x2D
    || codeAt(value, UUID_DASH_POS_3) !== 0x2D || codeAt(value, UUID_DASH_POS_4) !== 0x2D) {
    return false;
  }
  // Version digit at position 14 must be 1-8
  const version = codeAt(value, UUID_VERSION_POS);

  if (version < 0x31 || version > 0x38) {
    return false;
  }
  // Variant digit at position 19 must be 8, 9, a, or b
  const variant = codeAt(value, UUID_VARIANT_POS);

  if (!((variant >= 0x38 && variant <= 0x39) || variant === 0x61 || variant === 0x62
    || variant === 0x41 || variant === 0x42)) {
    return false;
  }
  // All other positions must be hex
  for (let i = 0; i < UUID_STRING_LENGTH; i++) {
    if (i === UUID_DASH_POS_1 || i === UUID_DASH_POS_2 || i === UUID_DASH_POS_3 || i === UUID_DASH_POS_4) {
      continue;
    }
    if (!isHexChar(codeAt(value, i))) {
      return false;
    }
  }

  return true;
}

function validateRegex(value: string): boolean {
  try {
    new RegExp(value, 'u');

    return true;
  } catch {
    return false;
  }
}

const STRING_FORMAT_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  'binary': (value) => {
    return typeof value === 'string' && validateBinary(value);
  },
  'byte': (value) => {
    return typeof value === 'string' && validateByte(value);
  },
  'date': (value) => {
    return typeof value === 'string' && validateDateFormat(value);
  },
  'duration': (value) => {
    return typeof value === 'string' && validateDuration(value);
  },
  'email': (value) => {
    return typeof value === 'string' && validateEmail(value);
  },
  'hostname': (value) => {
    return typeof value === 'string' && isAsciiHostname(value);
  },
  'ipv4': (value) => {
    return typeof value === 'string' && isIPv4(value);
  },
  'ipv6': (value) => {
    return typeof value === 'string' && isIPv6(value);
  },
  'iri': (value) => {
    return typeof value === 'string' && isUriLike(value);
  },
  'regex': (value) => {
    return typeof value === 'string' && validateRegex(value);
  },
  'time': (value) => {
    return typeof value === 'string' && validateTimeFormat(value);
  },
  'uri': (value) => {
    return typeof value === 'string' && isUriLike(value);
  },
  'uuid': (value) => {
    return typeof value === 'string' && validateUuid(value);
  }
};

STRING_FORMAT_VALIDATORS['date-time'] = (value) => {
  return typeof value === 'string' && validateDateTime(value);
};
STRING_FORMAT_VALIDATORS['idn-email'] = (value) => {
  return typeof value === 'string' && validateIdnEmail(value);
};
STRING_FORMAT_VALIDATORS['idn-hostname'] = (value) => {
  return typeof value === 'string' && domainToAscii(value).length > 0;
};
STRING_FORMAT_VALIDATORS['iri-reference'] = (value) => {
  return typeof value === 'string' && isUriReference(value);
};
STRING_FORMAT_VALIDATORS['json-pointer'] = (value) => {
  return typeof value === 'string' && validateJsonPointer(value);
};
STRING_FORMAT_VALIDATORS['uri-reference'] = (value) => {
  return typeof value === 'string' && isUriReference(value);
};
STRING_FORMAT_VALIDATORS['uri-template'] = (value) => {
  return typeof value === 'string' && isUriReference(value) && hasBalancedBraces(value);
};

// ---------------------------------------------------------------------------
// Built-in number format validators
// ---------------------------------------------------------------------------

const NUMBER_FORMAT_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  'double': (value) => {
    return typeof value === 'number' && Number.isFinite(value);
  },
  'float': (value) => {
    return typeof value === 'number' && Number.isFinite(value) && Math.fround(value) === value;
  },
  'int32': (value) => {
    return typeof value === 'number' && Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
  },
  'int64': (value) => {
    return typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value);
  }
};

/**
 * Pluggable registry for JSON Schema `format` validators.
 *
 * Each validator receives `unknown` so it can handle both string and number
 * formats in one map.  Built-in validators are registered by
 * `FormatRegistry.builtin()`.
 */
export class FormatRegistry implements FormatRegistryInterface {
  /**
   * Create a `FormatRegistry` pre-loaded with all built-in JSON Schema format
   * validators (string formats like `date`, `email`, `uri`, etc. and number
   * formats like `int32`, `float`, etc.).
   */
  static builtin(): FormatRegistry {
    const registry = new FormatRegistry();

    for (const [
      name,
      fn
    ] of Object.entries(STRING_FORMAT_VALIDATORS)) {
      registry.set(name, fn);
    }

    for (const [
      name,
      fn
    ] of Object.entries(NUMBER_FORMAT_VALIDATORS)) {
      registry.set(name, fn);
    }

    return registry;
  }

  private readonly validators = new Map<string, (value: unknown) => boolean>();

  /**
   * Look up a format validator by name.
   *
   * @param name - Format name (e.g. "email", "uri", "int32")
   * @returns Validator function, or undefined if the format is not registered
   */
  get(name: string): ((value: unknown) => boolean) | undefined {
    return this.validators.get(name);
  }

  /**
   * Check whether a format validator is registered under the given name.
   *
   * @param name - Format name to check
   * @returns True if the format is registered
   */
  has(name: string): boolean {
    return this.validators.has(name);
  }

  /**
   * Add a format validator under the given name, replacing any previous validator.
   *
   * @param name - Format name to register
   * @param validator - Validation function that returns true when the value matches the format
   */
  set(name: string, validator: (value: unknown) => boolean): void {
    this.validators.set(name, validator);
  }
}
