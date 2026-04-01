import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { KeywordDefinitionInterface } from '../../src/interfaces/GraphEngine.js';
import { GraphEngine } from '../../src/modules/graph/graphEngine.js';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';

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

  void it('validates custom keyword, type-scoped keyword, and error-returning keyword', () => {
    // Basic custom keyword
    const schema = {
      '$id': 'https://test.com/Even',
      'evenNumber': true,
      'type': 'number'
    };
    const engine = new GraphEngine(schema, { 'keywords': [evenNumberKeyword] });

    assert.equal(engine.check(4), true);
    assert.equal(engine.check(3), false);
    assert.equal(engine.check(0), true);

    // Type-scoped keyword (only applies to numbers)
    const numberOnlyKeyword: KeywordDefinitionInterface = {
      'keyword': 'evenNumber',
      'type': 'number',
      'validate': (schemaValue, data) => {
        return schemaValue !== true || (data as number) % 2 === 0;
      }
    };
    const scopedEngine = new GraphEngine(
      {
        '$id': 'https://test.com/Scoped',
        'evenNumber': true
      },
      { 'keywords': [numberOnlyKeyword] }
    );

    assert.equal(scopedEngine.check(4), true);
    assert.equal(scopedEngine.check(3), false);
    // type mismatch, keyword skips
    assert.equal(scopedEngine.check('hello'), true);

    // Error-returning keyword
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
    const rangeEngine = new GraphEngine(
      {
        '$id': 'https://test.com/Range',
        'customRange': {
          'max': 100,
          'min': 10
        },
        'type': 'number'
      },
      { 'keywords': [rangeKeyword] }
    );

    assert.equal(rangeEngine.check(50), true);
    assert.equal(rangeEngine.check(5), false);
    assert.equal(rangeEngine.check(200), false);
    assert.equal(rangeEngine.errors(5)[0].message, 'must be >= 10');
  });

  void it('schema without custom keywords is unchanged', () => {
    const engine = new GraphEngine({
      '$id': 'https://test.com/Plain',
      'minLength': 1,
      'type': 'string'
    });

    assert.equal(engine.check('hello'), true);
    assert.equal(engine.check(''), false);
  });

  void it('threads keywords through SchemaRegistry, graph semantics, and JsonTology', () => {
    // SchemaRegistry
    const registry = new SchemaRegistry({ 'keywords': [evenNumberKeyword] });

    registry.register({
      '$id': 'https://test.com/RegEven',
      'evenNumber': true,
      'type': 'number'
    });
    assert.ok(registry.validate('https://test.com/RegEven', 3).length > 0);
    assert.equal(registry.validate('https://test.com/RegEven', 4).length, 0);

    // Graph semantics
    const reg2 = new SchemaRegistry();

    reg2.register({
      '$id': 'urn:test:graph-kw',
      'evenNumber': true,
      'type': 'number'
    } as const);
    const graph = reg2.graph('urn:test:graph-kw');
    const sem = graph.semantics(graph.rootNode);

    assert.equal(sem.extensions.evenNumber, true);
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

    // JsonTology
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
