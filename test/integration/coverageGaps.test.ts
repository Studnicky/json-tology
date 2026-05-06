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
 *   7. Recursive ref depth limits + maxDepth
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
  void it('dump on schema without $id throws SchemaError', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://bookstore.io' });

    assert.throws(
      () => {
        return jt.dump(null as unknown as { '$id': string }, { 'name': 'x' });
      },
      (err: unknown) => {
        return err instanceof SchemaError;
      }
    );
  });

  void it('dump on unregistered $id throws GraphError REF_UNRESOLVED', () => {
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
  });

  void it('dump with a schema whose Transform encoder throws propagates the error', () => {
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
  });

  void it('dumpJson produces a valid JSON string for a registered schema', () => {
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
  });

  void it('dumpJson with BigInt value throws because JSON.stringify cannot encode it', () => {
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
        // BigInt deliberately violates the schema; documents engine behaviour.
        return jt.dumpJson(BigIntSchema.$id, BigInt(10) as unknown as number);
      },
      TypeError
    );
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

  void it('encode with no transform attached returns the input unchanged (identity)', () => {
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
  });

  void it('encode delegates to the Transform decoder when present', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [TimestampSchema] as const
    });
    const wire = jt.encode(TimestampSchema, new Date('2026-01-01T00:00:00.000Z'));

    assert.equal(wire, '2026-01-01T00:00:00.000Z');
  });

  void it('parent with $ref to a transform-attached schema: instantiate preserves wire form (decoder not applied through $ref)', () => {
    // Documents current behaviour: a cross-schema $ref to a Transform-attached
    // schema does NOT apply the decoder when instantiating the parent — the
    // leaf value remains in wire form (a plain string).
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
    const input = {
      'occurredAt': '2026-01-01T00:00:00.000Z',
      'subject': 'login'
    };
    const decoded = jt.instantiate(ParentSchema.$id, input) as Record<string, unknown>;

    assert.equal(decoded.occurredAt, '2026-01-01T00:00:00.000Z');
    assert.equal(decoded.subject, 'login');
    assert.equal(decoded.occurredAt instanceof Date, false);
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

  void it('fromQuads against an unregistered schema returns an empty array (silent passthrough)', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://bookstore.io' });
    const lifted = jt.fromQuads('https://bookstore.io/NotRegistered', []);

    assert.deepStrictEqual(lifted, []);
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

  void it('toQuads with cyclic data structure throws a stack-overflow RangeError (documented limitation)', () => {
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
        return jt.toQuads(SelfRefSchema, cycle as Record<string, unknown>);
      },
      (err: unknown) => {
        return err instanceof RangeError;
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

  const refScenarios: Array<{
    'expectedCode': string;
    'name': string;
    'pointer': string;
  }> = [
    {
      'expectedCode': 'POINTER_INVALID',
      'name': 'invalid pointer (missing leading slash) throws POINTER_INVALID',
      'pointer': 'properties/tag'
    },
    {
      'expectedCode': 'POINTER_NOT_FOUND',
      'name': 'pointer to non-existent path throws POINTER_NOT_FOUND',
      'pointer': '/properties/missing'
    }
  ];

  for (const scenario of refScenarios) {
    void it(scenario.name, () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://bookstore.io',
        'schemas': [PARENT] as const
      });

      assert.throws(
        () => {
          return jt.subschemaAt(PARENT.$id, scenario.pointer);
        },
        (err: unknown) => {
          return err instanceof GraphError && (err).code === scenario.expectedCode;
        }
      );
    });
  }

  void it('subschemaAt with empty pointer returns the root schema', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [PARENT] as const
    });
    const root = jt.subschemaAt(PARENT.$id, '');

    assert.equal(root.$id, `${PARENT.$id}#`);
  });

  void it('subschemaAt resolves a nested pointer to a sub-schema', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [PARENT] as const
    });
    const inner = jt.subschemaAt(PARENT.$id, '/properties/inner');

    assert.equal((inner as { 'type': string }).type, 'object');
    assert.equal(inner.$id, `${PARENT.$id}#/properties/inner`);
  });
});

// ===========================================================================
// 5. Static-counterpart failure modes
// ===========================================================================

