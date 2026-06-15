/**
 * OWL codegen registry-directory benchmarks: `generateRegistryFiles` throughput.
 *
 * Measures the directory-mode code-generation pipeline — OWL 2 TBox JSON-LD →
 * axiom dispatch → per-entity source strings — under two scenarios:
 *
 *   1. owl-codegen-dir bookstore tbox  — full bookstore TBox (~62 classes);
 *      serialised once, only the generateRegistryFiles call is timed.
 *   2. owl-codegen-dir minimal class   — a 3-class synthetic ontology
 *      representing the smallest non-trivial codegen unit.
 *
 * `generateRegistryFiles` is the pure in-memory path (no I/O). Writing to disk
 * is benchmarked separately if needed; the I/O cost depends on the OS and
 * filesystem, not the codegen logic.
 */

import { bookstoreEntities } from '../bookstore/index.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import { generateRegistryFiles } from '../../../src/modules/codegen/OwlCodegen.js';
import { JsonTology } from '../../../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures — serialised once, reused across all iterations
// ---------------------------------------------------------------------------

// Bookstore TBox: exported once before timing begins.
const bookstoreTboxJsonLd = bookstoreEntities.toTbox().jsonLd();
const bookstoreImportResult = JsonTology.fromTbox(bookstoreTboxJsonLd);

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
const minimalImportResult = JsonTology.fromTbox(minimalTboxJsonLd);

// ---------------------------------------------------------------------------
// Warm — allow V8 to compile before measuring
// ---------------------------------------------------------------------------

generateRegistryFiles(bookstoreImportResult, {
  'registryConstName': 'bookstore',
  'sourceLabel': 'bookstore-tbox'
});
generateRegistryFiles(minimalImportResult, {
  'registryConstName': 'minimal',
  'sourceLabel': 'minimal-tbox'
});

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

export function runOwlCodegenDirBench(): BenchResult[] {
  const results: BenchResult[] = [];

  section('owl-codegen-dir — bookstore TBox (~62 classes, per-entity source emission)');

  results.push(bench(
    'owl-codegen-dir bookstore tbox',
    'json-tology',
    () => {
      return generateRegistryFiles(bookstoreImportResult, {
        'registryConstName': 'bookstore',
        'sourceLabel': 'bookstore-tbox'
      });
    },
    {
      'iterations': 500,
      'warmup': 20
    }
  ));

  section('owl-codegen-dir — minimal class (3 classes + 1 ObjectProperty)');

  results.push(bench(
    'owl-codegen-dir minimal class',
    'json-tology',
    () => {
      return generateRegistryFiles(minimalImportResult, {
        'registryConstName': 'minimal',
        'sourceLabel': 'minimal-tbox'
      });
    },
    {
      'iterations': 5000,
      'warmup': 100
    }
  ));

  return results;
}
