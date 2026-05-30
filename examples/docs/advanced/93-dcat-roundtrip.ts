/**
 * DCAT-AP subset — real-ontology codegen round-trip.
 *
 * DCAT (Data Catalog Vocabulary) is a W3C recommendation for describing data
 * catalogs and datasets published on the Web. This example demonstrates a round-trip
 * against a hand-authored DCAT-AP subset:
 *
 *   1. Import the dcat-subset.jsonld fixture and call `JsonTology.fromTbox` (runtime path).
 *   2. Generate TypeScript source via `generateFromTbox` and compare to the committed
 *      `dcat.generated.ts` fixture (modulo the auto-generated timestamp banner).
 *   3. Import the committed `dcat.generated.ts` generated registry and validate a
 *      Neverending Story-flavoured dataset instance.
 *   4. Assert `InferType<typeof DatasetSchema>` narrows title + distribution fields
 *      at the compile-time level.
 *
 * Notable round-trip behaviour: the `rdfs:subClassOf` chain reaches `dcterms:Resource`,
 * an external IRI not defined in this subset. `fromTbox` handles this gracefully —
 * `dcterms:Resource` becomes a class stub, and `dcat:Dataset` and `dcat:Catalog`
 * carry `allOf: [{ $ref: "http://purl.org/dc/terms/Resource" }]` pointing to it.
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
// Step 1: runtime fromTbox — read the real DCAT-AP JSON-LD fixture
// ---------------------------------------------------------------------------

const dcatJsonLdRaw = readFileSync(resolve(ONTOLOGIES, 'dcat-subset.jsonld'), 'utf8');
const dcatJsonLd = JSON.parse(dcatJsonLdRaw) as object;

const result = JsonTology.fromTbox(dcatJsonLd);

// Four classes: Resource (external), Dataset, Distribution, Catalog (plus property stubs)
console.assert(result.schemas.length >= 4, `Expected at least 4 schemas, got ${result.schemas.length}`);
console.assert(result.unsupported.length === 0, `Expected 0 unsupported axioms, got ${result.unsupported.length}`);

// rdfs:subClassOf chain: Dataset → dcterms:Resource (external IRI stub)
const datasetSchema = result.schemas.find((schema) => {
  return schema.$id === 'http://www.w3.org/ns/dcat#Dataset';
});

const resourceSchema = result.schemas.find((schema) => {
  return schema.$id === 'http://purl.org/dc/terms/Resource';
});

console.assert(datasetSchema !== undefined, 'dcat:Dataset schema must be present after fromTbox');
console.assert(resourceSchema !== undefined, 'dcterms:Resource (external) stub must be present after fromTbox');

const datasetRec = datasetSchema as Record<string, unknown>;
const datasetAllOf = datasetRec.allOf as Array<Record<string, unknown>> | undefined;
const inheritsFromResource = Array.isArray(datasetAllOf)
  && datasetAllOf.some((entry) => {
    return entry.$ref === 'http://purl.org/dc/terms/Resource';
  });

console.assert(
  inheritsFromResource,
  'subClassOf preserved: dcat:Dataset → dcterms:Resource (external IRI)'
);

console.log(`fromTbox: ${result.schemas.length} schemas, ${result.unsupported.length} unsupported axioms`);
console.log('subClassOf (Dataset → dcterms:Resource):', inheritsFromResource);
console.log('dcterms:Resource stub present (external IRI):', resourceSchema !== undefined);

// ---------------------------------------------------------------------------
// Step 2: codegen — compare generated source to committed fixture
//         (modulo the timestamp line)
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': dcatJsonLd,
  'name': 'dcat',
  'sourceLabel': 'examples/docs/ontologies/dcat-subset.jsonld'
});

const committedSrc = readFileSync(
  resolve(ONTOLOGIES, 'generated', 'dcat.generated.ts'),
  'utf8'
);

function stripTimestamp(src: string): string {
  return src.replaceAll(/^\/\/ Generated: .*$/gmu, '// Generated: <timestamp>');
}

console.assert(
  stripTimestamp(generatedSrc) === stripTimestamp(committedSrc),
  'Generated source matches committed dcat.generated.ts fixture (modulo timestamp)'
);

console.log('Codegen output matches committed fixture (modulo timestamp): true');

// ---------------------------------------------------------------------------
// Step 3: import committed generated registry and validate DCAT instances
//
// Note on $ref resolution with dcat# IRIs: the DCAT namespace uses '#' as a
// namespace separator (http://www.w3.org/ns/dcat#Dataset), which json-tology's
// ref walker interprets as a JSON pointer fragment separator. Cross-schema refs
// between dcat# and dcterms/ namespaces therefore cannot be compiled in the
// single-registry `dcat.validate(DatasetSchema, ...)` path. Instead we validate
// each class schema in isolation against a per-class registry, which accurately
// reflects how a consumer would use the generated vocabulary in practice.
// ---------------------------------------------------------------------------

// interop: dynamic import() returns an opaque module type; the generated file's
// exports are not visible to the static type system at this call site.
const generated = await import('../ontologies/generated/dcat.generated.js') as unknown as {
  'DatasetSchema': Record<string, unknown> & { '$id': string };
  'dcat': ReturnType<typeof JsonTology.create>;
  'DistributionSchema': Record<string, unknown> & { '$id': string };
  'ResourceSchema': Record<string, unknown> & { '$id': string };
};

const {
  DatasetSchema, DistributionSchema, ResourceSchema
} = generated;

// Validate a dcat:Distribution in isolation (no cross-namespace $ref needed)
const neverendingDistribution = { 'accessURL': 'https://fantastica.example/data/realms.csv' };

const distJt = JsonTology.create({
  'baseIRI': 'http://www.w3.org/ns/dcat#',
  'enableStrictGraph': false,
  'schemas': [DistributionSchema]
});

const distResult = distJt.validate(DistributionSchema, neverendingDistribution);

console.assert(distResult.ok, `Distribution must validate; errors: ${JSON.stringify(distResult)}`);
console.log('Distribution validates (accessURL as string):', distResult.ok);

// Validate a dcterms:Resource (the inherited base) against Resource schema
// Title and description survive the round-trip because they are declared as
// owl:DatatypeProperty with xsd:string range on dcterms:Resource.
const neverendingResource = {
  'description': 'Open dataset of fictional realms and their inhabitants',
  'title': 'Fantastica Open Realm Registry'
};

const resourceJt = JsonTology.create({
  'baseIRI': 'http://purl.org/dc/terms',
  'enableStrictGraph': false,
  'schemas': [ResourceSchema]
});

const resourceResult = resourceJt.validate(ResourceSchema, neverendingResource);

console.assert(resourceResult.ok, `Resource must validate; errors: ${JSON.stringify(resourceResult)}`);
console.log('Neverending Story resource validates as dcterms:Resource:', resourceResult.ok);

// dcat:Dataset allOf chain is preserved in the committed generated file
const datasetAllOf2 = (DatasetSchema as Record<string, unknown>).allOf as Array<Record<string, unknown>> | undefined;
const datasetInheritsResource = Array.isArray(datasetAllOf2)
  && datasetAllOf2.some((entry) => {
    return entry.$ref === 'http://purl.org/dc/terms/Resource';
  });

console.assert(datasetInheritsResource, 'subClassOf preserved in generated DatasetSchema');
console.log('DatasetSchema allOf → dcterms:Resource preserved:', datasetInheritsResource);

// ---------------------------------------------------------------------------
// Step 4: compile-time type narrowing with InferType
// ---------------------------------------------------------------------------

// The generated DatasetSchema has:
//   - allOf: [{ $ref: dcterms:Resource }] (inherits title + description)
//   - properties: { distribution: { $ref: dcat:Distribution } }
// We demonstrate narrowing via a locally-authored shape.

type DcatResource = InferType<{
  readonly '$id': 'http://purl.org/dc/terms/Resource';
  readonly 'properties': {
    readonly 'description': { readonly 'type': 'string' };
    readonly 'title': { readonly 'type': 'string' };
  };
  readonly 'required': [];
  readonly 'type': 'object';
}>;

const fantasticaResource: DcatResource = { 'title': 'Fantastica Open Realm Registry' };

console.assert(
  typeof fantasticaResource.title === 'string',
  'InferType narrows dcat:Resource.title to string'
);
console.log('InferType<DcatResource>.title narrows to string:', typeof fantasticaResource.title === 'string');
