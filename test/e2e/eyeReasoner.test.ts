/**
 * EYE reasoner e2e test.
 *
 * Verifies that json-tology's ABox output drives a real OWL/N3 reasoner
 * end-to-end against the canonical bookstore domain.
 *
 * Pipeline under test:
 *   1. Validate Bastian's customer, his order of the 1979 Thienemann printing
 *      of `Die unendliche Geschichte`, the rare book itself, and his review.
 *   2. Project each fixture to rdf/js quads via JsonTology.toQuads with explicit
 *      iriFor strategies so the resulting subjects are stable, human-readable
 *      bookstore IRIs (`urn:bookstore:customer:UUID`, `urn:bookstore:book:ISBN`).
 *   3. Serialize the rdf/js quads to N3 with the n3 Writer.
 *   4. Append three N3 inference rules that chain through Customer#id and
 *      Book#isbn so derived predicates land on instance IRIs instead of literal
 *      foreign keys.
 *   5. Hand data + rules to EYE (WASM) via n3reasoner.
 *   6. Parse the reasoner output through Lists.narrowExternalQuads and assert
 *      the expected `:purchased`, `:reviewed`, and `:isVerifiedReviewerOf`
 *      triples land on the right subject/object IRIs.
 *
 * `eyereasoner` is an optional peer dependency. When absent (e.g. in a leaner
 * CI matrix), every test in this file is skipped rather than failed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, Writer } from 'n3';
import { Lists } from '../../src/index.js';
import type { QuadInterface } from '../../src/interfaces/index.js';
import {
  aboxFixtures,
  BookSchema,
  bookstoreEntities,
  CustomerSchema,
  OrderSchema,
  ReviewSchema
} from '../../examples/docs/bookstore/index.js';

interface N3ReasonerFn {
  (data: string, query: string): Promise<string>;
}

async function tryLoadN3Reasoner(): Promise<N3ReasonerFn | null> {
  try {
    const mod = await import('eyereasoner');

    if (typeof (mod as { n3reasoner?: unknown }).n3reasoner === 'function') {
      return (mod as { n3reasoner: N3ReasonerFn }).n3reasoner;
    }

    return null;
  } catch {
    return null;
  }
}

const PURCHASED = 'urn:example:purchased';
const REVIEWED = 'urn:example:reviewed';
const VERIFIED = 'urn:example:isVerifiedReviewerOf';

const bastianIri = `urn:bookstore:customer:${aboxFixtures.customer.id}`;
const rareBookIri = `urn:bookstore:book:${aboxFixtures.rareBook.isbn}`;

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

function queryN3(): string {
  return `
{ ?customer <${PURCHASED}> ?book } => { ?customer <${PURCHASED}> ?book }.
{ ?customer <${REVIEWED}>  ?book } => { ?customer <${REVIEWED}>  ?book }.
{ ?customer <${VERIFIED}>  ?book } => { ?customer <${VERIFIED}>  ?book }.
`;
}

async function runReasoner(): Promise<readonly QuadInterface[]> {
  const n3reasoner = await tryLoadN3Reasoner();

  if (n3reasoner === null) {
    return [];
  }

  const allQuads: QuadInterface[] = [
    ...bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer, {
      'iriFor': bastianIri
    }),
    ...bookstoreEntities.toQuads(BookSchema, aboxFixtures.rareBook, {
      'iriFor': rareBookIri
    }),
    ...bookstoreEntities.toQuads(OrderSchema, aboxFixtures.order, {
      'iriFor': `urn:bookstore:order:${aboxFixtures.order.id}`
    }),
    ...bookstoreEntities.toQuads(ReviewSchema, aboxFixtures.review, {
      'iriFor': `urn:bookstore:review:${aboxFixtures.review.id}`
    })
  ];

  const factsN3 = await quadsToN3(allQuads);
  const dataN3 = `${factsN3}\n${rulesN3()}`;
  const resultN3 = await n3reasoner(dataN3, queryN3());

  const parser = new Parser({ 'format': 'N3' });

  return Lists.narrowExternalQuads(parser.parse(resultN3) as readonly unknown[]);
}

void describe('EYE reasoner — bookstore ABox e2e inference', async () => {
  const reasonerAvailable = await tryLoadN3Reasoner() !== null;

  if (!reasonerAvailable) {
    void it('skipped: optional peer dependency `eyereasoner` not installed', { 'skip': true }, () => {
      // Nothing — the suite is skipped when the reasoner peer is absent.
    });

    return;
  }

  const inferredQuads = await runReasoner();

  void it('derives :purchased from Order line items', () => {
    const purchased = inferredQuads.filter((quad) => {
      return quad.predicate.value === PURCHASED;
    });

    assert.ok(purchased.length > 0, ':purchased triple should be inferred');

    const hit = purchased.find((quad) => {
      return quad.subject.value === bastianIri && quad.object.value === rareBookIri;
    });

    assert.ok(hit !== undefined, `Bastian (${bastianIri}) should be inferred as having purchased the rare book (${rareBookIri})`);
  });

  void it('derives :reviewed from Review records', () => {
    const reviewed = inferredQuads.filter((quad) => {
      return quad.predicate.value === REVIEWED;
    });

    assert.ok(reviewed.length > 0, ':reviewed triple should be inferred');

    const hit = reviewed.find((quad) => {
      return quad.subject.value === bastianIri && quad.object.value === rareBookIri;
    });

    assert.ok(hit !== undefined, `Bastian (${bastianIri}) should be inferred as having reviewed the rare book (${rareBookIri})`);
  });

  void it('derives :isVerifiedReviewerOf from purchased ∧ reviewed', () => {
    const verified = inferredQuads.filter((quad) => {
      return quad.predicate.value === VERIFIED;
    });

    assert.ok(verified.length > 0, ':isVerifiedReviewerOf triple should be inferred');

    const hit = verified.find((quad) => {
      return quad.subject.value === bastianIri && quad.object.value === rareBookIri;
    });

    assert.ok(hit !== undefined, 'Bastian should be inferred as a verified reviewer of the rare book');
  });

  void it('every inferred triple has named-node subject and object (no literal-subject leakage)', () => {
    const triples = inferredQuads.filter((quad) => {
      return quad.predicate.value === PURCHASED
        || quad.predicate.value === REVIEWED
        || quad.predicate.value === VERIFIED;
    });

    for (const quad of triples) {
      assert.equal(quad.subject.termType, 'NamedNode', `subject should be a NamedNode: ${quad.subject.value}`);
      assert.equal(quad.object.termType, 'NamedNode', `object should be a NamedNode: ${quad.object.value}`);
    }
  });
});
