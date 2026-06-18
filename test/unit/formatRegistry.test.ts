/**
 * Unit tests for FormatRegistry built-in validators.
 *
 * Targets the uncovered branches in src/modules/format/FormatRegistry.ts:
 * hostname, ipv4, ipv6, date, date-time, time, duration, uuid, email,
 * idn-email, json-pointer, uri-reference, uri-template, binary, byte,
 * number formats (int32, int64, float, double).
 *
 * Invocation pattern: retrieve the validator via FormatRegistry.builtin().get(format)
 * and call it directly — the same API used by GraphEngine during format-assertion validation.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';

const registry = FormatRegistry.builtin();

function check(format: string, value: unknown): boolean {
  const validator = registry.get(format);

  assert.ok(validator !== undefined, `format '${format}' must be registered`);

  return validator(value);
}

// ---------------------------------------------------------------------------
// hostname
// ---------------------------------------------------------------------------

void describe('hostname format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'simple single label',
      'valid': true,
      'value': 'localhost'
    },
    {
      'name': 'multi-label domain',
      'valid': true,
      'value': 'example.com'
    },
    {
      'name': 'subdomain',
      'valid': true,
      'value': 'sub.example.com'
    },
    {
      'name': 'label with hyphen in middle',
      'valid': true,
      'value': 'my-host.example.com'
    },
    {
      'name': 'numeric label',
      'valid': true,
      'value': 'host1.example.com'
    },
    {
      'name': 'empty string',
      'valid': false,
      'value': ''
    },
    {
      'name': 'leading dot',
      'valid': false,
      'value': '.example.com'
    },
    {
      'name': 'label starting with hyphen',
      'valid': false,
      'value': '-host.example.com'
    },
    {
      'name': 'trailing dot',
      'valid': false,
      'value': 'example.com.'
    },
    {
      'name': 'consecutive dots',
      'valid': false,
      'value': 'a..b.com'
    },
    {
      'name': 'label too long (64 chars)',
      'valid': false,
      'value': `${'a'.repeat(64)}.com`
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 42
    },
    {
      'name': 'underscore in label',
      'valid': false,
      'value': 'my_host.com'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('hostname', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// idn-hostname
// ---------------------------------------------------------------------------

void describe('idn-hostname format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'ASCII domain',
      'valid': true,
      'value': 'example.com'
    },
    {
      'name': 'punycode domain',
      'valid': true,
      'value': 'xn--nxasmq6b.com'
    },
    {
      'name': 'empty string',
      'valid': false,
      'value': ''
    },
    {
      'name': 'non-string',
      'valid': false,
      'value': 123
    },
    {
      // domainToAscii returns null for an unparseable input; the validator
      // must return false rather than treating '' (empty string) as valid.
      'name': 'domain with spaces (unparseable — domainToAscii null path)',
      'valid': false,
      'value': 'not a valid domain'
    },
    {
      // URL constructor rejects hostnames with raw control characters; another
      // null path exercise for domainToAscii.
      'name': 'domain with null byte (unparseable — domainToAscii null path)',
      'valid': false,
      'value': 'bad\x00host.com'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('idn-hostname', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// ipv4
// ---------------------------------------------------------------------------

void describe('ipv4 format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'canonical address',
      'valid': true,
      'value': '192.168.1.1'
    },
    {
      'name': 'all zeros',
      'valid': true,
      'value': '0.0.0.0'
    },
    {
      'name': 'max address',
      'valid': true,
      'value': '255.255.255.255'
    },
    {
      'name': 'loopback',
      'valid': true,
      'value': '127.0.0.1'
    },
    {
      'name': 'octet 256',
      'valid': false,
      'value': '256.0.0.1'
    },
    {
      'name': 'octet 300',
      'valid': false,
      'value': '192.168.300.1'
    },
    {
      'name': 'three parts only',
      'valid': false,
      'value': '192.168.1'
    },
    {
      'name': 'five parts',
      'valid': false,
      'value': '1.2.3.4.5'
    },
    {
      'name': 'empty octet',
      'valid': false,
      'value': '192..1.1'
    },
    {
      'name': 'leading zero in octet',
      'valid': false,
      'value': '01.2.3.4'
    },
    {
      'name': 'alphabetic octet',
      'valid': false,
      'value': 'a.b.c.d'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 192_168
    },
    {
      'name': 'four-digit octet',
      'valid': false,
      'value': '1234.0.0.1'
    },
    {
      'name': 'octet with letter',
      'valid': false,
      'value': '1a.2.3.4'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('ipv4', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// ipv6
// ---------------------------------------------------------------------------

void describe('ipv6 format', () => {
  // Implementation note: the validator accepts full 8-group addresses (IPV6_FULL),
  // mixed IPv4-mapped forms (IPV6_MIXED / IPV6_MIXED_COMPRESSED), and
  // compressed forms where the prefix before '::' is non-empty
  // (IPV6_WITH_DOUBLE_COLON). Leading-:: forms (e.g. "::1", "::") are not
  // matched by the current regex set and return false.
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'full 8-group',
      'valid': true,
      'value': '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
    },
    {
      'name': 'trailing :: (2001:db8::)',
      'valid': true,
      'value': '2001:db8::'
    },
    {
      'name': 'middle :: (fe80::1)',
      'valid': true,
      'value': 'fe80::1'
    },
    {
      'name': 'middle :: (2001:db8::1)',
      'valid': true,
      'value': '2001:db8::1'
    },
    {
      'name': 'IPv4-mapped with leading :: (::ffff:192.168.1.1)',
      'valid': true,
      'value': '::ffff:192.168.1.1'
    },
    {
      'name': 'uppercase hex groups (2001:DB8::1)',
      'valid': true,
      'value': '2001:DB8::1'
    },
    {
      'name': 'loopback ::1 (leading :: not matched by regex set)',
      'valid': false,
      'value': '::1'
    },
    {
      'name': 'all-zeros :: (leading :: not matched)',
      'valid': false,
      'value': '::'
    },
    {
      'name': '::ffff:0:0 (leading :: non-mixed)',
      'valid': false,
      'value': '::ffff:0:0'
    },
    {
      'name': 'empty string',
      'valid': false,
      'value': ''
    },
    {
      'name': 'too many groups',
      'valid': false,
      'value': '1:2:3:4:5:6:7:8:9'
    },
    {
      'name': 'two double colons',
      'valid': false,
      'value': '1::2::3'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 1
    },
    {
      'name': 'plain hostname',
      'valid': false,
      'value': 'example.com'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('ipv6', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

void describe('date format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'canonical date',
      'valid': true,
      'value': '2024-01-15'
    },
    {
      'name': 'first of year',
      'valid': true,
      'value': '2024-01-01'
    },
    {
      'name': 'last day of march',
      'valid': true,
      'value': '2024-03-31'
    },
    {
      'name': 'leap day on leap year',
      'valid': true,
      'value': '2024-02-29'
    },
    {
      'name': 'leap day 2000 (divisible by 400)',
      'valid': true,
      'value': '2000-02-29'
    },
    {
      'name': 'too short',
      'valid': false,
      'value': '2024-1-1'
    },
    {
      'name': 'too long',
      'valid': false,
      'value': '2024-01-150'
    },
    {
      'name': 'month 13',
      'valid': false,
      'value': '2024-13-01'
    },
    {
      'name': 'month 00',
      'valid': false,
      'value': '2024-00-01'
    },
    {
      'name': 'day 00',
      'valid': false,
      'value': '2024-01-00'
    },
    {
      'name': 'day 32',
      'valid': false,
      'value': '2024-01-32'
    },
    {
      'name': 'Feb 29 on non-leap year (2023)',
      'valid': false,
      'value': '2023-02-29'
    },
    {
      'name': 'Feb 30',
      'valid': false,
      'value': '2024-02-30'
    },
    {
      'name': 'April 31',
      'valid': false,
      'value': '2024-04-31'
    },
    {
      'name': 'non-numeric year',
      'valid': false,
      'value': 'YYYY-01-01'
    },
    {
      'name': 'missing dash separator',
      'valid': false,
      'value': '20240101'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 20_240_115
    },
    {
      'name': 'Feb 29 on 1900 (divisible by 100, not 400)',
      'valid': false,
      'value': '1900-02-29'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('date', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// date-time
// ---------------------------------------------------------------------------

void describe('date-time format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'UTC Z offset',
      'valid': true,
      'value': '2024-01-15T12:30:45Z'
    },
    {
      'name': 'positive offset',
      'valid': true,
      'value': '2024-01-15T12:30:45+05:30'
    },
    {
      'name': 'negative offset',
      'valid': true,
      'value': '2024-01-15T12:30:45-08:00'
    },
    {
      'name': 'fractional seconds',
      'valid': true,
      'value': '2024-01-15T12:30:45.999Z'
    },
    {
      'name': 'milliseconds precision',
      'valid': true,
      'value': '2024-01-15T00:00:00.000Z'
    },
    {
      'name': 'space instead of T',
      'valid': false,
      'value': '2024-01-15 12:30:45Z'
    },
    {
      'name': 'date only no time',
      'valid': false,
      'value': '2024-01-15'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 1_234_567_890
    },
    {
      'name': 'random garbage',
      'valid': false,
      'value': 'not-a-datetime'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('date-time', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// time
// ---------------------------------------------------------------------------

void describe('time format', () => {
  // Implementation note: validateTimeFormat delegates to validateTime which
  // enforces `pos === value.length` after consuming HH:MM:SS[.fractions].
  // As a result, time + timezone suffix is always rejected — only bare times
  // (with optional fractional seconds) pass.
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'bare time HH:MM:SS',
      'valid': true,
      'value': '12:30:45'
    },
    {
      'name': 'midnight',
      'valid': true,
      'value': '00:00:00'
    },
    {
      'name': 'max time 23:59:59',
      'valid': true,
      'value': '23:59:59'
    },
    {
      'name': 'leap second 23:59:60',
      'valid': true,
      'value': '23:59:60'
    },
    {
      'name': 'fractional seconds bare',
      'valid': true,
      'value': '12:30:45.5'
    },
    {
      'name': 'fractional seconds multi-digit',
      'valid': true,
      'value': '12:30:45.999'
    },
    {
      'name': 'time with Z (tz not accepted)',
      'valid': false,
      'value': '12:30:45Z'
    },
    {
      'name': 'time with +05:30 (tz not accepted)',
      'valid': false,
      'value': '12:30:45+05:30'
    },
    {
      'name': 'time with -08:00 (tz not accepted)',
      'valid': false,
      'value': '14:00:00-08:00'
    },
    {
      'name': 'fractional seconds + Z (tz not accepted)',
      'valid': false,
      'value': '12:30:45.123Z'
    },
    {
      'name': 'hour 24',
      'valid': false,
      'value': '24:00:00'
    },
    {
      'name': 'minute 60',
      'valid': false,
      'value': '12:60:00'
    },
    {
      'name': 'second 61',
      'valid': false,
      'value': '12:30:61'
    },
    {
      'name': 'too short',
      'valid': false,
      'value': '12:30'
    },
    {
      'name': 'missing colons',
      'valid': false,
      'value': '123045'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 123_045
    },
    {
      'name': 'non-digit hour',
      'valid': false,
      'value': 'ab:30:45'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('time', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// duration
// ---------------------------------------------------------------------------

void describe('duration format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'P1Y',
      'valid': true,
      'value': 'P1Y'
    },
    {
      'name': 'P1M',
      'valid': true,
      'value': 'P1M'
    },
    {
      'name': 'P1D',
      'valid': true,
      'value': 'P1D'
    },
    {
      'name': 'PT1H',
      'valid': true,
      'value': 'PT1H'
    },
    {
      'name': 'PT30M',
      'valid': true,
      'value': 'PT30M'
    },
    {
      'name': 'PT1S',
      'valid': true,
      'value': 'PT1S'
    },
    {
      'name': 'P1Y2M3DT4H5M6S',
      'valid': true,
      'value': 'P1Y2M3DT4H5M6S'
    },
    {
      'name': 'fractional seconds PT1.5S',
      'valid': true,
      'value': 'PT1.5S'
    },
    {
      'name': 'missing P prefix',
      'valid': false,
      'value': '1Y'
    },
    {
      'name': 'only P',
      'valid': false,
      'value': 'P'
    },
    {
      'name': 'empty string',
      'valid': false,
      'value': ''
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 100
    },
    {
      'name': 'PT alone',
      'valid': false,
      'value': 'PT'
    },
    {
      'name': 'PX (non-digit)',
      'valid': false,
      'value': 'PX'
    },
    {
      'name': 'P1 (no unit char)',
      'valid': false,
      'value': 'P1'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('duration', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

void describe('email format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'standard address',
      'valid': true,
      'value': 'user@example.com'
    },
    {
      'name': 'subdomain',
      'valid': true,
      'value': 'user@sub.example.co.uk'
    },
    {
      'name': 'plus tag',
      'valid': true,
      'value': 'user+tag@example.com'
    },
    {
      'name': 'no at sign',
      'valid': false,
      'value': 'notanemail'
    },
    {
      'name': 'at sign at start',
      'valid': false,
      'value': '@example.com'
    },
    {
      'name': 'at sign at end',
      'valid': false,
      'value': 'user@'
    },
    {
      'name': 'no dot after at',
      'valid': false,
      'value': 'user@nodot'
    },
    {
      'name': 'trailing dot in domain',
      'valid': false,
      'value': 'user@example.'
    },
    {
      'name': 'space in address',
      'valid': false,
      'value': 'user @example.com'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 42
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('email', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// idn-email
// ---------------------------------------------------------------------------

void describe('idn-email format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'standard ASCII email',
      'valid': true,
      'value': 'user@example.com'
    },
    {
      'name': 'no at sign',
      'valid': false,
      'value': 'notanemail'
    },
    {
      'name': 'at sign at start',
      'valid': false,
      'value': '@example.com'
    },
    {
      'name': 'at sign at end',
      'valid': false,
      'value': 'user@'
    },
    {
      'name': 'space in address',
      'valid': false,
      'value': 'user @example.com'
    },
    {
      'name': 'two at signs',
      'valid': false,
      'value': 'user@@example.com'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 42
    },
    {
      // domainToAscii returns null for an unparseable domain; idn-email must
      // return false rather than accepting it as a non-empty ASCII domain.
      'name': 'domain with spaces (unparseable — domainToAscii null path)',
      'valid': false,
      'value': 'user@not a valid domain'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('idn-email', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// uri
// ---------------------------------------------------------------------------

void describe('uri format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'https URL',
      'valid': true,
      'value': 'https://example.com'
    },
    {
      'name': 'http URL with path',
      'valid': true,
      'value': 'http://example.com/path?q=1'
    },
    {
      'name': 'urn',
      'valid': true,
      'value': 'urn:isbn:0451450523'
    },
    {
      'name': 'relative path',
      'valid': false,
      'value': '/just/a/path'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 123
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('uri', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// uri-reference
// ---------------------------------------------------------------------------

void describe('uri-reference format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'empty string',
      'valid': true,
      'value': ''
    },
    {
      'name': 'absolute URI',
      'valid': true,
      'value': 'https://example.com'
    },
    {
      'name': 'relative path',
      'valid': true,
      'value': '/path/to/resource'
    },
    {
      'name': 'fragment only',
      'valid': true,
      'value': '#section'
    },
    {
      'name': 'value with space',
      'valid': false,
      'value': 'path with space'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 42
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('uri-reference', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// uri-template
// ---------------------------------------------------------------------------

void describe('uri-template format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'URI with template variable',
      'valid': true,
      'value': 'https://example.com/{id}'
    },
    {
      'name': 'plain absolute URI',
      'valid': true,
      'value': 'https://example.com/path'
    },
    {
      'name': 'unbalanced open brace',
      'valid': false,
      'value': 'https://example.com/{id'
    },
    {
      'name': 'unbalanced close brace',
      'valid': false,
      'value': 'https://example.com/id}'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 42
    },
    {
      'name': 'space in value',
      'valid': false,
      'value': 'path with space'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('uri-template', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// iri
// ---------------------------------------------------------------------------

void describe('iri format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'https IRI',
      'valid': true,
      'value': 'https://example.com'
    },
    {
      'name': 'plain https',
      'valid': true,
      'value': 'https://example.com/path'
    },
    {
      'name': 'relative path',
      'valid': false,
      'value': '/just/a/path'
    },
    {
      'name': 'non-string',
      'valid': false,
      'value': 42
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('iri', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// iri-reference
// ---------------------------------------------------------------------------

void describe('iri-reference format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'empty string',
      'valid': true,
      'value': ''
    },
    {
      'name': 'absolute IRI',
      'valid': true,
      'value': 'https://example.com'
    },
    {
      'name': 'relative reference',
      'valid': true,
      'value': '/path'
    },
    {
      'name': 'value with space',
      'valid': false,
      'value': 'path with space'
    },
    {
      'name': 'non-string',
      'valid': false,
      'value': 99
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('iri-reference', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// json-pointer
// ---------------------------------------------------------------------------

void describe('json-pointer format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'empty string (root)',
      'valid': true,
      'value': ''
    },
    {
      'name': '/foo',
      'valid': true,
      'value': '/foo'
    },
    {
      'name': '/foo/bar',
      'valid': true,
      'value': '/foo/bar'
    },
    {
      'name': '/fo~0o (escaped tilde)',
      'valid': true,
      'value': '/fo~0o'
    },
    {
      'name': '/fo~1o (escaped slash)',
      'valid': true,
      'value': '/fo~1o'
    },
    {
      'name': 'no leading slash',
      'valid': false,
      'value': 'foo'
    },
    {
      'name': 'trailing tilde',
      'valid': false,
      'value': '/foo~'
    },
    {
      'name': 'tilde followed by 2',
      'valid': false,
      'value': '/foo~2'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 0
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('json-pointer', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// uuid
// ---------------------------------------------------------------------------

void describe('uuid format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'valid UUIDv4 lowercase',
      'valid': true,
      'value': '550e8400-e29b-41d4-a716-446655440000'
    },
    {
      'name': 'valid UUIDv4 uppercase',
      'valid': true,
      'value': '550E8400-E29B-41D4-A716-446655440000'
    },
    {
      'name': 'valid UUIDv1',
      'valid': true,
      'value': '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    },
    {
      'name': 'too short',
      'valid': false,
      'value': '550e8400-e29b-41d4-a716'
    },
    {
      'name': 'too long',
      'valid': false,
      'value': '550e8400-e29b-41d4-a716-4466554400000'
    },
    {
      'name': 'no dashes',
      'valid': false,
      'value': '550e8400e29b41d4a716446655440000'
    },
    {
      'name': 'version digit 0',
      'valid': false,
      'value': '550e8400-e29b-01d4-a716-446655440000'
    },
    {
      'name': 'version digit 9',
      'valid': false,
      'value': '550e8400-e29b-91d4-a716-446655440000'
    },
    {
      'name': 'invalid variant c',
      'valid': false,
      'value': '550e8400-e29b-41d4-c716-446655440000'
    },
    {
      'name': 'non-hex chars',
      'valid': false,
      'value': 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 550
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('uuid', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// binary (hex-encoded octets)
// ---------------------------------------------------------------------------

void describe('binary format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': '2-char hex',
      'valid': true,
      'value': 'ff'
    },
    {
      'name': '4-char hex lowercase',
      'valid': true,
      'value': 'deadbeef'
    },
    {
      'name': '4-char hex uppercase',
      'valid': true,
      'value': 'DEADBEEF'
    },
    {
      'name': 'empty string',
      'valid': false,
      'value': ''
    },
    {
      'name': 'odd length',
      'valid': false,
      'value': 'abc'
    },
    {
      'name': 'non-hex char',
      'valid': false,
      'value': 'zz'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 255
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('binary', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// byte (base64-encoded)
// ---------------------------------------------------------------------------

void describe('byte format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'empty string',
      'valid': true,
      'value': ''
    },
    {
      'name': 'base64 with padding',
      'valid': true,
      'value': 'dGVzdA=='
    },
    {
      'name': 'base64 no padding',
      'valid': true,
      'value': 'dGVz'
    },
    {
      'name': 'base64 with + and /',
      'valid': true,
      'value': 'a+b/c+d/'
    },
    {
      'name': 'two padding chars',
      'valid': true,
      'value': 'YQ=='
    },
    {
      'name': 'length not multiple of 4',
      'valid': false,
      'value': 'abc'
    },
    {
      'name': 'invalid char (!) in content',
      'valid': false,
      'value': 'dG!z'
    },
    {
      'name': 'triple padding',
      'valid': false,
      'value': 'YQ==='
    },
    {
      'name': 'X in padding position',
      'valid': false,
      'value': 'YQ=X'
    },
    {
      'name': 'number value',
      'valid': false,
      'value': 42
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('byte', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// regex
// ---------------------------------------------------------------------------

void describe('regex format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'simple pattern',
      'valid': true,
      'value': '^[a-z]+$'
    },
    {
      'name': 'empty pattern',
      'valid': true,
      'value': ''
    },
    {
      'name': 'complex pattern',
      'valid': true,
      'value': '(?:foo|bar)\\d+'
    },
    {
      'name': 'unclosed group',
      'valid': false,
      'value': '('
    },
    {
      'name': 'unclosed character class',
      'valid': false,
      'value': '[invalid'
    },
    {
      'name': 'non-string',
      'valid': false,
      'value': 42
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('regex', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// int32
// ---------------------------------------------------------------------------

void describe('int32 format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'zero',
      'valid': true,
      'value': 0
    },
    {
      'name': 'max int32',
      'valid': true,
      'value': 2_147_483_647
    },
    {
      'name': 'min int32',
      'valid': true,
      'value': -2_147_483_648
    },
    {
      'name': 'max+1 (overflow)',
      'valid': false,
      'value': 2_147_483_648
    },
    {
      'name': 'min-1 (underflow)',
      'valid': false,
      'value': -2_147_483_649
    },
    {
      'name': 'float value',
      'valid': false,
      'value': 1.5
    },
    {
      'name': 'string value',
      'valid': false,
      'value': '42'
    },
    {
      'name': 'Infinity',
      'valid': false,
      'value': Infinity
    },
    {
      'name': 'NaN',
      'valid': false,
      'value': NaN
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('int32', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// int64
// ---------------------------------------------------------------------------

void describe('int64 format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'zero',
      'valid': true,
      'value': 0
    },
    {
      'name': 'max safe integer',
      'valid': true,
      'value': Number.MAX_SAFE_INTEGER
    },
    {
      'name': 'min safe integer',
      'valid': true,
      'value': Number.MIN_SAFE_INTEGER
    },
    {
      'name': 'max safe + 1',
      'valid': false,
      'value': Number.MAX_SAFE_INTEGER + 1
    },
    {
      'name': 'min safe - 1',
      'valid': false,
      'value': Number.MIN_SAFE_INTEGER - 1
    },
    {
      'name': 'float value',
      'valid': false,
      'value': 1.5
    },
    {
      'name': 'string value',
      'valid': false,
      'value': '42'
    },
    {
      'name': 'Infinity',
      'valid': false,
      'value': Infinity
    },
    {
      'name': 'NaN',
      'valid': false,
      'value': NaN
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('int64', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// float
// ---------------------------------------------------------------------------

void describe('float format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'zero',
      'valid': true,
      'value': 0
    },
    {
      'name': 'float32-representable 1.5',
      'valid': true,
      'value': 1.5
    },
    {
      'name': 'float32-representable -1.25',
      'valid': true,
      'value': -1.25
    },
    {
      'name': 'float64-only precision',
      'valid': false,
      'value': 0.1
    },
    {
      'name': 'Infinity',
      'valid': false,
      'value': Infinity
    },
    {
      'name': '-Infinity',
      'valid': false,
      'value': -Infinity
    },
    {
      'name': 'NaN',
      'valid': false,
      'value': NaN
    },
    {
      'name': 'string value',
      'valid': false,
      'value': '1.5'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('float', value), valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// double
// ---------------------------------------------------------------------------

void describe('double format', () => {
  const scenarios: Array<{
    'name': string;
    'valid': boolean;
    'value': unknown;
  }> = [
    {
      'name': 'zero',
      'valid': true,
      'value': 0
    },
    {
      'name': 'float64 precision',
      'valid': true,
      'value': 0.1
    },
    {
      'name': 'large finite',
      'valid': true,
      'value': Number.MAX_VALUE
    },
    {
      'name': 'Infinity',
      'valid': false,
      'value': Infinity
    },
    {
      'name': '-Infinity',
      'valid': false,
      'value': -Infinity
    },
    {
      'name': 'NaN',
      'valid': false,
      'value': NaN
    },
    {
      'name': 'string value',
      'valid': false,
      'value': '1.0'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      assert.equal(check('double', value), valid, name);
    });
  }
});
