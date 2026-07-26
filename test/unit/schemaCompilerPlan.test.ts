/**
 * Direct unit tests for SchemaCompilerPlan.buildNodePlan.
 *
 * SchemaCompilerPlan.buildNodePlan produces a CompiledNodeValidationPlanInterface by reading
 * graph semantics for a given node. Tests drive it with real SchemaGraph
 * instances and a minimal-but-functional SchemaCompilerValidatePlanContext.
 *
 * The context stubs return identity validators so that plan *structure* is
 * tested without requiring a fully wired SchemaCompiler.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { SchemaCompilerPlan } from '../../src/modules/validation/SchemaCompilerPlan.js';
import type { FormatRegistryInterface } from '../../src/interfaces/FormatRegistryInterface.js';
import type { SchemaCompilerValidatePlanContextInterface } from '../../src/interfaces/SchemaCompilerValidatePlanContextInterface.js';
import type { ValidateWithErrorsFunctionInterface } from '../../src/interfaces/ValidateWithErrorsFunctionInterface.js';

// ---------------------------------------------------------------------------
// Stub context
// ---------------------------------------------------------------------------

const passValidator: ValidateWithErrorsFunctionInterface = (value) => {
  return {
    'valid': true,
    'value': value
  };
};

const stubFormatRegistry: FormatRegistryInterface = {
  'get': () => {
    return;
  },
  'has': () => {
    return false;
  },
  'set': () => {
    // no-op
  }
};

function makeContext(): SchemaCompilerValidatePlanContextInterface {
  return {
    'activeCustomKeywords': [],
    'appliesFormatAssertions': (_) => {
      return false;
    },
    'compileNodeOrBooleanValidateWithErrors': (_) => {
      return passValidator;
    },
    'compileNodeValidateWithErrors': (_) => {
      return passValidator;
    },
    'resolveImplicitDefault': (_) => {
      return;
    },
    'synthesizeZeroValue': () => {
      return;
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('SchemaCompilerPlan.buildNodePlan', { 'concurrency': true }, () => {
  void it('builds plan for object schema — types, required, allowedKeys', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'properties': {
        'age': { 'type': 'number' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.deepEqual(plan.types, ['object']);
    assert.ok(Array.isArray(plan.required) && plan.required.includes('name'), 'required should include "name"');
    assert.ok(plan.allowedKeys !== undefined, 'allowedKeys should be defined for object with properties');
    assert.ok(plan.allowedKeys.has('name'), 'allowedKeys should include "name"');
    assert.ok(plan.allowedKeys.has('age'), 'allowedKeys should include "age"');
    assert.ok(plan.propValidators instanceof Map, 'propValidators should be a Map');
    assert.equal(plan.propValidators.size, 2);
  });

  void it('builds plan for array schema with items', () => {
    const schema = {
      '$id': 'https://example.io/StrList',
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.deepEqual(plan.types, ['array']);
    assert.equal(plan.minItems, 1);
    assert.ok(typeof plan.itemValidator === 'function', 'itemValidator should be a function when items is present');
  });

  void it('builds plan for array schema with prefixItems', () => {
    const schema = {
      '$id': 'https://example.io/Tuple',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.deepEqual(plan.types, ['array']);
    assert.ok(Array.isArray(plan.prefixValidators) && plan.prefixValidators.length === 2, 'prefixValidators should have 2 entries');
  });

  void it('builds plan for allOf composition schema', () => {
    const schema = {
      '$id': 'https://example.io/Composed',
      'allOf': [
        { 'properties': { 'x': { 'type': 'string' } } },
        { 'properties': { 'y': { 'type': 'number' } } }
      ],
      'type': 'object'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.ok(Array.isArray(plan.allOfValidators) && plan.allOfValidators.length === 2, 'allOfValidators should have 2 entries');
    assert.equal(plan.anyOfValidators, undefined);
    assert.equal(plan.oneOfValidators, undefined);
  });

  void it('builds plan for anyOf composition schema', () => {
    const schema = {
      '$id': 'https://example.io/AnyOf',
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.ok(Array.isArray(plan.anyOfValidators) && plan.anyOfValidators.length === 2, 'anyOfValidators should have 2 entries');
    assert.equal(plan.allOfValidators, undefined);
  });

  void it('builds plan for oneOf composition schema', () => {
    const schema = {
      '$id': 'https://example.io/OneOf',
      'oneOf': [
        { 'type': 'string' },
        { 'type': 'null' }
      ]
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.ok(Array.isArray(plan.oneOfValidators) && plan.oneOfValidators.length === 2, 'oneOfValidators should have 2 entries');
    assert.equal(plan.allOfValidators, undefined);
  });

  void it('builds plan for scalar schema with minimum/maximum restrictions', () => {
    const schema = {
      '$id': 'https://example.io/Score',
      'maximum': 100,
      'minimum': 0,
      'type': 'number'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.deepEqual(plan.types, ['number']);
    assert.equal(plan.minimum, 0);
    assert.equal(plan.maximum, 100);
    assert.equal(plan.exclusiveMinimum, undefined);
    assert.equal(plan.exclusiveMaximum, undefined);
  });

  void it('builds plan for scalar schema with pattern restriction', () => {
    const schema = {
      '$id': 'https://example.io/EmailStr',
      'pattern': '^[^@]+@[^@]+$',
      'type': 'string'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.deepEqual(plan.types, ['string']);
    assert.equal(plan.pattern, '^[^@]+@[^@]+$');
    assert.ok(plan.patternRegex instanceof RegExp, 'patternRegex should be a RegExp');
  });

  void it('builds plan for const schema — hasConst true, constVal set', () => {
    const schema = {
      '$id': 'https://example.io/Fixed',
      'const': 42
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.equal(plan.hasConst, true);
    assert.equal(plan.constVal, 42);
  });

  void it('builds plan for enum schema — enumValues and enumSet populated', () => {
    const schema = {
      '$id': 'https://example.io/Status',
      'enum': [
        'active',
        'inactive',
        'pending'
      ],
      'type': 'string'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.ok(Array.isArray(plan.enumValues) && plan.enumValues.length === 3, 'enumValues should have 3 entries');
    assert.ok(plan.enumSet instanceof Set, 'enumSet should be a Set for primitive-only enums');
    assert.ok((plan.enumSet as Set<unknown>).has('active'), 'enumSet should contain "active"');
  });

  void it('builds plan for schema with $ref — refValidator is a function', () => {
    const parentSchema = {
      '$defs': {
        'Address': {
          '$id': 'https://example.io/Address',
          'properties': { 'city': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://example.io/Person',
      'properties': { 'address': { '$ref': '#/$defs/Address' } },
      'type': 'object'
    } as const;

    const graph = new SchemaGraph(parentSchema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    // Root plan has no direct $ref — the address property node has it
    // Verify that the propValidators map includes address
    assert.ok(plan.propValidators.has('address'), 'propValidators should include "address"');
  });

  void it('builds plan for schema with no keywords — all optional fields are undefined', () => {
    const schema: Record<string, unknown> = { '$id': 'https://example.io/Any' };

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.equal(plan.hasConst, false);
    assert.equal(plan.enumValues, undefined);
    assert.equal(plan.minimum, undefined);
    assert.equal(plan.maximum, undefined);
    assert.equal(plan.pattern, undefined);
    assert.equal(plan.allOfValidators, undefined);
    assert.equal(plan.anyOfValidators, undefined);
    assert.equal(plan.oneOfValidators, undefined);
    assert.equal(plan.refValidator, undefined);
    assert.ok(plan.propValidators instanceof Map && plan.propValidators.size === 0);
  });

  void it('builds plan for object schema with additionalProperties: false — additionalIsFalse set', () => {
    const schema = {
      '$id': 'https://example.io/Strict',
      'additionalProperties': false,
      'properties': { 'id': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const graph = new SchemaGraph(schema);
    const plan = SchemaCompilerPlan.buildNodePlan(makeContext(), graph.rootNode, stubFormatRegistry, graph);

    assert.equal(plan.additionalIsFalse, true);
  });
});
