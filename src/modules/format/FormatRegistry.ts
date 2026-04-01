import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';

// ---------------------------------------------------------------------------
// Format validation constants
// ---------------------------------------------------------------------------

const HOSTNAME_LABEL_MAX_LENGTH = 63;
const DATE_STRING_LENGTH = 10;
const DATE_YEAR_DIGIT_COUNT = 4;
const DATE_MONTH_MAX = 12;
const DATE_DAY_MAX = 31;
const TIME_HOUR_MAX = 23;
const TIME_MINUTE_MAX = 59;
const TIME_SECOND_MAX = 60;
const TIME_BASE_LENGTH = 8;
const TIME_OFFSET_HOUR1 = 1;
const TIME_OFFSET_HOUR2 = 2;
const TIME_OFFSET_COLON = 3;
const TIME_OFFSET_MIN1 = 4;
const TIME_OFFSET_MIN2 = 5;
const TIME_ZONE_OFFSET_LENGTH = 6;
const DATE_MONTH_OFFSET_1 = 5;
const DATE_MONTH_OFFSET_2 = 6;
const DATE_DAY_SEPARATOR_OFFSET = 7;
const DATE_DAY_OFFSET_1 = 8;
const DATE_DAY_OFFSET_2 = 9;
const TIME_SECONDS_COLON_OFFSET = 5;
const TIME_SECONDS_DIGIT_1_OFFSET = 6;
const TIME_SECONDS_DIGIT_2_OFFSET = 7;
const IP_VERSION_4 = 4;
const IP_VERSION_6 = 6;
const BASE64_CHUNK_SIZE = 4;
const BASE64_MAX_PADDING = 2;
const DATETIME_MIN_LENGTH = 15;
const DECIMAL_RADIX = 10;
const UUID_STRING_LENGTH = 36;
const UUID_DASH_POS_1 = 8;
const UUID_DASH_POS_2 = 13;
const UUID_DASH_POS_3 = 18;
const UUID_DASH_POS_4 = 23;
const UUID_VERSION_POS = 14;
const UUID_VARIANT_POS = 19;

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

function validateDateFormat(value: string): boolean {
  if (value.length !== DATE_STRING_LENGTH) {
    return false;
  }
  if (!validateDate(value, 0)) {
    return false;
  }
  const candidate = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(candidate.getTime()) && candidate.toISOString().startsWith(value);
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

  return domainToASCII(domain).length > 0;
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

const STRING_FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
  'binary': validateBinary,
  'byte': validateByte,
  'date': validateDateFormat,
  'duration': validateDuration,
  'email': validateEmail,
  'hostname': isAsciiHostname,
  'ipv4': (value) => {
    return isIP(value) === IP_VERSION_4;
  },
  'ipv6': (value) => {
    return isIP(value) === IP_VERSION_6;
  },
  'iri': isUriLike,
  'regex': validateRegex,
  'time': validateTimeFormat,
  'uri': isUriLike,
  'uuid': validateUuid
};

STRING_FORMAT_VALIDATORS['date-time'] = validateDateTime;
STRING_FORMAT_VALIDATORS['idn-email'] = validateIdnEmail;
STRING_FORMAT_VALIDATORS['idn-hostname'] = (value) => {
  return domainToASCII(value).length > 0;
};
STRING_FORMAT_VALIDATORS['iri-reference'] = isUriReference;
STRING_FORMAT_VALIDATORS['json-pointer'] = validateJsonPointer;
STRING_FORMAT_VALIDATORS['uri-reference'] = isUriReference;
STRING_FORMAT_VALIDATORS['uri-template'] = (value) => {
  return isUriReference(value) && hasBalancedBraces(value);
};

// ---------------------------------------------------------------------------
// Built-in number format validators
// ---------------------------------------------------------------------------

const NUMBER_FORMAT_VALIDATORS: Record<string, (value: number) => boolean> = {
  'double': (value) => {
    return Number.isFinite(value);
  },
  'float': (value) => {
    return Number.isFinite(value) && Math.fround(value) === value;
  },
  'int32': (value) => {
    return Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
  },
  'int64': (value) => {
    return Number.isInteger(value) && Number.isSafeInteger(value);
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
      registry.register(name, (value) => {
        return typeof value === 'string' && fn(value);
      });
    }

    for (const [
      name,
      fn
    ] of Object.entries(NUMBER_FORMAT_VALIDATORS)) {
      registry.register(name, (value) => {
        return typeof value === 'number' && fn(value);
      });
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
   * Register a format validator under the given name, replacing any previous validator.
   *
   * @param name - Format name to register
   * @param validator - Validation function that returns true when the value matches the format
   */
  register(name: string, validator: (value: unknown) => boolean): void {
    this.validators.set(name, validator);
  }
}
