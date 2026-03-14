import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

/**
 * Pluggable registry for JSON Schema `format` validators.
 *
 * Each validator receives `unknown` so it can handle both string and number
 * formats in one map.  Built-in validators are registered by
 * `FormatRegistry.builtin()`.
 */
export class FormatRegistry {
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
      registry.register(name, (v) => {
        return typeof v === 'string' && fn(v);
      });
    }

    for (const [
      name,
      fn
    ] of Object.entries(NUMBER_FORMAT_VALIDATORS)) {
      registry.register(name, (v) => {
        return typeof v === 'number' && fn(v);
      });
    }

    return registry;
  }

  private readonly validators = new Map<string, (value: unknown) => boolean>();

  get(name: string): ((value: unknown) => boolean) | undefined {
    return this.validators.get(name);
  }

  has(name: string): boolean {
    return this.validators.has(name);
  }

  register(name: string, validator: (value: unknown) => boolean): void {
    this.validators.set(name, validator);
  }
}

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

function isAlphanumeric(c: number): boolean {
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
}

function isHexChar(c: number): boolean {
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
}

function isDigit(c: number): boolean {
  return c >= 0x30 && c <= 0x39;
}

function isAsciiHostname(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  let labelLen = 0;

  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);

    if (c === 0x2E) { // '.'
      if (labelLen === 0) {
        return false;
      }
      if (!isAlphanumeric(value.charCodeAt(i - 1))) {
        return false;
      }
      labelLen = 0;
      continue;
    }
    if (labelLen === 0 && !isAlphanumeric(c)) {
      return false;
    }
    if (!isAlphanumeric(c) && c !== 0x2D) {
      return false;
    } // not alphanumeric or '-'
    labelLen++;
    if (labelLen > 63) {
      return false;
    }
  }

  return labelLen > 0 && isAlphanumeric(value.charCodeAt(value.length - 1));
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

function isBase64Char(c: number): boolean {
  return isAlphanumeric(c) || c === 0x2B || c === 0x2F; // '+' or '/'
}

