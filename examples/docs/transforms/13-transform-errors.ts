/**
 * Transform errors — Example: DecodeError, EncodeError, CoercionError
 * Demonstrates: typed error handling for decode/encode failures and value.cast
 *
 * Three scenarios from Coreander's antiquariat:
 *   a. A decode transform rejects a malformed placement timestamp → DecodeError.
 *   b. A custom decoder throws its own DecodeError → library preserves the instance.
 *   c. An encode transform throws → EncodeError caught from jt.encode.
 *   d. value.cast on data that cannot satisfy the schema → CoercionError.
 */

import {
  CoercionError,
  DecodeError,
  EncodeError,
  Transform,
  TransformError
} from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// ─── a. Decode transform rejects bad input → DecodeError ────────────────────

const StrictDateSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/StrictDate',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (raw: string) => {
      const ms = Date.parse(raw);

      if (Number.isNaN(ms)) {
        throw new TypeError(`Not a valid date string: "${raw}"`);
      }

      return new Date(ms).toISOString();
    },
    'encode': (isoString: string) => {
      return isoString;
    }
  }
);

jt.set(StrictDateSchema);

try {
  jt.instantiate(StrictDateSchema, 'not-a-date');
} catch (error) {
  if (error instanceof DecodeError) {
    console.log('a. DecodeError caught');
    console.log('   code      :', error.code);
    console.log('   direction :', error.direction);
    console.log('   cause     :', error.cause?.message);
  }
}

// ─── b. Custom decoder throws DecodeError → instance preserved ───────────────

const AnnotatedDateSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/AnnotatedDate',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (raw: string) => {
      if (!raw.startsWith('19') && !raw.startsWith('20')) {
        throw new DecodeError('Year out of antiquariat range', { 'path': '/placedAt' });
      }

      return new Date(raw).toISOString();
    },
    'encode': (isoString: string) => {
      return isoString;
    }
  }
);

jt.set(AnnotatedDateSchema);

try {
  jt.instantiate(AnnotatedDateSchema, '1800-01-01T00:00:00Z');
} catch (error) {
  if (error instanceof DecodeError) {
    console.log('b. Custom DecodeError preserved');
    console.log('   message   :', error.message);
    console.log('   path      :', error.path);
    console.log('   is TransformError:', error instanceof TransformError);
  }
}

// ─── c. Encode transform throws → EncodeError ───────────────────────────────

const GuardedEncodeSchema = Transform.create(
  {
    '$id': 'https://bookstore.example/GuardedEncode',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (raw: string) => {
      return new Date(raw).toISOString();
    },
    'encode': (isoString: string) => {
      const date = new Date(isoString);

      if (date.getFullYear() < 1900) {
        throw new Error('Cannot encode dates before 1900 to wire format');
      }

      return isoString;
    }
  }
);

jt.set(GuardedEncodeSchema);

const ancientDate = '1879-01-01T00:00:00Z';

try {
  jt.encode(GuardedEncodeSchema, ancientDate);
} catch (error) {
  if (error instanceof EncodeError) {
    console.log('c. EncodeError caught');
    console.log('   code      :', error.code);
    console.log('   direction :', error.direction);
    console.log('   cause     :', error.cause?.message);
  }
}

// ─── d. value.cast on uncoercible data → CoercionError ──────────────────────

// BookSchema requires 'title', 'isbn', 'authors', 'price', 'printStatus'.
// Passing an empty object fails coercion.
try {
  jt.value.cast(BookSchema.$id, {});
} catch (error) {
  if (error instanceof CoercionError) {
    console.log('d. CoercionError caught');
    console.log('   code         :', error.code);
    console.log('   errors.length:', error.errors.items.length);
  }
}
