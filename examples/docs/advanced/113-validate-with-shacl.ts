/**
 * Advanced Example 113 — validateWithShacl
 *
 * `validateWithShacl(shapes, data)` is the inverse of `toShacl()`:
 *
 *   toShacl()          → SHACL shape quads encoding structural constraints
 *   validateWithShacl() → conformance report against those shapes + ABox data
 *
 * The method accepts either an `OntologyBuilder` (the return of `toShacl()`)
 * or a raw `QuadInterface[]` shape array. ABox data quads come from
 * `toQuads()`.
 *
 * Conforming instance: `report.conforms === true`, `report.results` is empty.
 * Non-conforming instance (required property absent): `report.conforms === false`
 * and `report.results` contains a `MinCountConstraintComponent` entry.
 *
 * Note: `toQuads()` validates the data before projecting, so non-conforming
 * data quads must be crafted manually. The predicate IRI used in those quads
 * must match the `sh:path` IRI emitted by `toShacl()` — both go through
 * JsonTology's predicateResolver, so they are always consistent.
 *
 * @since 0.20.0
 */

import type { QuadInterface } from '../../../src/interfaces/Quad.js';
import type { ShaclValidationReportInterface } from '../../../src/interfaces/ShaclValidationReportInterface.js';
import { JsonTology } from '../../../src/index.js';
import { Terms } from '../../../src/modules/rdf/Terms.js';
import {
  RDF, SH
} from '../../../src/constants/IRI.js';

// ── Schema definitions ────────────────────────────────────────────────────
// A minimal bookstore domain: Author requires `name`; Book requires `title`.
// Primitives with constraints have their own $id and are referenced via $ref.

const BASE = 'https://bookstore.example.com';

const AuthorNameSchema = {
  '$id': `${BASE}/AuthorName`,
  'minLength': 1,
  'type': 'string'
} as const;

const TitleSchema = {
  '$id': `${BASE}/Title`,
  'minLength': 1,
  'type': 'string'
} as const;

const AuthorSchema = {
  '$id': `${BASE}/Author`,
  'properties': { 'name': { '$ref': `${BASE}/AuthorName` } },
  'required': ['name'],
  'type': 'object'
} as const;

const BookSchema = {
  '$id': `${BASE}/Book`,
  'properties': {
    'author': { '$ref': `${BASE}/Author` },
    'title': { '$ref': `${BASE}/Title` }
  },
  'required': ['title'],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': BASE,
  'schemas': [
    AuthorNameSchema,
    TitleSchema,
    AuthorSchema,
    BookSchema
  ] as const
});

// ── Build shapes once ────────────────────────────────────────────────────
// toShacl() returns an OntologyBuilder; validateWithShacl accepts it directly.

const shapes = jt.toShacl();

// ── Case 1: CONFORMING instance ───────────────────────────────────────────
// A valid Book (title present) projected through toQuads().

const conformingData = jt.toQuads(BookSchema, { 'title': 'Die unendliche Geschichte' });
const conformingReport: ShaclValidationReportInterface = jt.validateWithShacl(shapes, conformingData);

console.assert(
  conformingReport.conforms,
  'conforming: report.conforms must be true'
);
console.assert(
  conformingReport.results.length === 0,
  'conforming: results array must be empty'
);
console.log('Conforming report.conforms :', conformingReport.conforms);
console.log('Conforming results.length  :', conformingReport.results.length);

// ── Case 2: NON-CONFORMING instance (missing required title) ──────────────
// toQuads() validates the data first, so we hand-craft quads that omit title.
// The predicate IRI must match the sh:path in the emitted shapes — both are
// produced by the same predicateResolver, so they are always in sync.
// We discover the IRI from the shapes rather than hard-coding it.

const shapeQuads = shapes.shaclQuads();
const titlePathQuad = shapeQuads.find((quad) => {
  return quad.predicate.value === SH.path && quad.object.value.endsWith('/title');
});

if (titlePathQuad === undefined) {
  throw new Error('sh:path for title not found in shape quads — shape projection is broken');
}

const titlePath = titlePathQuad.object.value;
const focusNode = `${BASE}/instances/book-no-title`;