function validateDate(value: string, offset: number): boolean {
  if (offset + 10 > value.length) {
    return false;
  }
  for (let i = 0; i < 4; i++) {
    if (!isDigit(value.charCodeAt(offset + i))) {
      return false;
    }
  }
  if (value.charCodeAt(offset + 4) !== 0x2D) {
    return false;
  } // '-'
  if (!isDigit(value.charCodeAt(offset + 5)) || !isDigit(value.charCodeAt(offset + 6))) {
    return false;
  }
  if (value.charCodeAt(offset + 7) !== 0x2D) {
    return false;
  }
  if (!isDigit(value.charCodeAt(offset + 8)) || !isDigit(value.charCodeAt(offset + 9))) {
    return false;
  }
  const month = (value.charCodeAt(offset + 5) - 0x30) * 10 + (value.charCodeAt(offset + 6) - 0x30);
  const day = (value.charCodeAt(offset + 8) - 0x30) * 10 + (value.charCodeAt(offset + 9) - 0x30);

  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function validateTime(value: string, offset: number): boolean {
  if (offset + 8 > value.length) {
    return false;
  }
  const h1 = value.charCodeAt(offset); const
    h2 = value.charCodeAt(offset + 1);

  if (!isDigit(h1) || !isDigit(h2)) {
    return false;
  }
  const hour = (h1 - 0x30) * 10 + (h2 - 0x30);

  if (hour > 23) {
    return false;
  }
  if (value.charCodeAt(offset + 2) !== 0x3A) {
    return false;
  } // ':'
  const m1 = value.charCodeAt(offset + 3); const
    m2 = value.charCodeAt(offset + 4);

  if (!isDigit(m1) || !isDigit(m2)) {
    return false;
  }
  if ((m1 - 0x30) * 10 + (m2 - 0x30) > 59) {
    return false;
  }
  if (value.charCodeAt(offset + 5) !== 0x3A) {
    return false;
  }
  const s1 = value.charCodeAt(offset + 6); const
    s2 = value.charCodeAt(offset + 7);

  if (!isDigit(s1) || !isDigit(s2)) {
    return false;
  }
  if ((s1 - 0x30) * 10 + (s2 - 0x30) > 60) {
    return false;
  } // 60 for leap second
  let pos = offset + 8;

  // fractional seconds
  if (pos < value.length && value.charCodeAt(pos) === 0x2E) {
    pos++;
    if (pos >= value.length || !isDigit(value.charCodeAt(pos))) {
      return false;
    }
    while (pos < value.length && isDigit(value.charCodeAt(pos))) {
      pos++;
    }
  }

  return pos === value.length; // no timezone required for bare time check
}

const STRING_FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
  'binary': (value) => {
    if (value.length === 0 || value.length % 2 !== 0) {
      return false;
    }

    for (let i = 0; i < value.length; i++) {
      if (!isHexChar(value.charCodeAt(i))) {
        return false;
      }
    }

    return true;
  },
  'byte': (value) => {
    if (value.length === 0) {
      return true;
    }
    if (value.length % 4 !== 0) {
      return false;
    }
    const padStart = value.indexOf('=');
    const contentEnd = padStart === -1 ? value.length : padStart;

    for (let i = 0; i < contentEnd; i++) {
      if (!isBase64Char(value.charCodeAt(i))) {
        return false;
      }
    }
    if (padStart !== -1) {
      const padLen = value.length - padStart;

      if (padLen > 2) {
        return false;
      }
      for (let i = padStart; i < value.length; i++) {
        if (value.charCodeAt(i) !== 0x3D) {
          return false;
        } // '='
      }
    }

    return true;
  },
  'date': (value) => {
    if (value.length !== 10) {
      return false;
    }
    if (!validateDate(value, 0)) {
      return false;
    }
    const candidate = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(candidate.getTime()) && candidate.toISOString().startsWith(value);
  },
  'date-time': (value) => {
    return value.length > 15 && value.includes('T') && !Number.isNaN(Date.parse(value));
  },
  'duration': (value) => {
    if (value.length < 2 || value.charCodeAt(0) !== 0x50) {
      return false;
    } // 'P'
    let pos = 1;
    let hasContent = false;
    let inTime = false;

    while (pos < value.length) {
      const c = value.charCodeAt(pos);

      if (c === 0x54 && !inTime) { // 'T'
        inTime = true;
        pos++;
        continue;
      }
      if (!isDigit(c)) {
        return false;
      }
      while (pos < value.length && isDigit(value.charCodeAt(pos))) {
        pos++;
      }
      if (pos >= value.length) {
        return false;
      }
      const unit = value.charCodeAt(pos);

      if (unit === 0x2E && inTime) { // '.' for fractional seconds
        pos++;
        if (pos >= value.length || !isDigit(value.charCodeAt(pos))) {
          return false;
        }
        while (pos < value.length && isDigit(value.charCodeAt(pos))) {
          pos++;
        }
        if (pos >= value.length || value.charCodeAt(pos) !== 0x53) {
          return false;
        } // 'S'
      }
      pos++;
      hasContent = true;
    }

    return hasContent;
  },
  'email': (value) => {
    const at = value.indexOf('@');

    if (at < 1 || at === value.length - 1) {
      return false;
    }
    const dot = value.indexOf('.', at + 2);

    if (dot < 0 || dot === value.length - 1) {
      return false;
    }
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) <= 0x20) {
        return false;
      }
    }

    return true;
  },
  'hostname': (value) => {
    return isAsciiHostname(value);
  },
  'idn-email': (value) => {
    const at = value.lastIndexOf('@');

    if (at < 1 || at === value.length - 1) {
      return false;
    }
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);

      if (c <= 0x20 || (c === 0x40 && i !== at)) {
        return false;
      } // whitespace or duplicate @
    }
    const domain = value.slice(at + 1);

    return domainToASCII(domain).length > 0;
  },
  'idn-hostname': (value) => {
    return domainToASCII(value).length > 0;
  },
  'ipv4': (value) => {
    return isIP(value) === 4;
  },
  'ipv6': (value) => {
    return isIP(value) === 6;
  },
  'iri': (value) => {
    return isUriLike(value);
  },
  'iri-reference': (value) => {
    return isUriReference(value);
  },
  'json-pointer': (value) => {
    if (value.length === 0) {
      return true;
    }
    if (value.charCodeAt(0) !== 0x2F) {
      return false;
    } // '/'

    for (let i = 1; i < value.length; i++) {
      if (value.charCodeAt(i) === 0x7E) { // '~'
        i++;
        if (i >= value.length) {
          return false;
        }
        const next = value.charCodeAt(i);

        if (next !== 0x30 && next !== 0x31) {
          return false;
        } // must be '0' or '1'
      }
    }

    return true;
  },
  'regex': (value) => {
    try {
      new RegExp(value, 'u');

      return true;
    } catch {
      return false;
    }
  },
  'time': (value) => {
    if (value.length < 8) {
      return false;
    }
    if (!validateTime(value, 0)) {
      return false;
    }
    // Check optional timezone after time portion
    let pos = 8;

    // skip fractional seconds
    if (pos < value.length && value.charCodeAt(pos) === 0x2E) {
      pos++;
      while (pos < value.length && isDigit(value.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos === value.length) {
      return true;
    } // no timezone is valid
    const tzChar = value.charCodeAt(pos);

    if (tzChar === 0x5A) {
      return pos + 1 === value.length;
    } // 'Z'
    if (tzChar !== 0x2B && tzChar !== 0x2D) {
      return false;
    } // '+' or '-'
    // +HH:MM
    if (pos + 6 !== value.length) {
      return false;
    }
    if (!isDigit(value.charCodeAt(pos + 1)) || !isDigit(value.charCodeAt(pos + 2))) {
      return false;
    }
    if (value.charCodeAt(pos + 3) !== 0x3A) {
      return false;
    }
    if (!isDigit(value.charCodeAt(pos + 4)) || !isDigit(value.charCodeAt(pos + 5))) {
      return false;
    }

    return true;
  },
  'uri': (value) => {
    return isUriLike(value);
  },
  'uri-reference': (value) => {
    return isUriReference(value);
  },
  'uri-template': (value) => {
    return isUriReference(value) && hasBalancedBraces(value);
  },
  'uuid': (value) => {
    if (value.length !== 36) {
      return false;
    }
    // Check dash positions: 8, 13, 18, 23
    if (value.charCodeAt(8) !== 0x2D || value.charCodeAt(13) !== 0x2D
      || value.charCodeAt(18) !== 0x2D || value.charCodeAt(23) !== 0x2D) {
      return false;
    }
    // Version digit at position 14 must be 1-8
    const version = value.charCodeAt(14);

    if (version < 0x31 || version > 0x38) {
      return false;
    }
    // Variant digit at position 19 must be 8, 9, a, or b
    const variant = value.charCodeAt(19);

    if (!((variant >= 0x38 && variant <= 0x39) || variant === 0x61 || variant === 0x62
      || variant === 0x41 || variant === 0x42)) {
      return false;
    }
    // All other positions must be hex
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        continue;
      }
      if (!isHexChar(value.charCodeAt(i))) {
        return false;
      }
    }

    return true;
  }
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

