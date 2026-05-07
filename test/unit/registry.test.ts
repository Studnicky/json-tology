// Merged from: configInheritance.test.ts, findDuplicates.test.ts, formatRegistry.test.ts, schemaLoader.test.ts, customKeywords.test.ts, resolverMerge.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// KeywordDefinitionInterface is the contract for custom keyword shapes; not surfaced via the public API.
import type { KeywordDefinitionInterface } from '../../src/interfaces/GraphEngine.js';
// ValidationErrorType is the per-error structural type used by ValidationErrors; not re-exported publicly.
import type { ValidationErrorType } from '../../src/types/Validation.js';
import {
  after, before, describe, it
} from 'node:test';
import {
  mkdirSync, rmSync, writeFileSync
} from 'node:fs';
import {
  Compose, GraphEngine, InstantiationError, JsonTology, Resolver
} from '../../src/index.js';
// Internal access: FormatRegistry's builtin() / register() mechanics are tested
// directly; the public API exposes formats only as a config option.
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';
// Internal access: SchemaLoader file-system loading + logger plumbing is tested
// directly; the public JsonTology API does not expose a loader surface.
import { SchemaLoader } from '../../src/modules/registry/SchemaLoader.js';
import { Logger } from '../utils/Logger.js';
import { resolve } from 'node:path';

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

      registry.register(ConfigStrictSchema);

      assert.throws(() => {
        registry.instantiate(ConfigStrictSchema.$id, {
          'age': '30',
          'name': 'Alice'
        });
      });
    });

    void it('jt:config.extra: allow retains unknown properties in coerce output', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(AllowExtraSchema);
      const result = registry.instantiate(AllowExtraSchema.$id, {
        'extra': 'keep-me',
        'name': 'Alice'
      }) as Record<string, unknown>;

      assert.equal(result.extra, 'keep-me');
    });

    void it('jt:config.extra: forbid raises error on unknown properties', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(ForbidExtraSchema);

      assert.throws(() => {
        registry.instantiate(ForbidExtraSchema.$id, {
          'name': 'Alice',
          'unexpected': 'value'
        });
      }, (error: unknown) => {
        return error instanceof InstantiationError;
      });
    });

    void it('jt:config.extra: forbid allows known properties only', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(ForbidExtraSchema);
      const result = registry.instantiate(ForbidExtraSchema.$id, { 'name': 'Alice' });

      assert.deepEqual(result, { 'name': 'Alice' });
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

    void it('extra: forbid reports EXTRA_FORBIDDEN error keyword', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(ForbidExtraSchema);
      const errs = registry.validate(ForbidExtraSchema.$id, {
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

      registry.register(EmailSchema);
      registry.register({
        '$id': 'urn:test:Other',
        'type': 'number'
      });

      assert.deepStrictEqual(registry.findDuplicates(), []);
    });

    void it('detects structurally-identical leaf shape that matches a registered schema', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(EmailSchema);
      registry.register(PersonSchema);

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

      registry.register(Base);
      registry.register(Container);

      const dups = registry.findDuplicates();

      assert.ok(dups.length > 0, 'structural match despite different titles');
    });

    void it('reports correct schemaId and equivalentTo fields', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(EmailSchema);
      registry.register(PersonSchema);

      const dups = registry.findDuplicates();
      const dup = dups[0];

      assert.ok(typeof dup.schemaId === 'string', 'schemaId is string');
      assert.ok(typeof dup.equivalentTo === 'string', 'equivalentTo is string');
      assert.ok(typeof dup.pointer === 'string', 'pointer is string');
      assert.ok(typeof dup.shape === 'object', 'shape is object');
    });

    void it('returns empty when only $ref properties exist', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test' }).registry;

      registry.register(EmailSchema);
      registry.register({
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

      registry.register('phone', (value) => {
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

      void it('edge: unknown format returns undefined', () => {
        assert.strictEqual(registry.get('nonexistent'), undefined);
        assert.ok(!registry.has('nonexistent'));
      });
    });

    void describe('GraphEngine integration and override', () => {
      void it('happy: validates with custom format via GraphEngine', () => {
        const registry = FormatRegistry.builtin();

        registry.register('hex-color', (value) => {
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

        const engine = new GraphEngine(schema, { 'formatRegistry': registry });

        assert.ok(engine.check('#ff00aa'));
        assert.ok(!engine.check('not-a-color'));
      });

      void it('edge: registering over existing format overrides it', () => {
        const registry = FormatRegistry.builtin();

        registry.register('email', () => {
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

        const emailEngine = new GraphEngine(emailSchema, { 'formatRegistry': registry });

        assert.ok(!emailEngine.check('user@example.com'));
      });
    });
  });
}

// ===========================================================================
// Source: schemaLoader.test.ts
// ===========================================================================
{
  const testDir = resolve(import.meta.dirname, 'fixtures', 'schemas');
  const validDir = resolve(testDir, 'valid');
  const invalidDir = resolve(testDir, 'invalid');
  const nestedDir = resolve(validDir, 'nested');
  const emptyDir = resolve(testDir, 'empty');
  const nonJsonDir = resolve(testDir, 'non-json-only');
  const dupDir = resolve(testDir, 'duplicates');

  void describe('SchemaLoader', () => {
    before(() => {
      mkdirSync(nestedDir, { 'recursive': true });
      mkdirSync(invalidDir, { 'recursive': true });
      mkdirSync(emptyDir, { 'recursive': true });
      mkdirSync(nonJsonDir, { 'recursive': true });
      mkdirSync(dupDir, { 'recursive': true });

      // Valid schemas
      writeFileSync(
        resolve(validDir, 'user.json'),
        JSON.stringify({
          '$id': 'https://example.io/user',
          'properties': {
            'id': { 'type': 'number' },
            'name': { 'type': 'string' }
          },
          'required': [
            'id',
            'name'
          ],
          'type': 'object'
        })
      );

      writeFileSync(
        resolve(nestedDir, 'product.json'),
        JSON.stringify({
          '$id': 'https://example.io/product',
          'properties': {
            'price': { 'type': 'number' },
            'sku': { 'type': 'string' }
          },
          'required': ['sku'],
          'type': 'object'
        })
      );

      // Invalid schemas
      writeFileSync(resolve(invalidDir, 'no-id.json'), JSON.stringify({ 'type': 'object' }));
      writeFileSync(resolve(invalidDir, 'bad-json.json'), '{ invalid json }');
      writeFileSync(resolve(invalidDir, 'not-object.json'), JSON.stringify([
        1,
        2,
        3
      ]));

      // Non-JSON files only
      writeFileSync(resolve(nonJsonDir, 'readme.txt'), 'This is not JSON');
      writeFileSync(resolve(nonJsonDir, 'notes.md'), '# Notes');

      // Duplicates
      const dupSchema = {
        '$id': 'https://example.io/duplicate',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      };

      writeFileSync(resolve(dupDir, 'file1.json'), JSON.stringify(dupSchema));
      writeFileSync(resolve(dupDir, 'file2.json'), JSON.stringify(dupSchema));

      // readme.txt in valid dir for filter test
      writeFileSync(resolve(validDir, 'readme.txt'), 'This is not JSON');
    });

    after(() => {
      rmSync(testDir, {
        'force': true,
        'recursive': true
      });
    });

    void describe('loadSchema', () => {
      const loadFileScenarios: Array<{
        'expectedId'?: string;
        'expectNull'?: boolean;
        'name': string;
        'path': string;
      }> = [
        {
          'expectedId': 'https://example.io/user',
          'name': 'happy: loads a valid schema with $id',
          'path': resolve(validDir, 'user.json')
        },
        {
          'expectNull': true,
          'name': 'unhappy: returns null for invalid JSON',
          'path': resolve(invalidDir, 'bad-json.json')
        },
        {
          'expectNull': true,
          'name': 'unhappy: returns null for schema without $id',
          'path': resolve(invalidDir, 'no-id.json')
        },
        {
          'expectNull': true,
          'name': 'unhappy: returns null for non-object schema (array)',
          'path': resolve(invalidDir, 'not-object.json')
        },
        {
          'expectNull': true,
          'name': 'edge: returns null for nonexistent file path',
          'path': resolve(testDir, 'does-not-exist.json')
        }
      ];

      for (const {
        'expectedId': id, 'expectNull': isNull, 'name': scenarioName, 'path': filePath
      } of loadFileScenarios) {
        void it(scenarioName, () => {
          const loader = new SchemaLoader(new Logger({ 'silent': true }));
          const schema = loader.loadSchema(filePath);

          if (isNull === true) {
            assert.strictEqual(schema, null);
          } else {
            assert.ok(schema);
            assert.strictEqual(schema.$id, id);
          }
        });
      }
    });

    void describe('loadDirectory', () => {
      const loadDirScenarios: Array<{
        'checkErrors'?: (errors: ReadonlyArray<{ 'reason': string }>) => void;
        'dir': string;
        'expectedFailed': number;
        'expectedLoaded': number;
        'name': string;
        'options'?: {
          'filePattern'?: RegExp;
          'stopOnError'?: boolean;
        };
      }> = [
        {
          'dir': validDir,
          'expectedFailed': 0,
          'expectedLoaded': 2,
          'name': 'happy: loads all schemas recursively from valid directory'
        },
        {
          'checkErrors': (errors) => {
            assert.ok(errors.some((err) => {
              return err.reason === 'invalid-json';
            }));
            assert.ok(errors.some((err) => {
              return err.reason === 'missing-id';
            }));
          },
          'dir': invalidDir,
          'expectedFailed': 3,
          'expectedLoaded': 0,
          'name': 'unhappy: reports loading errors with reasons'
        },
        {
          'checkErrors': (errors) => {
            assert.ok(errors.some((err) => {
              return err.reason === 'duplicate-id';
            }));
          },
          'dir': dupDir,
          'expectedFailed': 1,
          'expectedLoaded': 1,
          'name': 'unhappy: detects duplicate schema IDs'
        },
        {
          'dir': emptyDir,
          'expectedFailed': 0,
          'expectedLoaded': 0,
          'name': 'edge: handles empty directory with zero loaded and zero failed'
        },
        {
          'dir': nonJsonDir,
          'expectedFailed': 0,
          'expectedLoaded': 0,
          'name': 'edge: directory with only non-JSON files loads nothing'
        }
      ];

      for (const {
        'checkErrors': errorCheck, 'dir': dirPath, 'expectedFailed': failed, 'expectedLoaded': loaded, 'name': scenarioName, options
      } of loadDirScenarios) {
        void it(scenarioName, () => {
          const loader = new SchemaLoader(new Logger({ 'silent': true }));
          const [
            loadedSchemas,
            result
          ] = loader.loadDirectory(dirPath, options);

          assert.strictEqual(loadedSchemas.length, loaded);
          assert.strictEqual(result.failed, failed);

          if (errorCheck) {
            errorCheck(result.errors);
          }
        });
      }

      void it('happy: filters by file pattern and counts skipped files', () => {
        const loader = new SchemaLoader(new Logger({ 'silent': true }));
        const [
          _,
          result
        ] = loader.loadDirectory(validDir, { 'filePattern': /\.json$/iu });

        assert.strictEqual(result.skipped, 1);
      });

      void it('unhappy: stops on first error when stopOnError is true', () => {
        const loader = new SchemaLoader(new Logger({ 'silent': true }));
        const [
          _,
          result
        ] = loader.loadDirectory(invalidDir, { 'stopOnError': true });

        assert.ok(result.failed > 0);
      });

      void it('edge: nonexistent directory produces zero results', () => {
        const loader = new SchemaLoader(new Logger({ 'silent': true }));
        const [
          loadedSchemas,
          result
        ] = loader.loadDirectory(resolve(testDir, 'does-not-exist'));

        assert.strictEqual(loadedSchemas.length, 0);
        assert.strictEqual(result.failed, 0);
        assert.strictEqual(result.successful, 0);
      });
    });

    void describe('logging', () => {
      void it('happy: invokes custom logger during directory loading', () => {
        const logs: string[] = [];
        const mockLogger = {
          'debug': (msg: string) => {
            return logs.push(`DEBUG: ${msg}`);
          },
          'error': (msg: string) => {
            return logs.push(`ERROR: ${msg}`);
          },
          'fatal': (msg: string) => {
            return logs.push(`FATAL: ${msg}`);
          },
          'info': (msg: string) => {
            return logs.push(`INFO: ${msg}`);
          },
          'trace': (msg: string) => {
            return logs.push(`TRACE: ${msg}`);
          },
          'warn': (msg: string) => {
            return logs.push(`WARN: ${msg}`);
          }
        };

        const loader = new SchemaLoader(mockLogger);

        loader.loadDirectory(validDir);

        assert.ok(logs.some((log) => {
          return log.includes('Loading schemas from');
        }));
        assert.ok(logs.some((log) => {
          return log.includes('Load complete');
        }));
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

          registry.register({
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

          reg2.register({
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
    void it('returns base when override is undefined', () => {
      const base = {
        'applyDefaults': true,
        'castTypes': false,
        'collectErrors': true
      };
      const result = Resolver.merge(base);

      assert.deepEqual(result, base);
    });

    void it('override keys win when defined', () => {
      const base = {
        'applyDefaults': true,
        'collectErrors': true
      };
      const result = Resolver.merge(base, { 'applyDefaults': false });

      assert.equal(result.applyDefaults, false, 'override key replaces base value');
      assert.equal(result.collectErrors, true, 'unrelated base key is preserved');
    });

    void it('override keys with undefined value do NOT blank base', () => {
      const base = {
        'applyDefaults': true,
        'castTypes': false
      };
      const override: Partial<typeof base> = { 'applyDefaults': undefined };
      const result = Resolver.merge(base, override);

      assert.equal(result.applyDefaults, true, 'undefined override does not overwrite base');
    });

    void it('empty override object returns shallow-cloned base unchanged', () => {
      const base = {
        'applyDefaults': true,
        'collectErrors': true
      };
      const result = Resolver.merge(base, {});

      assert.deepEqual(result, base);
      assert.notEqual(result, base, 'result is a new object, not the same reference');
    });

    void it('nested object values are NOT deep-merged (shallow only)', () => {
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
    });

    void it('type signature preserves the T shape', () => {
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
    });
  });
}