// A Book node with rdf:type but no title predicate.
function makeTypeQuad(subject: string, classIri: string): QuadInterface {
  return {
    'equals': () => {
      return false;
    },
    'graph': Terms.defaultGraph(),
    'object': Terms.iri(classIri),
    'predicate': Terms.iri(RDF.type),
    'subject': Terms.iri(subject),
    'termType': 'Quad',
    'value': ''
  };
}

// Title absent — violates sh:minCount 1 on the title property shape.
const nonConformingData: QuadInterface[] = [makeTypeQuad(focusNode, `${BASE}/Book`)];

const nonConformingReport: ShaclValidationReportInterface = jt.validateWithShacl(shapes, nonConformingData);

console.assert(
  !nonConformingReport.conforms,
  'non-conforming: report.conforms must be false'
);
console.assert(
  nonConformingReport.results.length > 0,
  'non-conforming: results array must be non-empty'
);

const violation = nonConformingReport.results.find((result) => {
  return result.sourceConstraintComponent === SH.MinCountConstraintComponent;
});

console.assert(
  violation !== undefined,
  'non-conforming: MinCountConstraintComponent violation expected for missing title'
);
console.assert(
  violation?.focusNode === focusNode,
  'non-conforming: focusNode matches the hand-crafted subject IRI'
);
console.assert(
  violation?.resultPath === titlePath,
  'non-conforming: resultPath matches the title sh:path IRI'
);
console.assert(
  violation?.resultSeverity === 'Violation',
  'non-conforming: resultSeverity is Violation'
);

console.log('\nNon-conforming report.conforms  :', nonConformingReport.conforms);
console.log('Non-conforming results.length   :', nonConformingReport.results.length);

if (violation !== undefined) {
  console.log('\nViolation:');
  console.log('  focusNode                :', violation.focusNode);
  console.log('  resultPath               :', violation.resultPath);
  console.log('  resultSeverity           :', violation.resultSeverity);
  console.log('  sourceConstraintComponent:', violation.sourceConstraintComponent);
  console.log('  resultMessage            :', violation.resultMessage);
}

// ── Case 3: Conforming instance with author ───────────────────────────────
// Round-trip through toQuads() with optional author filled in.

const fullBookData = jt.toQuads(BookSchema, {
  'author': { 'name': 'Michael Ende' },
  'title': 'Die unendliche Geschichte'
});
const fullBookReport: ShaclValidationReportInterface = jt.validateWithShacl(shapes, fullBookData);

console.assert(
  fullBookReport.conforms,
  'full book with author: report.conforms must be true'
);
console.log('\nFull book with author — conforms:', fullBookReport.conforms);

// ── Case 4: Non-conforming — multiple violations ───────────────────────────
// A node typed as Author that is also missing its required `name` property
// will trigger a MinCountConstraintComponent on the name path.

const shapeQuadsForLookup = shapes.shaclQuads();
const namePathQuad = shapeQuadsForLookup.find((quad) => {
  return quad.predicate.value === SH.path && quad.object.value.endsWith('/name');
});

if (namePathQuad === undefined) {
  throw new Error('sh:path for name not found in shape quads — shape projection is broken');
}

const namePath = namePathQuad.object.value;
const noNameFocusNode = `${BASE}/instances/author-no-name`;

// An Author node with rdf:type but no name predicate.
const noNameData: QuadInterface[] = [makeTypeQuad(noNameFocusNode, `${BASE}/Author`)];

const noNameReport: ShaclValidationReportInterface = jt.validateWithShacl(shapes, noNameData);

console.assert(
  !noNameReport.conforms,
  'no-name author: report.conforms must be false (name is required)'
);

const nameViolation = noNameReport.results.find((result) => {
  return result.sourceConstraintComponent === SH.MinCountConstraintComponent
    && result.resultPath === namePath;
});

console.assert(
  nameViolation !== undefined,
  'no-name author: MinCountConstraintComponent violation expected for missing name'
);
console.assert(
  nameViolation?.resultSeverity === 'Violation',
  'no-name author: resultSeverity is Violation'
);
console.log('\nNo-name author report.conforms :', noNameReport.conforms);
console.log('No-name author violations.length:', noNameReport.results.length);
