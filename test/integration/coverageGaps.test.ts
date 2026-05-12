/**
 * Phase 4 — public-API coverage gaps
 *
 * Covers failure modes and boundary conditions identified in
 * .audits/test-consolidation-2026-05.md §5:
 *   1. dump / dumpJson failure modes
 *   2. encode end-to-end (chained transforms, identity, nested)
 *   3. toQuads / fromQuads boundaries (undefined, null, cyclic, empty, missing types)
 *   4. subschemaAt pointer errors
 *   5. Static-counterpart failure modes
 *   6. Computed / Invariant lifecycle (add/remove, override, throwing)
 *   7. Recursive ref depth limits + maxSchemaDepth
 *   8. Mutual recursion graphs
 *   9. Mixed-tuple registration order
 *  10. Type-cast failures with enableTypeCast
 *  11. Default propagation through nested $refs
 *  12. Transform decode errors at root-level coercion
 *  13. findDuplicates against structurally-identical-but-IRI-distinct nodes
 *  14. Compose.equivalent chain transitivity (TBox quad emission)
 *  15. Mixed $defs + cross-schema $ref
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  Compose,
  GraphError,
  InstantiationError,
  JsonTology,
  MaterializationError,
  SchemaError,
  Skolemize,
  Transform
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Bookstore fixtures (used across multiple sections)
// ---------------------------------------------------------------------------

const IsbnSchema = {
  '$id': 'https://bookstore.io/Isbn',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

const AuthorSchema = {
  '$id': 'https://bookstore.io/Author',
  'properties': {
    'id': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const BookSchema = {
  '$id': 'https://bookstore.io/Book',
  'properties': {
    'author': { '$ref': 'https://bookstore.io/Author' },
    'isbn': { '$ref': 'https://bookstore.io/Isbn' },
    'title': { 'type': 'string' }
  },
  'required': [
    'title',
    'isbn'
  ],
  'type': 'object'
} as const;

const CustomerSchema = {
  '$id': 'https://bookstore.io/Customer',
  'properties': {
    'addresses': {
      'default': [],
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const OrderSchema = {
  '$id': 'https://bookstore.io/Order',
  'properties': {
    'customer': { '$ref': 'https://bookstore.io/Customer' },
    'orderId': { 'type': 'string' }
  },
  'required': [
    'orderId',
    'customer'
  ],
  'type': 'object'
} as const;

// ===========================================================================
// 1. dump / dumpJson failure modes
// ===========================================================================

void describe('dump / dumpJson failure modes', () => {
  void it('GBU: dump error paths — no $id throws SchemaError, unregistered throws GraphError REF_UNRESOLVED, encoder throw propagates', () => {
    // no $id
    {
      const jt = JsonTology.create({ 'baseIRI': 'https://bookstore.io' });

      assert.throws(
        () => {
          return jt.dump(null as unknown as { '$id': string }, { 'name': 'x' });
        },
        (err: unknown) => {
          return err instanceof SchemaError;
        }
      );
    }

    // unregistered $id
    {
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [AuthorSchema] as const
      });

      assert.throws(
        () => {
          return jt.dump('https://bookstore.io/Unknown', { 'name': 'x' });
        },
        (err: unknown) => {
          return err instanceof GraphError && (err).code === 'REF_UNRESOLVED';
        }
      );
    }

    // encoder throw propagates
    {
      const ExplosiveSchema = Transform.create(
        {
          '$id': 'https://bookstore.io/Explosive',
          'type': 'string'
        } as const,
        {
          'decode': (raw: string) => {
            return raw;
          },
          'encode': () => {
            throw new Error('encoder boom');
          }
        }
      );
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [ExplosiveSchema] as const
      });

      assert.throws(
        () => {
          return jt.dump(ExplosiveSchema.$id, 'value');
        },
        (err: unknown) => {
          return err instanceof Error && err.message.includes('encoder boom');
        }
      );
    }
  });

  void it('dumpJson produces valid JSON and throws TypeError for non-serializable BigInt', () => {
    // valid JSON string output
    {
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [AuthorSchema] as const
      });
      const out = jt.dumpJson(AuthorSchema.$id, {
        'id': 'a-1',
        'name': 'Asimov'
      });
      const parsed = JSON.parse(out) as Record<string, unknown>;

      assert.equal(parsed.name, 'Asimov');
      assert.equal(parsed.id, 'a-1');
    }

    // BigInt throws TypeError
    {
      const BigIntSchema = {
        '$id': 'https://bookstore.io/Bigint',
        'type': 'number'
      } as const;
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [BigIntSchema] as const
      });

      assert.throws(
        () => {
          return jt.dumpJson(BigIntSchema.$id, BigInt(10) as unknown as number);
        },
        TypeError
      );
    }
  });
});

// ===========================================================================
// 2. encode end-to-end (isolated, not just round-trip)
// ===========================================================================

void describe('encode — isolated behaviour', () => {
  const TimestampSchema = Transform.create(
    {
      '$id': 'https://bookstore.io/Timestamp',
      'format': 'date-time',
      'type': 'string'
    } as const,
    {
      'decode': (raw: string) => {
        return new Date(raw);
      },
      'encode': (value: Date) => {
        return value.toISOString();
      }
    }
  );

  void it('encode through chained Transform.pipe runs encoders in reverse order', () => {
    const ChainedSchema = Transform.pipe(
      {
        '$id': 'https://bookstore.io/Chained',
        'type': 'string'
      } as const,
      [
        {
          'decode': (raw: string) => {
            return raw.trim();
          },
          'encode': (raw: string) => {
            return ` ${raw} `;
          }
        },
        {
          'decode': (raw: string) => {
            return raw.toUpperCase();
          },
          'encode': (raw: string) => {
            return raw.toLowerCase();
          }
        }
      ]
    );
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [ChainedSchema] as const
    });

    // Decode: trim → upper. So "  hi  " → "HI".
    // Encode: lower → wrap-spaces. So "HI" → "hi" → " hi ".
    const decoded = jt.instantiate(ChainedSchema.$id, '  hi  ');

    assert.equal(decoded, 'HI');

    const encoded = jt.encode(ChainedSchema, 'HI');

    assert.equal(encoded, ' hi ');
  });

  void it('encode identity, decoder delegation, and cross-$ref decoder application', () => {
    // identity: no transform → input unchanged
    {
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [AuthorSchema] as const
      });
      const value = {
        'id': 'a-1',
        'name': 'Asimov'
      };
      // @ts-expect-error -- AuthorSchema has no transform; runtime falls through to identity.
      const result = jt.encode(AuthorSchema as unknown, value);

      assert.deepStrictEqual(result, value);
    }

    // delegates to Transform encoder
    {
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [TimestampSchema] as const
      });
      const wire = jt.encode(TimestampSchema, new Date('2026-01-01T00:00:00.000Z'));

      assert.equal(wire, '2026-01-01T00:00:00.000Z');
    }

    // cross-$ref decoder applied at instantiate time
    {
      const ParentSchema = {
        '$id': 'https://bookstore.io/EventLog',
        'properties': {
          'occurredAt': { '$ref': 'https://bookstore.io/Timestamp' },
          'subject': { 'type': 'string' }
        },
        'required': [
          'occurredAt',
          'subject'
        ],
        'type': 'object'
      } as const;
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [
          TimestampSchema,
          ParentSchema
        ] as const
      });
      const decoded = jt.instantiate(ParentSchema.$id, {
        'occurredAt': '2026-01-01T00:00:00.000Z',
        'subject': 'login'
      }) as Record<string, unknown>;

      assert.equal(decoded.subject, 'login');
      assert.ok(decoded.occurredAt instanceof Date);
      assert.equal((decoded.occurredAt).toISOString(), '2026-01-01T00:00:00.000Z');
    }
  });
});

// ===========================================================================
// 3. toQuads / fromQuads boundaries
// ===========================================================================

void describe('toQuads / fromQuads boundaries', () => {
  void it('fromQuads on empty array returns an empty array', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [AuthorSchema] as const
    });
    const lifted = jt.fromQuads(AuthorSchema.$id, []);

    assert.deepStrictEqual(lifted, []);
  });

  void it('fromQuads on quads with no rdf:type triple yields no instances', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [AuthorSchema] as const
    });
    const stray = [{
      'object': {
        'termType': 'Literal' as const,
        'value': 'Asimov'
      },
      'predicate': 'https://bookstore.io/Author/name',
      'subject': 'https://bookstore.io/Author/instances/anon'
    }];
    const lifted = jt.fromQuads(AuthorSchema.$id, stray);

    assert.deepStrictEqual(lifted, []);
  });

  void it('fromQuads against an unregistered schema throws SchemaError SCHEMA_NOT_REGISTERED', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://bookstore.io' });

    assert.throws(
      () => {
        return jt.fromQuads('https://bookstore.io/NotRegistered', []);
      },
      (err: unknown) => {
        return err instanceof SchemaError
          && (err).code === 'SCHEMA_NOT_REGISTERED'
          && err.message.includes('not registered');
      }
    );
  });

  void it('toQuads with iriFor from Skolemize.wellKnownGenid produces .well-known/genid IRIs', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [AuthorSchema] as const
    });
    const quads = jt.toQuads(
      AuthorSchema,
      { 'name': 'Asimov' },
      { 'iriFor': Skolemize.wellKnownGenid('https://bookstore.io') }
    );

    assert.ok(quads.length > 0);
    for (const quad of quads) {
      assert.match(quad.subject, /\/\.well-known\/genid\//u);
    }
  });

  void it('toQuads with cyclic data structure throws MaterializationError CYCLIC_DATA', () => {
    const SelfRefSchema = {
      '$id': 'https://bookstore.io/Node',
      'properties': {
        'label': { 'type': 'string' },
        'next': { '$ref': 'https://bookstore.io/Node' }
      },
      'required': ['label'],
      'type': 'object'
    } as const;
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [SelfRefSchema] as const
    });

    interface NodeData { 'label': string;
      'next'?: NodeData }
    const cycle: NodeData = { 'label': 'a' };

    cycle.next = cycle;

    assert.throws(
      () => {
        return jt.toQuads(SelfRefSchema, cycle);
      },
      (err: unknown) => {
        return err instanceof MaterializationError && (err).code === 'CYCLIC_DATA';
      }
    );
  });

  void it('toQuads with iriFor returning a constant collides; same subject reused for distinct objects', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [
        BookSchema,
        AuthorSchema,
        IsbnSchema
      ] as const
    });
    const quads = jt.toQuads(
      BookSchema,
      {
        'author': { 'name': 'Asimov' },
        'isbn': '9780306406157',
        'title': 'Foundation'
      },
      {
        'iriFor': () => {
          return 'https://bookstore.io/SAME';
        }
      }
    );

    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    // Documented collision: every object subject collapses to the constant.
    assert.equal(subjects.size, 1);
    assert.ok(subjects.has('https://bookstore.io/SAME'));
  });
});

// ===========================================================================
// 4. subschemaAt pointer errors
// ===========================================================================

void describe('subschemaAt pointer errors', () => {
  const PARENT = {
    '$id': 'https://bookstore.io/Parent',
    'properties': {
      'inner': {
        'properties': { 'leaf': { 'type': 'string' } },
        'type': 'object'
      },
      'tag': { 'type': 'string' }
    },
    'type': 'object'
  } as const;

  void it('GBU: invalid pointer throws, not-found throws, empty returns root, nested resolves', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [PARENT] as const
    });

    // invalid pointer (no leading slash)
    assert.throws(
      () => {
        return jt.subschemaAt(PARENT.$id, 'properties/tag');
      },
      (err: unknown) => {
        return err instanceof GraphError && (err).code === 'POINTER_INVALID';
      }
    );

    // pointer to non-existent path
    assert.throws(
      () => {
        return jt.subschemaAt(PARENT.$id, '/properties/missing');
      },
      (err: unknown) => {
        return err instanceof GraphError && (err).code === 'POINTER_NOT_FOUND';
      }
    );

    // empty pointer returns root
    const root = jt.subschemaAt(PARENT.$id, '');

    assert.equal(root.$id, `${PARENT.$id}#`);

    // nested pointer resolves sub-schema
    const inner = jt.subschemaAt(PARENT.$id, '/properties/inner');

    assert.equal((inner as { 'type': string }).type, 'object');
    assert.equal(inner.$id, `${PARENT.$id}#/properties/inner`);
  });
});

// ===========================================================================
// 5. Static-counterpart failure modes
// ===========================================================================

void describe('static counterparts — failure modes', () => {
  void it('JsonTology.instantiate wraps a Transform decoder error as InstantiationError TRANSFORM_DECODE_FAILED', () => {
    const ExplodingSchema = Transform.create(
      {
        '$id': 'urn:test:Exploding',
        'type': 'string'
      } as const,
      {
        'decode': () => {
          throw new Error('decoder failure');
        },
        'encode': (raw: string) => {
          return raw;
        }
      }
    );

    assert.throws(
      () => {
        return JsonTology.instantiate(ExplodingSchema, 'whatever');
      },
      (err: unknown) => {
        return err instanceof InstantiationError
          && err.code === 'TRANSFORM_DECODE_FAILED'
          && err.cause instanceof Error
          && err.cause.message === 'decoder failure';
      }
    );
  });

  void it('static methods: toQuads wellKnown IRIs, validate/is/instantiate ephemeral, REF_UNRESOLVED lazy, subschemaAt, toSchema, dump encoder throw', () => {
    // toQuads with wellKnownGenid
    {
      const quads = JsonTology.toQuads(AuthorSchema, { 'name': 'Asimov' }, { 'iriFor': Skolemize.wellKnownGenid('https://bookstore.io') });

      assert.ok(quads.length > 0);
      for (const quad of quads) {
        assert.match(quad.subject, /\/\.well-known\/genid\//u);
      }
    }

    // validate, is, instantiate without prior create()
    {
      assert.equal(JsonTology.validate(AuthorSchema, { 'name': 'Asimov' }).length, 0);
      assert.equal(JsonTology.is(AuthorSchema, { 'name': 'Asimov' }), true);
      assert.deepStrictEqual(JsonTology.instantiate(AuthorSchema, { 'name': 'Asimov' }), { 'name': 'Asimov' });
    }

    // unregistered cross-schema $ref throws REF_UNRESOLVED lazily on first use
    {
      const Standalone = {
        '$id': 'urn:test:Standalone',
        'properties': { 'ref': { '$ref': 'urn:test:NotInRegistry' } },
        'type': 'object'
      } as const;
      const jt = JsonTology.create({
        'baseIRI': 'urn:test:',
        'schemas': [Standalone] as const
      });

      assert.throws(
        () => {
          return jt.validate(Standalone.$id, { 'ref': { 'x': 1 } });
        },
        (err: unknown) => {
          return err instanceof GraphError && (err).code === 'REF_UNRESOLVED';
        }
      );
    }

    // subschemaAt with invalid pointer throws GraphError
    assert.throws(
      () => {
        return JsonTology.subschemaAt(AuthorSchema, 'no-leading-slash');
      },
      (err: unknown) => {
        return err instanceof GraphError;
      }
    );

    // toSchema returns graph-derived object
    {
      const result = JsonTology.toSchema(AuthorSchema);

      assert.ok(result !== undefined);
      assert.equal((result as { '$id': string }).$id, AuthorSchema.$id);
    }

    // dump with throwing encoder propagates error
    {
      const ExplosiveSchema = Transform.create(
        {
          '$id': 'urn:test:StaticExplosive',
          'type': 'string'
        } as const,
        {
          'decode': (raw: string) => {
            return raw;
          },
          'encode': () => {
            throw new Error('static encoder boom');
          }
        }
      );

      assert.throws(
        () => {
          return JsonTology.dump(ExplosiveSchema, 'value');
        },
        (err: unknown) => {
          return err instanceof Error && err.message.includes('static encoder boom');
        }
      );
    }
  });
});

// ===========================================================================
// 6. Computed / Invariant lifecycle
// ===========================================================================

void describe('Computed / Invariant lifecycle', () => {
  const ComputedSchema = {
    '$id': 'urn:lifecycle:Computed',
    'properties': {
      'derived': {
        'jt:computed': true,
        'type': 'number'
      },
      'value': { 'type': 'number' }
    },
    'required': ['value'],
    'type': 'object'
  } as const;

  void it('GBU: addComputed/removeComputed, addComputed override, invariant throw, removeInvariant no-op, default-then-computed', () => {
    // addComputed then removeComputed
    {
      const jt = JsonTology.create({
        'baseIRI': 'urn:lifecycle:',
        'computeds': {
          'urn:lifecycle:Computed': {
            'derived': (data: Record<string, unknown>) => {
              return (data.value as number) * 2;
            }
          }
        },
        'schemas': [ComputedSchema] as const
      });
      const before = jt.instantiate(ComputedSchema.$id, { 'value': 3 }) as Record<string, unknown>;

      assert.equal(before.derived, 6, 'computed field present before removeComputed');
      jt.removeComputed(ComputedSchema.$id, 'derived');
      const after = jt.instantiate(ComputedSchema.$id, { 'value': 3 }) as Record<string, unknown>;

      assert.ok(!('derived' in after) || after.derived === undefined, 'derived absent after removeComputed');
    }

    // addComputed override
    {
      const jt = JsonTology.create({
        'baseIRI': 'urn:lifecycle:',
        'computeds': {
          'urn:lifecycle:Computed': {
            'derived': () => {
              return 1;
            }
          }
        },
        'schemas': [ComputedSchema] as const
      });

      jt.addComputed(ComputedSchema.$id, 'derived', () => {
        return 99;
      });
      assert.equal((jt.instantiate(ComputedSchema.$id, { 'value': 1 }) as Record<string, unknown>).derived, 99, 'second addComputed overrides first');
    }

    // addInvariant that throws
    {
      const Schema = {
        '$id': 'urn:lifecycle:InvariantThrow',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      } as const;
      const jt = JsonTology.create({
        'baseIRI': 'urn:lifecycle:',
        'schemas': [Schema] as const
      });

      jt.addInvariant(Schema.$id, {
        'fn': () => {
          throw new Error('invariant boom');
        },
        'name': 'thrower'
      });
      assert.throws(
        () => {
          return jt.instantiate(Schema.$id, { 'name': 'x' });
        },
        (err: unknown) => {
          return err instanceof Error && /invariant boom|invariant/u.test(err.message);
        }
      );
    }

    // removeInvariant no-op
    {
      const Schema = {
        '$id': 'urn:lifecycle:NoOp',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      } as const;
      const jt = JsonTology.create({
        'baseIRI': 'urn:lifecycle:',
        'schemas': [Schema] as const
      });

      assert.doesNotThrow(() => {
        jt.removeInvariant(Schema.$id, 'never-registered');
      });
      assert.equal(jt.validate(Schema.$id, { 'name': 'x' }).length, 0, 'validation still passes after no-op removeInvariant');
    }

    // default applies first, then computed
    {
      const Schema = {
        '$id': 'urn:lifecycle:DefaultThenCompute',
        'properties': {
          'base': {
            'default': 10,
            'type': 'number'
          },
          'doubled': {
            'jt:computed': true,
            'type': 'number'
          }
        },
        'type': 'object'
      } as const;
      const jt = JsonTology.create({
        'baseIRI': 'urn:lifecycle:',
        'computeds': {
          'urn:lifecycle:DefaultThenCompute': {
            'doubled': (data: Record<string, unknown>) => {
              return (data.base as number) * 2;
            }
          }
        },
        'schemas': [Schema] as const
      });
      const result = jt.instantiate(Schema.$id, {}) as Record<string, unknown>;

      assert.equal(result.base, 10, 'default applied');
      assert.equal(result.doubled, 20, 'computed ran on defaulted value');
    }
  });
});

// ===========================================================================
// 7. Mutual recursion graphs (renumbered from §8 after §7 moved to unit tier)
// ===========================================================================

void describe('Mutual recursion graphs', () => {
  void it('A → B → A terminates without infinite loop', () => {
    const NodeA = {
      '$id': 'urn:mutual:A',
      'properties': {
        'b': { '$ref': 'urn:mutual:B' },
        'tag': { 'type': 'string' }
      },
      'required': ['tag'],
      'type': 'object'
    } as const;
    const NodeB = {
      '$id': 'urn:mutual:B',
      'properties': {
        'a': { '$ref': 'urn:mutual:A' },
        'tag': { 'type': 'string' }
      },
      'required': ['tag'],
      'type': 'object'
    } as const;
    const jt = JsonTology.create({
      'baseIRI': 'urn:mutual:',
      'maxSchemaDepth': 50,
      'schemas': [
        NodeA,
        NodeB
      ] as const
    });

    const data = {
      'b': {
        'a': {
          'b': {
            'a': { 'tag': 'inner' },
            'tag': 'b2'
          },
          'tag': 'a1'
        },
        'tag': 'b1'
      },
      'tag': 'root'
    };

    const result = jt.instantiate(NodeA.$id, data) as Record<string, unknown>;

    assert.equal(result.tag, 'root');
    assert.equal(((result.b as Record<string, unknown>).a as Record<string, unknown>).tag, 'a1');
  });
});

// ===========================================================================
// 9. Mixed-tuple registration order
// ===========================================================================

void describe('Mixed-tuple registration order — order independence', () => {
  void it('cross-schema $ref resolves regardless of schema registration order', () => {
    for (const [
      schemas,
      orderId
    ] of [
        [
          [
            OrderSchema,
            CustomerSchema
          ],
          'o-1'
        ],
        [
          [
            CustomerSchema,
            OrderSchema
          ],
          'o-2'
        ]
      ] as const) {
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': schemas as Array<typeof OrderSchema>
      });
      const result = jt.instantiate(OrderSchema.$id, {
        'customer': { 'name': 'Alice' },
        'orderId': orderId
      }) as Record<string, unknown>;

      assert.equal(result.orderId, orderId, `orderId ${orderId} preserved`);
      assert.equal((result.customer as Record<string, unknown>).name, 'Alice', 'customer.name preserved');
    }
  });
});

// ===========================================================================
// 10. Type-cast behaviour with enableTypeCast
// ===========================================================================

void describe('Type-cast behaviour with enableTypeCast', () => {
  const FlagSchema = {
    '$id': 'urn:typecast:Flag',
    'properties': { 'active': { 'type': 'boolean' } },
    'required': ['active'],
    'type': 'object'
  } as const;

  void it('GBU: "true" string rejected by default, coerced to boolean true with enableTypeCast', () => {
    // default: reject string for boolean
    const jtDefault = JsonTology.create({
      'baseIRI': 'urn:typecast:',
      'schemas': [FlagSchema] as const
    });

    assert.throws(
      () => {
        return jtDefault.instantiate(FlagSchema.$id, { 'active': 'true' });
      },
      (err: unknown) => {
        return err instanceof InstantiationError;
      }
    );

    // enableTypeCast: coerce to boolean
    const jtCast = JsonTology.create({
      'baseIRI': 'urn:typecast:',
      'enableTypeCast': true,
      'schemas': [FlagSchema] as const
    });
    const result = jtCast.instantiate(FlagSchema.$id, { 'active': 'true' }) as Record<string, unknown>;

    assert.equal(result.active, true, '"true" coerced to boolean true');
  });
});

// ===========================================================================
// 11. Default propagation through nested $refs
// ===========================================================================

void describe('Default propagation through nested $refs', () => {
  void it('Customer.addresses default applies when reached through Order.$ref', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'enableDefaults': true,
      'schemas': [
        CustomerSchema,
        OrderSchema
      ] as const
    });
    const result = jt.instantiate(OrderSchema.$id, {
      'customer': { 'name': 'Alice' },
      'orderId': 'o-99'
    }) as Record<string, unknown>;
    const customer = result.customer as Record<string, unknown>;

    assert.deepStrictEqual(customer.addresses, []);
  });
});

// ===========================================================================
// 12. Transform decode errors at root-level coercion
// ===========================================================================

void describe('Transform decode errors at root-level coercion', () => {
  void it('decoder throw at root wraps as InstantiationError TRANSFORM_DECODE_FAILED with original cause', () => {
    // Transform decode runs after compiled validation succeeds; failures wrap
    // as InstantiationError with code TRANSFORM_DECODE_FAILED and the original
    // Error attached as cause.
    const HostileSchema = Transform.create(
      {
        '$id': 'urn:transform:Hostile',
        'type': 'string'
      } as const,
      {
        'decode': (raw: string) => {
          if (raw === 'bad') {
            throw new Error('decoder rejects "bad"');
          }

          return raw;
        },
        'encode': (raw: string) => {
          return raw;
        }
      }
    );
    const jt = JsonTology.create({
      'baseIRI': 'urn:transform:',
      'schemas': [HostileSchema] as const
    });

    assert.throws(
      () => {
        return jt.instantiate(HostileSchema.$id, 'bad');
      },
      (err: unknown) => {
        return err instanceof InstantiationError
          && err.code === 'TRANSFORM_DECODE_FAILED'
          && err.cause instanceof Error
          && err.cause.message === 'decoder rejects "bad"';
      }
    );
  });
});

// ===========================================================================
// 13. findDuplicates against structurally-identical-but-IRI-distinct nodes
// ===========================================================================

void describe('findDuplicates — structurally identical, IRI distinct', () => {
  void it('two top-level schemas with identical leaf shape are reported via container property', () => {
    const A = {
      '$id': 'urn:dup:A',
      'pattern': '^x+$',
      'type': 'string'
    } as const;
    // Container references a property identical to A's shape. findDuplicates
    // matches inline shapes against registered schemas, not registered-vs-registered.
    const Container = {
      '$id': 'urn:dup:Container',
      'properties': {
        'a': {
          'pattern': '^x+$',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const jt = JsonTology.create({ 'baseIRI': 'urn:dup:' });

    jt.registry.register(A);
    jt.registry.register(Container);

    const dups = jt.registry.findDuplicates();

    assert.ok(dups.length > 0);
    const found = dups.find((entry) => {
      return entry.equivalentTo === A.$id;
    });

    assert.ok(found !== undefined, 'duplicate should reference A');
  });
});

// ===========================================================================
// 14. Compose.equivalent chain transitivity (TBox quad emission)
// ===========================================================================

void describe('Compose.equivalent — chain transitivity in TBox', () => {
  void it('A ≡ B and B ≡ C: TBox raw output emits owl:equivalentClass arcs for both', () => {
    const SchemaA = {
      '$id': 'urn:equiv:A',
      'pattern': '^[a-z]+$',
      'type': 'string'
    } as const;
    const SchemaB = Compose.equivalent(SchemaA, { '$id': 'urn:equiv:B' });
    const SchemaC = Compose.equivalent(SchemaB, { '$id': 'urn:equiv:C' });

    const builder = JsonTology.toTbox([
      SchemaA,
      SchemaB,
      SchemaC
    ]);

    // raw() returns JSON-LD nodes with prefixed predicates (e.g. owl:equivalentClass).
    const nodes = builder.raw() as Array<Record<string, unknown>>;

    const equivKeys = [
      'owl:equivalentClass',
      'http://www.w3.org/2002/07/owl#equivalentClass'
    ];

    const subjectsWithEquiv = new Set<string>();

    for (const node of nodes) {
      for (const key of equivKeys) {
        if (key in node) {
          const id = node['@id'];

          if (typeof id === 'string') {
            subjectsWithEquiv.add(id);
          }
        }
      }
    }

    assert.ok(subjectsWithEquiv.size >= 2, `expected >=2 subjects with equivalentClass, got ${subjectsWithEquiv.size}: ${[...subjectsWithEquiv].join(', ')}`);

    // B and C must each carry an equivalentClass relation back to their source.
    const ids = [...subjectsWithEquiv].join(' ');

    assert.match(ids, /B\b/u, `B subject present: ${ids}`);
    assert.match(ids, /C\b/u, `C subject present: ${ids}`);
  });
});

// ===========================================================================
// 15. Mixed $defs + cross-schema $ref
// ===========================================================================

void describe('Mixed $defs + cross-schema $ref', () => {
  const ExternalTag = {
    '$id': 'urn:mixed:Tag',
    'pattern': '^[a-z-]+$',
    'type': 'string'
  } as const;

  const Mixed = {
    '$defs': {
      'Local': {
        'properties': { 'count': { 'type': 'number' } },
        'required': ['count'],
        'type': 'object'
      }
    },
    '$id': 'urn:mixed:Doc',
    'properties': {
      'local': { '$ref': '#/$defs/Local' },
      'tag': { '$ref': 'urn:mixed:Tag' }
    },
    'required': [
      'local',
      'tag'
    ],
    'type': 'object'
  } as const;

  void it('GBU: instantiate accepts $defs+cross-ref, rejects on constraint fail, toSchema preserves both ref forms', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:mixed:',
      'schemas': [
        ExternalTag,
        Mixed
      ] as const
    });

    // valid data
    const result = jt.instantiate(Mixed.$id, {
      'local': { 'count': 5 },
      'tag': 'demo-tag'
    }) as Record<string, unknown>;

    assert.deepStrictEqual(result, {
      'local': { 'count': 5 },
      'tag': 'demo-tag'
    });

    // rejects when cross-schema $ref constraint fails
    assert.throws(
      () => {
        return jt.instantiate(Mixed.$id, {
          'local': { 'count': 5 },
          'tag': 'BadTag!'
        });
      },
      (err: unknown) => {
        return err instanceof InstantiationError;
      }
    );

    // toSchema preserves both ref forms
    const reconstructed = jt.toSchema(Mixed.$id) as Record<string, unknown>;
    const properties = reconstructed.properties as Record<string, Record<string, unknown>>;

    assert.equal(properties.tag.$ref, 'urn:mixed:Tag', 'cross-schema ref preserved');
    assert.ok(typeof properties.local.$ref === 'string', 'local $defs ref preserved as string');
    assert.match(properties.local.$ref, /\$defs\/Local|Doc/u, 'local ref points into $defs');
  });
});
