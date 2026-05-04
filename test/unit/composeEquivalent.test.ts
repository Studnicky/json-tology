/**
 * Compose.equivalent — unit tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const IsbnSchema = {
  '$id': 'urn:bookstore:Isbn',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

void describe('Compose.equivalent()', () => {
  void it('emits $id and $ref, no structural duplication', () => {
    const result = Compose.equivalent(IsbnSchema, { '$id': 'urn:bookstore:PrimaryIsbn' });

    assert.strictEqual(result.$id, 'urn:bookstore:PrimaryIsbn');
    assert.strictEqual(result.$ref, 'urn:bookstore:Isbn');
    assert.ok(!('type' in result));
    assert.ok(!('pattern' in result));
  });

  void it('carries optional metadata fields', () => {
    const result = Compose.equivalent(IsbnSchema, {
      '$id': 'urn:bookstore:PrimaryIsbn',
      'description': 'Primary ISBN for catalog lookup',
      'examples': ['9780306406157'],
      'title': 'Primary ISBN'
    });

    assert.strictEqual(result.description, 'Primary ISBN for catalog lookup');
    assert.strictEqual(result.title, 'Primary ISBN');
    assert.deepStrictEqual(result.examples, ['9780306406157']);
  });

  void it('two registered equivalent schemas validate the same data', () => {
    const registry = new SchemaRegistry();

    registry.register(IsbnSchema as unknown as Record<string, unknown>);

    const PrimaryIsbn = Compose.equivalent(IsbnSchema, {
      '$id': 'urn:bookstore:PrimaryIsbn',
      'description': 'Primary ISBN'
    });

    registry.register(PrimaryIsbn as unknown as Record<string, unknown>);

    const validIsbn = '9780306406157';
    const invalidIsbn = 'not-an-isbn';

    assert.deepStrictEqual(registry.validate(IsbnSchema.$id, validIsbn), []);
    assert.deepStrictEqual(registry.validate('urn:bookstore:PrimaryIsbn', validIsbn), []);
    assert.ok(registry.validate(IsbnSchema.$id, invalidIsbn).length > 0);
    assert.ok(registry.validate('urn:bookstore:PrimaryIsbn', invalidIsbn).length > 0);
  });

  void it('OWL projection emits equivalentClass for equivalent schemas', async () => {
    const { SchemaGraph } = await import('../../src/modules/graph/SchemaGraph.js');
    const { projectOwlGraph } = await import('../../src/modules/rdf/OwlProjection.js');
    const { OWL } = await import('../../src/constants/IRI.js');

    const PrimaryIsbn = Compose.equivalent(IsbnSchema, { '$id': 'urn:bookstore:PrimaryIsbn' });

    const graph = new SchemaGraph(PrimaryIsbn as unknown as Record<string, unknown>);
    const quads = projectOwlGraph(graph);

    const equivQuad = quads.find((quad) => {
      return quad.predicate === OWL.equivalentClass;
    });

    assert.ok(equivQuad !== undefined, 'equivalentClass quad should be emitted');
    assert.ok(
      (equivQuad.subject).includes('PrimaryIsbn'),
      'subject should be PrimaryIsbn'
    );
  });

  void it('fails gracefully if no $id on source', () => {
    // TypeScript constraint enforces $id at compile time; runtime test documents behavior
    const noId = {
      'pattern': '^\\d+$',
      'type': 'string'
    } as unknown as { readonly '$id': string };
    const result = Compose.equivalent(noId, { '$id': 'urn:test:NoId' });

    assert.strictEqual(result.$ref, undefined);
  });
});
