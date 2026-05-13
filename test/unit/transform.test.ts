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
// Transform.chain()
// ---------------------------------------------------------------------------

void describe('Transform.chain()', () => {
  const chainScenarios: Array<{
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
      'name': 'edge: chain with single transform behaves like create',
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
      'name': 'edge: chain with identity transforms preserves value',
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
  } of chainScenarios) {
    void it(name, () => {
      const ChainSchema = {
        '$id': 'https://myapp.io/ChainTest',
        'type': 'string'
      } as const;

      const chained = Transform.chain(ChainSchema, transforms);

      assert.equal(chained.$id, ChainSchema.$id);

      const jt = JsonTology.create({
        'baseIRI': 'https://myapp.io',
        'schemas': [chained] as const
      });

      const parsed = jt.instantiate(chained.$id, input);

      assert.equal(parsed, expectedDecode);

      const wire = jt.encode(chained, expectedDecode);

      assert.equal(wire, expectedEncode);
    });
  }
});

// ---------------------------------------------------------------------------
// Transform bad paths — encoder/decoder throw, empty chain
// ---------------------------------------------------------------------------

void describe('Transform bad paths', () => {
  // --- decoder throws ---
  void it('unhappy: decoder that throws propagates as InstantiationError(TRANSFORM_DECODE_FAILED)', () => {
    const BoomDecodeSchema = {
      '$id': 'https://myapp.io/BoomDecode',
      'type': 'string'
    } as const;

    const transformed = Transform.create(BoomDecodeSchema, {
      'decode': (_: string) => {
        throw new Error('decode boom');
      },
      'encode': (val: string) => {
        return val;
      }
    });

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [transformed] as const
    });

    assert.throws(
      () => {
        jt.instantiate(transformed.$id, 'hello');
      },
      (err: unknown) => {
        assert.equal((err as Error).constructor.name, 'InstantiationError', `expected InstantiationError, got ${(err as Error).constructor.name}`);
        assert.equal((err as { 'code': string }).code, 'TRANSFORM_DECODE_FAILED');
        assert.ok((err as Error).message.includes('decode boom'));

        return true;
      }
    );
  });

  void it('unhappy: decoder throws on specific input but not others', () => {
    const PartialDecodeSchema = {
      '$id': 'https://myapp.io/PartialDecode',
      'type': 'string'
    } as const;

    const transformed = Transform.create(PartialDecodeSchema, {
      'decode': (raw: string) => {
        if (raw === 'bad') {
          throw new Error('bad input rejected');
        }

        return raw.toUpperCase();
      },
      'encode': (val: string) => {
        return val.toLowerCase();
      }
    });

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [transformed] as const
    });

    // Valid input succeeds
    const result = jt.instantiate(transformed.$id, 'hello');

    assert.equal(result, 'HELLO');

    // Bad input throws InstantiationError
    assert.throws(
      () => {
        jt.instantiate(transformed.$id, 'bad');
      },
      (err: unknown) => {
        assert.equal((err as Error).constructor.name, 'InstantiationError');
        assert.equal((err as { 'code': string }).code, 'TRANSFORM_DECODE_FAILED');

        return true;
      }
    );
  });

  // --- encoder throws ---
  void it('unhappy: encoder that throws propagates the raw error (not wrapped)', () => {
    const BoomEncodeSchema = {
      '$id': 'https://myapp.io/BoomEncode',
      'type': 'string'
    } as const;

    const transformed = Transform.create(BoomEncodeSchema, {
      'decode': (raw: string) => {
        return raw;
      },
      'encode': (_: string) => {
        throw new Error('encode boom');
      }
    });

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [transformed] as const
    });

    // BEHAVIOURAL NOTE: encoder throws propagate as the raw Error, not wrapped in
    // an InstantiationError. This differs from decoder failures.
    assert.throws(
      () => {
        jt.encode(transformed, 'some-value');
      },
      (err: unknown) => {
        assert.ok(err instanceof Error, `expected Error, got ${String(err)}`);
        assert.ok((err).message.includes('encode boom'));

        return true;
      }
    );
  });

  // --- non-pure encoder (different shape on consecutive calls) ---
  void it('edge: non-pure encoder produces different output on consecutive calls', () => {
    let callCount = 0;
    const NoPureSchema = {
      '$id': 'https://myapp.io/NoPure',
      'type': 'string'
    } as const;

    const transformed = Transform.create(NoPureSchema, {
      'decode': (raw: string) => {
        return raw;
      },
      'encode': (val: string) => {
        callCount++;

        return `${val}-${callCount}`;
      }
    });

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [transformed] as const
    });

    const enc1 = jt.encode(transformed, 'test');
    const enc2 = jt.encode(transformed, 'test');

    // Non-pure encoder: outputs differ
    assert.notEqual(enc1, enc2);
    assert.equal(enc1, 'test-1');
    assert.equal(enc2, 'test-2');
  });

  // --- empty chain (zero transforms) ---
  void it('edge: Transform.chain with empty array is an identity transform (decode and encode pass-through)', () => {
    const IdentityChainSchema = {
      '$id': 'https://myapp.io/IdentityChain',
      'type': 'string'
    } as const;

    const chained = Transform.chain(IdentityChainSchema, []);

    // Schema identity is preserved
    assert.equal(chained.$id, IdentityChainSchema.$id);
    assert.equal(chained.type, IdentityChainSchema.type);

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [chained] as const
    });

    // Decode: passes value through unchanged
    const decoded = jt.instantiate(chained.$id, 'unchanged');

    assert.equal(decoded, 'unchanged');

    // Encode: passes value through unchanged
    const encoded = jt.encode(chained, 'also-unchanged');

    assert.equal(encoded, 'also-unchanged');
  });

  void it('edge: empty chain registers a decoder that is retrievable via getDecoder', () => {
    const EmptyChainSchema = {
      '$id': 'https://myapp.io/EmptyChain',
      'type': 'string'
    } as const;

    Transform.chain(EmptyChainSchema, []);

    const fns = Transform.getDecoder(EmptyChainSchema);

    assert.ok(fns !== undefined, 'getDecoder should return functions for empty chain');
    assert.equal(typeof fns.decode, 'function');
    assert.equal(typeof fns.encode, 'function');

    // Identity semantics: decode and encode are both pass-through
    assert.equal(fns.decode('input-value'), 'input-value');
    assert.equal(fns.encode('output-value'), 'output-value');
  });
});
