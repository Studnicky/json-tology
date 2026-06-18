/**
 * Real-world ontology import e2e tests.
 *
 * Validates `JsonTology.fromTbox` and `jt.fromTbox` against minimal in-line
 * JSON-LD snippets drawn from two well-known W3C ontologies:
 *
 *   • FOAF (Friend of a Friend, http://xmlns.com/foaf/0.1/)
 *   • DCAT-AP (Data Catalog Vocabulary, http://www.w3.org/ns/dcat#)
 *
 * Inline fixtures are used so the test suite has no network dependency and
 * no reliance on external fixture files beyond what this file declares. They
 * cover the `foaf:Person` and `dcat:Dataset` classes respectively, which are
 * the primary hand-validation targets for each ontology.
 *
 * Expected drift (OWL 2 axioms not yet fully covered):
 *   • `owl:Restriction` nodes with `owl:onProperty` + `owl:someValuesFrom` /
 *     `owl:allValuesFrom` / cardinality axioms — not emitted as JSON Schema
 *     property-constraint keywords from inline JSON-LD (they are emitted from
 *     the json-tology TBox serialiser but the importer reconstructs them as
 *     `jt:restrictions` which is not fully restored from arbitrary JSON-LD).
 *   • `owl:minQualifiedCardinality` / `owl:maxQualifiedCardinality` —
 *     qualified cardinality axioms are not mapped to `required` / `maxItems`
 *     in the current dispatcher implementation.
 *   • `rdfs:comment` / `rdfs:label` literal values are not carried into
 *     `title` or `description` by the current Annotations dispatcher.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// FOAF minimal in-line JSON-LD snippet
//
// Covers:
//   - foaf:Person (owl:Class)
//   - foaf:givenName, foaf:familyName (owl:DatatypeProperty → xsd:string range)
//   - foaf:knows (owl:ObjectProperty, foaf:Person domain+range → $ref)
// ---------------------------------------------------------------------------

const FOAF_JSONLD = JSON.stringify({
  '@context': {
    'foaf': 'http://xmlns.com/foaf/0.1/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    {
      '@id': 'http://xmlns.com/foaf/0.1/Person',
      '@type': ['owl:Class'],
      'rdfs:label': 'Person'
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/givenName',
      '@type': ['owl:DatatypeProperty'],
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Person' },
      'rdfs:label': 'given name',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/familyName',
      '@type': ['owl:DatatypeProperty'],
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Person' },
      'rdfs:label': 'family name',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/knows',
      '@type': ['owl:ObjectProperty'],
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Person' },
      'rdfs:label': 'knows',
      'rdfs:range': { '@id': 'http://xmlns.com/foaf/0.1/Person' }
    }
  ]
});

// ---------------------------------------------------------------------------
// DCAT-AP minimal in-line JSON-LD snippet
//
// Covers:
//   - dcat:Dataset (owl:Class)
//   - dct:title, dct:description (owl:DatatypeProperty → xsd:string range)
//   - dct:publisher (owl:ObjectProperty → foaf:Agent range → $ref)
//   - foaf:Agent (owl:Class — referenced class must also be imported)
// ---------------------------------------------------------------------------

const DCAT_JSONLD = JSON.stringify({
  '@context': {
    'dcat': 'http://www.w3.org/ns/dcat#',
    'dct': 'http://purl.org/dc/terms/',
    'foaf': 'http://xmlns.com/foaf/0.1/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    {
      '@id': 'http://www.w3.org/ns/dcat#Dataset',
      '@type': ['owl:Class'],
      'rdfs:label': 'Dataset'
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/Agent',
      '@type': ['owl:Class'],
      'rdfs:label': 'Agent'
    },
    {
      '@id': 'http://purl.org/dc/terms/title',
      '@type': ['owl:DatatypeProperty'],
      'rdfs:domain': { '@id': 'http://www.w3.org/ns/dcat#Dataset' },
      'rdfs:label': 'title',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://purl.org/dc/terms/description',
      '@type': ['owl:DatatypeProperty'],
      'rdfs:domain': { '@id': 'http://www.w3.org/ns/dcat#Dataset' },
      'rdfs:label': 'description',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://purl.org/dc/terms/publisher',
      '@type': ['owl:ObjectProperty'],
      'rdfs:domain': { '@id': 'http://www.w3.org/ns/dcat#Dataset' },
      'rdfs:label': 'publisher',
      'rdfs:range': { '@id': 'http://xmlns.com/foaf/0.1/Agent' }
    }
  ]
});

// ---------------------------------------------------------------------------
// FOAF import tests
// ---------------------------------------------------------------------------

void describe('real-world ontology import: FOAF', () => {
  void it('imports FOAF snippet: schemas count > 0, every schema has $id', () => {
    const result = JsonTology.fromTbox(FOAF_JSONLD);

    assert.ok(result.schemas.length > 0, 'FOAF import must produce at least one schema');

    for (const schema of result.schemas) {
      assert.ok(typeof schema.$id === 'string', `Schema missing $id: ${JSON.stringify(schema)}`);
    }
  });

  void it('imports FOAF snippet: unsupported is empty', () => {
    const result = JsonTology.fromTbox(FOAF_JSONLD);

    // Expected drift: none — this minimal snippet uses only owl:Class,
    // owl:DatatypeProperty, owl:ObjectProperty, rdfs:domain, rdfs:range
    // which are all supported.
    assert.deepEqual(result.unsupported, [], 'No unsupported axioms expected for the minimal FOAF snippet');
  });

  void it('imports FOAF snippet: foaf:Person schema has expected property shapes', () => {
    const result = JsonTology.fromTbox(FOAF_JSONLD);

    const personSchema = result.schemas.find((schema) => {
      return schema.$id === 'http://xmlns.com/foaf/0.1/Person';
    }) as Record<string, unknown> | undefined;

    assert.ok(personSchema !== undefined, 'foaf:Person must be present in imported schemas');

    const rawProps: unknown = personSchema.properties;

    assert.ok(typeof rawProps === 'object' && rawProps !== null, 'foaf:Person must have a properties object');

    const props = rawProps as Record<string, Record<string, unknown>>;

    // foaf:givenName and foaf:familyName are xsd:string → type: 'string'
    assert.ok('givenName' in props, 'foaf:Person must have givenName property');
    assert.ok('familyName' in props, 'foaf:Person must have familyName property');

    // foaf:knows is an ObjectProperty with range foaf:Person → $ref: self
    const knowsProp = props['knows'];

    if (knowsProp === undefined) {
      throw new Error('props.knows is undefined');
    }

    const knowsRef = knowsProp.$ref;

    assert.equal(
      knowsRef,
      'http://xmlns.com/foaf/0.1/Person',
      'foaf:knows must be a $ref to foaf:Person (self-referential ObjectProperty)'
    );
  });

  void it('validates a foaf:Person instance against the imported schema', () => {
    // Use instance fromTbox so all schemas register into the same registry.
    const jt = JsonTology.create({
      'baseIri': 'http://xmlns.com/foaf/0.1/',
      'enableStrictGraph': false
    });
    const result = jt.fromTbox(FOAF_JSONLD);

    const personSchema = result.schemas.find((schema) => {
      return schema.$id === 'http://xmlns.com/foaf/0.1/Person';
    });

    assert.ok(personSchema !== undefined, 'foaf:Person schema must be imported');

    // Valid instance: givenName is a string. foaf:knows is an ObjectProperty
    // (not an array) in this minimal TBox — omit it from the instance.
    const validPerson = {
      'familyName': 'Smith',
      'givenName': 'Alice'
    };

    const errs = jt.validate(personSchema as Record<string, unknown> & { '$id': string }, validPerson);

    assert.ok(errs.ok, `foaf:Person instance should validate; errors: ${JSON.stringify(errs)}`);
  });
});

// ---------------------------------------------------------------------------
// DCAT import tests
// ---------------------------------------------------------------------------

void describe('real-world ontology import: DCAT-AP', () => {
  void it('imports DCAT snippet: schemas count > 0, every schema has $id', () => {
    const result = JsonTology.fromTbox(DCAT_JSONLD);

    assert.ok(result.schemas.length > 0, 'DCAT import must produce at least one schema');

    for (const schema of result.schemas) {
      assert.ok(typeof schema.$id === 'string', `Schema missing $id: ${JSON.stringify(schema)}`);
    }
  });

  void it('imports DCAT snippet: unsupported is empty', () => {
    const result = JsonTology.fromTbox(DCAT_JSONLD);

    assert.deepEqual(result.unsupported, [], 'No unsupported axioms expected for the minimal DCAT snippet');
  });

  void it('imports DCAT snippet: dcat:Dataset and foaf:Agent schemas are present', () => {
    const result = JsonTology.fromTbox(DCAT_JSONLD);

    const datasetSchema = result.schemas.find((schema) => {
      return schema.$id === 'http://www.w3.org/ns/dcat#Dataset';
    });
    const agentSchema = result.schemas.find((schema) => {
      return schema.$id === 'http://xmlns.com/foaf/0.1/Agent';
    });

    assert.ok(datasetSchema !== undefined, 'dcat:Dataset must be present in imported schemas');
    assert.ok(agentSchema !== undefined, 'foaf:Agent must be present in imported schemas (referenced range)');
  });

  void it('imports DCAT snippet: dcat:Dataset has expected property shapes', () => {
    const result = JsonTology.fromTbox(DCAT_JSONLD);

    const datasetSchema = result.schemas.find((schema) => {
      return schema.$id === 'http://www.w3.org/ns/dcat#Dataset';
    }) as Record<string, unknown> | undefined;

    assert.ok(datasetSchema !== undefined, 'dcat:Dataset must be present');

    const rawProps: unknown = datasetSchema.properties;

    assert.ok(typeof rawProps === 'object' && rawProps !== null, 'dcat:Dataset must have a properties object');

    const props = rawProps as Record<string, Record<string, unknown>>;

    // dct:title and dct:description are xsd:string → type: 'string'
    assert.ok('title' in props, 'dcat:Dataset must have title property');
    assert.ok('description' in props, 'dcat:Dataset must have description property');

    // dct:publisher is an ObjectProperty → $ref: foaf:Agent
    const publisherProp = props['publisher'];

    if (publisherProp === undefined) {
      throw new Error('props.publisher is undefined');
    }

    const publisherRef = publisherProp.$ref;

    assert.equal(publisherRef, 'http://xmlns.com/foaf/0.1/Agent', 'dct:publisher must be a $ref to foaf:Agent');
  });

  void it('validates a dcat:Dataset instance against the imported schema', () => {
    // Use instance fromTbox so all schemas (including foaf:Agent) register.
    const jt = JsonTology.create({
      'baseIri': 'http://www.w3.org/ns/dcat#',
      'enableStrictGraph': false
    });
    const result = jt.fromTbox(DCAT_JSONLD);

    const datasetSchema = result.schemas.find((schema) => {
      return schema.$id === 'http://www.w3.org/ns/dcat#Dataset';
    });

    assert.ok(datasetSchema !== undefined, 'dcat:Dataset schema must be imported');

    // Valid Dataset instance: title and description present
    const validDataset = {
      'description': 'An open dataset about public transport.',
      'title': 'Public Transport Schedules'
    };

    const errs = jt.validate(
      datasetSchema as Record<string, unknown> & { '$id': string },
      validDataset
    );

    assert.ok(errs.ok, `dcat:Dataset instance should validate; errors: ${JSON.stringify(errs)}`);
  });
});
