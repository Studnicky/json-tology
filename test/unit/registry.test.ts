// Merged from: configInheritance.test.ts, findDuplicates.test.ts, formatRegistry.test.ts, schemaLoader.test.ts, customKeywords.test.ts, resolverMerge.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// KeywordDefinitionInterface is the contract for custom keyword shapes; not surfaced via the public API.
import type { KeywordDefinitionInterface } from '../../src/interfaces/GraphEngine.js';
// ValidationErrorType is the per-error structural type used by ValidationErrors; not re-exported publicly.
import type { ValidationErrorType } from '../../src/types/Validation.js';
import {
  describe, it
} from 'node:test';
import {
  Compose, GraphEngine, InstantiationError, JsonTology, Resolver
} from '../../src/index.js';
// Internal access: FormatRegistry's builtin() / register() mechanics are tested
// directly; the public API exposes formats only as a config option.
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';

// ===========================================================================
// Source: configInheritance.test.ts
// ===========================================================================
{
  const BaseSchema = {
    '$id': 'https://ex.io/Base',
    'jt:config': {
      'extra': 'allow',
      'strict': false
    },
    'properties': {
      'name': { 'type': 'string' },
      'score': { 'type': 'number' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const ForbidExtraSchema = {
    '$id': 'https://ex.io/ForbidExtra',
    'jt:config': { 'extra': 'forbid' },
    'properties': { 'name': { 'type': 'string' } },
    'required': ['name'],
    'type': 'object'
  } as const;

  const AllowExtraSchema = {
    '$id': 'https://ex.io/AllowExtra',
    'jt:config': { 'extra': 'allow' },
    'properties': { 'name': { 'type': 'string' } },
    'required': ['name'],
    'type': 'object'
  } as const;

  void describe('jt:config inheritance', () => {
    void it('jt:config.strict applies to all fields without individual override', () => {
      const ConfigStrictSchema = {
        '$id': 'https://ex.io/ConfigStrict',
        'jt:config': { 'strict': true },
        'properties': {
          'age': { 'type': 'integer' },
          'name': { 'type': 'string' }
        },
        'required': [
          'age',
          'name'
        ],
        'type': 'object'
      } as const;

      const registry = JsonTology.create({
        'baseIRI': 'urn:test',
        'enableTypeCast': true
      }).registry;

      registry.set(ConfigStrictSchema);

      assert.throws(() => {
        registry.instantiate(ConfigStrictSchema.$id, {
          'age': '30',
          'name': 'Alice'
        });
      });
    });

    void it('jt:config.extra: allow retains unknown properties in coerce output', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.set(AllowExtraSchema);
      const result = registry.instantiate(AllowExtraSchema.$id, {
        'extra': 'keep-me',
        'name': 'Alice'
      }) as Record<string, unknown>;

      assert.equal(result.extra, 'keep-me');
    });

    void it('jt:config.extra: forbid — GBU: rejects unknown props (InstantiationError), accepts known only, reports EXTRA_FORBIDDEN keyword', () => {
      // Bad: rejects unknown properties with InstantiationError
      const reg1 = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      reg1.set(ForbidExtraSchema);

      assert.throws(() => {
        reg1.instantiate(ForbidExtraSchema.$id, {
          'name': 'Alice',
          'unexpected': 'value'
        });
      }, (error: unknown) => {
        return error instanceof InstantiationError;
      });

      // Good: accepts only known properties
      const reg2 = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      reg2.set(ForbidExtraSchema);
      const result = reg2.instantiate(ForbidExtraSchema.$id, { 'name': 'Alice' });

      assert.deepEqual(result, { 'name': 'Alice' });

      // Ugly: validate() reports EXTRA_FORBIDDEN keyword
      const reg3 = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      reg3.set(ForbidExtraSchema);
      const errs = reg3.validate(ForbidExtraSchema.$id, {
        'name': 'Alice',
        'unexpected': 'value'
      });

      assert.ok(!errs.ok);

      const allErrors: ValidationErrorType[] = [];

      for (const err of errs) {
        allErrors.push(err);
      }

      assert.ok(allErrors.some((err) => {
        return err.keyword === 'EXTRA_FORBIDDEN';
      }));
    });

    void it('extend() merges jt:config — child wins per key', () => {
      const ChildSchema = Compose.extend(
        BaseSchema,
        {
          'jt:config': { 'extra': 'forbid' },
          'role': { 'type': 'string' }
        } as const,
        'https://ex.io/Child'
      ) as Record<string, unknown>;

      // jt:config is on the additions block (allOf[1]) in the allOf+$ref shape
      const allOf = ChildSchema.allOf as Array<Record<string, unknown>>;
      const config = allOf[1]['jt:config'] as Record<string, unknown>;

      assert.equal(config.extra, 'forbid');
      assert.equal(config.strict, false);
    });

    void it('extend() without child config carries parent config unchanged', () => {
      const ChildNoConfig = Compose.extend(
        BaseSchema,
        { 'role': { 'type': 'string' } } as const,
        'https://ex.io/ChildNoConfig'
      ) as Record<string, unknown>;

      // jt:config from parent is carried into the additions block (allOf[1])
      const allOf = ChildNoConfig.allOf as Array<Record<string, unknown>>;
      const config = allOf[1]['jt:config'] as Record<string, unknown>;

      assert.equal(config.extra, 'allow');
      assert.equal(config.strict, false);
    });

    void it('pick() carries jt:config from source schema', () => {
      const PickedSchema = Compose.pick(
        BaseSchema,
        ['name'] as const,
        'https://ex.io/Picked'
      ) as Record<string, unknown>;

      const config = PickedSchema['jt:config'] as Record<string, unknown>;

      assert.equal(config.extra, 'allow');
    });

    void it('omit() carries jt:config from source schema', () => {
      const OmittedSchema = Compose.omit(
        BaseSchema,
        ['score'] as const,
        'https://ex.io/Omitted'
      ) as Record<string, unknown>;

      const config = OmittedSchema['jt:config'] as Record<string, unknown>;

      assert.equal(config.extra, 'allow');
    });
  });
}

// ===========================================================================
// Source: findDuplicates.test.ts
// ===========================================================================
{
  const EmailSchema = {
    '$id': 'urn:test:Email',
    'format': 'email',
    'type': 'string'
  } as const;

  const PersonSchema = {
    '$id': 'urn:test:Person',
    'properties': {
      'email': {
        'format': 'email',
        'type': 'string'
      },
      'name': { 'type': 'string' }
    },
    'type': 'object'
  } as const;

  void describe('SchemaRegistry.findDuplicates()', () => {
    void it('returns empty when no duplicates', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.set(EmailSchema);
      registry.set({
        '$id': 'urn:test:Other',
        'type': 'number'
      });

      assert.deepStrictEqual(registry.findDuplicates(), []);
    });

    void it('detects structurally-identical leaf shape that matches a registered schema', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.set(EmailSchema);
      registry.set(PersonSchema);

      const dups = registry.findDuplicates();

      assert.ok(dups.length > 0, 'should find at least one duplicate');

      const dup = dups.find((entry) => {
        return entry.equivalentTo === EmailSchema.$id;
      });

      assert.ok(dup !== undefined, 'duplicate should point to EmailSchema');
      assert.ok(dup.pointer.includes('email'), 'pointer should reference email property');
    });

    void it('ignores description/title differences when hashing', () => {
      const Base = {
        '$id': 'urn:test:Base2',
        'description': 'A base type',
        'pattern': '^\\d+$',
        'type': 'string'
      } as const;

      const Container = {
        '$id': 'urn:test:Container2',
        'properties': {
          'code': {
            'pattern': '^\\d+$',
            'title': 'Different title',
            'type': 'string'
          }
        },
        'type': 'object'
      } as const;

      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.set(Base);
      registry.set(Container);

      const dups = registry.findDuplicates();

      assert.ok(dups.length > 0, 'structural match despite different titles');
    });

    void it('reports correct schemaId and equivalentTo fields', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.set(EmailSchema);
      registry.set(PersonSchema);

      const dups = registry.findDuplicates();
      const dup = dups[0];

      assert.ok(typeof dup.schemaId === 'string', 'schemaId is string');
      assert.ok(typeof dup.equivalentTo === 'string', 'equivalentTo is string');
      assert.ok(typeof dup.pointer === 'string', 'pointer is string');
      assert.ok(typeof dup.shape === 'object', 'shape is object');
    });

    void it('returns empty when only $ref properties exist', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.set(EmailSchema);
      registry.set({
        '$id': 'urn:test:RefOnly',
        'properties': { 'email': { '$ref': 'urn:test:Email' } },
        'type': 'object'
      });

      const dups = registry.findDuplicates();

      assert.deepStrictEqual(dups, [], 'no dups when using $ref');
    });
  });
}

