import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import { OwlImportError } from '../../src/errors/OwlImportError.js';
import { OntologyBuilder } from '../../src/modules/ontology/OntologyBuilder.js';
import { Terms } from '../../src/modules/rdf/Terms.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuad(subjectIri: string, predicateIri: string, objectIri: string): QuadInterface {
  return Terms.quad(
    Terms.iri(subjectIri),
    Terms.iri(predicateIri),
    Terms.iri(objectIri),
    Terms.defaultGraph()
  );
}

function emptyBuilder(): OntologyBuilder {
  return new OntologyBuilder({
    'baseIRI': 'https://example.com',
    'prefixes': { 'ex': 'https://example.com/' }
  });
}

// ---------------------------------------------------------------------------
// OntologyBuilder.quads()
// ---------------------------------------------------------------------------

void describe('OntologyBuilder.quads()', () => {
  void it('returns empty array when no quads added', () => {
    const builder = emptyBuilder();

    assert.deepEqual(builder.quads(), []);
  });

  void it('returns quads supplied via addFromQuads', () => {
    const q1 = makeQuad('https://example.com/A', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const q2 = makeQuad('https://example.com/B', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const builder = emptyBuilder().addFromQuads([
      q1,
      q2
    ]);
    const result = builder.quads();

    assert.equal(result.length, 2);
    assert.equal(result[0].subject.value, q1.subject.value);
    assert.equal(result[1].subject.value, q2.subject.value);
  });

  void it('concatenates quads from multiple addFromQuads calls', () => {
    const qa = makeQuad('https://example.com/A', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const qb = makeQuad('https://example.com/B', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const builder = emptyBuilder().addFromQuads([qa])
      .addFromQuads([qb]);
    const result = builder.quads();

    assert.equal(result.length, 2);
    assert.equal(result[0].subject.value, qa.subject.value);
    assert.equal(result[1].subject.value, qb.subject.value);
  });

  void it('returns a fresh array each call', () => {
    const quad = makeQuad('https://example.com/A', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const builder = emptyBuilder().addFromQuads([quad]);

    assert.notEqual(builder.quads(), builder.quads());
  });

  void it('jsonLdObject @graph reflects quads added via addFromQuads', () => {
    const quad = makeQuad('https://example.com/A', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const builder = emptyBuilder().addFromQuads([quad]);
    const graph = builder.jsonLdObject()['@graph'];

    assert.ok(Array.isArray(graph));
    assert.ok((graph as unknown[]).length > 0);
  });
});

// ---------------------------------------------------------------------------
// OntologyBuilder.shaclQuads()
// ---------------------------------------------------------------------------

void describe('OntologyBuilder.shaclQuads()', () => {
  void it('returns empty array when no SHACL quads added', () => {
    const builder = emptyBuilder();

    assert.deepEqual(builder.shaclQuads(), []);
  });

  void it('returns quads supplied via addShaclFromQuads', () => {
    const q1 = makeQuad('https://example.com/PersonShape', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#NodeShape');
    const q2 = makeQuad('https://example.com/PersonShape', 'http://www.w3.org/ns/shacl#targetClass', 'https://example.com/Person');
    const builder = emptyBuilder().addShaclFromQuads([
      q1,
      q2
    ]);
    const result = builder.shaclQuads();

    assert.equal(result.length, 2);
    assert.equal(result[0].subject.value, q1.subject.value);
    assert.equal(result[1].subject.value, q2.subject.value);
  });

  void it('concatenates quads from multiple addShaclFromQuads calls', () => {
    const qa = makeQuad('https://example.com/AShape', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#NodeShape');
    const qb = makeQuad('https://example.com/BShape', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#NodeShape');
    const builder = emptyBuilder().addShaclFromQuads([qa])
      .addShaclFromQuads([qb]);
    const result = builder.shaclQuads();

    assert.equal(result.length, 2);
    assert.equal(result[0].subject.value, qa.subject.value);
    assert.equal(result[1].subject.value, qb.subject.value);
  });

  void it('shaclObject @graph reflects quads added via addShaclFromQuads', () => {
    const quad = makeQuad('https://example.com/PersonShape', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#NodeShape');
    const builder = emptyBuilder().addShaclFromQuads([quad]);
    const obj = builder.shaclObject();

    assert.ok(typeof obj === 'object');
    const graph = obj['@graph'];

    assert.ok(Array.isArray(graph) && (graph as unknown[]).length > 0);
  });
});

// ---------------------------------------------------------------------------
// OntologyBuilder — empty builder invariants
// ---------------------------------------------------------------------------

void describe('OntologyBuilder empty builder', () => {
  void it('quads() and shaclQuads() are [] on empty builder', () => {
    const builder = emptyBuilder();

    assert.deepEqual(builder.quads(), []);
    assert.deepEqual(builder.shaclQuads(), []);
  });

  void it('jsonLdObject @graph is [] on empty builder', () => {
    const builder = emptyBuilder();
    const graph = builder.jsonLdObject()['@graph'];

    assert.ok(Array.isArray(graph));
    assert.equal((graph as unknown[]).length, 0);
  });

  void it('jsonLd() round-trips to parseable JSON with expected structure', () => {
    const builder = emptyBuilder();
    const json = builder.jsonLd();

    assert.ok(typeof json === 'string');
    const parsed = JSON.parse(json) as Record<string, unknown>;

    assert.ok(parsed['@context'] !== undefined);
    assert.ok(Array.isArray(parsed['@graph']));
  });
});

// ---------------------------------------------------------------------------
// addFromJsonLd — JSON-LD entry point
// ---------------------------------------------------------------------------

void describe('OntologyBuilder.addFromJsonLd()', () => {
  void it('parses a simple JSON-LD document and produces quads', async () => {
    const doc = {
      '@context': { 'ex': 'http://example.org/' },
      '@id': 'ex:alice',
      'ex:name': 'Alice'
    };
    const builder = await emptyBuilder().addFromJsonLd(doc);
    const qs = builder.quads();

    assert.ok(qs.length > 0, 'expected at least one quad');

    const nameQuad = qs.find((quad) => {
      return quad.predicate.value === 'http://example.org/name';
    });

    assert.ok(nameQuad !== undefined, 'expected a predicate quad for ex:name');
    assert.equal(nameQuad.subject.value, 'http://example.org/alice');
    assert.equal(nameQuad.object.value, 'Alice');
  });

  void it('appends quads to the store (does not replace existing)', async () => {
    const quad = makeQuad('https://example.com/A', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    const doc = {
      '@context': { 'ex': 'http://example.org/' },
      '@id': 'ex:bob',
      'ex:name': 'Bob'
    };
    const builder = await emptyBuilder().addFromQuads([quad])
      .addFromJsonLd(doc);

    assert.ok(builder.quads().length > 1, 'quads from both sources present');
  });
});

// ---------------------------------------------------------------------------
// addShaclFromJsonLd — JSON-LD SHACL entry point
// ---------------------------------------------------------------------------

void describe('OntologyBuilder.addShaclFromJsonLd()', () => {
  void it('parses a JSON-LD document into the SHACL store', async () => {
    const doc = {
      '@context': {
        'ex': 'http://example.org/',
        'sh': 'http://www.w3.org/ns/shacl#'
      },
      '@id': 'ex:PersonShape',
      '@type': 'sh:NodeShape'
    };
    const builder = await emptyBuilder().addShaclFromJsonLd(doc);
    const qs = builder.shaclQuads();

    assert.ok(qs.length > 0, 'expected at least one SHACL quad');
    assert.equal(builder.quads().length, 0, 'canonical store must stay empty');
  });
});

// ---------------------------------------------------------------------------
// JSON-LD round-trip: addFromQuads → jsonLdObject → addFromJsonLd
// ---------------------------------------------------------------------------

void describe('OntologyBuilder JSON-LD round-trip', () => {
  void it('quad sets match after round-tripping through JSON-LD', async () => {
    const subjectIri = 'https://example.com/Thing';
    const predicateIri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const objectIri = 'http://www.w3.org/2002/07/owl#Class';
    const quad = makeQuad(subjectIri, predicateIri, objectIri);

    const sourceBuilder = emptyBuilder().addFromQuads([quad]);
    const jsonLdDoc = sourceBuilder.jsonLdObject();

    // Re-parse the JSON-LD document via addFromJsonLd
    const roundTripped = await emptyBuilder().addFromJsonLd(jsonLdDoc);
    const resultQuads = roundTripped.quads();

    // Find the type quad in the round-tripped result
    const typeQuad = resultQuads.find((rq) => {
      return rq.subject.value === subjectIri && rq.predicate.value === predicateIri;
    });

    assert.ok(typeQuad !== undefined, 'expected type quad after round-trip');
    assert.equal(typeQuad.object.value, objectIri);
  });
});

// ---------------------------------------------------------------------------
// addFromJsonLd — malformed document failure paths (M-S-1)
// ---------------------------------------------------------------------------

void describe('OntologyBuilder.addFromJsonLd() failure paths', () => {
  void it('rejects a document with an unresolvable remote @context', async () => {
    // An unresolvable remote context IRI causes jsonld.toRDF to reject.
    const builder = emptyBuilder();
    const badDoc = {
      '@context': 'invalid://unreachable/context',
      '@id': 'https://example.org/thing'
    };

    await assert.rejects(
      async () => {
        await builder.addFromJsonLd(badDoc);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error, 'expected an Error for unresolvable @context');

        return true;
      }
    );
  });

  void it('rejects a document with a bad-protocol @context IRI', async () => {
    const builder = emptyBuilder();
    const badDoc = {
      '@context': 'invalid://bad:context',
      '@id': 'https://example.org/thing'
    };

    await assert.rejects(
      async () => {
        await builder.addFromJsonLd(badDoc);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error, 'expected an Error for bad protocol context IRI');

        return true;
      }
    );
  });
});

void describe('OntologyBuilder.addShaclFromJsonLd() failure paths', () => {
  void it('rejects a SHACL document with an unresolvable @context', async () => {
    const builder = emptyBuilder();
    const badDoc = {
      '@context': 'invalid://no-such-context',
      '@id': 'https://example.org/PersonShape',
      '@type': 'sh:NodeShape'
    };

    await assert.rejects(
      async () => {
        await builder.addShaclFromJsonLd(badDoc);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error, 'expected an Error for unresolvable SHACL context');

        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// H-8: OwlImportError .code assertions
//
// OWL_IMPORT_NOT_IMPLEMENTED is the only live throw site (OntologyBuilder.addFromJsonLd
// and OwlImporter.importAsync when jsonld peer dep is absent).
// The four unreachable codes (INVALID_DATATYPE, MALFORMED_CLASS, UNKNOWN_AXIOM,
// UNRESOLVED_REF) are never thrown in production code and are dead surface.
//
// The throw path for OWL_IMPORT_NOT_IMPLEMENTED requires jsonld to be absent;
// since jsonld is installed in this environment, we assert the error class
// carries the correct code by constructing it directly (verifying the error
// contract without requiring the optional dependency to be uninstalled).
// ---------------------------------------------------------------------------

void describe('OwlImportError .code assertions', { 'concurrency': true }, () => {
  void it('OWL_IMPORT_NOT_IMPLEMENTED: OwlImportError carries correct code', () => {
    const err = new OwlImportError(
      'addFromJsonLd() requires the optional jsonld peerDependency',
      {
        'axiomIri': 'https://www.w3.org/TR/json-ld/',
        'code': 'OWL_IMPORT_NOT_IMPLEMENTED',
        'subjectIri': null
      }
    );

    assert.ok(err instanceof OwlImportError, 'instanceof OwlImportError');
    assert.equal(err.code, 'OWL_IMPORT_NOT_IMPLEMENTED', 'err.code === OWL_IMPORT_NOT_IMPLEMENTED');
    assert.ok(err.message.length > 0, 'message is non-empty');
  });
});
