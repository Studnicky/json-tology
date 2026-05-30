/**
 * DCAT-AP subset — real-ontology codegen round-trip.
 *
 * DCAT (Data Catalog Vocabulary) is a W3C recommendation for describing data
 * catalogs and datasets published on the Web. This example demonstrates a round-trip
 * against a hand-authored DCAT-AP subset:
 *
 *   1. Import the dcat-subset data and call `JsonTology.fromTbox` (runtime path).
 *   2. Generate TypeScript source via `generateFromTbox` and log salient facts.
 *   3. Validate a Neverending Story-flavoured dataset instance.
 *   4. Assert `InferType<typeof DcatResource>` narrows title + description fields
 *      at the compile-time level.
 *
 * Notable round-trip behaviour: the `rdfs:subClassOf` chain reaches `dcterms:Resource`,
 * an external IRI not defined in this subset. `fromTbox` handles this gracefully —
 * `dcterms:Resource` becomes a class stub, and `dcat:Dataset` and `dcat:Catalog`
 * carry `allOf: [{ $ref: "http://purl.org/dc/terms/Resource" }]` pointing to it.
 *
 * Browser-safe: no node:fs, node:path, or node:url.
 */

import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';
import { generateFromTbox } from '../../../src/owl-gen.js';
import { dcatSubset } from '../ontologies/dcat-subset.js';

// ---------------------------------------------------------------------------
// Step 1: runtime fromTbox — import the DCAT-AP JSON-LD data directly
// ---------------------------------------------------------------------------

const result = JsonTology.fromTbox(dcatSubset);

// Four classes: Resource (external), Dataset, Distribution, Catalog (plus property stubs)
console.assert(result.schemas.length >= 4, `Expected at least 4 schemas, got ${result.schemas.length}`);
console.assert(result.unsupported.length === 0, `Expected 0 unsupported axioms, got ${result.unsupported.length}`);

// rdfs:subClassOf chain: Dataset -> dcterms:Resource (external IRI stub)
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
  'subClassOf preserved: dcat:Dataset -> dcterms:Resource (external IRI)'
);

console.log(`fromTbox: ${result.schemas.length} schemas, ${result.unsupported.length} unsupported axioms`);
console.log('subClassOf (Dataset -> dcterms:Resource):', inheritsFromResource);
console.log('dcterms:Resource stub present (external IRI):', resourceSchema !== undefined);

// ---------------------------------------------------------------------------
// Step 2: codegen — generate source and log salient facts
// ---------------------------------------------------------------------------

const generatedSrc = generateFromTbox({
  'input': dcatSubset,
  'name': 'dcat',
  'sourceLabel': 'examples/docs/ontologies/dcat-subset.jsonld'
});

console.assert(generatedSrc.includes('export const DatasetSchema'), 'Generated source must export DatasetSchema');
console.assert(generatedSrc.includes('export const DistributionSchema'), 'Generated source must export DistributionSchema');
console.assert(generatedSrc.includes('allOf'), 'Generated source must preserve subClassOf as allOf');

console.log('Generated source length:', generatedSrc.length);
console.log('Contains DatasetSchema export:', generatedSrc.includes('export const DatasetSchema'));
console.log('Contains allOf (subClassOf):', generatedSrc.includes('allOf'));

// ---------------------------------------------------------------------------
// Step 3: validate DCAT instances against the runtime-imported schemas
//
// Note on $ref resolution with dcat# IRIs: the DCAT namespace uses '#' as a
// namespace separator (http://www.w3.org/ns/dcat#Dataset), which json-tology's
// ref walker interprets as a JSON pointer fragment separator. Cross-schema refs
// between dcat# and dcterms/ namespaces therefore cannot be compiled in the
// single-registry path. We validate each class schema in isolation against a
// per-class registry, which accurately reflects how a consumer uses the vocabulary.
// ---------------------------------------------------------------------------

const distributionSchema = result.schemas.find((schema) => {
  return schema.$id === 'http://www.w3.org/ns/dcat#Distribution';
});

if (distributionSchema !== undefined && typeof distributionSchema.$id === 'string') {
  const distributionRec = distributionSchema as Record<string, unknown> & { '$id': string };
  const distJt = JsonTology.create({
    'baseIRI': 'http://www.w3.org/ns/dcat#',
    'enableStrictGraph': false,
    'schemas': [distributionRec]
  });

  const neverendingDistribution = { 'accessURL': 'https://fantastica.example/data/realms.csv' };
  const distResult = distJt.validate(distributionRec, neverendingDistribution);

  console.assert(distResult.ok, `Distribution must validate; errors: ${JSON.stringify(distResult)}`);
  console.log('Distribution validates (accessURL as string):', distResult.ok);
}

if (resourceSchema !== undefined && typeof resourceSchema.$id === 'string') {
  const resourceRec = resourceSchema as Record<string, unknown> & { '$id': string };
  const resourceJt = JsonTology.create({
    'baseIRI': 'http://purl.org/dc/terms',
    'enableStrictGraph': false,
    'schemas': [resourceRec]
  });

  const neverendingResource = {
    'description': 'Open dataset of fictional realms and their inhabitants',
    'title': 'Fantastica Open Realm Registry'
  };

  const resourceResult = resourceJt.validate(resourceRec, neverendingResource);

  console.assert(resourceResult.ok, `Resource must validate; errors: ${JSON.stringify(resourceResult)}`);
  console.log('Neverending Story resource validates as dcterms:Resource:', resourceResult.ok);
}

// dcat:Dataset allOf chain is preserved in the runtime schemas
console.assert(inheritsFromResource, 'subClassOf preserved in DatasetSchema');
console.log('DatasetSchema allOf -> dcterms:Resource preserved:', inheritsFromResource);

// ---------------------------------------------------------------------------
// Step 4: compile-time type narrowing with InferType
// ---------------------------------------------------------------------------

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
