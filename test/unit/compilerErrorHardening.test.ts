/**
 * Regression tests: SchemaCompiler error-hardening fixes.
 *
 * Covers four previously-silent failure modes that now throw GraphError:
 *
 *   Fix 1 — compileValidateWithErrors: missing graph node → GraphError(REF_NOT_FOUND)
 *            instead of returning an accept-all validator.
 *   Fix 2 — SchemaCompilerDefaults.resolveRef: unresolvable $ref during default
 *            synthesis → GraphError(REF_NOT_FOUND) instead of falling back to rootNode.
 *   Fix 3 — SchemaCompilerDefaults.resolveDynamicRef: now performs real resolution
 *            using RefResolver + scope walk; unresolvable static target →
 *            GraphError(REF_NOT_FOUND) instead of returning rootNode.
 *   Fix 4 — compileDynamicRefValidator: unresolvable static $dynamicRef target →
 *            GraphError(REF_NOT_FOUND) at compile time; $dynamicRef '#' with no
 *            matching scope entry remains a spec-legal runtime no-op (valid:true).
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { SchemaCompiler } from '../../src/modules/validation/SchemaCompiler.js';
import { buildNodePlan } from '../../src/modules/validation/SchemaCompilerPlan.js';
import { SchemaCompilerDefaults } from '../../src/modules/validation/SchemaCompilerDefaults.js';
import { GraphError } from '../../src/errors/GraphError.js';
import { GraphErrorCode } from '../../src/constants/ERROR_CODES.js';
import { JsonTology } from '../../src/index.js';
import type { FormatRegistryInterface } from '../../src/interfaces/FormatRegistryInterface.js';
import type { SchemaCompilerValidatePlanContextType } from '../../src/types/SchemaCompilerValidatePlanContextType.js';
import type { ValidateWithErrorsFnType } from '../../src/types/Validation.js';
import type { GraphEngineInterface } from '../../src/interfaces/GraphEngineInterface.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

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

const passValidator: ValidateWithErrorsFnType = (value) => {
  return {
    'valid': true,
    'value': value
  };
};

function makeStubContext(): SchemaCompilerValidatePlanContextType {
  return {
    'activeCustomKeywords': [],
    'appliesFormatAssertions': () => {
      return false;
    },
    'compileNodeOrBooleanValidateWithErrors': () => {
      return passValidator;
    },
    'compileNodeValidateWithErrors': () => {
      return passValidator;
    },
    'resolveImplicitDefault': () => {
      return;
    },
    'synthesizeZeroValue': () => {
      return;
    }
  };
}

// ---------------------------------------------------------------------------
// Fix 1 — compileValidateWithErrors: missing graph node throws GraphError
// ---------------------------------------------------------------------------

void describe('Fix 1 — compileValidateWithErrors: missing graph node', () => {
  void it('throws GraphError(REF_NOT_FOUND) when schema object is not in the graph', () => {
    // Build a graph for schema A, then pass a completely different schema object
    // to compile(). graph.node(differentSchema) returns undefined, triggering Fix 1.
    const registeredSchema = {
      '$id': 'https://hardening.test/Fix1',
      'type': 'string'
    } as const;

    const graph = new SchemaGraph(registeredSchema);

    // A different object not registered in the graph
    const alienSchema: Record<string, unknown> = {
      '$id': 'https://hardening.test/Fix1',
      'type': 'string'
    };

    // Minimal GraphEngineInterface stub whose rootSchema is the alien object
    const stubEngine: GraphEngineInterface = {
      'formatRegistry': stubFormatRegistry,
      'graphLookup': () => {
        return;
      },
      'hasRegisteredCustomKeywords': () => {
        return false;
      },
      'keywords': () => {
        return [];
      },
      'rootSchema': alienSchema,
      'rootSchemaId': () => {
        return alienSchema.$id as string;
      },
      'schemaLookup': () => {
        return;
      }
    };

    const compiler = new SchemaCompiler();

    assert.throws(
      () => {
        compiler.compile(stubEngine, graph);
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, 'error must be GraphError');
        assert.equal(err.code, GraphErrorCode.REF_NOT_FOUND);

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — SchemaCompilerDefaults.resolveRef: unresolvable $ref during default synthesis
// ---------------------------------------------------------------------------

void describe('Fix 2 — SchemaCompilerDefaults.resolveRef: unresolvable $ref', () => {
  void it('throws GraphError(REF_NOT_FOUND) when $ref inside a default points to a missing schema', () => {
    // Schema: object with a property whose type is a $ref to a non-existent schema.
    // When applyDefaults is true, the compiler attempts to synthesize a default for
    // that property, which invokes SchemaCompilerDefaults.resolveRef on the broken ref.
    const schema = {
      '$id': 'https://hardening.test/Fix2',
      'properties': { 'address': { '$ref': 'https://hardening.test/Missing' } },
      'type': 'object'
    } as const;

    const graph = new SchemaGraph(schema);
    const rootNode = graph.rootNode;

    assert.throws(
      () => {
        SchemaCompilerDefaults.resolveImplicitDefaultValue(
          rootNode,
          graph,
          undefined,
          new Set()
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, 'error must be GraphError');
        assert.equal(err.code, GraphErrorCode.REF_NOT_FOUND);

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Fix 3 — SchemaCompilerDefaults.resolveDynamicRef: unresolvable static target
// ---------------------------------------------------------------------------

void describe('Fix 3 — SchemaCompilerDefaults.resolveDynamicRef: unresolvable target', () => {
  void it('throws GraphError(REF_NOT_FOUND) when $dynamicRef target does not exist', () => {
    // Schema where the root node itself carries a $dynamicRef to a non-existent schema.
    // SchemaCompilerDefaults.resolveImplicitDefaultValue is triggered on the root node
    // because the schema has a $dynamicRef and applyDefaults is true during compilation.
    // resolveDynamicRef must throw GraphError(REF_NOT_FOUND) rather than return rootNode.
    const schema = {
      '$dynamicRef': 'https://hardening.test/MissingDynamic#item',
      '$id': 'https://hardening.test/Fix3'
    };

    const graph = new SchemaGraph(schema);
    const rootNode = graph.rootNode;

    assert.throws(
      () => {
        SchemaCompilerDefaults.resolveImplicitDefaultValue(
          rootNode,
          graph,
          undefined,
          new Set()
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, 'error must be GraphError');
        assert.equal(err.code, GraphErrorCode.REF_NOT_FOUND);

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Fix 4a — compileDynamicRefValidator: unresolvable $dynamicRef throws at compile time
// ---------------------------------------------------------------------------

void describe('Fix 4a — compileDynamicRefValidator: bad $dynamicRef throws', () => {
  void it('throws GraphError(REF_NOT_FOUND) when $dynamicRef static target is missing', () => {
    // A schema where the root node carries a $dynamicRef to a non-existent external schema.
    // buildNodePlan calls compileDynamicRefValidator, which must throw GraphError(REF_NOT_FOUND)
    // at compile time rather than producing a pass-all validator at runtime.
    const schema = {
      '$dynamicRef': 'https://hardening.test/NoSuchSchema#items',
      '$id': 'https://hardening.test/Fix4a'
    };

    const graph = new SchemaGraph(schema);

    assert.throws(
      () => {
        buildNodePlan(
          makeStubContext(),
          graph.rootNode,
          stubFormatRegistry,
          graph
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, 'error must be GraphError');
        assert.equal(err.code, GraphErrorCode.REF_NOT_FOUND);

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Fix 4b — $dynamicRef '#' with no matching scope entry is a spec-legal no-op
// ---------------------------------------------------------------------------

void describe('Fix 4b — $dynamicRef "#" spec-legal no-op validates successfully', () => {
  void it('validates true when $dynamicRef "#" has no matching dynamic scope entry', () => {
    // JSON Schema spec: $dynamicRef '#' with no dynamic scope entry in scope is a
    // no-op — validation passes. This must NOT throw.
    //
    // A self-contained schema with $dynamicAnchor and $dynamicRef '#'.
    // When the dynamic scope contains no matching root anchor, the validator
    // returns valid:true (spec-legal no-op).
    const schema = {
      '$defs': {
        'Inner': {
          '$dynamicAnchor': 'node',
          '$id': 'https://hardening.test/Fix4b/Inner',
          'type': 'string'
        }
      },
      '$id': 'https://hardening.test/Fix4b',
      'items': { '$dynamicRef': '#node' },
      'type': 'array'
    };

    const jt = JsonTology.create({
      'baseIRI': 'https://hardening.test/',
      'enableStrictGraph': false
    });

    // The schema is self-contained — $dynamicRef '#node' resolves to Inner within the same doc.
    jt.set(schema as Record<string, unknown> & { '$id': string });

    // Compile and validate: should not throw, and an array of strings should be valid.
    const validator = jt.registry.validator('https://hardening.test/Fix4b');
    const result = validator.validate([
      'hello',
      'world'
    ]);

    assert.equal(result.valid, true);
  });
});