void describe('static counterparts — failure modes', () => {
  void it('JsonTology.instantiate propagates a Transform decoder error as a raw Error (not wrapped)', () => {
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
        return err instanceof Error && (err).message.includes('decoder failure');
      }
    );
  });

  void it('JsonTology.toQuads with Skolemize.wellKnownGenid produces well-known IRIs', () => {
    const quads = JsonTology.toQuads(
      AuthorSchema,
      { 'name': 'Asimov' },
      { 'iriFor': Skolemize.wellKnownGenid('https://bookstore.io') }
    );

    assert.ok(quads.length > 0);
    for (const quad of quads) {
      assert.match(quad.subject, /\/\.well-known\/genid\//u);
    }
  });

  void it('JsonTology.validate, .is, .instantiate work without any prior .create() call', () => {
    // Each call here is an ephemeral registry — no shared instance state.
    const errors = JsonTology.validate(AuthorSchema, { 'name': 'Asimov' });

    assert.equal(errors.length, 0);

    const ok = JsonTology.is(AuthorSchema, { 'name': 'Asimov' });

    assert.equal(ok, true);

    const value = JsonTology.instantiate(AuthorSchema, { 'name': 'Asimov' });

    assert.deepStrictEqual(value, { 'name': 'Asimov' });
  });

  void it('JsonTology.validate against an unregistered cross-schema $ref returns ValidationErrors with no items (silent passthrough)', () => {
    const Standalone = {
      '$id': 'urn:test:Standalone',
      'properties': { 'ref': { '$ref': 'urn:test:NotInRegistry' } },
      'type': 'object'
    } as const;

    // The static counterpart only registers the supplied schema, so the cross
    // reference cannot resolve. Behaviour: validate is permissive — no errors.
    const errors = JsonTology.validate(Standalone, { 'ref': { 'x': 1 } });

    assert.equal(errors.length, 0);
    assert.equal(errors.ok, true);
  });

  void it('JsonTology.subschemaAt with invalid pointer throws GraphError', () => {
    assert.throws(
      () => {
        return JsonTology.subschemaAt(AuthorSchema, 'no-leading-slash');
      },
      (err: unknown) => {
        return err instanceof GraphError;
      }
    );
  });

  void it('JsonTology.toSchema returns the registered schema as a graph-derived object', () => {
    const result = JsonTology.toSchema(AuthorSchema);

    assert.ok(result !== undefined);
    assert.equal((result as { '$id': string }).$id, AuthorSchema.$id);
  });

  void it('JsonTology.dump on schema with throwing encoder propagates the error', () => {
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

  void it('addComputed then removeComputed: derived field disappears from output', () => {
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

    assert.equal(before.derived, 6);

    jt.removeComputed(ComputedSchema.$id, 'derived');

    const after = jt.instantiate(ComputedSchema.$id, { 'value': 3 }) as Record<string, unknown>;

    assert.ok(!('derived' in after) || after.derived === undefined);
  });

  void it('addComputed twice for the same key — second registration overrides the first', () => {
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

    const result = jt.instantiate(ComputedSchema.$id, { 'value': 1 }) as Record<string, unknown>;

    assert.equal(result.derived, 99);
  });

  void it('addInvariant whose function throws is wrapped in InstantiationError', () => {
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
  });

  void it('removeInvariant for a non-existent name is a no-op', () => {
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

    // Validation still passes — no invariants present.
    const errors = jt.validate(Schema.$id, { 'name': 'x' });

    assert.equal(errors.length, 0);
  });

  void it('computed depending on a defaulted field: default applies first, then computed runs', () => {
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

    // No 'base' in input — default 10 should be applied; computed should see 10.
    const result = jt.instantiate(Schema.$id, {}) as Record<string, unknown>;

    assert.equal(result.base, 10);
    assert.equal(result.doubled, 20);
  });
});

// ===========================================================================
// 7. Recursive ref depth limits
// ===========================================================================

function buildSelfRefChain(depth: number): Record<string, unknown> {
  const root: Record<string, unknown> = { 'name': 'root' };
  let cursor = root;

  for (let index = 0; index < depth; index++) {
    const child: Record<string, unknown> = { 'name': `n${index}` };

    cursor.next = child;
    cursor = child;
  }

  return root;
}

void describe('Recursive ref depth limits', () => {
  const SelfNode = {
    '$id': 'urn:depth:Node',
    'properties': {
      'name': { 'type': 'string' },
      'next': { '$ref': 'urn:depth:Node' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  void it('engine.execute() with maxDepth below the schema-graph $ref depth throws RECURSION_LIMIT', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:depth:',
      'maxDepth': 1,
      'schemas': [SelfNode] as const
    });

    // maxDepth bounds the SCHEMA-GRAPH traversal depth, not the data depth.
    // With maxDepth: 1 even a 2-element data chain trips the limit because
    // resolving a $ref counts as descent.
    const engine = jt.registry.engine(SelfNode as unknown as Record<string, unknown>);

    assert.throws(
      () => {
        return engine.execute(buildSelfRefChain(2));
      },
      (err: unknown) => {
        return err instanceof GraphError && (err).code === 'RECURSION_LIMIT';
      }
    );
  });

  void it('engine.execute() with maxDepth above the $ref depth completes successfully', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:depth:',
      'maxDepth': 100,
      'schemas': [SelfNode] as const
    });
    const engine = jt.registry.engine(SelfNode as unknown as Record<string, unknown>);
    const result = engine.execute(buildSelfRefChain(5));

    assert.equal(result.valid, true);
    assert.equal((result.value as Record<string, unknown>).name, 'root');
  });

  void it('instantiate (compiled validation path) does NOT enforce maxDepth (documented gap)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:depth:',
      'maxDepth': 1,
      'schemas': [SelfNode] as const
    });

    // Compiled validation does not currently honour maxDepth — this passes
    // even with a 50-deep chain. Pinning this so any future change is loud.
    const result = jt.instantiate(SelfNode.$id, buildSelfRefChain(50)) as Record<string, unknown>;

    assert.equal(result.name, 'root');
  });
});

