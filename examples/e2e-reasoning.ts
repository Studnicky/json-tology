/**
 * e2e-reasoning.ts — Graph + ABox + EYE reasoner + round-trip
 *
 * Demonstrates that the ontology output from json-tology feeds a real
 * N3 reasoner (EYE via WASM) to derive social-network inferences, and
 * that reasoner output can be rehydrated back into typed JS objects.
 *
 * Pipeline:
 *   1. Registers FOAF schemas, validates instances
 *   2. Extracts TBox (OWL) and SHACL shapes
 *   3. Projects ABox instances -> quads -> fromQuads round-trip
 *   4. Serializes to N3, runs EYE reasoner
 *   5. Prints derived social connections
 *
 * Run: npm run build && tsx examples/e2e-reasoning.ts
 */

import {
  fromRdfQuad, JsonTology
} from '../src/index.js';
import type { InferType } from '../src/types/index.js';
import type { QuadInterface } from '../src/interfaces/index.js';
import type { RdfJsQuadInterface } from '../src/interfaces/RdfJsQuad.js';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';
import {
  allSchemas, foafOrganizations, foafPersons,
  OrganizationSchema, PersonSchema
} from '../test/fixtures/foaf.js';

// ---------------------------------------------------------------------------
// 1. Register and validate
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'http://xmlns.com/foaf',
  'castTypes': true,
  'schemas': allSchemas
});

// Validate persons
for (const person of foafPersons) {
  const errs = jt.validate(PersonSchema.$id, person);

  if (errs.length > 0) {
    const givenName = typeof person.givenName === 'string' ? person.givenName : 'unknown';

    throw new Error(`Invalid person ${givenName}: ${errs.items.map((error) => {
      return error.message;
    }).join(', ')}`);
  }
}
for (const org of foafOrganizations) {
  const errs = jt.validate(OrganizationSchema.$id, org);

  if (errs.length > 0) {
    const name = typeof org.name === 'string' ? org.name : 'unknown';

    throw new Error(`Invalid organization ${name}: ${errs.items.map((error) => {
      return error.message;
    }).join(', ')}`);
  }
}

console.log('All instances validated.\n');

// ---------------------------------------------------------------------------
// 2. TBox — OWL ontology
// ---------------------------------------------------------------------------

const ontology = jt.ontology();
const tbox = ontology.jsonLdObject();
const tboxGraph = (tbox['@graph'] ?? []) as Array<Record<string, unknown>>;

console.log('=== TBox (OWL classes) ===');
for (const node of tboxGraph) {
  if (node['@type'] === 'owl:Class') {
    console.log(' ', node['@id']);
  }
}

// ---------------------------------------------------------------------------
// 3. SHACL shapes
// ---------------------------------------------------------------------------

const shacl = ontology.shaclObject();
const shaclGraph = (shacl['@graph'] ?? []) as Array<Record<string, unknown>>;

console.log('\n=== SHACL shapes ===');
for (const node of shaclGraph) {
  const nodeType = node['@type'];

  if (nodeType === 'sh:NodeShape' || (Array.isArray(nodeType) && nodeType.includes('sh:NodeShape'))) {
    console.log(' ', node['@id']);
  }
}

// ---------------------------------------------------------------------------
// 4. ABox round-trip: JS -> quads -> fromQuads -> JS
// ---------------------------------------------------------------------------

console.log('\n=== ABox round-trip ===');

let allQuads: QuadInterface[] = [];

for (const person of foafPersons) {
  const quads = jt.materializer.projectAbox(
    PersonSchema as unknown as Record<string, unknown> & { '$id': string },
    person,
    'http://xmlns.com/foaf'
  );

  allQuads = [
    ...allQuads,
    ...quads
  ];
}

type Person = InferType<typeof PersonSchema>;
const rehydrated = jt.fromQuads(PersonSchema.$id, allQuads) as Person[];

console.log('Original persons:', foafPersons.length);
console.log('Rehydrated persons:', rehydrated.length);
for (const person of rehydrated) {
  const givenName = typeof person.givenName === 'string' ? person.givenName : 'Unknown';
  const familyName = typeof person.familyName === 'string' ? person.familyName : 'Unknown';
  const mbox = typeof person.mbox === 'string' ? person.mbox : 'Unknown';

  console.log(`  ${givenName} ${familyName} (${mbox})`);
}

// ---------------------------------------------------------------------------
// 5. Serialize to N3, run EYE reasoner
// ---------------------------------------------------------------------------

const FOAF = 'http://xmlns.com/foaf/0.1/';

