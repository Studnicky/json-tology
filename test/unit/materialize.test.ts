// Merged from: materializer.test.ts, materializerEdgeCases.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
// SchemaGraph + projectGraph are graph-projection internals not surfaced via the public API.
// The cross-reference test below compares raw TBox QuadInterface[] (predicate/termType shape)
// against ABox quads; OntologyBuilder.raw() returns JSON-LD nodes, not the QuadInterface form.
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { Projection } from '../../src/modules/rdf/Projection.js';

// ===========================================================================
// Source: materializer.test.ts
// ===========================================================================
{
  const ConfigSchema = {
    '$id': 'https://example.io/config',
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'properties': {
      'debug': {
        'default': false,
        'type': 'boolean'
      },
      'name': { 'type': 'string' },
      'timeout': {
        'default': 5000,
        'type': 'number'
      }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const NestedSchema = {
    '$defs': {
      'Inner': {
        'properties': {
          'value': {
            'default': 42,
            'type': 'number'
          }
        },
        'type': 'object'
      }
    },
    '$id': 'https://example.io/nested',
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
    'type': 'object'
  } as const;

  const StrictSchema = {
    '$id': 'https://example.io/strict',
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'additionalProperties': false,
    'properties': {
      'name': { 'type': 'string' },
      'value': { 'type': 'number' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  interface QuadObject {
    'termType': string;
    'type': string;
    'value'?: unknown;
  }

  interface Quad {
    'object': QuadObject;
    'predicate': string;
    'subject': string;
  }

  void describe('Materializer', () => {
    void describe('materialize happy paths', () => {
      const scenarios: Array<{
        'expected': Record<string, unknown>;
        'input': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'expected': {
            'debug': false,
            'name': 'test',
            'timeout': 5000
          },
          'input': { 'name': 'test' },
          'name': 'applies schema defaults for missing optional properties',
          'schema': ConfigSchema
        },
        {
          'expected': {
            'debug': false,
            'name': 'custom',
            'timeout': 10_000
          },
          'input': {
            'name': 'custom',
            'timeout': 10_000
          },
          'name': 'partial overrides replace defaults',
          'schema': ConfigSchema
        },
        {
          'expected': {
            'debug': false,
            'name': 'test',
            'timeout': 5000
          },
          'input': { 'name': 'test' },
          'name': 'execution projection materializes correctly',
          'schema': ConfigSchema
        },
        {
          'expected': { 'inner': { 'value': 42 } },
          'input': {},
          'name': 'nested defaults via $ref are applied',
          'schema': NestedSchema
        },
        {
          'expected': { 'field': 'default-value' },
          'input': {},
          'name': 'build from partial when required properties have defaults',
          'schema': {
            '$id': 'https://example.io/all-defaults',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'properties': {
              'field': {
                'default': 'default-value',
                'type': 'string'
              }
            },
            'required': ['field'],
            'type': 'object'
          }
        },
        {
          'expected': {},
          'input': {},
          'name': 'empty schema with no properties materializes to empty object',
          'schema': {
            '$id': 'https://example.io/empty-props',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object'
          }
        },
        {
          'expected': {},
          'input': {},
          'name': 'all-optional properties with no defaults produces empty-ish object',
          'schema': {
            '$id': 'https://example.io/all-optional',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'properties': {
              'a': { 'type': 'string' },
              'b': { 'type': 'number' }
            },
            'type': 'object'
          }
        }
      ];

      for (const {
        'expected': exp, 'input': inp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          const result = JsonTology.materialize(sch, inp) as Record<string, unknown>;

          for (const [
            key,
            value
          ] of Object.entries(exp)) {
            if (typeof value === 'object' && value !== null) {
              assert.deepStrictEqual(result[key], value, `${n}: ${key}`);
            } else {
              assert.strictEqual(result[key], value, `${n}: ${key}`);
            }
          }
        });
      }
    });

    void describe('declared property presence', () => {
      const scenarios: Array<{
        'expectedKeys': readonly string[];
        'input': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'expectedKeys': [
            'name',
            'debug',
            'timeout'
          ],
          'input': { 'name': 'test' },
          'name': 'non-required properties with defaults present',
          'schema': ConfigSchema
        },
        {
          'expectedKeys': [
            'required',
            'optional'
          ],
          'input': { 'required': 'yes' },
          'name': 'non-required property with no default is still present',
          'schema': {
            '$id': 'https://example.io/optional',
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'properties': {
              'optional': { 'type': 'string' },
              'required': { 'type': 'string' }
            },
            'required': ['required'],
            'type': 'object'
          }
        }
      ];

      for (const {
        'expectedKeys': keys, 'input': inp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          const result = JsonTology.materialize(sch, inp) as Record<string, unknown>;

          for (const key of keys) {
            assert.ok(key in result, `${n}: ${key} must be present`);
          }
        });
      }

      void it('optional property without default is undefined', () => {
        const result = JsonTology.materialize({
          '$id': 'https://example.io/optional-undef',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': {
            'optional': { 'type': 'string' },
            'required': { 'type': 'string' }
          },
          'required': ['required'],
          'type': 'object'
        }, { 'required': 'yes' }) as Record<string, unknown>;

        assert.strictEqual(result.optional, undefined);
      });
    });

    void describe('materialize throws on invalid data', () => {
      const scenarios: Array<{
        'input': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'input': { 'name': 123 },
          'name': 'type mismatch on required property',
          'schema': ConfigSchema
        },
        {
          'input': {},
          'name': 'missing required property',
          'schema': ConfigSchema
        },
        {
          'input': {
            'name': 'test',
            'timeout': '10000'
          },
          'name': 'type mismatch without coerce',
          'schema': ConfigSchema
        },
        {
          'input': {
            'extra': 'not allowed',
            'name': 'test'
          },
          'name': 'extra keys without passAdditionalProperties',
          'schema': StrictSchema
        },
        {
          'input': { 'name': null },
          'name': 'null value for required string property',
          'schema': ConfigSchema
        }
      ];

      for (const {
        'input': inp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          assert.throws(
            () => {
              return JsonTology.materialize(sch, inp);
            },
            (err: Error) => {
              return err.message.includes('Invalid');
            },
            n
          );
        });
      }
    });

    void describe('materialize options', () => {
      const scenarios: Array<{
        'check': (result: Record<string, unknown>) => void;
        'input': Record<string, unknown>;
        'materializerOpts'?: Record<string, unknown>;
        'name': string;
        'registryOpts'?: Record<string, unknown>;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (result) => {
            assert.strictEqual(result.name, 'auto');
          },
          'input': { 'name': 'auto' },
          'name': 'auto-registers the schema with no prior registry.register()',
          'schema': ConfigSchema
        },
        {
          'check': (result) => {
            assert.strictEqual(result.timeout, 10_000);
            assert.strictEqual(typeof result.timeout, 'number');
          },
          'input': {
            'name': 'test',
            'timeout': '10000'
          },
          'name': 'coerces types when registry castTypes: true',
          'registryOpts': { 'enableTypeCast': true },
          'schema': ConfigSchema
        },
        {
          'check': (result) => {
            assert.strictEqual(result.name, 'test');
            assert.strictEqual(result.extra, 'allowed');
          },
          'input': {
            'extra': 'allowed',
            'name': 'test'
          },
          'materializerOpts': { 'passAdditionalProperties': true },
          'name': 'allows extra keys when passAdditionalProperties: true',
          'schema': StrictSchema
        }
      ];

      for (const {
        'check': chk, 'input': inp, 'materializerOpts': mOpts, 'name': n, 'registryOpts': rOpts, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          const opts: Parameters<typeof JsonTology.create>[0] = {
            'baseIRI': 'urn:test:',
            ...rOpts,
            ...(mOpts ? { 'materializer': mOpts } : {})
          };
          const tology = JsonTology.create(opts);
          const result = tology.materialize(sch as typeof sch & { '$id': string }, inp) as Record<string, unknown>;

          chk(result);
        });
      }

      void it('auto-registered schema is accessible from registry', () => {
        const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });

        tology.materialize(ConfigSchema, { 'name': 'auto' });

        assert.ok(tology.registry.get(ConfigSchema.$id) !== undefined);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Runtime Projection Contract (Task 02)
  // ---------------------------------------------------------------------------

  void describe('Runtime projection contract', () => {
    void describe('createDefault()', () => {
      const scenarios: Array<{
        'expected': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'expected': {
            'debug': false,
            'name': '',
            'timeout': 5000
          },
          'name': 'creates defaults from schema with defaults and required properties',
          'schema': ConfigSchema
        },
        {
          'expected': { 'inner': { 'value': 42 } },
          'name': 'resolves local $defs ref in createDefault',
          'schema': {
            '$defs': {
              'Inner': {
                'properties': {
                  'value': {
                    'default': 42,
                    'type': 'number'
                  }
                },
                'type': 'object'
              }
            },
            '$id': 'https://example.io/ref-create',
            'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
            'required': ['inner'],
            'type': 'object'
          }
        },
        {
          'expected': { 'item': { 'label': 'untitled' } },
          'name': 'resolves $anchor ref in createDefault',
          'schema': {
            '$defs': {
              'Item': {
                '$anchor': 'item-def',
                'properties': {
                  'label': {
                    'default': 'untitled',
                    'type': 'string'
                  }
                },
                'required': ['label'],
                'type': 'object'
              }
            },
            '$id': 'https://example.io/anchor-create',
            'properties': { 'item': { '$ref': '#item-def' } },
            'required': ['item'],
            'type': 'object'
          }
        },
        {
          'expected': { 'kind': 'fixed' },
          'name': 'uses const value as default',
          'schema': {
            '$id': 'https://example.io/const-create',
            'properties': { 'kind': { 'const': 'fixed' } },
            'required': ['kind'],
            'type': 'object'
          }
        },
        {
          'expected': { 'status': 'active' },
          'name': 'uses first enum value as default',
          'schema': {
            '$id': 'https://example.io/enum-create',
            'properties': {
              'status': {
                'enum': [
                  'active',
                  'inactive'
                ],
                'type': 'string'
              }
            },
            'required': ['status'],
            'type': 'object'
          }
        }
      ];

      for (const {
        'expected': exp, 'name': n, 'schema': sch
      } of scenarios) {
        void it(n, () => {
          const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });

          tology.register(sch as typeof sch & { '$id': string });
          const result = tology.value.create((sch as { '$id': string }).$id) as Record<string, unknown>;

          assert.deepStrictEqual(result, exp);
        });
      }

      void it('registry.create() delegates to createDefault', () => {
        const tology = JsonTology.create({
          'baseIRI': 'urn:test:',
          'schemas': [ConfigSchema] as const
        });
        const result = tology.value.create(ConfigSchema.$id) as Record<string, unknown>;

        assert.strictEqual(result.name, '');
        assert.strictEqual(result.debug, false);
        assert.strictEqual(result.timeout, 5000);
      });

      void it('resolves external $ref in createDefault', () => {
        const PartSchema = {
          '$id': 'https://example.io/part',
          'properties': {
            'value': {
              'default': 99,
              'type': 'number'
            }
          },
          'required': ['value'],
          'type': 'object'
        };
        const WholeSchema = {
          '$id': 'https://example.io/whole',
          'properties': { 'part': { '$ref': 'https://example.io/part' } },
          'required': ['part'],
          'type': 'object'
        };

        const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });

        tology.register(PartSchema as typeof PartSchema & { '$id': string });
        tology.register(WholeSchema as typeof WholeSchema & { '$id': string });
        const result = tology.value.create(WholeSchema.$id) as Record<string, unknown>;

        assert.deepStrictEqual(result.part, { 'value': 99 });
      });

      void it('handles recursive refs without infinite loop', () => {
        const RecursiveSchema = {
          '$id': 'https://example.io/recursive',
          'properties': {
            'child': { '$ref': 'https://example.io/recursive' },
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        };

        const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });

        tology.register(RecursiveSchema as typeof RecursiveSchema & { '$id': string });
        const result = tology.value.create(RecursiveSchema.$id) as Record<string, unknown>;

        assert.strictEqual(result.name, '');
      // child is not required, so it should not be in the default
      });
    });

    void describe('execute() non-throwing API', () => {
      const scenarios: Array<{
        'expectErrors': boolean;
        'expectValid': boolean;
        'input': Record<string, unknown>;
        'name': string;
      }> = [
        {
          'expectErrors': false,
          'expectValid': true,
          'input': { 'name': 'test' },
          'name': 'valid data returns valid=true with empty errors'
        },
        {
          'expectErrors': true,
          'expectValid': false,
          'input': { 'name': 123 },
          'name': 'invalid data returns valid=false with errors'
        },
        {
          'expectErrors': true,
          'expectValid': false,
          'input': {},
          'name': 'missing required field returns valid=false with errors'
        }
      ];

      for (const {
        'expectErrors': errs, 'expectValid': valid, 'input': inp, 'name': n
      } of scenarios) {
        void it(n, () => {
          const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
          const result = tology.materializer.execute(ConfigSchema, inp, { 'baseIRI': 'https://example.io' });

          assert.equal(result.valid, valid);
          if (errs) {
            assert.ok(result.errors.length > 0);
          } else {
            assert.equal(result.errors.length, 0);
          }
        });
      }

      void it('valid execution returns value and abox', () => {
        const tology = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const ok = tology.materializer.execute(ConfigSchema, { 'name': 'test' }, { 'baseIRI': 'https://example.io' });

        assert.equal((ok.value as Record<string, unknown>).name, 'test');
        assert.ok(Array.isArray(ok.abox));
      });
    });

    void describe('execute -> materialize -> abox projection contract', () => {
      void it('projectAbox returns well-formed quads with rdf:type and property literals', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://example.io',
          'schemas': [ConfigSchema] as const
        });
        const abox = tology.toQuads(ConfigSchema, { 'name': 'test' });

        // --- quad structure ---
        assert.ok(Array.isArray(abox));
        assert.ok(abox.length > 0);

        const first = abox[0] as Quad;

        assert.ok(typeof first.subject === 'string', 'quad must have string subject');
        assert.ok(typeof first.predicate === 'string', 'quad must have string predicate');
        assert.ok(typeof first.object === 'object', 'quad must have object');
        assert.ok(typeof first.object.termType === 'string', 'quad object must have termType');

        // --- rdf:type and property literals ---
        const typeQuad = abox.find((quad: Quad) => {
          return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode' && quad.object.value === ConfigSchema.$id;
        });

        assert.ok(typeQuad, 'ABox must contain rdf:type quad referencing schema $id');

        const nameQuad = abox.find((quad: Quad) => {
          return quad.predicate.endsWith('#name') && quad.object.termType === 'Literal' && quad.object.value === 'test';
        });

        assert.ok(nameQuad, 'ABox must contain name property quad');
      });

      void describe('deterministic identity', () => {
        const scenarios: Array<{
          'data1': Record<string, unknown>;
          'data2': Record<string, unknown>;
          'expectSame': boolean;
          'name': string;
        }> = [
          {
            'data1': { 'name': 'test' },
            'data2': { 'name': 'test' },
            'expectSame': true,
            'name': 'same data produces same instance IRI'
          },
          {
            'data1': { 'name': 'test' },
            'data2': { 'name': 'bob' },
            'expectSame': false,
            'name': 'different data produces different instance IRI'
          }
        ];

        for (const {
          'data1': d1, 'data2': d2, 'expectSame': same, 'name': n
        } of scenarios) {
          void it(n, () => {
            const tology = JsonTology.create({
              'baseIRI': 'https://example.io',
              'schemas': [ConfigSchema] as const
            });
            const abox1 = tology.toQuads(ConfigSchema, d1);
            const abox2 = tology.toQuads(ConfigSchema, d2);

            const subj1 = abox1.find((quad: Quad) => {
              return quad.predicate === 'rdf:type';
            })?.subject;
            const subj2 = abox2.find((quad: Quad) => {
              return quad.predicate === 'rdf:type';
            })?.subject;

            if (same) {
              assert.strictEqual(subj1, subj2);
            } else {
              assert.notStrictEqual(subj1, subj2);
            }
          });
        }
      });

      void it('ABox instance types reference TBox classes', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://example.io',
          'schemas': [ConfigSchema] as const
        });
        const graph = new SchemaGraph(ConfigSchema);
        const tbox = Projection.graph(graph);
        const abox = tology.toQuads(ConfigSchema, { 'name': 'test' });

        const tboxClasses = new Set(tbox
          .filter((quad: Quad) => {
            return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode' && quad.object.value === 'owl:Class';
          })
          .map((quad: Quad) => {
            return quad.subject;
          }));

        const aboxTypes = abox
          .filter((quad: Quad) => {
            return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode';
          })
          .map((quad: Quad) => {
            return quad.object.value;
          });

        for (const aboxType of aboxTypes) {
          assert.ok(
            tboxClasses.has(aboxType),
            `ABox type ${String(aboxType)} should be declared as owl:Class in TBox`
          );
        }
      });
    });
  });
}

