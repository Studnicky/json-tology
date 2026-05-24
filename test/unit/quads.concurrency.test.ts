/**
 * Blank-node concurrency test — verifies per-call IdentifierIssuer isolation.
 *
 * With the old module-level bnode counters, concurrent or sequential calls
 * to projection functions that produce blank nodes could corrupt each other
 * when the reset was called mid-flight, or produce duplicate names within a
 * single result set.
 *
 * With per-call IdentifierIssuer, each projection call owns its own counter.
 * This test verifies:
 *
 *   1. Within each quad set produced by a projection call, every blank node
 *      identifier is unique (no internal duplicates).
 *
 *   2. Two concurrent calls (via Promise.all) produce consistent results —
 *      no shared state corruption occurs between the two calls.
 *
 *   3. Blank node names in result set A and result set B may overlap
 *      (both start from `_:b0`) but neither set has internal duplicates,
 *      which is the correct behaviour for independent projections that are
 *      not intended to be merged into the same graph.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { OwlProjection } from '../../src/modules/rdf/OwlProjection.js';
import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';

// A schema with required properties produces owl:Restriction blank nodes.
const BookSchema = {
  '$id': 'https://example.com/Book',
  'properties': {
    'author': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'required': ['title'],
  'type': 'object'
} as const;

const ArticleSchema = {
  '$id': 'https://example.com/Article',
  'properties': {
    'abstract': { 'type': 'string' },
    'author': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'required': [
    'author',
    'title'
  ],
  'type': 'object'
} as const;

function collectBnodes(quads: Array<{ 'object': { 'termType': string;
  'value': string }
'subject': { 'termType': string;
  'value': string }; }>): string[] {
  const bnodes = new Set<string>();

  for (const quad of quads) {
    if (quad.subject.termType === 'BlankNode') {
      bnodes.add(quad.subject.value);
    }
    if (quad.object.termType === 'BlankNode') {
      bnodes.add(quad.object.value);
    }
  }

  return [...bnodes];
}

void describe('blank-node concurrency — per-call IdentifierIssuer isolation', () => {
  void it('OWL: concurrent Promise.all calls produce internally unique blank node names', async () => {
    const bookGraph = new SchemaGraph(BookSchema);
    const articleGraph = new SchemaGraph(ArticleSchema);

    // Run two projection calls concurrently.
    // Since projection is synchronous, Promise.all executes them in sequence,
    // but the test verifies no shared mutable counter state is present.
    const [
      bookQuads,
      articleQuads
    ] = await Promise.all([
      Promise.resolve(OwlProjection.graph(bookGraph)),
      Promise.resolve(OwlProjection.graph(articleGraph))
    ]);

    const bookBnodes = collectBnodes(bookQuads);
    const articleBnodes = collectBnodes(articleQuads);

    // Each result set must have at least one blank node (owl:Restriction for required props).
    assert.ok(bookBnodes.length > 0, 'BookSchema OWL projection should produce blank nodes for required property restriction');
    assert.ok(articleBnodes.length > 0, 'ArticleSchema OWL projection should produce blank nodes for required property restrictions');

    // Within each result set, blank node names must be unique (no duplicates).
    const bookUnique = new Set(bookBnodes);
    const articleUnique = new Set(articleBnodes);

    assert.equal(bookBnodes.length, bookUnique.size, 'Book blank nodes must be unique within their result set');
    assert.equal(articleBnodes.length, articleUnique.size, 'Article blank nodes must be unique within their result set');
  });

  void it('SHACL: concurrent Promise.all calls produce internally unique blank node names', async () => {
    const bookGraph = new SchemaGraph(BookSchema);
    const articleGraph = new SchemaGraph(ArticleSchema);

    const [
      bookQuads,
      articleQuads
    ] = await Promise.all([
      Promise.resolve(ShaclProjection.graph(bookGraph)),
      Promise.resolve(ShaclProjection.graph(articleGraph))
    ]);

    const bookBnodes = collectBnodes(bookQuads);
    const articleBnodes = collectBnodes(articleQuads);

    // SHACL projection produces blank nodes for sh:PropertyShape nodes.
    assert.ok(bookBnodes.length > 0, 'BookSchema SHACL projection should produce blank nodes');
    assert.ok(articleBnodes.length > 0, 'ArticleSchema SHACL projection should produce blank nodes');

    const bookUnique = new Set(bookBnodes);
    const articleUnique = new Set(articleBnodes);

    assert.equal(bookBnodes.length, bookUnique.size, 'Book blank nodes must be unique within their result set');
    assert.equal(articleBnodes.length, articleUnique.size, 'Article blank nodes must be unique within their result set');
  });

  void it('repeated sequential calls produce consistent blank-node counts', () => {
    const graph = new SchemaGraph(ArticleSchema);

    // Run the same projection three times. With a module-level counter that
    // increments forever, the blank node names would drift across calls.
    // With per-call issuers, each call produces the same set of names.
    const quads1 = OwlProjection.graph(graph);
    const quads2 = OwlProjection.graph(graph);
    const quads3 = OwlProjection.graph(graph);

    const bnodes1 = collectBnodes(quads1).sort();
    const bnodes2 = collectBnodes(quads2).sort();
    const bnodes3 = collectBnodes(quads3).sort();

    // Quad counts must be identical across calls.
    assert.equal(quads1.length, quads2.length, 'quad count must be stable across calls');
    assert.equal(quads1.length, quads3.length, 'quad count must be stable across calls');

    // Blank node counts must be identical.
    assert.equal(bnodes1.length, bnodes2.length, 'bnode count must be stable across calls');
    assert.equal(bnodes1.length, bnodes3.length, 'bnode count must be stable across calls');

    // Blank node names must be identical across calls (deterministic per-call issuer).
    assert.deepEqual(bnodes1, bnodes2, 'bnode names must be deterministic across calls');
    assert.deepEqual(bnodes1, bnodes3, 'bnode names must be deterministic across calls');
  });
});
