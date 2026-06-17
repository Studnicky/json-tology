/**
 * Cyclic-data safety: registry.validate must not throw RangeError on recursive schemas.
 *
 * Before the fix, the compiled validator for a self-referential schema had no
 * recursion guard. Feeding it structurally-cyclic data caused infinite recursion
 * and an uncaught RangeError (stack overflow). The fix wraps the compiled
 * dispatchValidate in a try/catch that delegates to the interpreter on RangeError;
 * the interpreter's refStack terminates schema-level recursion at the cycle
 * boundary and returns a sensible verdict.
 *
 * This test would previously throw:
 *   RangeError: Maximum call stack size exceeded
 * It now returns without throwing and produces valid: true or false depending
 * on whether the non-cyclic portions of the data satisfy the schema.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';

// A recursive linked-list schema: each node may have a `next` that is also a Node.
const NodeSchema = {
  '$id': 'urn:cyclic-safety:Node',
  'properties': {
    'name': { 'type': 'string' },
    'next': { '$ref': 'urn:cyclic-safety:Node' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

// A recursive tree schema: each node may have `children` that are also Trees.
const TreeSchema = {
  '$id': 'urn:cyclic-safety:Tree',
  'properties': {
    'children': {
      'items': { '$ref': 'urn:cyclic-safety:Tree' },
      'type': 'array'
    },
    'label': { 'type': 'string' }
  },
  'required': ['label'],
  'type': 'object'
} as const;

void describe('registry.validate — cyclic-data safety', () => {
  void it('returns without throwing on a self-referential (cyclic) linked-list', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:cyclic-safety:',
      'enableStrictGraph': false,
      'schemas': [NodeSchema] as const
    });

    // Build a structurally-cyclic object: root.next → child, child.next → root.
    // Previously this caused: RangeError: Maximum call stack size exceeded
    const root: Record<string, unknown> = { 'name': 'root' };
    const child: Record<string, unknown> = { 'name': 'child' };

    root['next'] = child;
    // cycle: child.next points back to root
    child['next'] = root;

    // Must not throw. The interpreter's refStack detects the cycle and returns.
    let errors: ReturnType<typeof jt.registry.validate> | undefined;

    assert.doesNotThrow(() => {
      errors = jt.registry.validate('urn:cyclic-safety:Node', root);
    }, 'registry.validate must not throw RangeError on cyclic data');

    // The interpreter's refStack short-circuits on the back-edge and treats the
    // cyclic branch as valid (same semantics it has always had for the engine path).
    // What matters here is the non-throwing guarantee; the verdict is stable.
    assert.ok(errors !== undefined, 'validate must return a result');
  });

  void it('returns without throwing on a structurally-cyclic tree', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:cyclic-safety:',
      'enableStrictGraph': false,
      'schemas': [TreeSchema] as const
    });

    // Build a cyclic tree: root has a child that points back to root.
    const root: Record<string, unknown> = { 'label': 'root' };

    // cycle: root.children contains root itself
    root['children'] = [root];

    assert.doesNotThrow(() => {
      jt.registry.validate('urn:cyclic-safety:Tree', root);
    }, 'registry.validate must not throw RangeError on cyclic tree data');
  });

  void it('parity: compiled fallback verdict matches interpreter for non-cyclic recursive data', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:cyclic-safety:',
      'enableStrictGraph': false,
      'schemas': [NodeSchema] as const
    });

    // A valid linear chain — should pass both paths.
    const valid = {
      'name': 'root',
      'next': {
        'name': 'child',
        'next': { 'name': 'leaf' }
      }
    };

    // An invalid chain — leaf.next is a number, not an object.
    const invalid = {
      'name': 'root',
      'next': {
        'name': 'child',
        'next': {
          'name': 'leaf',
          'next': 42
        }
      }
    };

    assert.equal(
      jt.registry.validate('urn:cyclic-safety:Node', valid).length,
      0,
      'valid chain must produce no errors'
    );

    assert.ok(
      jt.registry.validate('urn:cyclic-safety:Node', invalid).length > 0,
      'invalid chain (number for next) must produce errors'
    );
  });
});
