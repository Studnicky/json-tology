import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GraphEngine, type KeywordDefinition } from '../../src/schema/GraphEngine.js';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';
import type { ValidationError } from '../../src/interfaces/validation.js';

describe('Custom keyword extensions', () => {
  const evenNumberKeyword: KeywordDefinition = {
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

  it('validates a custom keyword constraint (evenNumber)', () => {
    const schema = {
      '$id': 'https://test.com/Even',
      'type': 'number',
      'evenNumber': true
    };
    const engine = new GraphEngine(schema, { 'keywords': [evenNumberKeyword] });

    assert.equal(engine.check(4), true);
    assert.equal(engine.check(3), false);
    assert.equal(engine.check(0), true);
  });

  it('custom keyword scoped to specific type', () => {
    const numberOnlyKeyword: KeywordDefinition = {
      'keyword': 'evenNumber',
      'type': 'number',
      'validate': (schema, data) => {
        if (schema !== true) {
          return true;
        }

        return (data as number) % 2 === 0;
      }
    };

    const schema = {
      '$id': 'https://test.com/Scoped',
      'evenNumber': true
    };
    const engine = new GraphEngine(schema, { 'keywords': [numberOnlyKeyword] });

    // Number type: keyword applies
    assert.equal(engine.check(4), true);
    assert.equal(engine.check(3), false);

    // String type: keyword does not apply (type mismatch)
    assert.equal(engine.check('hello'), true);
  });

  it('custom keyword returning ValidationError[]', () => {
    const rangeKeyword: KeywordDefinition = {
      'keyword': 'customRange',
      'type': 'number',
      'validate': (schema, data, context): ValidationError[] => {
        const spec = schema as { max: number; min: number };
        const value = data as number;
        const errors: ValidationError[] = [];

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

    const schema = {
      '$id': 'https://test.com/Range',
      'type': 'number',
      'customRange': { 'max': 100, 'min': 10 }
    };
    const engine = new GraphEngine(schema, { 'keywords': [rangeKeyword] });

    assert.equal(engine.check(50), true);
    assert.equal(engine.check(5), false);
    assert.equal(engine.check(200), false);

    const errors = engine.errors(5);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'must be >= 10');
  });

  it('schema without custom keywords is unchanged', () => {
    const schema = {
      '$id': 'https://test.com/Plain',
      'type': 'string',
      'minLength': 1
    };
    const engine = new GraphEngine(schema);

    assert.equal(engine.check('hello'), true);
    assert.equal(engine.check(''), false);
  });

  it('threads keywords through SchemaRegistry', () => {
    const registry = new SchemaRegistry({
      'keywords': [evenNumberKeyword]
    });
    const schema = {
      '$id': 'https://test.com/RegEven',
      'type': 'number',
      'evenNumber': true
    };
    registry.register(schema);

    const errors = registry.validate('https://test.com/RegEven', 3);

    assert.ok(errors.length > 0);
    assert.equal(registry.validate('https://test.com/RegEven', 4).length, 0);
  });

  it('threads keywords through JsonTology', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.com',
      'keywords': [evenNumberKeyword],
      'schemas': [{
        '$id': 'https://test.com/JtEven',
        'type': 'number',
        'evenNumber': true
      }]
    });

    assert.equal(jt.validate('https://test.com/JtEven', 4).length, 0);
    assert.ok(jt.validate('https://test.com/JtEven', 3).length > 0);
  });
});