// ===========================================================================
// Source: formatRegistry.test.ts
// ===========================================================================
{
  void describe('FormatRegistry', () => {
    void describe('built-in format validation', () => {
      const builtinScenarios: Array<{
        'format': string;
        'name': string;
        'valid': boolean;
        'value': unknown;
      }> = [
      // --- string formats: email ---
        {
          'format': 'email',
          'name': 'happy: valid email passes',
          'valid': true,
          'value': 'user@example.com'
        },
        {
          'format': 'email',
          'name': 'unhappy: non-email string fails',
          'valid': false,
          'value': 'not-an-email'
        },
        {
          'format': 'email',
          'name': 'unhappy: number fails email validation',
          'valid': false,
          'value': 42
        },
        {
          'format': 'email',
          'name': 'edge: empty string fails email validation',
          'valid': false,
          'value': ''
        },
        // --- number formats: int32 ---
        {
          'format': 'int32',
          'name': 'happy: valid int32 passes',
          'valid': true,
          'value': 42
        },
        {
          'format': 'int32',
          'name': 'unhappy: value exceeding int32 range fails',
          'valid': false,
          'value': 2_147_483_648
        },
        {
          'format': 'int32',
          'name': 'unhappy: string fails int32 validation',
          'valid': false,
          'value': '42'
        },
        // --- format existence ---
        {
          'format': 'uri',
          'name': 'happy: uri format exists and validates',
          'valid': true,
          'value': 'https://example.com'
        },
        {
          'format': 'date',
          'name': 'happy: date format exists and validates',
          'valid': true,
          'value': '2024-01-15'
        },
        {
          'format': 'uuid',
          'name': 'happy: uuid format exists and validates',
          'valid': true,
          'value': '550e8400-e29b-41d4-a716-446655440000'
        }
      ];

      const registry = FormatRegistry.builtin();

      for (const {
        'format': format, 'name': name, 'valid': valid, 'value': value
      } of builtinScenarios) {
        void it(name, () => {
          assert.ok(registry.has(format));
          const validator = registry.get(format);

          assert.ok(validator !== undefined);
          assert.equal(validator(value), valid);
        });
      }

      const formatExistenceScenarios: Array<{
        'format': string;
        'name': string;
      }> = [
        {
          'format': 'email',
          'name': 'happy: email format registered'
        },
        {
          'format': 'uri',
          'name': 'happy: uri format registered'
        },
        {
          'format': 'date',
          'name': 'happy: date format registered'
        },
        {
          'format': 'date-time',
          'name': 'happy: date-time format registered'
        },
        {
          'format': 'uuid',
          'name': 'happy: uuid format registered'
        },
        {
          'format': 'ipv4',
          'name': 'happy: ipv4 format registered'
        },
        {
          'format': 'ipv6',
          'name': 'happy: ipv6 format registered'
        },
        {
          'format': 'hostname',
          'name': 'happy: hostname format registered'
        },
        {
          'format': 'int32',
          'name': 'happy: int32 format registered'
        },
        {
          'format': 'int64',
          'name': 'happy: int64 format registered'
        },
        {
          'format': 'float',
          'name': 'happy: float format registered'
        },
        {
          'format': 'double',
          'name': 'happy: double format registered'
        }
      ];

      for (const {
        'format': format, 'name': name
      } of formatExistenceScenarios) {
        void it(name, () => {
          assert.ok(registry.has(format));
        });
      }
    });

    void describe('custom format registration', () => {
      const customScenarios: Array<{
        'name': string;
        'valid': boolean;
        'value': unknown;
      }> = [
        {
          'name': 'happy: valid phone number passes',
          'valid': true,
          'value': '+1234567890'
        },
        {
          'name': 'unhappy: non-phone string fails',
          'valid': false,
          'value': 'not-a-phone'
        },
        {
          'name': 'edge: empty string fails phone validation',
          'valid': false,
          'value': ''
        }
      ];

      const registry = new FormatRegistry();

      registry.set('phone', (value) => {
        return typeof value === 'string' && /^\+\d{10,15}$/u.test(value);
      });

      for (const {
        'name': name, 'valid': valid, 'value': value
      } of customScenarios) {
        void it(name, () => {
          assert.ok(registry.has('phone'));
          const validator = registry.get('phone');

          assert.ok(validator !== undefined);
          assert.equal(validator(value), valid);
        });
      }

      // edge: unknown format returns undefined (no throw)
      assert.strictEqual(registry.get('nonexistent'), undefined, 'unknown format: get returns undefined');
      assert.ok(!registry.has('nonexistent'), 'unknown format: has returns false');
    });

    void describe('GraphEngine integration and override', () => {
      void it('validates with custom format via GraphEngine, and re-registering overrides the existing format', () => {
        // happy: custom format validates correctly
        const reg = FormatRegistry.builtin();

        reg.set('hex-color', (value) => {
          return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value);
        });

        const schema: Record<string, unknown> = {
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$vocabulary': {
            'https://json-schema.org/draft/2020-12/vocab/core': true,
            'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
            'https://json-schema.org/draft/2020-12/vocab/validation': true
          },
          'format': 'hex-color',
          'type': 'string'
        };

        const engine = new GraphEngine(schema, { 'formatRegistry': reg });

        assert.ok(engine.check('#ff00aa'), 'valid hex color accepted');
        assert.ok(!engine.check('not-a-color'), 'invalid hex color rejected');

        // edge: re-registering over an existing format overrides it
        const overrideReg = FormatRegistry.builtin();

        overrideReg.set('email', () => {
          return false;
        });

        const emailSchema: Record<string, unknown> = {
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$vocabulary': {
            'https://json-schema.org/draft/2020-12/vocab/core': true,
            'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
            'https://json-schema.org/draft/2020-12/vocab/validation': true
          },
          'format': 'email',
          'type': 'string'
        };

        const emailEngine = new GraphEngine(emailSchema, { 'formatRegistry': overrideReg });

        assert.ok(!emailEngine.check('user@example.com'), 'overridden email format rejects valid email');
      });
    });
  });
}