// ===========================================================================
// Source: materializerEdgeCases.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Default application scenarios
// ---------------------------------------------------------------------------

  interface DefaultScenario {
    'assertions': (result: Record<string, unknown>) => void;
    'input': Record<string, unknown>;
    'name': string;
    'schema': Record<string, unknown> & { '$id': string };
  }

  const defaultScenarios: DefaultScenario[] = [
    {
      'assertions': (result) => {
        assert.strictEqual(result.enabled, true, 'all defaults — enabled');
        assert.strictEqual(result.count, 10, 'all defaults — count');
        assert.strictEqual(result.color, 'blue', 'all defaults — color');
      },
      'input': {},
      'name': 'applies all defaults when no data is provided',
      'schema': {
        '$id': 'https://edge.io/all-defaults',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'color': {
            'default': 'blue',
            'type': 'string'
          },
          'count': {
            'default': 10,
            'type': 'number'
          },
          'enabled': {
            'default': true,
            'type': 'boolean'
          }
        },
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        assert.deepStrictEqual(result.tags, ['general'], 'array default — tags');
      },
      'input': {},
      'name': 'applies default array values',
      'schema': {
        '$id': 'https://edge.io/array-default',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'tags': {
            'default': ['general'],
            'items': { 'type': 'string' },
            'type': 'array'
          }
        },
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.status, 'pending', 'enum default — status');
      },
      'input': {},
      'name': 'applies default enum value',
      'schema': {
        '$id': 'https://edge.io/enum-default',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'status': {
            'default': 'pending',
            'enum': [
              'active',
              'inactive',
              'pending'
            ],
            'type': 'string'
          }
        },
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        assert.ok('alpha' in result, 'no defaults — alpha key present');
        assert.ok('beta' in result, 'no defaults — beta key present');
        assert.strictEqual(result.alpha, undefined, 'no defaults — alpha undefined');
        assert.strictEqual(result.beta, undefined, 'no defaults — beta undefined');
      },
      'input': {},
      'name': 'returns minimal object when schema has no defaults',
      'schema': {
        '$id': 'https://edge.io/no-defaults',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'alpha': { 'type': 'string' },
          'beta': { 'type': 'number' }
        },
        'type': 'object'
      }
    }
  ];

  void describe('Materializer default application', () => {
    for (const scenario of defaultScenarios) {
      void it(scenario.name, () => {
        const result = JsonTology.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

        scenario.assertions(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Falsy default preservation scenarios
  // ---------------------------------------------------------------------------

  interface FalsyScenario {
    'expected': unknown;
    'expectedType': string;
    'name': string;
    'property': string;
    'schema': Record<string, unknown> & { '$id': string };
  }

  const falsyScenarios: FalsyScenario[] = [
    {
      'expected': false,
      'expectedType': 'boolean',
      'name': 'preserves boolean default of false (falsy but valid)',
      'property': 'active',
      'schema': {
        '$id': 'https://edge.io/bool-false',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'active': {
            'default': false,
            'type': 'boolean'
          }
        },
        'type': 'object'
      }
    },
    {
      'expected': 0,
      'expectedType': 'number',
      'name': 'preserves numeric default of 0 (falsy but valid)',
      'property': 'offset',
      'schema': {
        '$id': 'https://edge.io/zero-default',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'offset': {
            'default': 0,
            'type': 'number'
          }
        },
        'type': 'object'
      }
    },
    {
      'expected': '',
      'expectedType': 'string',
      'name': 'preserves empty string default (falsy but valid)',
      'property': 'label',
      'schema': {
        '$id': 'https://edge.io/empty-string',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'label': {
            'default': '',
            'type': 'string'
          }
        },
        'type': 'object'
      }
    }
  ];

  void describe('Materializer falsy default preservation', () => {
    for (const scenario of falsyScenarios) {
      void it(scenario.name, () => {
        const result = JsonTology.materialize(scenario.schema, {}) as Record<string, unknown>;

        assert.strictEqual(result[scenario.property], scenario.expected, scenario.name);
        assert.strictEqual(typeof result[scenario.property], scenario.expectedType, `${scenario.name} — type`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Structured materialization scenarios ($ref defaults, deep nesting, facade)
  // ---------------------------------------------------------------------------

  interface StructuredScenario {
    'assertions': (result: Record<string, unknown>) => void;
    'extraSchemas'?: ReadonlyArray<Record<string, unknown>>;
    'input': Record<string, unknown>;
    'name': string;
    'schema': Record<string, unknown> & { '$id': string };
    'useFacade'?: boolean;
  }

  const structuredScenarios: StructuredScenario[] = [
    {
      'assertions': (result) => {
        const address = result.address as Record<string, unknown>;

        assert.strictEqual(address.city, 'Unknown', '$ref defaults — city');
        assert.strictEqual(address.zip, '00000', '$ref defaults — zip');
      },
      'extraSchemas': [{
        '$id': 'https://edge.io/address',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'city': {
            'default': 'Unknown',
            'type': 'string'
          },
          'zip': {
            'default': '00000',
            'type': 'string'
          }
        },
        'type': 'object'
      }],
      'input': {
        'address': {},
        'name': 'Alice'
      },
      'name': 'applies defaults from a referenced schema via $ref',
      'schema': {
        '$id': 'https://edge.io/person-ref',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'address': { '$ref': 'https://edge.io/address' },
          'name': { 'type': 'string' }
        },
        'required': ['name'],
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        const l1 = result.a as Record<string, unknown>;
        const l2 = l1.b as Record<string, unknown>;
        const l3 = l2.c as Record<string, unknown>;

        assert.strictEqual(l3.d, 'deep-default', 'edge: deeply nested defaults — 3+ levels');
      },
      'extraSchemas': [
        {
          '$id': 'https://edge.io/level-c',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': {
            'd': {
              'default': 'deep-default',
              'type': 'string'
            }
          },
          'type': 'object'
        },
        {
          '$id': 'https://edge.io/level-b',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': { 'c': { '$ref': 'https://edge.io/level-c' } },
          'type': 'object'
        },
        {
          '$id': 'https://edge.io/level-a',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': { 'b': { '$ref': 'https://edge.io/level-b' } },
          'type': 'object'
        }
      ],
      'input': { 'a': { 'b': { 'c': {} } } },
      'name': 'edge: schema with deeply nested defaults (3+ levels via $ref) applies all defaults',
      'schema': {
        '$id': 'https://edge.io/deep-3plus',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'a': { '$ref': 'https://edge.io/level-a' } },
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        const level1 = result.level1 as Record<string, unknown>;
        const level3 = level1.level3 as Record<string, unknown>;

        assert.strictEqual(level3.leaf, 'deep-value', 'deep nesting — leaf default');
      },
      'input': { 'level1': { 'level3': {} } },
      'name': 'applies defaults through deeply nested schemas (3+ levels)',
      'schema': {
        '$defs': {
          'Level2': {
            'properties': {
              'level3': {
                'properties': {
                  'leaf': {
                    'default': 'deep-value',
                    'type': 'string'
                  }
                },
                'type': 'object'
              }
            },
            'type': 'object'
          }
        },
        '$id': 'https://edge.io/deep-nested',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'level1': { '$ref': '#/$defs/Level2' } },
        'type': 'object'
      }
    },
    {
      'assertions': (result) => {
        assert.strictEqual(result.name, 'important', 'facade — name');
        assert.strictEqual(result.priority, 0, 'facade — falsy numeric default');
        assert.strictEqual(result.visible, false, 'facade — falsy boolean default');
      },
      'input': { 'name': 'important' },
      'name': 'materialize is accessible via JsonTology facade',
      'schema': {
        '$id': 'https://edge.io/tag',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': {
          'name': { 'type': 'string' },
          'priority': {
            'default': 0,
            'type': 'number'
          },
          'visible': {
            'default': false,
            'type': 'boolean'
          }
        },
        'required': ['name'],
        'type': 'object'
      },
      'useFacade': true
    }
  ];

  void describe('Materializer structured scenarios', () => {
    for (const scenario of structuredScenarios) {
      void it(scenario.name, () => {
        if (scenario.useFacade === true) {
          const jt = JsonTology.create({
            'baseIRI': 'https://edge.io',
            'schemas': [scenario.schema] as const
          });
          const result = jt.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

          scenario.assertions(result);
        } else {
          const tology = JsonTology.create({ 'baseIRI': 'https://edge.io' });

          for (const extra of scenario.extraSchemas ?? []) {
            tology.register(extra as Record<string, unknown> & { '$id': string });
          }
          const result = tology.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

          scenario.assertions(result);
        }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Validation rejection scenarios (additional properties, null handling)
  // ---------------------------------------------------------------------------

  interface RejectionScenario {
    'input': Record<string, unknown>;
    'name': string;
    'options'?: { 'passAdditionalProperties'?: boolean };
    'schema': Record<string, unknown> & { '$id': string };
  }

  const rejectionScenarios: RejectionScenario[] = [
    {
      'input': {
        'extra': 'not allowed',
        'name': 'test'
      },
      'name': 'rejects extra keys when additionalProperties is false',
      'schema': {
        '$id': 'https://edge.io/strict-extra',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'additionalProperties': false,
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      }
    },
    {
      'input': { 'label': null },
      'name': 'rejects null value for non-nullable property',
      'schema': {
        '$id': 'https://edge.io/non-nullable',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'label': { 'type': 'string' } },
        'required': ['label'],
        'type': 'object'
      }
    },
    {
      'input': null as unknown as Record<string, unknown>,
      'name': 'unhappy: materialize with null input rejects',
      'schema': {
        '$id': 'https://edge.io/null-input',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'properties': { 'x': { 'type': 'string' } },
        'required': ['x'],
        'type': 'object'
      }
    }
  ];

  void describe('Materializer validation rejection', () => {
    for (const scenario of rejectionScenarios) {
      void it(scenario.name, () => {
        const tology = JsonTology.create({
          'baseIRI': 'urn:test:',
          ...(scenario.options ? { 'materializer': scenario.options } : {})
        });

        assert.throws(
          () => {
            return tology.materialize(scenario.schema, scenario.input);
          },
          (err: Error) => {
            return err.message.includes('Invalid');
          },
          scenario.name
        );
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Additional properties pass-through
  // ---------------------------------------------------------------------------

  void describe('Materializer passAdditionalProperties', () => {
    void it('passes extra keys through when passAdditionalProperties is true', () => {
      const StrictSchema = {
        '$id': 'https://edge.io/strict-extra-pass',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        'additionalProperties': false,
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      } as const;

      const tology = JsonTology.create({
        'baseIRI': 'urn:test:',
        'materializer': { 'passAdditionalProperties': true }
      });
      const result = tology.materialize(StrictSchema, {
        'extra': 'allowed',
        'name': 'test'
      });

      assert.strictEqual(result.name, 'test', 'passAdditionalProperties — name');
      assert.strictEqual((result as Record<string, unknown>).extra, 'allowed', 'passAdditionalProperties — extra');
    });
  });
}

// ===========================================================================
// Materializer ugly paths — cycles / depth / IRI collision / skolemizer
// ===========================================================================
{
  const BaseSchema = {
    '$id': 'https://ugly.io/base',
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'properties': {
      'debug': {
        'default': false,
        'type': 'boolean'
      },
      'name': { 'type': 'string' },
      'timeout': {
        'default': 5000,
        'type': 'number'
      }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  void describe('Materializer ugly paths', () => {
    void describe('CYCLIC_DATA via toQuads ABox projection', () => {
      const scenarios: Array<{
        'buildData': () => Record<string, unknown>;
        'name': string;
      }> = [
        {
          'buildData': () => {
            const obj: Record<string, unknown> = { 'name': 'test' };

            obj.self = obj;

            return obj;
          },
          'name': 'cyclic self-reference throws MaterializationError(CYCLIC_DATA)'
        },
        {
          'buildData': () => {
            const obj1: Record<string, unknown> = { 'name': 'obj1' };
            const obj2: Record<string, unknown> = { 'name': 'obj2' };

            obj1.peer = obj2;
            obj2.peer = obj1;

            return obj1;
          },
          'name': 'mutually cyclic objects throw MaterializationError(CYCLIC_DATA)'
        }
      ];

      for (const {
        'buildData': build, 'name': n
      } of scenarios) {
        void it(n, () => {
          const tology = JsonTology.create({
            'baseIRI': 'https://ugly.io',
            'schemas': [BaseSchema] as const
          });
          const data = build();

          assert.throws(
            () => {
              tology.toQuads(BaseSchema, data);
            },
            (err: Error) => {
              assert.equal(err.constructor.name, 'MaterializationError', `${n}: expected MaterializationError`);
              assert.equal((err as { 'code': string }).code, 'CYCLIC_DATA', `${n}: expected code CYCLIC_DATA`);
              assert.ok(
                err.message.toLowerCase().includes('cyclic'),
                `${n}: message should mention cyclic`
              );

              return true;
            },
            n
          );
        });
      }
    });

    void describe('IRI collision via deterministic content-based minting', () => {
      void it('same data produces the same IRI on separate toQuads calls', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://ugly.io',
          'schemas': [BaseSchema] as const
        });
        const data = { 'name': 'stable' };
        const quads1 = tology.toQuads(BaseSchema, data);
        const quads2 = tology.toQuads(BaseSchema, data);

        interface TypedQuad { 'predicate': string;
          'subject': string }

        const typeQuad1 = (quads1 as TypedQuad[]).find((quad) => {
          return quad.predicate === 'rdf:type';
        });
        const typeQuad2 = (quads2 as TypedQuad[]).find((quad) => {
          return quad.predicate === 'rdf:type';
        });

        assert.ok(typeQuad1, 'first projection must have rdf:type quad');
        assert.ok(typeQuad2, 'second projection must have rdf:type quad');
        assert.equal(typeQuad1.subject, typeQuad2.subject, 'same data must mint the same IRI (content-based, deterministic)');
      });

      void it('two objects with different data produce different subject IRIs', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://ugly.io',
          'schemas': [BaseSchema] as const
        });

        interface TypedQuad { 'predicate': string;
          'subject': string }

        const quads1 = tology.toQuads(BaseSchema, { 'name': 'first' });
        const quads2 = tology.toQuads(BaseSchema, { 'name': 'second' });

        const iri1 = (quads1 as TypedQuad[]).find((quad) => {
          return quad.predicate === 'rdf:type';
        })?.subject;
        const iri2 = (quads2 as TypedQuad[]).find((quad) => {
          return quad.predicate === 'rdf:type';
        })?.subject;

        assert.ok(iri1 !== undefined, 'first projection must have rdf:type quad');
        assert.ok(iri2 !== undefined, 'second projection must have rdf:type quad');
        assert.notEqual(iri1, iri2, 'different data must produce different IRIs');
      });

      void it('custom iriFor function overrides the default minter', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://ugly.io',
          'schemas': [BaseSchema] as const
        });

        interface TypedQuad { 'predicate': string;
          'subject': string }

        const customIri = 'https://custom.io/instance/42';
        const quads = tology.toQuads(BaseSchema, { 'name': 'test' }, {
          'iriFor': () => {
            return customIri;
          }
        });

        const typeQuad = (quads as TypedQuad[]).find((quad) => {
          return quad.predicate === 'rdf:type';
        });

        assert.ok(typeQuad, 'custom iriFor must produce a rdf:type quad');
        assert.equal(typeQuad.subject, customIri);
      });

      void it('BLANK_NODE_IRI_FOR produces blank-node subjects (_:b prefix)', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://ugly.io',
          'schemas': [BaseSchema] as const
        });

        interface TypedQuad { 'predicate': string;
          'subject': string }

        const quads = tology.toQuads(BaseSchema, { 'name': 'test' }, { 'iriFor': 'blank-node' });
        const typeQuad = (quads as TypedQuad[]).find((quad) => {
          return quad.predicate === 'rdf:type';
        });

        assert.ok(typeQuad, 'blank-node mode must produce a rdf:type quad');
        assert.ok(
          typeQuad.subject.startsWith('_:'),
          `blank-node subject should start with _:, got ${typeQuad.subject}`
        );
      });
    });

    void describe('iriFor that throws propagates the error', () => {
      void it('iriFor function that throws propagates raw error', () => {
        const tology = JsonTology.create({
          'baseIRI': 'https://ugly.io',
          'schemas': [BaseSchema] as const
        });

        assert.throws(
          () => {
            tology.toQuads(BaseSchema, { 'name': 'test' }, {
              'iriFor': () => {
                throw new Error('skolemizer refused to mint IRI');
              }
            });
          },
          (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.ok((err).message.includes('skolemizer refused'));

            return true;
          }
        );
      });
    });
  });
}