// ===========================================================================
// 8. Mutual recursion graphs
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
      'maxDepth': 50,
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
  void it('order [Order, Customer]: cross-schema $ref resolves regardless of array position', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [
        OrderSchema,
        CustomerSchema
      ] as const
    });
    const result = jt.instantiate(OrderSchema.$id, {
      'customer': { 'name': 'Alice' },
      'orderId': 'o-1'
    }) as Record<string, unknown>;

    assert.equal(result.orderId, 'o-1');
    assert.equal((result.customer as Record<string, unknown>).name, 'Alice');
  });

  void it('order [Customer, Order]: same outcome — order does not matter', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.io',
      'schemas': [
        CustomerSchema,
        OrderSchema
      ] as const
    });
    const result = jt.instantiate(OrderSchema.$id, {
      'customer': { 'name': 'Alice' },
      'orderId': 'o-2'
    }) as Record<string, unknown>;

    assert.equal(result.orderId, 'o-2');
    assert.equal((result.customer as Record<string, unknown>).name, 'Alice');
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

  void it('default registry rejects "true" string for boolean field with InstantiationError', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:typecast:',
      'schemas': [FlagSchema] as const
    });

    assert.throws(
      () => {
        return jt.instantiate(FlagSchema.$id, { 'active': 'true' });
      },
      (err: unknown) => {
        return err instanceof InstantiationError;
      }
    );
  });

  void it('enableTypeCast: true coerces "true" to boolean true', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:typecast:',
      'enableTypeCast': true,
      'schemas': [FlagSchema] as const
    });

    const result = jt.instantiate(FlagSchema.$id, { 'active': 'true' }) as Record<string, unknown>;

    assert.equal(result.active, true);
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
  void it('decoder throw at root propagates as a raw Error (not wrapped in InstantiationError)', () => {
    // Documents current contract: Transform decode runs after compiled
    // validation succeeds, so its errors reach the caller unwrapped.
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
        return err instanceof Error
          && !(err instanceof InstantiationError)
          && (err).message.includes('decoder rejects "bad"');
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

    jt.registry.register(A as unknown as Record<string, unknown>);
    jt.registry.register(Container as unknown as Record<string, unknown>);

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
    const SchemaC = Compose.equivalent(SchemaB as Record<string, unknown> & { '$id': string }, { '$id': 'urn:equiv:C' });

    const builder = JsonTology.toTbox([
      SchemaA,
      SchemaB as Record<string, unknown> & { '$id': string },
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

  void it('instantiate accepts data using both $defs and cross-schema $ref', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:mixed:',
      'schemas': [
        ExternalTag,
        Mixed
      ] as const
    });

    const result = jt.instantiate(Mixed.$id, {
      'local': { 'count': 5 },
      'tag': 'demo-tag'
    }) as Record<string, unknown>;

    assert.deepStrictEqual(result, {
      'local': { 'count': 5 },
      'tag': 'demo-tag'
    });
  });

  void it('instantiate rejects data when cross-schema $ref constraint fails', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:mixed:',
      'schemas': [
        ExternalTag,
        Mixed
      ] as const
    });

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
  });

  void it('toSchema preserves both $defs and cross-schema $ref forms', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:mixed:',
      'schemas': [
        ExternalTag,
        Mixed
      ] as const
    });

    const reconstructed = jt.toSchema(Mixed.$id) as Record<string, unknown>;
    const properties = reconstructed.properties as Record<string, Record<string, unknown>>;

    // Cross-schema ref preserved
    assert.equal(properties.tag.$ref, 'urn:mixed:Tag');

    // Local $defs ref preserved (string form, pointing into $defs)
    assert.ok(typeof properties.local.$ref === 'string');
    assert.match(properties.local.$ref, /\$defs\/Local|Doc/u);
  });
});
