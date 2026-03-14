/**
 * Materializer Tests
 */

import {
  describe, it
} from 'node:test';
import * as assert from 'node:assert';
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

describe('Materializer', () => {
  it('should materialize an entity with schema defaults', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    const config = materializer.materialize(ConfigSchema, { 'name': 'test' });

    assert.strictEqual(config.name, 'test');
    assert.strictEqual(config.debug, false);
    assert.strictEqual(config.timeout, 5000);
  });

  it('should merge partial values with defaults', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    const config = materializer.materialize(ConfigSchema, {
      'name': 'custom',
      'timeout': 10_000
    });

    assert.strictEqual(config.name, 'custom');
    assert.strictEqual(config.timeout, 10_000);
    assert.strictEqual(config.debug, false);
  });

  it('should handle nested defaults via $ref', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    const nested = materializer.materialize(NestedSchema, {});

    assert.strictEqual(nested.inner.value, 42);
  });

  it('should validate and throw on invalid data', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    assert.throws(
      () => {
        return materializer.materialize(ConfigSchema, { 'name': 123 as unknown as string });
      },
      (err: Error) => {
        return err.message.includes('Invalid');
      }
    );
  });

  it('should throw if required property is missing', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    assert.throws(
      () => {
        return materializer.materialize(ConfigSchema, {});
      },
      (err: Error) => {
        return err.message.includes('Invalid');
      }
    );
  });

  it('should build from partial without all required properties if they have defaults', () => {
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
  });

  it('should set non-required properties without defaults to undefined (never omit keys)', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    const config = materializer.materialize(ConfigSchema, { 'name': 'test' });

    assert.ok('name' in config, 'name must be present');
    assert.ok('debug' in config, 'debug must be present');
    assert.ok('timeout' in config, 'timeout must be present');
  });

  it('should set non-required property with no default to undefined', () => {
    const SchemaWithOptional = {
      '$id': 'https://example.io/optional',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'optional': { 'type': 'string' },
        'required': { 'type': 'string' }
      },
      'required': ['required'],
      'type': 'object'
    } as const;

    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    const result = materializer.materialize(SchemaWithOptional, { 'required': 'yes' });

    assert.ok('optional' in result, 'optional key must be present on output');
    assert.strictEqual(result.optional, undefined);
  });

  it('should auto-register the schema with no prior registry.register()', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    const config = materializer.materialize(ConfigSchema, { 'name': 'auto' });

    assert.strictEqual(config.name, 'auto');

    // Schema should now be accessible from the registry
    assert.ok(registry.get(ConfigSchema.$id) !== undefined);
  });

  it('should coerce types when registry coerce: true', () => {
    const registry = new SchemaRegistry({ 'coerce': true });
    const materializer = new Materializer(registry);

    const config = materializer.materialize(ConfigSchema, {
      'name': 'test',
      'timeout': '10000' as unknown as number
    });

    assert.strictEqual(config.timeout, 10_000);
    assert.strictEqual(typeof config.timeout, 'number');
  });

  it('should reject type mismatch without coerce option', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    assert.throws(
      () => {
        return materializer.materialize(ConfigSchema, {
          'name': 'test',
          'timeout': '10000' as unknown as number
        });
      },
      (err: Error) => {
        return err.message.includes('Invalid');
      }
    );
  });

  it('should allow extra keys when passAdditionalProperties: true', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry, { 'passAdditionalProperties': true });

    const result = materializer.materialize(StrictSchema, {
      'extra': 'allowed' as unknown as never,
      'name': 'test'
    });

    assert.strictEqual(result.name, 'test');
    assert.strictEqual((result as Record<string, unknown>).extra, 'allowed');
  });

  it('should throw on extra keys when passAdditionalProperties is not set', () => {
    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry);

    assert.throws(
      () => {
        return materializer.materialize(StrictSchema, {
          'extra': 'not allowed' as unknown as never,
          'name': 'test'
        });
      },
      (err: Error) => {
        return err.message.includes('Invalid');
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Runtime Projection Contract (Task 02)
// ---------------------------------------------------------------------------

describe('Runtime projection contract', () => {
  describe('createDefault()', () => {
    it('creates a default instance from schema with defaults and required properties', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const result = materializer.createDefault(ConfigSchema);

      assert.deepStrictEqual(result, {
        'debug': false,
        'name': '',
        'timeout': 5000
      });
    });

    it('resolves local $defs refs in create()', () => {
      const RefSchema = {
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
      };

      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const result = materializer.createDefault(RefSchema) as Record<string, unknown>;

      assert.deepStrictEqual(result.inner, { 'value': 42 });
    });

    it('creates defaults for schemas with $anchor refs', () => {
      const AnchorSchema = {
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
      };

      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);
      const result = materializer.createDefault(AnchorSchema) as Record<string, unknown>;

      assert.deepStrictEqual(result.item, { 'label': 'untitled' });
    });

    it('creates defaults for schemas with external $ref', () => {
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

    it('handles recursive refs without infinite loop', () => {
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

    it('uses const value as default', () => {
      const ConstSchema = {
        '$id': 'https://example.io/const-create',
        'properties': { 'kind': { 'const': 'fixed' } },
        'required': ['kind'],
        'type': 'object'
      };

      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);
      const result = materializer.createDefault(ConstSchema) as Record<string, unknown>;

      assert.strictEqual(result.kind, 'fixed');
    });

    it('uses first enum value as default', () => {
      const EnumSchema = {
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
      };

      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);
      const result = materializer.createDefault(EnumSchema) as Record<string, unknown>;

      assert.strictEqual(result.status, 'active');
    });
  });

  describe('execute → materialize → abox projection contract', () => {
    it('materialize is a projection over validation execution output', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      // materialize() calls execute() internally and projects defaults
      const result = materializer.materialize(ConfigSchema, { 'name': 'test' });

      assert.strictEqual(result.debug, false);
      assert.strictEqual(result.timeout, 5000);
      assert.strictEqual(result.name, 'test');
    });

    it('projectAbox returns Quad[] from shared RDF projection path', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const abox = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

      assert.ok(Array.isArray(abox));
      assert.ok(abox.length > 0);

      // Quads have subject, predicate, object structure
      const first = abox[0] as { 'object': { 'type': string }
        'predicate': string;
        'subject': string; };

      assert.ok(typeof first.subject === 'string', 'quad must have string subject');
      assert.ok(typeof first.predicate === 'string', 'quad must have string predicate');
      assert.ok(typeof first.object === 'object', 'quad must have object');
      assert.ok(typeof first.object.type === 'string', 'quad object must have type');
    });

    it('ABox quads include rdf:type pointing to schema $id', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const abox = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

      const typeQuad = abox.find((q: { 'object': { 'type': string;
        'value'?: unknown }
      'predicate': string; }) => {
        return q.predicate === 'rdf:type' && q.object.type === 'iri' && q.object.value === ConfigSchema.$id;
      });

      assert.ok(typeQuad, 'ABox must contain rdf:type quad referencing schema $id');
    });

    it('ABox quads include property values with correct literals', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const abox = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

      const nameQuad = abox.find((q: { 'object': { 'type': string;
        'value'?: unknown }
      'predicate': string; }) => {
        return q.predicate.endsWith('#name') && q.object.type === 'literal' && q.object.value === 'test';
      });

      assert.ok(nameQuad, 'ABox must contain name property quad');
    });

    it('deterministic instance identity: same data produces same subject IRI', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const abox1 = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');
      const abox2 = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

      const subj1 = abox1.find((q: { 'predicate': string }) => {
        return q.predicate === 'rdf:type';
      })?.subject;
      const subj2 = abox2.find((q: { 'predicate': string }) => {
        return q.predicate === 'rdf:type';
      })?.subject;

      assert.strictEqual(subj1, subj2, 'same data must produce same instance IRI');
    });

    it('different data produces different subject IRI', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      const abox1 = materializer.projectAbox(ConfigSchema, { 'name': 'alice' }, 'https://example.io');
      const abox2 = materializer.projectAbox(ConfigSchema, { 'name': 'bob' }, 'https://example.io');

      const subj1 = abox1.find((q: { 'predicate': string }) => {
        return q.predicate === 'rdf:type';
      })?.subject;
      const subj2 = abox2.find((q: { 'predicate': string }) => {
        return q.predicate === 'rdf:type';
      })?.subject;

      assert.notStrictEqual(subj1, subj2, 'different data must produce different instance IRI');
    });
  });

  describe('TBox + ABox coherence through Materializer', () => {
    it('ABox instance types reference TBox classes', () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);

      registry.register(ConfigSchema);

      const graph = new SchemaGraph(ConfigSchema);
      const tbox = projectGraph(graph);
      const abox = materializer.projectAbox(ConfigSchema, { 'name': 'test' }, 'https://example.io');

      const tboxClasses = new Set(tbox
        .filter((q: { 'object': { 'type': string;
          'value': unknown }
        'predicate': string; }) => {
          return q.predicate === 'rdf:type' && q.object.type === 'iri' && q.object.value === 'owl:Class';
        })
        .map((q: { 'subject': string }) => {
          return q.subject;
        }));

      const aboxTypes = abox
        .filter((q: { 'object': { 'type': string }
          'predicate': string; }) => {
          return q.predicate === 'rdf:type' && q.object.type === 'iri';
        })
        .map((q: { 'object': { 'value': unknown } }) => {
          return q.object.value;
        });

      for (const aboxType of aboxTypes) {
        assert.ok(
          tboxClasses.has(aboxType),
          `ABox type ${aboxType} should be declared as owl:Class in TBox`
        );
      }
    });
  });

  describe('registry.create()', () => {
    it('creates a default instance via registry', () => {
      const registry = new SchemaRegistry();

      registry.register(ConfigSchema);
      const result = registry.create(ConfigSchema.$id) as Record<string, unknown>;

      assert.strictEqual(result.name, '');
      assert.strictEqual(result.debug, false);
      assert.strictEqual(result.timeout, 5000);
    });
  });
});
