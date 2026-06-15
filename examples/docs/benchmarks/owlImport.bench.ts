/**
 * OWL import benchmarks: `JsonTology.fromTbox` throughput.
 *
 * Measures the cost of the full import pipeline — JSON-LD → Quad extraction
 * → axiom dispatch → schema reconstruction — under two scenarios:
 *
 *   1. owl-import bookstore tbox  — full bookstore TBox (~62 classes).
 *   2. owl-import minimal class   — a 3-class synthetic ontology with
 *      one subClassOf relation and one ObjectProperty, representing the
 *      smallest non-trivial import unit.
 *
 * These benchmarks are single-library scenarios (no third-party comparator
 * exists for OWL → JSON Schema import). The `library` label is `json-tology`
 * and the `name` encodes the scenario.
 */

import { JsonTology } from '../../../src/JsonTology.js';
import { bookstoreEntities } from '../bookstore/index.js';
import {
  bench, type BenchResult, section
} from './harness.js';

// ---------------------------------------------------------------------------
// Fixture — bookstore TBox JSON-LD (serialized once, reused across iterations)
// ---------------------------------------------------------------------------

const bookstoreTboxJsonLd = bookstoreEntities.toTbox().jsonLd();

// ---------------------------------------------------------------------------
// Fixture — 3-class minimal synthetic ontology
// ---------------------------------------------------------------------------

const minimalTboxJsonLd = JSON.stringify({
  '@context': {
    'ex': 'https://example.com/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    {
      '@id': 'https://example.com/Thing',
      '@type': 'owl:Class'
    },
    {
      '@id': 'https://example.com/NamedThing',
      '@type': 'owl:Class',
      'rdfs:subClassOf': { '@id': 'https://example.com/Thing' }
    },
    {
      '@id': 'https://example.com/Person',
      '@type': 'owl:Class',
      'rdfs:subClassOf': { '@id': 'https://example.com/NamedThing' }
    },
    {
      '@id': 'https://example.com/knows',
      '@type': 'owl:ObjectProperty',
      'rdfs:domain': { '@id': 'https://example.com/Person' },
      'rdfs:range': { '@id': 'https://example.com/Person' }
    }
  ]
});

// ---------------------------------------------------------------------------
// Warm — allow V8 to compile before measuring
// ---------------------------------------------------------------------------

JsonTology.fromTbox(bookstoreTboxJsonLd);
JsonTology.fromTbox(minimalTboxJsonLd);

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

export function runOwlImportBench(): BenchResult[] {
  const results: BenchResult[] = [];

  section('owl-import — bookstore TBox (~62 classes, full axiom dispatch)');

  results.push(bench(
    'owl-import bookstore tbox',
    'json-tology',
    () => {
      return JsonTology.fromTbox(bookstoreTboxJsonLd);
    },
    {
      'iterations': 500,
      'warmup': 20
    }
  ));

  section('owl-import — minimal class (3 classes + 1 ObjectProperty)');

  results.push(bench(
    'owl-import minimal class',
    'json-tology',
    () => {
      return JsonTology.fromTbox(minimalTboxJsonLd);
    },
    {
      'iterations': 10_000,
      'warmup': 500
    }
  ));

  return results;
}
