/**
 * e2e-reasoning.ts — bookstore ABox + EYE reasoner end-to-end
 *
 * Demonstrates that json-tology's ABox output drives a real OWL/N3 reasoner.
 *
 * Pipeline:
 *   1. Load the canonical bookstore registry and ABox fixtures.
 *   2. Validate Bastian Balthazar Bux's customer record, his order of the
 *      rare 1979 Thienemann printing of `Die unendliche Geschichte`, the
 *      rare book itself, and his review.
 *   3. Emit the TBox (OWL classes and properties) and SHACL shapes — display
 *      the class IRIs and the property-shape paths that the registry produced.
 *   4. Project each fixture to rdf/js quads via `toQuads()`.
 *   5. Serialize those quads to N3 using the `n3` Writer.
 *   6. Append three bookstore-natural N3 inference rules:
 *        a. Order line items → customer purchased the book.
 *        b. Review → customer reviewed the book.
 *        c. Purchased ∧ reviewed → verified reviewer of the book.
 *   7. Hand data + rules to EYE (WASM) via `n3reasoner`.
 *   8. Parse the reasoner output back as rdf/js quads and display the
 *      inferred predicates grouped by subject.
 *
 * Run: npm run build && tsx examples/e2e-reasoning.ts
 */

import {
  Parser, Writer
} from 'n3';
import { n3reasoner } from 'eyereasoner';
import {
  aboxFixtures,
  BookSchema,
  bookstoreEntities,
  CustomerSchema,
  OrderSchema,
  ReviewSchema
} from './docs/bookstore/index.js';
import { Lists } from '../src/index.js';
import type { QuadInterface } from '../src/interfaces/index.js';

// ---------------------------------------------------------------------------
// 1. Validate every fixture against its registered schema.
// ---------------------------------------------------------------------------

interface ValidationTarget {
  readonly 'data': unknown;
  readonly 'label': string;
  readonly 'schemaId': string;
}

const validations: readonly ValidationTarget[] = [
  {
    'data': aboxFixtures.customer,
    'label': 'customer',
    'schemaId': CustomerSchema.$id
  },
  {
    'data': aboxFixtures.rareBook,
    'label': 'rareBook',
    'schemaId': BookSchema.$id
  },
  {
    'data': aboxFixtures.order,
    'label': 'order',
    'schemaId': OrderSchema.$id
  },
  {
    'data': aboxFixtures.review,
    'label': 'review',
    'schemaId': ReviewSchema.$id
  }
];

for (const target of validations) {
  const errors = bookstoreEntities.validate(target.schemaId, target.data);

  if (errors.length > 0) {
    throw new Error(`Invalid ${target.label}: ${errors.items.map((error) => {
      return error.message;
    }).join('; ')}`);
  }
}

console.log('All bookstore fixtures validated.\n');

// ---------------------------------------------------------------------------
// 2. TBox — list the OWL classes registered for the bookstore.
//    JSON-LD output carries full IRIs in @type; filter accordingly.
// ---------------------------------------------------------------------------

const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const SH_NODE_SHAPE = 'http://www.w3.org/ns/shacl#NodeShape';

interface JsonLdNode {
  readonly '@id'?: string;
  readonly '@type'?: readonly string[] | string;
}

function hasType(node: JsonLdNode, target: string): boolean {
  const value = node['@type'];

  if (typeof value === 'string') {
    return value === target;
  }

  if (Array.isArray(value)) {
    return value.includes(target);
  }

  return false;
}

const ontology = bookstoreEntities.ontology();
const tboxGraph = ontology.jsonLdObject()['@graph'] as readonly JsonLdNode[] | undefined;

console.log('=== TBox (OWL classes) ===');
for (const node of tboxGraph ?? []) {
  if (hasType(node, OWL_CLASS) && typeof node['@id'] === 'string') {
    console.log(` ${node['@id']}`);
  }
}

// ---------------------------------------------------------------------------
// 3. SHACL shapes — list the node-shape IRIs.
// ---------------------------------------------------------------------------

const shaclGraph = ontology.shaclObject()['@graph'] as readonly JsonLdNode[] | undefined;

