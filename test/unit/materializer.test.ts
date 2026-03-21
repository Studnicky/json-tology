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
  void it('should materialize defaults, partial overrides, nested refs, and declared properties', () => {
    // --- defaults, partial overrides, and execution projection ---
    const scenarios = [
      {
        'expected': {
          'debug': false,
          'name': 'test',
          'timeout': 5000
        },
        'input': { 'name': 'test' },
        'label': 'schema defaults'
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
        'label': 'partial overrides'
      },
      {
        'expected': {
          'debug': false,
          'name': 'test',
          'timeout': 5000
        },
        'input': { 'name': 'test' },
        'label': 'execution projection'
      }
    ] as const;

    for (const scenario of scenarios) {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const config = materializer.materialize(ConfigSchema, scenario.input);

      assert.strictEqual(config.name, scenario.expected.name, `${scenario.label}: name`);
      assert.strictEqual(config.debug, scenario.expected.debug, `${scenario.label}: debug`);
      assert.strictEqual(config.timeout, scenario.expected.timeout, `${scenario.label}: timeout`);
    }

    // --- nested defaults via $ref ---
    {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const nested = materializer.materialize(NestedSchema, {});

      assert.strictEqual(nested.inner.value, 42);
    }

    // --- build from partial when required properties have defaults ---
    {
      const SchemaWithDefaults = {
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
      } as const;

      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const result = materializer.materialize(SchemaWithDefaults, {});

      assert.strictEqual(result.field, 'default-value');
    }

    // --- all declared properties appear on output ---
    {
      const propertyScenarios = [
        {
          'expectedKeys': [
            'name',
            'debug',
            'timeout'
          ],
          'input': { 'name': 'test' },
          'label': 'non-required properties with defaults present',
          'schema': ConfigSchema
        },
        {
          'expectedKeys': [
            'required',
            'optional'
          ],
          'input': { 'required': 'yes' },
          'label': 'non-required property with no default is undefined',
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
      ] as const;

      for (const scenario of propertyScenarios) {
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        const result = materializer.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

        for (const key of scenario.expectedKeys) {
          assert.ok(key in result, `${scenario.label}: ${key} must be present`);
        }
      }

      // Additional assertion: optional property without default is undefined
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const result = materializer.materialize(propertyScenarios[1].schema, { 'required': 'yes' }) as Record<string, unknown>;

      assert.strictEqual(result.optional, undefined);
    }
  });

  void it('should throw on invalid data across scenarios', () => {
    const scenarios = [
      {
        'input': { 'name': 123 as unknown as string },
        'label': 'type mismatch on required property',
        'schema': ConfigSchema,
        'strictRegistry': false
      },
      {
        'input': {},
        'label': 'missing required property',
        'schema': ConfigSchema,
        'strictRegistry': false
      },
      {
        'input': {
          'name': 'test',
          'timeout': '10000' as unknown as number
        },
        'label': 'type mismatch without coerce',
        'schema': ConfigSchema,
        'strictRegistry': false
      },
      {
        'input': {
          'extra': 'not allowed' as unknown as never,
          'name': 'test'
        },
        'label': 'extra keys without passAdditionalProperties',
        'schema': StrictSchema,
        'strictRegistry': false
      }
    ] as const;

    for (const scenario of scenarios) {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      assert.throws(
        () => {
          return materializer.materialize(scenario.schema, scenario.input);
        },
        (err: Error) => {
          return err.message.includes('Invalid');
        },
        scenario.label
      );
    }
  });

  void it('should auto-register, coerce types, and pass additional properties via options', () => {
    // --- auto-register the schema with no prior registry.register() ---
    {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const config = materializer.materialize(ConfigSchema, { 'name': 'auto' });

      assert.strictEqual(config.name, 'auto');

      // Schema should now be accessible from the registry
      assert.ok(registry.get(ConfigSchema.$id) !== undefined);
    }

    // --- coerce types when registry coerce: true ---
    {
      const registry = new SchemaRegistry({ 'castTypes': true });
      const materializer = new Materializer(registry);

      const config = materializer.materialize(ConfigSchema, {
        'name': 'test',
        'timeout': '10000' as unknown as number
      });

      assert.strictEqual(config.timeout, 10_000);
      assert.strictEqual(typeof config.timeout, 'number');
    }

    // --- allow extra keys when passAdditionalProperties: true ---
    {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry, { 'passAdditionalProperties': true });

      const result = materializer.materialize(StrictSchema, {
        'extra': 'allowed' as unknown as never,
        'name': 'test'
      });

      assert.strictEqual(result.name, 'test');
      assert.strictEqual((result as Record<string, unknown>).extra, 'allowed');
    }
  });
});