function factsToN3(): string {
  const lines: string[] = [
    `@prefix foaf: <${FOAF}>.`,
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.',
    ''
  ];

  for (const person of foafPersons) {
    const givenName = typeof person.givenName === 'string' ? person.givenName : '';
    const familyName = typeof person.familyName === 'string' ? person.familyName : '';
    const knows = Array.isArray(person.knows) ? person.knows : [];
    const pid = givenName.toLowerCase();

    lines.push(`foaf:${pid} rdf:type foaf:Person.`);
    lines.push(`foaf:${pid} foaf:givenName "${givenName}".`);
    lines.push(`foaf:${pid} foaf:familyName "${familyName}".`);
    for (const known of knows) {
      const knownStr = typeof known === 'string' ? known : '';

      lines.push(`foaf:${pid} foaf:knows foaf:${knownStr}.`);
    }
  }
  lines.push('');
  for (const org of foafOrganizations) {
    const name = typeof org.name === 'string' ? org.name : '';
    const member = Array.isArray(org.member) ? org.member : [];
    const oid = name.toLowerCase().replaceAll(/\s+/gu, '-');

    lines.push(`foaf:${oid} rdf:type foaf:Organization.`);
    lines.push(`foaf:${oid} foaf:name "${name}".`);
    for (const m of member) {
      const memberStr = typeof m === 'string' ? m : '';

      lines.push(`foaf:${oid} foaf:hasMember foaf:${memberStr}.`);
    }
  }

  return lines.join('\n');
}

function rulesToN3(): string {
  return `
@prefix foaf: <${FOAF}>.
@prefix log: <http://www.w3.org/2000/10/swap/log#>.

{
  ?a foaf:knows ?b.
} => {
  ?b foaf:knows ?a.
}.

{
  ?a foaf:knows ?b.
  ?b foaf:knows ?c.
} => {
  ?a foaf:couldCollaborateWith ?c.
}.

{
  ?org foaf:hasMember ?a.
  ?org foaf:hasMember ?b.
  ?a log:notEqualTo ?b.
} => {
  ?a foaf:knows ?b.
}.
`;
}

function queryN3(): string {
  return `
@prefix foaf: <${FOAF}>.
{ ?a foaf:knows ?b } => { ?a foaf:knows ?b }.
{ ?a foaf:couldCollaborateWith ?b } => { ?a foaf:couldCollaborateWith ?b }.
`;
}

// ---------------------------------------------------------------------------
// 6. Print derived facts — inferred social connections
// ---------------------------------------------------------------------------

async function reason() {
  const dataN3 = `${factsToN3()}\n${rulesToN3()}`;

  console.log('\n=== Running EYE reasoner ===');
  const resultN3 = await n3reasoner(dataN3, queryN3());

  function parseN3Quads(n3Text: string): RdfJsQuadInterface[] {
    const N3Parser = Parser as unknown as new (opts: Record<string, string>) => { 'parse': (input: string) => unknown[] };
    const parser = new N3Parser({ 'format': 'text/n3' });

    return parser.parse(n3Text) as RdfJsQuadInterface[];
  }

  const moduleQuads = parseN3Quads(resultN3).map((rdfQuad) => {
    return fromRdfQuad(rdfQuad);
  });

  const bySubject = new Map<string, QuadInterface[]>();

  for (const quad of moduleQuads) {
    let list = bySubject.get(quad.subject);

    if (!list) {
      list = []; bySubject.set(quad.subject, list);
    }
    list.push(quad);
  }

  const nameOf: Record<string, string> = {};

  for (const person of foafPersons) {
    const givenName = typeof person.givenName === 'string' ? person.givenName : '';

    nameOf[FOAF + givenName.toLowerCase()] = givenName;
  }

  console.log('\n=== Inferred social connections ===');
  for (const [
    subject,
    quads
  ] of bySubject) {
    const personName = nameOf[subject] ?? subject;

    for (const quad of quads) {
      if (quad.predicate === `${FOAF}knows`) {
        const targetName = nameOf[quad.object.value as string] ?? quad.object.value;

        console.log(`  ${personName} knows ${targetName}`);
      }
    }
    for (const quad of quads) {
      if (quad.predicate === `${FOAF}couldCollaborateWith`) {
        const targetName = nameOf[quad.object.value as string] ?? quad.object.value;

        console.log(`  ${personName} could collaborate with ${targetName}`);
      }
    }
  }

  const carolKnowsBob = moduleQuads.some((quad) => {
    return quad.subject === `${FOAF}carol`
      && quad.predicate === `${FOAF}knows`
      && quad.object.value === `${FOAF}bob`;
  });

  console.log(`\n  Carol ${carolKnowsBob ? 'DOES' : 'does NOT'} know Bob`);
  console.log('  (Carol knows Alice+Bob explicitly; symmetric rule confirms reverse)');
}

await reason();