console.log('\n=== SHACL shapes ===');
for (const node of shaclGraph ?? []) {
  if (hasType(node, SH_NODE_SHAPE) && typeof node['@id'] === 'string') {
    console.log(` ${node['@id']}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Project each fixture to rdf/js quads via toQuads.
//    Use Skolemize.fromProperty to mint stable IRIs from each instance's
//    primary identifier so the reasoner output references human-readable IRIs.
// ---------------------------------------------------------------------------

const customerQuads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer, { 'iriFor': `urn:bookstore:customer:${aboxFixtures.customer.id}` });

const bookQuads = bookstoreEntities.toQuads(BookSchema, aboxFixtures.rareBook, { 'iriFor': `urn:bookstore:book:${aboxFixtures.rareBook.isbn}` });

const orderQuads = bookstoreEntities.toQuads(OrderSchema, aboxFixtures.order, { 'iriFor': `urn:bookstore:order:${aboxFixtures.order.id}` });

const reviewQuads = bookstoreEntities.toQuads(ReviewSchema, aboxFixtures.review, { 'iriFor': `urn:bookstore:review:${aboxFixtures.review.id}` });

const allQuads: QuadInterface[] = [
  ...customerQuads,
  ...bookQuads,
  ...orderQuads,
  ...reviewQuads
];

console.log(`\n=== ABox quads emitted ===\n ${allQuads.length} quads across 4 fixtures.`);

// ---------------------------------------------------------------------------
// 5. Serialize quads to N3 text.
//    The n3 Writer accepts rdf/js quads directly.
// ---------------------------------------------------------------------------

async function quadsToN3(quads: readonly QuadInterface[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ 'format': 'N3' });

    writer.addQuads([...quads] as never);
    writer.end((err: Error | null, result: string) => {
      if (err) {
        reject(err);

        return;
      }
      resolve(result);
    });
  });
}

// ---------------------------------------------------------------------------
// 6. Bookstore-natural inference rules.
//    Order#customerId / Review#customerId / OrderLine#bookIsbn carry literal
//    foreign keys, not instance IRIs. Each rule joins those literals back to
//    the corresponding Customer#id / Book#isbn instance predicate so the
//    derived `:purchased`, `:reviewed`, and `:isVerifiedReviewerOf` triples
//    land on instance IRIs (valid N3 subjects/objects).
// ---------------------------------------------------------------------------

const PURCHASED = 'urn:example:purchased';
const REVIEWED = 'urn:example:reviewed';
const VERIFIED = 'urn:example:isVerifiedReviewerOf';

function rulesN3(): string {
  return `
{
  ?customer <urn:bookstore:Customer#id>          ?customerId.
  ?order    <urn:bookstore:Order#customerId>     ?customerId.
  ?order    <urn:bookstore:Order#items>          ?line.
  ?line     <urn:bookstore:OrderLine#bookIsbn>   ?isbn.
  ?book     <urn:bookstore:Book#isbn>            ?isbn.
} => {
  ?customer <${PURCHASED}> ?book.
}.

{
  ?customer <urn:bookstore:Customer#id>          ?customerId.
  ?review   <urn:bookstore:Review#customerId>    ?customerId.
  ?review   <urn:bookstore:Review#bookIsbn>      ?isbn.
  ?book     <urn:bookstore:Book#isbn>            ?isbn.
} => {
  ?customer <${REVIEWED}> ?book.
}.

{
  ?customer <${PURCHASED}> ?book.
  ?customer <${REVIEWED}>  ?book.
} => {
  ?customer <${VERIFIED}> ?book.
}.
`;
}

// ---------------------------------------------------------------------------
// 7. Run EYE with data + rules; ask it to surface every derived predicate.
// ---------------------------------------------------------------------------

const factsN3 = await quadsToN3(allQuads);
const dataN3 = `${factsN3}\n${rulesN3()}`;

const queryN3 = `
@prefix ex: <urn:example:>.
{ ?customer <${PURCHASED}> ?isbn } => { ?customer <${PURCHASED}> ?isbn }.
{ ?customer <${REVIEWED}>  ?isbn } => { ?customer <${REVIEWED}>  ?isbn }.
{ ?customer <${VERIFIED}>  ?isbn } => { ?customer <${VERIFIED}>  ?isbn }.
`;

console.log('\n=== Running EYE reasoner over toQuads ABox ===');
const resultN3 = await n3reasoner(dataN3, queryN3);

// ---------------------------------------------------------------------------
// 8. Parse reasoner output and display the inferred facts.
// ---------------------------------------------------------------------------

const parser = new Parser({ 'format': 'N3' });
const parsed = parser.parse(resultN3) as readonly unknown[];
const inferredQuads = Lists.narrowExternalQuads(parsed);

console.log('\n=== Inferred facts ===');
for (const quad of inferredQuads) {
  const predicate = quad.predicate.value;

  if (predicate === PURCHASED || predicate === REVIEWED || predicate === VERIFIED) {
    const labels: Record<string, string> = {
      [PURCHASED]: 'purchased',
      [REVIEWED]: 'reviewed',
      [VERIFIED]: 'isVerifiedReviewerOf'
    };
    const label = labels[predicate];

    console.log(`  ${quad.subject.value}  ${label}  ${quad.object.value}`);
  }
}

const bastianIri = `urn:bookstore:customer:${aboxFixtures.customer.id}`;
const rareBookIri = `urn:bookstore:book:${aboxFixtures.rareBook.isbn}`;

const expectedVerified = inferredQuads.some((quad) => {
  return quad.predicate.value === VERIFIED
    && quad.subject.value === bastianIri
    && quad.object.value === rareBookIri;
});

console.log(`\n  Bastian ${expectedVerified ? 'IS' : 'is NOT'} a verified reviewer of`
  + ' the 1979 Thienemann printing — derived purely from json-tology ABox quads'
  + ' + three N3 rules consumed by EYE.');

if (!expectedVerified) {
  process.exitCode = 1;
}