// ===========================================================================
// Source: customKeywords.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Shared keywords
// ---------------------------------------------------------------------------

  const evenNumberKeyword: KeywordDefinitionInterface = {
    'keyword': 'evenNumber',
    'validate': (schema, data) => {
      if (schema !== true) {
        return true;
      }
      if (typeof data !== 'number') {
        return true;
      }

      return data % 2 === 0;
    }
  };

  const numberOnlyKeyword: KeywordDefinitionInterface = {
    'keyword': 'evenNumber',
    'type': 'number',
    'validate': (schemaValue, data) => {
      return schemaValue !== true || (data as number) % 2 === 0;
    }
  };

  const rangeKeyword: KeywordDefinitionInterface = {
    'keyword': 'customRange',
    'type': 'number',
    'validate': (schemaValue, data, context): ValidationErrorType[] => {
      const spec = schemaValue as { 'max': number;
        'min': number };
      const value = data as number;
      const errors: ValidationErrorType[] = [];

      if (value < spec.min) {
        errors.push({
          'keyword': 'customRange',
          'message': `must be >= ${spec.min}`,
          'params': { 'min': spec.min },
          'path': context.path
        });
      }
      if (value > spec.max) {
        errors.push({
          'keyword': 'customRange',
          'message': `must be <= ${spec.max}`,
          'params': { 'max': spec.max },
          'path': context.path
        });
      }

      return errors;
    }
  };

  // ---------------------------------------------------------------------------
  // Custom keyword validation
  // ---------------------------------------------------------------------------

  void describe('Custom keyword validation', () => {
    const validationScenarios: Array<{
      'data': unknown;
      'keyword': KeywordDefinitionInterface;
      'name': string;
      'schema': Record<string, unknown>;
      'valid': boolean;
    }> = [
      {
        'data': 4,
        'keyword': evenNumberKeyword,
        'name': 'happy: even number passes',
        'schema': {
          '$id': 'https://test.com/Even1',
          'evenNumber': true,
          'type': 'number'
        },
        'valid': true
      },
      {
        'data': 3,
        'keyword': evenNumberKeyword,
        'name': 'unhappy: odd number fails',
        'schema': {
          '$id': 'https://test.com/Even2',
          'evenNumber': true,
          'type': 'number'
        },
        'valid': false
      },
      {
        'data': 0,
        'keyword': evenNumberKeyword,
        'name': 'happy: zero is even',
        'schema': {
          '$id': 'https://test.com/Even3',
          'evenNumber': true,
          'type': 'number'
        },
        'valid': true
      },
      {
        'data': 4,
        'keyword': numberOnlyKeyword,
        'name': 'happy: type-scoped keyword passes even',
        'schema': {
          '$id': 'https://test.com/Scoped1',
          'evenNumber': true
        },
        'valid': true
      },
      {
        'data': 3,
        'keyword': numberOnlyKeyword,
        'name': 'unhappy: type-scoped keyword rejects odd',
        'schema': {
          '$id': 'https://test.com/Scoped2',
          'evenNumber': true
        },
        'valid': false
      },
      {
        'data': 'hello',
        'keyword': numberOnlyKeyword,
        'name': 'edge: type-scoped keyword skips on type mismatch',
        'schema': {
          '$id': 'https://test.com/Scoped3',
          'evenNumber': true
        },
        'valid': true
      },
      {
        'data': 50,
        'keyword': rangeKeyword,
        'name': 'happy: range keyword accepts in-range value',
        'schema': {
          '$id': 'https://test.com/Range1',
          'customRange': {
            'max': 100,
            'min': 10
          },
          'type': 'number'
        },
        'valid': true
      },
      {
        'data': 5,
        'keyword': rangeKeyword,
        'name': 'unhappy: range keyword rejects below-min value',
        'schema': {
          '$id': 'https://test.com/Range2',
          'customRange': {
            'max': 100,
            'min': 10
          },
          'type': 'number'
        },
        'valid': false
      },
      {
        'data': 200,
        'keyword': rangeKeyword,
        'name': 'unhappy: range keyword rejects above-max value',
        'schema': {
          '$id': 'https://test.com/Range3',
          'customRange': {
            'max': 100,
            'min': 10
          },
          'type': 'number'
        },
        'valid': false
      }
    ];

    for (const {
      'data': data, 'keyword': keyword, 'name': name, 'schema': schema, 'valid': valid
    } of validationScenarios) {
      void it(name, () => {
        const engine = new GraphEngine(schema, { 'keywords': [keyword] });

        assert.equal(engine.check(data), valid);
      });
    }

    void it('unhappy: range keyword error message contains min bound', () => {
      const rangeEngine = new GraphEngine(
        {
          '$id': 'https://test.com/RangeMsg',
          'customRange': {
            'max': 100,
            'min': 10
          },
          'type': 'number'
        },
        { 'keywords': [rangeKeyword] }
      );

      assert.equal(rangeEngine.errors(5)[0].message, 'must be >= 10');
    });
  });

  // ---------------------------------------------------------------------------
  // Schema without custom keywords
  // ---------------------------------------------------------------------------

  void describe('Schema without custom keywords', () => {
    const plainScenarios: Array<{
      'data': unknown;
      'name': string;
      'schema': Record<string, unknown>;
      'valid': boolean;
    }> = [
      {
        'data': 'hello',
        'name': 'happy: plain string schema accepts valid string',
        'schema': {
          '$id': 'https://test.com/Plain1',
          'minLength': 1,
          'type': 'string'
        },
        'valid': true
      },
      {
        'data': '',
        'name': 'unhappy: plain string schema rejects empty string',
        'schema': {
          '$id': 'https://test.com/Plain2',
          'minLength': 1,
          'type': 'string'
        },
        'valid': false
      },
      {
        'data': 42,
        'name': 'edge: schema with no custom keywords ignores unknown keyword properties',
        'schema': {
          '$id': 'https://test.com/Plain3',
          'type': 'number'
        },
        'valid': true
      }
    ];

    for (const {
      'data': data, 'name': name, 'schema': schema, 'valid': valid
    } of plainScenarios) {
      void it(name, () => {
        const engine = new GraphEngine(schema);

        assert.equal(engine.check(data), valid);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Keywords through SchemaRegistry, graph semantics, and JsonTology
  // ---------------------------------------------------------------------------

  void describe('Custom keywords through integration layers', () => {
    const integrationScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const registry = JsonTology.create({
            'baseIRI': 'urn:test',
            'keywords': [evenNumberKeyword]
          }).registry;

          registry.set({
            '$id': 'https://test.com/RegEven',
            'evenNumber': true,
            'type': 'number'
          });
          assert.ok(registry.validate('https://test.com/RegEven', 3).length > 0);
          assert.equal(registry.validate('https://test.com/RegEven', 4).length, 0);
        },
        'name': 'happy: SchemaRegistry validates with custom keyword'
      },
      {
        'check': () => {
          const reg2 = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

          reg2.set({
            '$id': 'urn:test:graph-kw',
            'evenNumber': true,
            'type': 'number'
          } as const);
          const graph = reg2.graph('urn:test:graph-kw');
          const sem = graph.semantics(graph.rootNode);

          assert.equal(sem.extensions.evenNumber, true);
        },
        'name': 'happy: graph semantics expose custom keyword as extension'
      },
      {
        'check': () => {
          const engine = new GraphEngine(
            {
              '$id': 'urn:test:graph-kw-2',
              'evenNumber': true,
              'type': 'number'
            },
            { 'keywords': [evenNumberKeyword] }
          );

          assert.equal(engine.execute(4).valid, true);
          assert.equal(engine.execute(3).valid, false);
        },
        'name': 'happy: GraphEngine.execute() validates with custom keyword'
      },
      {
        'check': () => {
          const jt = JsonTology.create({
            'baseIRI': 'https://test.com',
            'keywords': [evenNumberKeyword],
            'schemas': [{
              '$id': 'https://test.com/JtEven',
              'evenNumber': true,
              'type': 'number'
            }]
          });

          assert.equal(jt.validate('https://test.com/JtEven', 4).length, 0);
          assert.ok(jt.validate('https://test.com/JtEven', 3).length > 0);
        },
        'name': 'happy: JsonTology validates with custom keyword'
      },
      {
        'check': () => {
          const jt = JsonTology.create({
            'baseIRI': 'https://test.com',
            'keywords': [numberOnlyKeyword],
            'schemas': [{
              '$id': 'https://test.com/JtScoped',
              'evenNumber': true,
              'type': 'string'
            }]
          });

          // string data should pass — keyword is scoped to number
          assert.equal(jt.validate('https://test.com/JtScoped', 'anything').length, 0);
        },
        'name': 'edge: keyword on wrong type is no-op through JsonTology'
      }
    ];

    for (const {
      'check': check, 'name': name
    } of integrationScenarios) {
      void it(name, () => {
        check();
      });
    }
  });
}

// ===========================================================================
// Source: resolverMerge.test.ts
// ===========================================================================
{
  void describe('Resolver.merge()', () => {
    void it('GBU table: no-override, key-wins, undefined-does-not-blank, empty-clone, shallow-only, T-shape', () => {
      // Good: returns base unchanged when override is undefined
      {
        const base = {
          'applyDefaults': true,
          'castTypes': false,
          'collectErrors': true
        };
        const result = Resolver.merge(base);

        assert.deepEqual(result, base, 'no override: result equals base');
      }

      // Good: override keys win when defined
      {
        const base = {
          'applyDefaults': true,
          'collectErrors': true
        };
        const result = Resolver.merge(base, { 'applyDefaults': false });

        assert.equal(result.applyDefaults, false, 'override key replaces base value');
        assert.equal(result.collectErrors, true, 'unrelated base key is preserved');
      }

      // Bad: undefined override value does NOT blank base
      {
        const base = {
          'applyDefaults': true,
          'castTypes': false
        };
        const override: Partial<typeof base> = { 'applyDefaults': undefined };
        const result = Resolver.merge(base, override);

        assert.equal(result.applyDefaults, true, 'undefined override does not overwrite base');
      }

      // Bad: empty override returns shallow clone of base
      {
        const base = {
          'applyDefaults': true,
          'collectErrors': true
        };
        const result = Resolver.merge(base, {});

        assert.deepEqual(result, base, 'empty override: result equals base');
        assert.notEqual(result, base, 'result is a new object, not the same reference');
      }

      // Ugly: nested objects are NOT deep-merged (shallow only)
      {
        interface NestedRecord { 'nested': { 'a': number;
          'b'?: number } }
        const base: NestedRecord = {
          'nested': {
            'a': 1,
            'b': 2
          }
        };
        const override: Partial<NestedRecord> = { 'nested': { 'a': 99 } };
        const result = Resolver.merge(base, override);

        assert.equal(result.nested.a, 99, 'override nested.a wins');
        assert.equal(result.nested.b, undefined, 'shallow merge: base nested.b is not preserved');
      }

      // Ugly: type signature preserves the T shape
      {
        const base = {
          'applyDefaults': true,
          'castTypes': false,
          'collectErrors': true,
          'removeAdditionalProperties': true
        };
        const result = Resolver.merge(base, { 'applyDefaults': false });

        // Compile-time check: assignment satisfies the T shape constraint
        const _typeCheck: typeof base = result;

        assert.equal(_typeCheck.applyDefaults, false, 'result satisfies the T shape');
        assert.equal(typeof result.applyDefaults, 'boolean');
        assert.equal(typeof result.castTypes, 'boolean');
      }
    });
  });
}

