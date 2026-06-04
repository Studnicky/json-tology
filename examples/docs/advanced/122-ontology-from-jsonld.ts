/**
 * OntologyBuilder.addFromJsonLd / addShaclFromJsonLd — async JSON-LD ingestion.
 *
 * `addFromJsonLd` parses a JSON-LD document via `jsonld.toRDF` and appends the
 * resulting quads to the canonical ontology store. `addShaclFromJsonLd` does
 * the same for the SHACL store.
 *
 * This example shows a round-trip:
 *   1. Export the bookstore TBox to a JSON-LD object via `toTbox().jsonLdObject()`.
 *   2. Feed that object into a fresh `OntologyBuilder` via `addFromJsonLd`.
 *   3. Assert that all stable (fully-named) quads round-trip faithfully.
 *      Blank node IRIs (starting with "_:") are re-assigned on each JSON-LD
 *      parse, so they are excluded from the parity check.
 */

import { OntologyBuilder } from '../../../src/index.js';
import { bookstoreEntities } from '../bookstore/index.js';

// Step 1 — obtain the canonical TBox JSON-LD object.
const tboxBuilder = bookstoreEntities.toTbox();
const originalQuads = tboxBuilder.quads();
const tboxJsonLdObject = tboxBuilder.jsonLdObject();

console.assert(
  originalQuads.length > 0,
  'toTbox() must produce at least one quad'
);

// Step 2 — re-ingest the JSON-LD object into a fresh OntologyBuilder.
const freshBuilder = new OntologyBuilder({
  'baseIRI': 'https://bookstore.example',
  'prefixes': tboxBuilder.context()
});

await freshBuilder.addFromJsonLd(tboxJsonLdObject);

const reingested = freshBuilder.quads();

console.assert(
  reingested.length > 0,
  'Re-ingested builder must contain at least one quad'
);

// Step 3 — stable-quad parity.
// Blank node IRIs (starting with "_:") are re-assigned on each JSON-LD parse;
// only quads whose subject AND object are both named IRIs (or literals) are
// stable across round-trips and included in the parity check.
function isBlankNode(value: string): boolean {
  return value.startsWith('_:');
}

const reingestedStableKeys = reingested
  .filter((quad) => {
    return !isBlankNode(quad.subject.value) && !isBlankNode(quad.object.value);
  })
  .map((quad) => {
    return `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`;
  });
const reingestedStableSet = new Set(reingestedStableKeys);

const stableOriginalQuads = originalQuads.filter((quad) => {
  return !isBlankNode(quad.subject.value) && !isBlankNode(quad.object.value);
});

const missingStableCount = stableOriginalQuads.filter((quad) => {
  return !reingestedStableSet.has(`${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`);
}).length;

console.assert(
  missingStableCount === 0,
  `All stable (fully-named) quads must round-trip; missing: ${missingStableCount}`
);

console.log('original quad count:', originalQuads.length);
console.log('re-ingested quad count:', reingested.length);
console.log('stable quads checked:', stableOriginalQuads.length);
console.log('stable quad parity (missing):', missingStableCount);

// addShaclFromJsonLd — round-trip the SHACL shapes JSON-LD object.
// SHACL shapes use stable named IRIs so the full count should match.
const shaclBuilder = bookstoreEntities.toShacl();
const shaclJsonLdObject = shaclBuilder.shaclObject();
const originalShaclQuads = shaclBuilder.shaclQuads();

const freshShaclBuilder = new OntologyBuilder({
  'baseIRI': 'https://bookstore.example',
  'prefixes': shaclBuilder.context()
});

await freshShaclBuilder.addShaclFromJsonLd(shaclJsonLdObject);

const reingestedShacl = freshShaclBuilder.shaclQuads();

console.assert(
  reingestedShacl.length === originalShaclQuads.length,
  `Re-ingested SHACL quad count (${reingestedShacl.length}) must equal original (${originalShaclQuads.length})`
);

console.log('original SHACL quad count:', originalShaclQuads.length);
console.log('re-ingested SHACL quad count:', reingestedShacl.length);
console.log('SHACL quad parity:', reingestedShacl.length === originalShaclQuads.length);
