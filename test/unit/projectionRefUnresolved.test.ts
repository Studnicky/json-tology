/**
 * Regression test for Projection.ts — unresolvable $ref must throw GraphError
 * with code REF_NOT_FOUND instead of silently returning the original unresolved
 * node and emitting empty/wrong RDF quads.
 *
 * Before the canonical resolver, resolveNode() would fall through to
 * `return { graph, node }` when neither lookupGraph nor findNodeById could
 * resolve the ref, leaving the $ref string in node.schema and generating bogus
 * quads downstream. The canonical resolver now throws REF_NOT_FOUND uniformly.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Projection } from '../../src/modules/rdf/Projection.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { GraphError } from '../../src/errors/GraphError.js';

// A schema whose root node carries a $ref that cannot be resolved:
// - no lookupGraph is supplied
// - the ref target is not embedded in this graph
const UnresolvableRefSchema = {
  '$id': 'https://example.com/Broken',
  '$ref': 'https://example.com/Missing'
};

// lookupGraph always returns undefined (no registry)
function lookupGraph(_id: string): undefined {
  return;
}

void describe('Projection — unresolvable $ref throws REF_NOT_FOUND', () => {
  void it('throws GraphError with code REF_NOT_FOUND when the $ref target is absent', () => {
    const graph = new SchemaGraph(UnresolvableRefSchema);

    assert.throws(
      () => {
        Projection.abox(graph, { 'id': 'test' }, 'https://example.com', { lookupGraph });
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got ${String(err)}`);
        assert.equal(err.code, 'REF_NOT_FOUND');
        assert.equal(
          err.pointer,
          'https://example.com/Missing',
          `pointer should name the unresolved ref; got: ${String(err.pointer)}`
        );

        return true;
      }
    );
  });

  void it('does NOT throw when the root schema is a plain object (no $ref on root node)', () => {
    const PlainSchema = {
      '$id': 'https://example.com/Plain',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(PlainSchema);

    // Root node has no $ref — resolveNode returns it directly, no throw
    const quads = Projection.abox(graph, { 'name': 'Alice' }, 'https://example.com');

    assert.ok(Array.isArray(quads), 'abox returns an array');
  });

  void it('does NOT throw when the $ref target is an embedded $defs $id', () => {
    // Embedded-$id: the ref target lives inside $defs of the same graph.
    const EmbeddedSchema = {
      '$defs': {
        'Child': {
          '$id': 'https://example.com/Child',
          'properties': { 'value': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://example.com/Parent',
      'properties': { 'child': { '$ref': 'https://example.com/Child' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(EmbeddedSchema);

    // No lookupGraph — the embedded node must be found via the O(1) embeddedNode() index
    const quads = Projection.abox(
      graph,
      { 'child': { 'value': 'hello' } },
      'https://example.com'
    );

    assert.ok(Array.isArray(quads), 'abox returns an array');
  });
});
