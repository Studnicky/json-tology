/**
 * Materializer Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Materializer } from '../../src/modules/materialization/Materializer.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { projectGraph } from '../../src/modules/rdf/Projection.js';

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
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        const result = materializer.materialize(sch, inp) as Record<string, unknown>;

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
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        const result = materializer.materialize(sch, inp) as Record<string, unknown>;

        for (const key of keys) {
          assert.ok(key in result, `${n}: ${key} must be present`);
        }
      });
    }

    void it('optional property without default is undefined', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const result = materializer.materialize({
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
        'input': { 'name': 123 as unknown as string },
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
          'timeout': '10000' as unknown as number
        },
        'name': 'type mismatch without coerce',
        'schema': ConfigSchema
      },
      {
        'input': {
          'extra': 'not allowed' as unknown as never,
          'name': 'test'
        },
        'name': 'extra keys without passAdditionalProperties',
        'schema': StrictSchema
      },
      {
        'input': { 'name': null as unknown as string },
        'name': 'null value for required string property',
        'schema': ConfigSchema
      }
    ];

    for (const {
      'input': inp, 'name': n, 'schema': sch
    } of scenarios) {
      void it(n, () => {
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        assert.throws(
          () => {
            return materializer.materialize(sch, inp);
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
          'timeout': '10000' as unknown as number
        },
        'name': 'coerces types when registry castTypes: true',
        'registryOpts': { 'castTypes': true },
        'schema': ConfigSchema
      },
      {
        'check': (result) => {
          assert.strictEqual(result.name, 'test');
          assert.strictEqual(result.extra, 'allowed');
        },
        'input': {
          'extra': 'allowed' as unknown as never,
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
        const registry = new SchemaRegistry(rOpts);
        const materializer = new Materializer(registry, mOpts);

        const result = materializer.materialize(sch, inp) as Record<string, unknown>;

        chk(result);
      });
    }

    void it('auto-registered schema is accessible from registry', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      materializer.materialize(ConfigSchema, { 'name': 'auto' });

      assert.ok(registry.get(ConfigSchema.$id) !== undefined);
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
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        const result = materializer.createDefault(sch) as Record<string, unknown>;

        assert.deepStrictEqual(result, exp);
      });
    }

    void it('registry.create() delegates to createDefault', () => {
      const registry = new SchemaRegistry();

      registry.register(ConfigSchema);
      const result = registry.create(ConfigSchema.$id) as Record<string, unknown>;

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

      const registry = new SchemaRegistry();

      registry.register(PartSchema);
      const materializer = new Materializer(registry);
      const result = materializer.createDefault(WholeSchema) as Record<string, unknown>;

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

      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);
      const result = materializer.createDefault(RecursiveSchema) as Record<string, unknown>;

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
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        const result = materializer.execute(ConfigSchema, inp, { 'baseIRI': 'https://example.io' });

        assert.equal(result.valid, valid);
        if (errs) {
          assert.ok(result.errors.length > 0);
        } else {
          assert.equal(result.errors.length, 0);
        }
      });
    }

    void it('valid execution returns value and abox', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const ok = materializer.execute(ConfigSchema, { 'name': 'test' }, { 'baseIRI': 'https://example.io' });

      assert.equal((ok.value as Record<string, unknown>).name, 'test');
      assert.ok(Array.isArray(ok.abox));
    });
  });

  void describe('execute -> materialize -> abox projection contract', () => {
    void it('projectAbox returns well-formed quads with rdf:type and property literals', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const abox = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

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
          const registry = new SchemaRegistry();
          const materializer = new Materializer(registry);

          const abox1 = materializer.projectAbox(ConfigSchema, d1, 'https://example.io');
          const abox2 = materializer.projectAbox(ConfigSchema, d2, 'https://example.io');

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
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      registry.register(ConfigSchema);

      const graph = new SchemaGraph(ConfigSchema);
      const tbox = projectGraph(graph);
      const abox = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

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
