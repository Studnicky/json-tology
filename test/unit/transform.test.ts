/**
 * Transform / brand tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  JsonTology, Transform
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DateTimeSchema = {
  '$id': 'https://myapp.io/DateTime',
  'format': 'date-time',
  'type': 'string'
} as const;

const TransformedDateSchema = Transform.create(DateTimeSchema, {
  'decode': (raw: string) => {
    return new Date(raw);
  },
  'encode': (date: Date) => {
    return date.toISOString();
  }
});

const UserSchema = {
  '$id': 'https://myapp.io/User',
  'properties': {
    'name': { 'type': 'string' },
    'score': {
      'default': 0,
      'type': 'number'
    }
  },
  'required': ['name'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Transform.create()
// ---------------------------------------------------------------------------

void describe('Transform.create()', () => {
  const createScenarios: Array<{
    'check': (jt: JsonTology) => void;
    'name': string;
    'setup': () => JsonTology;
  }> = [
    {
      'check': () => {
        assert.equal(TransformedDateSchema.$id, DateTimeSchema.$id);
        assert.equal(TransformedDateSchema.type, DateTimeSchema.type);
      },
      'name': 'happy: preserves schema identity after create',
      'setup': () => {
        return JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [TransformedDateSchema] as const
        });
      }
    },
    {
      'check': (jt) => {
        const result = jt.instantiate(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');

        assert.ok(result instanceof Date);
        assert.equal((result as Date).getFullYear(), 2024);
      },
      'name': 'happy: coerce() applies decode to produce Date',
      'setup': () => {
        return JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [TransformedDateSchema] as const
        });
      }
    },
    {
      'check': (jt) => {
        assert.throws(
          () => {
            return jt.instantiate(TransformedDateSchema.$id, 'not-a-date');
          },
          (err: unknown) => {
            return (err as Error).constructor.name === 'InstantiationError';
          }
        );
      },
      'name': 'unhappy: coerce() rejects invalid data',
      'setup': () => {
        return JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [TransformedDateSchema] as const
        });
      }
    },
    {
      'check': (jt) => {
        const dateValue = new Date('2024-06-01T00:00:00.000Z');
        const wire = jt.encode(TransformedDateSchema, dateValue);

        assert.equal(wire, '2024-06-01T00:00:00.000Z');
      },
      'name': 'happy: encode() converts back to wire format',
      'setup': () => {
        return JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [TransformedDateSchema] as const
        });
      }
    },
    {
      'check': (jt) => {
        const val = {
          'name': 'Alice',
          'score': 42
        };
        // @ts-expect-error -- UserSchema has no transform, passing it to test runtime behaviour
        const passthrough = jt.encode(UserSchema as unknown, val);

        assert.deepEqual(passthrough, val);
      },
      'name': 'edge: encode() returns value unchanged for non-transformed schemas',
      'setup': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [TransformedDateSchema] as const
        });

        jt.register(UserSchema);

        return jt;
      }
    },
    {
      'check': (jt) => {
        const parsed = jt.instantiate('https://myapp.io/Identity', 'unchanged');

        assert.equal(parsed, 'unchanged');
      },
      'name': 'edge: identity transform decode/encode round-trips unchanged',
      'setup': () => {
        const IdentitySchema = Transform.create(
          {
            '$id': 'https://myapp.io/Identity',
            'type': 'string'
          } as const,
          {
            'decode': (raw: string) => {
              return raw;
            },
            'encode': (val: string) => {
              return val;
            }
          }
        );

        return JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [IdentitySchema] as const
        });
      }
    }
  ];

  for (const {
    'check': check, 'name': name, 'setup': setup
  } of createScenarios) {
    void it(name, () => {
      const jt = setup();

      check(jt);
    });
  }
});

// ---------------------------------------------------------------------------
// Transform.brand()
// ---------------------------------------------------------------------------

void describe('Transform.brand()', () => {
  const brandScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const UserIdSchema = Transform.brand(
          {
            '$id': 'https://myapp.io/UserId',
            'type': 'string'
          } as const,
          'UserId'
        );

        assert.equal(UserIdSchema.$id, 'https://myapp.io/UserId');
        assert.equal(UserIdSchema.type, 'string');
      },
      'name': 'happy: preserves schema $id and type'
    },
    {
      'check': () => {
        const UserIdSchema2 = Transform.brand(
          {
            '$id': 'https://myapp.io/UserId2',
            'type': 'string'
          } as const,
          'UserId'
        );
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        jt.register(UserIdSchema2);
        assert.equal(jt.validate(UserIdSchema2.$id, 'abc').length, 0);

        const wrongTypeErrors = jt.validate(UserIdSchema2.$id, 123);

        assert.equal(wrongTypeErrors.length, 1);
        assert.equal(wrongTypeErrors.items[0]?.keyword, 'type');
        assert.match(wrongTypeErrors.items[0]?.message ?? '', /must be string/u);
      },
      'name': 'happy: branded schema validates correct type and rejects wrong type'
    },
    {
      'check': () => {
        const ConstrainedId = Transform.brand(
          {
            '$id': 'https://myapp.io/ConstrainedId',
            'minLength': 3,
            'type': 'string'
          } as const,
          'ConstrainedId'
        );
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        jt.register(ConstrainedId);
        assert.equal(jt.validate(ConstrainedId.$id, 'abc').length, 0);

        const tooShortErrors = jt.validate(ConstrainedId.$id, 'ab');

        assert.equal(tooShortErrors.length, 1);
        assert.equal(tooShortErrors.items[0]?.keyword, 'minLength');
        assert.match(tooShortErrors.items[0]?.message ?? '', /at least 3 characters/u);
      },
      'name': 'edge: brand preserves validation constraints from base schema'
    }
  ];

  for (const {
    'check': check, 'name': name
  } of brandScenarios) {
    void it(name, () => {
      check();
    });
  }
});

// ---------------------------------------------------------------------------
// Transform contract alignment
// ---------------------------------------------------------------------------

void describe('Transform contract alignment', () => {
  const contractScenarios: Array<{
    'check': (jt: JsonTology) => void;
    'name': string;
  }> = [
    {
      'check': (jt) => {
        const parsed = jt.instantiate(TransformedDateSchema.$id, '2024-06-01T00:00:00.000Z');

        assert.ok(parsed instanceof Date);
        assert.equal((parsed as Date).toISOString(), '2024-06-01T00:00:00.000Z');
      },
      'name': 'happy: coerce() returns decoded output'
    },
    {
      'check': (jt) => {
        const materialized = jt.materialize(TransformedDateSchema, '2024-06-01T00:00:00.000Z');

        assert.equal(typeof materialized, 'string');
        assert.equal(materialized, '2024-06-01T00:00:00.000Z');
      },
      'name': 'happy: materialize() returns wire-form, not decoded'
    },
    {
      'check': (jt) => {
        const wire = jt.encode(TransformedDateSchema, new Date('2024-06-01T00:00:00.000Z'));

        assert.equal(typeof wire, 'string');
        assert.equal(wire, '2024-06-01T00:00:00.000Z');
      },
      'name': 'happy: encode() returns wire-form'
    },
    {
      'check': (jt) => {
        const userResult = jt.materialize(UserSchema, { 'name': 'Alice' });

        assert.deepEqual(userResult, {
          'name': 'Alice',
          'score': 0
        });
      },
      'name': 'happy: materialize() works for non-transformed schemas'
    }
  ];

  const jt = JsonTology.create({
    'baseIRI': 'https://myapp.io',
    'schemas': [
      TransformedDateSchema,
      UserSchema
    ] as const
  });

  for (const {
    'check': check, 'name': name
  } of contractScenarios) {
    void it(name, () => {
      check(jt);
    });
  }
});

// ---------------------------------------------------------------------------
// Transform.pipe()
// ---------------------------------------------------------------------------

void describe('Transform.pipe()', () => {
  const pipeScenarios: Array<{
    'expectedDecode': string;
    'expectedEncode': string;
    'input': string;
    'name': string;
    'transforms': Array<{ 'decode': (v: string) => string;
      'encode': (v: string) => string }>;
  }> = [
    {
      'expectedDecode': 'HELLO',
      'expectedEncode': ' hello ',
      'input': '  hello  ',
      'name': 'happy: composes decode left-to-right and encode right-to-left',
      'transforms': [
        {
          'decode': (value: string) => {
            return value.trim();
          },
          'encode': (value: string) => {
            return ` ${value} `;
          }
        },
        {
          'decode': (value: string) => {
            return value.toUpperCase();
          },
          'encode': (value: string) => {
            return value.toLowerCase();
          }
        }
      ]
    },
    {
      'expectedDecode': 'HELLO',
      'expectedEncode': 'hello',
      'input': 'hello',
      'name': 'edge: pipe with single transform behaves like create',
      'transforms': [{
        'decode': (value: string) => {
          return value.toUpperCase();
        },
        'encode': (value: string) => {
          return value.toLowerCase();
        }
      }]
    },
    {
      'expectedDecode': 'unchanged',
      'expectedEncode': 'unchanged',
      'input': 'unchanged',
      'name': 'edge: pipe with identity transforms preserves value',
      'transforms': [
        {
          'decode': (value: string) => {
            return value;
          },
          'encode': (value: string) => {
            return value;
          }
        },
        {
          'decode': (value: string) => {
            return value;
          },
          'encode': (value: string) => {
            return value;
          }
        }
      ]
    }
  ];

  for (const {
    'expectedDecode': expectedDecode, 'expectedEncode': expectedEncode, 'input': input, 'name': name, 'transforms': transforms
  } of pipeScenarios) {
    void it(name, () => {
      const PipeSchema = {
        '$id': 'https://myapp.io/PipeTest',
        'type': 'string'
      } as const;

      const piped = Transform.pipe(PipeSchema, transforms);

      assert.equal(piped.$id, PipeSchema.$id);

      const jt = JsonTology.create({
        'baseIRI': 'https://myapp.io',
        'schemas': [piped] as const
      });

      const parsed = jt.instantiate(piped.$id, input);

      assert.equal(parsed, expectedDecode);

      const wire = jt.encode(piped, expectedDecode);

      assert.equal(wire, expectedEncode);
    });
  }
});
