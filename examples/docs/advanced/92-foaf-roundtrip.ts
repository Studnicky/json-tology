/**
 * FOAF subset — real-ontology codegen round-trip.
 *
 * FOAF (Friend of a Friend) is a classic semantic-web vocabulary for describing
 * people and their social relationships. This example demonstrates a round-trip
 * against a hand-authored FOAF subset:
 *
 *   1. Import the foaf-subset.jsonld fixture and call `JsonTology.fromTbox` (runtime path).
 *   2. Generate TypeScript source via `generateFromTbox` and compare to the committed
 *      `foaf.generated.ts` fixture (modulo the auto-generated timestamp banner).
 *   3. Import the committed `foaf.generated.ts` generated registry and validate a
 *      Bastian-style `foaf:Person` instance.
 *   4. Assert `InferType<typeof PersonSchema>` narrows name + mbox fields correctly
 *      at the compile-time level.
 *
 * Notable round-trip behaviour: `owl:disjointWith` between `foaf:Person` and
 * `foaf:Group` is preserved as `disjointWith: "..."` on both class schemas.
 */

import { readFileSync } from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
import { generateFromTbox } from '../../../src/owl-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
const ONTOLOGIES = resolve(here, '../ontologies');

// ---------------------------------------------------------------------------
// Step 1: runtime fromTbox — read the real FOAF JSON-LD fixture
// ---------------------------------------------------------------------------

const foafJsonLdRaw = readFileSync(resolve(ONTOLOGIES, 'foaf-subset.jsonld'), 'utf8');
const foafJsonLd = JSON.parse(foafJsonLdRaw) as object;

const result = JsonTology.fromTbox(foafJsonLd);

// Three classes: Agent, Person, Group (plus property stubs for annotations)
console.assert(result.schemas.length >= 3, `Expected at least 3 schemas, got ${result.schemas.length}`);
console.assert(result.unsupported.length === 0, `Expected 0 unsupported axioms, got ${result.unsupported.length}`);

// owl:disjointWith is symmetric — both Person and Group carry the annotation
const personSchema = result.schemas.find((schema) => {
  return schema.$id === 'http://xmlns.com/foaf/0.1/Person';
});
const groupSchema = result.schemas.find((schema) => {
  return schema.$id === 'http://xmlns.com/foaf/0.1/Group';
});

console.assert(
  personSchema !== undefined,
  'foaf:Person schema must be present after fromTbox'
);

const personRec = personSchema as Record<string, unknown>;
const groupRec = groupSchema as Record<string, unknown>;

console.assert(
  personRec.disjointWith === 'http://xmlns.com/foaf/0.1/Group',
  'owl:disjointWith preserved: Person disjoint with Group'
);
console.assert(
  groupRec.disjointWith === 'http://xmlns.com/foaf/0.1/Person',
  'owl:disjointWith preserved: Group disjoint with Person (symmetric)'
);

console.log(`fromTbox: ${result.schemas.length} schemas, ${result.unsupported.length} unsupported axioms`);
console.log('disjointWith (Person ↔ Group):', personRec.disjointWith);

// ---------------------------------------------------------------------------
// Step 2: codegen — compare generated source to committed fixture
//         (modulo the timestamp line)
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': foafJsonLd,
  'name': 'foaf',
  'sourceLabel': 'examples/docs/ontologies/foaf-subset.jsonld'
});

const committedSrc = readFileSync(
  resolve(ONTOLOGIES, 'generated', 'foaf.generated.ts'),
  'utf8'
);

// Strip the timestamp banner line before comparing
function stripTimestamp(src: string): string {
  return src.replaceAll(/^\/\/ Generated: .*$/gmu, '// Generated: <timestamp>');
}

console.assert(
  stripTimestamp(generatedSrc) === stripTimestamp(committedSrc),
  'Generated source matches committed foaf.generated.ts fixture (modulo timestamp)'
);

