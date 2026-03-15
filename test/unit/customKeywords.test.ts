import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { KeywordDefinitionInterface } from '../../src/interfaces/graph-engine.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';
import type { ValidationErrorType } from '../../src/types/validation.js';

void describe('Custom keyword extensions', () => {
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

  void it('validates a custom keyword constraint (evenNumber)', () => {
    const schema = {
      '$id': 'https://test.com/Even',
      'evenNumber': true,
      'type': 'number'
    };
    const engine = new GraphEngine(schema, { 'keywords': [evenNumberKeyword] });

    assert.equal(engine.check(4), true);
    assert.equal(engine.check(3), false);
    assert.equal(engine.check(0), true);
  });

  void it('custom keyword scoped to specific type', () => {
    const numberOnlyKeyword: KeywordDefinitionInterface = {
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

  void it('custom keyword returning ValidationErrorType[]', () => {
    const rangeKeyword: KeywordDefinitionInterface = {
      'keyword': 'customRange',
      'type': 'number',
      'validate': (schema, data, context): ValidationErrorType[] => {
        const spec = schema as { 'max': number;
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

    const schema = {
      '$id': 'https://test.com/Range',
      'customRange': {
        'max': 100,
        'min': 10
      },
      'type': 'number'
    };
    const engine = new GraphEngine(schema, { 'keywords': [rangeKeyword] });

    assert.equal(engine.check(50), true);
    assert.equal(engine.check(5), false);
    assert.equal(engine.check(200), false);

    const errors = engine.errors(5);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'must be >= 10');
  });

  void it('schema without custom keywords is unchanged', () => {
    const schema = {
      '$id': 'https://test.com/Plain',
      'minLength': 1,
      'type': 'string'
    };
    const engine = new GraphEngine(schema);

    assert.equal(engine.check('hello'), true);
    assert.equal(engine.check(''), false);
  });

  void it('threads keywords through SchemaRegistry', () => {
    const registry = new SchemaRegistry({ 'keywords': [evenNumberKeyword] });
    const schema = {
      '$id': 'https://test.com/RegEven',
      'evenNumber': true,
      'type': 'number'
    };

    registry.register(schema);

    const errors = registry.validate('https://test.com/RegEven', 3);

    assert.ok(errors.length > 0);
    assert.equal(registry.validate('https://test.com/RegEven', 4).length, 0);
  });

  void it('reads custom keyword values from graph semantics, not raw schema', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:graph-kw',
      'evenNumber': true,
      'type': 'number'
    } as const;

    registry.register(schema);
    const graph = registry.graph('urn:test:graph-kw');
    const sem = graph.semantics(graph.rootNode);

    // The custom keyword must appear in extensions (graph-owned), not be absent
    assert.equal(sem.extensions.evenNumber, true);
    // And execution must use that value from extensions
    const engine = new GraphEngine(schema, { 'keywords': [evenNumberKeyword] });

    assert.equal(engine.execute(4).valid, true);
    assert.equal(engine.execute(3).valid, false);
  });

  void it('threads keywords through JsonTology', () => {
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
  });
});
