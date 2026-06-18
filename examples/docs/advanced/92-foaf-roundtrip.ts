/**
 * FOAF subset — real-ontology codegen round-trip.
 *
 * FOAF (Friend of a Friend) is a classic semantic-web vocabulary for describing
 * people and their social relationships. This example demonstrates a round-trip
 * against a hand-authored FOAF subset:
 *
 *   1. Import the foaf-subset data and call `JsonTology.fromTbox` (runtime path).
 *   2. Generate TypeScript source via `generateFromTbox` and log salient facts.
 *   3. Validate a Bastian-style `foaf:Agent` instance against the runtime schema.
 *   4. Assert `InferType<typeof FoafAgent>` narrows name + mbox fields correctly
 *      at the compile-time level.
 *
 * Notable round-trip behaviour: `owl:disjointWith` between `foaf:Person` and
 * `foaf:Group` is preserved as `disjointWith: "..."` on both class schemas.
 *
 * Browser-safe: no node:fs, node:path, or node:url.
 */

import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
import { generateFromTbox } from '../../../src/owl-gen.js';
import { foafSubset } from '../ontologies/foaf-subset.js';

// ---------------------------------------------------------------------------
// Step 1: runtime fromTbox — import the FOAF JSON-LD data directly
// ---------------------------------------------------------------------------

const result = JsonTology.fromTbox(foafSubset);

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
console.log('disjointWith (Person -> Group):', personRec.disjointWith);

// ---------------------------------------------------------------------------
// Step 2: codegen — generate source and log salient facts
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': foafSubset,
  'name': 'foaf',
  'sourceLabel': 'examples/docs/ontologies/foaf-subset.jsonld'
});

console.assert(generatedSrc.includes('export const AgentSchema'), 'Generated source must export AgentSchema');
console.assert(generatedSrc.includes('export const PersonSchema'), 'Generated source must export PersonSchema');
console.assert(generatedSrc.includes('export const GroupSchema'), 'Generated source must export GroupSchema');
console.assert(generatedSrc.includes('disjointWith'), 'Generated source must preserve disjointWith annotation');

console.log('Generated source length:', generatedSrc.length);
console.log('Contains AgentSchema export:', generatedSrc.includes('export const AgentSchema'));
console.log('Contains disjointWith annotation:', generatedSrc.includes('disjointWith'));

// ---------------------------------------------------------------------------
// Step 3: validate foaf:Agent instances against the runtime-imported schema
// ---------------------------------------------------------------------------

const agentSchema = result.schemas.find((schema) => {
  return schema.$id === 'http://xmlns.com/foaf/0.1/Agent';
});

console.assert(agentSchema !== undefined, 'foaf:Agent schema must be present');

if (agentSchema !== undefined && typeof agentSchema.$id === 'string') {
  const agentSchemaRec = agentSchema as Record<string, unknown> & { '$id': string };
  const jt = JsonTology.create({
    'baseIri': 'http://xmlns.com/foaf/0.1/',
    'enableStrictGraph': false,
    'schemas': [agentSchemaRec]
  });

  // Bastian Balthazar Bux as foaf:Agent — name + mbox are owl:DatatypeProperty
  // on foaf:Agent, so they appear as string properties on AgentSchema.
  const bastian = {
    'mbox': 'bastian@fantastica.example',
    'name': 'Bastian Balthazar Bux'
  };

  const bastianResult = jt.validate(agentSchemaRec, bastian);

  console.assert(bastianResult.ok, `Bastian Balthazar Bux must validate as foaf:Agent; errors: ${JSON.stringify(bastianResult)}`);
  console.log('Bastian Balthazar Bux validates as foaf:Agent:', bastianResult.ok);

  const cornelia = {
    'mbox': 'cornelia@funke.example',
    'name': 'Cornelia Funke'
  };

  const corneliaResult = jt.validate(agentSchemaRec, cornelia);

  console.assert(corneliaResult.ok, `Cornelia Funke must validate as foaf:Agent; errors: ${JSON.stringify(corneliaResult)}`);
  console.log('Cornelia Funke validates as foaf:Agent:', corneliaResult.ok);
}

console.log('PersonSchema.$id:', personRec.$id);
console.assert(
  personRec.disjointWith === 'http://xmlns.com/foaf/0.1/Group',
  'PersonSchema.disjointWith preserved in runtime schemas'
);
console.log('PersonSchema.disjointWith preserved:', personRec.disjointWith);

// ---------------------------------------------------------------------------
// Step 4: compile-time type narrowing with InferType
// ---------------------------------------------------------------------------

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