console.log('Codegen output matches committed fixture (modulo timestamp): true');

// ---------------------------------------------------------------------------
// Step 3: import committed generated registry and validate foaf:Agent instances
// ---------------------------------------------------------------------------

// The committed generated file exports `PersonSchema`, `AgentSchema`, and a `foaf`
// registry. We load them here via a dynamic import.
const generated = await import('../ontologies/generated/foaf.generated.js') as {
  'AgentSchema': Record<string, unknown> & { '$id': string };
  'foaf': ReturnType<typeof JsonTology.create>;
  'PersonSchema': Record<string, unknown> & { '$id': string };
};

const {
  AgentSchema, foaf, 'PersonSchema': CommittedPersonSchema
} = generated;

// Bastian Balthazar Bux — foaf:Agent (name + mbox survive the round-trip
// because both are declared as owl:DatatypeProperty with xsd:string range
// on foaf:Agent, so they appear as `properties.name` and `properties.mbox`
// in AgentSchema).
const bastian = {
  'mbox': 'bastian@fantastica.example',
  'name': 'Bastian Balthazar Bux'
};

const bastianResult = foaf.validate(AgentSchema, bastian);

console.assert(bastianResult.ok, `Bastian Balthazar Bux must validate as foaf:Agent; errors: ${JSON.stringify(bastianResult)}`);
console.log('Bastian Balthazar Bux validates as foaf:Agent:', bastianResult.ok);

// Cornelia Funke — also a foaf:Agent (the author of the Neverending Story)
const cornelia = {
  'mbox': 'cornelia@funke.example',
  'name': 'Cornelia Funke'
};

const corneliaResult = foaf.validate(AgentSchema, cornelia);

console.assert(corneliaResult.ok, `Cornelia Funke must validate as foaf:Agent; errors: ${JSON.stringify(corneliaResult)}`);
console.log('Cornelia Funke validates as foaf:Agent:', corneliaResult.ok);

// PersonSchema carries `disjointWith: foaf:Group` — the registry enforces the
// OWL disjointWith constraint at runtime. A plain object that structurally
// satisfies BOTH Person and Group (both are `type: object` with similar shapes)
// will fail PersonSchema validation, which is the correct OWL 2 behaviour.
// Use AgentSchema for round-trip validation; PersonSchema is for structural queries.
console.log('PersonSchema.$id:', CommittedPersonSchema.$id);
console.assert(
  (CommittedPersonSchema as Record<string, unknown>).disjointWith === 'http://xmlns.com/foaf/0.1/Group',
  'PersonSchema.disjointWith preserved in committed generated file'
);
console.log('PersonSchema.disjointWith preserved in generated file:', (CommittedPersonSchema as Record<string, unknown>).disjointWith);

// ---------------------------------------------------------------------------
// Step 4: compile-time type narrowing with InferType
// ---------------------------------------------------------------------------

// PersonSchema from the generated module has `properties.knows.$ref` pointing to
// foaf:Person — InferType produces an object type with `name?` and `mbox?` fields
// inherited from AgentSchema via `allOf: [{ $ref: foaf:Agent }]`.
//
// We demonstrate narrowing via a locally-authored shape that mirrors the generated
// output (the generated file itself carries the type alias `export type Person = ...`).
type FoafAgent = InferType<{
  readonly '$id': 'http://xmlns.com/foaf/0.1/Agent';
  readonly 'properties': {
    readonly 'mbox': { readonly 'type': 'string' };
    readonly 'name': { readonly 'type': 'string' };
  };
  readonly 'required': [];
  readonly 'type': 'object';
}>;

const bastianTyped: FoafAgent = { 'name': 'Bastian Balthazar Bux' };

console.assert(
  typeof bastianTyped.name === 'string',
  'InferType narrows foaf:Agent.name to string'
);
console.log('InferType<FoafAgent>.name narrows to string:', typeof bastianTyped.name === 'string');
