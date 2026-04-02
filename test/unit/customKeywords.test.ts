import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { KeywordDefinitionInterface } from '../../src/interfaces/GraphEngine.js';
import { GraphEngine } from '../../src/modules/graph/graphEngine.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';

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
        const registry = new SchemaRegistry({ 'keywords': [evenNumberKeyword] });

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
        const reg2 = new SchemaRegistry();

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
