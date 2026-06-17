/**
 * OWL codegen benchmarks: `generateFromTbox` throughput.
 *
 * Measures the code-generation pipeline — OWL 2 TBox JSON-LD → axiom dispatch
 * → TypeScript source string emission — under two scenarios:
 *
 *   1. owl-codegen bookstore tbox  — full bookstore TBox (~62 classes),
 *      serialised once and reused; only the generateFromTbox call is timed.
 *   2. owl-codegen minimal class   — a 3-class synthetic ontology (one
 *      subClassOf + one ObjectProperty), representing the smallest non-trivial
 *      codegen unit.
 *
 * If the sibling's `json-tology/owl-gen` module has not yet landed, both
 * scenarios fall back to a stub that returns a no-op BenchResult so the
 * benchmark runner stays functional.
 *
 * These are single-library benchmarks (no third-party comparator exists
 * for OWL → TypeScript source generation). The `library` label is `json-tology`
 * and the `name` encodes the scenario.
 */

import { bookstoreEntities } from '../bookstore/index.js';
import {
  bench, type BenchResult, section
} from './harness.js';

// ---------------------------------------------------------------------------
// Load generateFromTbox — sibling module, may not be present yet
// ---------------------------------------------------------------------------

type GenerateFromTboxFn = (options: {
  'baseIRI'?: string;
  'input': object | string;
  'name'?: string;
}) => string;

const owlGenModule: null | Record<string, unknown> = await (
  import('json-tology/owl-gen') as Promise<Record<string, unknown>>
).catch((): null => {
  return null;
});

const generateFromTbox: GenerateFromTboxFn | null = (
  owlGenModule !== null && typeof owlGenModule.generateFromTbox === 'function'
)
  ? owlGenModule.generateFromTbox as GenerateFromTboxFn
  : null;

// ---------------------------------------------------------------------------
// Fixtures — serialised once, reused across all iterations
// ---------------------------------------------------------------------------

// Bookstore TBox: exported once before timing begins.
const bookstoreTboxJsonLd = bookstoreEntities.toTbox().jsonLd();

// Minimal 3-class synthetic ontology (mirrors owlImport.bench.ts fixture).
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
// Warm — allow V8 to compile before measuring (skipped when sibling absent)
// ---------------------------------------------------------------------------

if (generateFromTbox !== null) {
  generateFromTbox({
    'input': bookstoreTboxJsonLd,
    'name': 'bookstore'
  });
  generateFromTbox({
    'input': minimalTboxJsonLd,
    'name': 'minimal'
  });
}

// ---------------------------------------------------------------------------
// Stub result for when the sibling module is not yet available
// ---------------------------------------------------------------------------

function stubResult(name: string): BenchResult {
  return {
    'avgUs': 0,
    'iterations': 0,
    'library': 'json-tology',
    name,
    'opsPerSec': 0
  };
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

export function runOwlCodegenBench(): BenchResult[] {
  const results: BenchResult[] = [];

  if (generateFromTbox === null) {
    console.log('  [owl-codegen] sibling json-tology/owl-gen not landed — skipping bench.');
    results.push(stubResult('owl-codegen bookstore tbox'));
    results.push(stubResult('owl-codegen minimal class'));

    return results;
  }

  // Capture in a local const so TypeScript narrows the type inside closures.
  const generate = generateFromTbox;

  section('owl-codegen — bookstore TBox (~62 classes, full source emission)');

  results.push(bench(
    'owl-codegen bookstore tbox',
    'json-tology',
    () => {
      return generate({
        'input': bookstoreTboxJsonLd,
        'name': 'bookstore'
      });
    },
    {
      'iterations': 500,
      'warmup': 20
    }
  ));

  section('owl-codegen — minimal class (3 classes + 1 ObjectProperty)');

  results.push(bench(
    'owl-codegen minimal class',
    'json-tology',
    () => {
      return generate({
        'input': minimalTboxJsonLd,
        'name': 'minimal'
      });
    },
    {
      'iterations': 5000,
      'warmup': 100
    }
  ));

  return results;
}