// ---------------------------------------------------------------------------
// Runtime Projection Contract (Task 02)
// ---------------------------------------------------------------------------

void describe('Runtime projection contract', () => {
  void describe('createDefault()', () => {
    void it('creates defaults from schema with defaults, required properties, and registry.create()', () => {
      // --- basic createDefault ---
      {
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);

        const result = materializer.createDefault(ConfigSchema);

        assert.deepStrictEqual(result, {
          'debug': false,
          'name': '',
          'timeout': 5000
        });
      }

      // --- registry.create() ---
      {
        const registry = new SchemaRegistry();

        registry.register(ConfigSchema);
        const result = registry.create(ConfigSchema.$id) as Record<string, unknown>;

        assert.strictEqual(result.name, '');
        assert.strictEqual(result.debug, false);
        assert.strictEqual(result.timeout, 5000);
      }
    });

    void it('resolves $ref variations, external refs, and recursive refs in createDefault()', () => {
      // --- local $defs ref and $anchor ref ---
      {
        const scenarios = [
          {
            'expected': { 'value': 42 },
            'label': 'local $defs ref',
            'property': 'inner',
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
            'expected': { 'label': 'untitled' },
            'label': '$anchor ref',
            'property': 'item',
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
          }
        ] as const;

        for (const scenario of scenarios) {
          const registry = new SchemaRegistry();
          const materializer = new Materializer(registry);

          const result = materializer.createDefault(scenario.schema) as Record<string, unknown>;

          assert.deepStrictEqual(result[scenario.property], scenario.expected, scenario.label);
        }
      }

      // --- external $ref ---
      {
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
      }

      // --- recursive refs without infinite loop ---
      {
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
      }
    });

    void it('uses const and first-enum values as defaults', () => {
      const scenarios = [
        {
          'expected': 'fixed',
          'label': 'const value',
          'property': 'kind',
          'schema': {
            '$id': 'https://example.io/const-create',
            'properties': { 'kind': { 'const': 'fixed' } },
            'required': ['kind'],
            'type': 'object'
          }
        },
        {
          'expected': 'active',
          'label': 'first enum value',
          'property': 'status',
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
      ] as const;

      for (const scenario of scenarios) {
        const registry = new SchemaRegistry();
        const materializer = new Materializer(registry);
        const result = materializer.createDefault(scenario.schema) as Record<string, unknown>;

        assert.strictEqual(result[scenario.property], scenario.expected, scenario.label);
      }
    });
  });

  void describe('execute() non-throwing API', () => {
    void it('returns valid/errors/value/abox without throwing on invalid data', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      // valid data
      const ok = materializer.execute(ConfigSchema, { 'name': 'test' }, { 'baseIRI': 'https://example.io' });

      assert.equal(ok.valid, true);
      assert.equal(ok.errors.length, 0);
      assert.equal((ok.value as Record<string, unknown>).name, 'test');
      assert.ok(Array.isArray(ok.abox));

      // invalid data — does not throw, reports errors
      const bad = materializer.execute(ConfigSchema, { 'name': 123 });

      assert.equal(bad.valid, false);
      assert.ok(bad.errors.length > 0);
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

    void it('deterministic identity and TBox coherence', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      // --- deterministic and distinct instance identity ---
      const abox1 = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');
      const abox2 = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');
      const abox3 = materializer.projectAbox(ConfigSchema, { 'name': 'bob' }, 'https://example.io');

      const subj1 = abox1.find((quad: Quad) => {
        return quad.predicate === 'rdf:type';
      })?.subject;
      const subj2 = abox2.find((quad: Quad) => {
        return quad.predicate === 'rdf:type';
      })?.subject;
      const subj3 = abox3.find((quad: Quad) => {
        return quad.predicate === 'rdf:type';
      })?.subject;

      assert.strictEqual(subj1, subj2, 'same data must produce same instance IRI');
      assert.notStrictEqual(subj1, subj3, 'different data must produce different instance IRI');

      // --- ABox instance types reference TBox classes ---
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
