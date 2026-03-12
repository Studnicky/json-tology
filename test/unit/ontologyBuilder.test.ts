/**
 * Ontology Builder Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { OntologyBuilder } from '../../src/modules/ontology/OntologyBuilder.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/GraphOntologySerializer.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

describe('OntologyBuilder', () => {
  it('should create an ontology builder with configuration', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      },
      'graphSources': [],
    });

    assert.ok(builder);
  });

  it('should return prefix context', () => {
    const prefixes = {
      'ex': 'https://example.io/ns#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    };

    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': prefixes,
      'graphSources': [],
    });

    const context = builder.context();

    assert.deepStrictEqual(context, prefixes);
  });

  it('should build graph from graphSources', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
      },
      'graphSources': [
        [{
          '@id': 'ex:Thing',
          '@type': 'owl:Class',
          'rdfs:label': 'Thing',
        }],
        () => [{
          '@id': 'ex:SubThing',
          '@type': 'owl:Class',
          'rdfs:subClassOf': 'ex:Thing',
        }],
      ],
    });

    const graph = builder.raw();

    assert.strictEqual(graph.length, 2);
    assert.strictEqual(graph[0]['@id'], 'ex:Thing');
    assert.strictEqual(graph[1]['@id'], 'ex:SubThing');
  });

  it('should generate N3 with prefix declarations', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      },
      'graphSources': [],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('@prefix ex: <https://example.io/ns#>.'));
    assert.ok(n3.includes('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.'));
  });

  it('should handle @vocab in prefix declarations', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        '@vocab': 'https://example.io/default#',
        'ex': 'https://example.io/ns#',
      },
      'graphSources': [],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('@prefix : <https://example.io/default#>.'));
    assert.ok(n3.includes('@prefix ex: <https://example.io/ns#>.'));
  });

  it('should generate JSON-LD object', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
      },
      'graphSources': [[{
        '@id': 'ex:Thing',
        '@type': 'owl:Class',
      }]],
    });

    const jsonLd = builder.jsonLdObject();

    assert.ok(jsonLd['@context']);
    assert.ok(jsonLd['@graph']);
    assert.strictEqual(jsonLd['@graph'].length, 1);
    assert.ok(jsonLd['@id'].includes('ontology'));
  });

  it('should generate JSON-LD as string', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
      },
      'graphSources': [],
    });

    const jsonLdString = builder.jsonLd();

    assert.ok(typeof jsonLdString === 'string');
    assert.ok(jsonLdString.includes('@context'));
    const parsed = JSON.parse(jsonLdString);
    assert.ok(parsed['@context']);
  });

  it('should handle empty graph sources', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
      },
      'graphSources': [],
    });

    const graph = builder.raw();

    assert.strictEqual(graph.length, 0);
  });

  // ---------------------------------------------------------------------------
  // N3 triple serialization
  // ---------------------------------------------------------------------------

  it('should serialize graph nodes as full N3 triples', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      },
      'graphSources': [[{
        '@id': 'ex:Thing',
        '@type': 'owl:Class',
        'rdfs:label': 'Thing',
        'rdfs:subClassOf': 'ex:Parent',
      }]],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('ex:Thing'), 'subject must appear');
    assert.ok(n3.includes('a owl:Class'), '@type must be rendered as "a"');
    assert.ok(n3.includes('rdfs:label "Thing"'), 'plain strings must be quoted literals');
    assert.ok(n3.includes('rdfs:subClassOf ex:Parent'), 'CURIEs must be unquoted resources');
  });

  it('should render full IRIs in angle brackets', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': { 'ex': 'https://example.io/ns#' },
      'graphSources': [[{
        '@id': 'ex:Foo',
        '@type': 'https://example.io/ns#Bar',
      }]],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('a <https://example.io/ns#Bar>'), 'full IRI must be wrapped in <>');
  });

  it('should render array values as comma-separated objects', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'owl': 'http://www.w3.org/2002/07/owl#',
      },
      'graphSources': [[{
        '@id': 'ex:Multi',
        '@type': ['owl:Class', 'owl:Thing'],
      }]],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('a owl:Class, owl:Thing'), 'array values must be comma-separated');
  });

  it('should chain multiple predicates with semicolons and end with a period', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'owl': 'http://www.w3.org/2002/07/owl#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      },
      'graphSources': [[{
        '@id': 'ex:Widget',
        '@type': 'owl:Class',
        'rdfs:label': 'Widget',
      }]],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes(';'), 'predicates must be chained with ;');
    assert.ok(n3.trimEnd().endsWith('.'), 'subject block must end with .');
  });

  it('should serialize multiple nodes', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'owl': 'http://www.w3.org/2002/07/owl#',
      },
      'graphSources': [[
        { '@id': 'ex:A', '@type': 'owl:Class' },
        { '@id': 'ex:B', '@type': 'owl:Class', 'ex:related': 'ex:A' },
      ]],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('ex:A'), 'first node subject must appear');
    assert.ok(n3.includes('ex:B'), 'second node subject must appear');
    assert.ok(n3.includes('ex:related ex:A'), 'cross-reference must be preserved');
  });
});

describe('GraphOntologySerializer', () => {
  function serializeSchema(schema: Record<string, unknown>): unknown[] {
    const graph = new SchemaGraph(schema);
    const serializer = new GraphOntologySerializer();

    return serializer.serialize([graph]);
  }

  it('should serialize if/then/else as jt:conditional', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/Conditional',
      'type': 'object',
      'if': { 'properties': { 'kind': { 'const': 'a' } } },
      'then': { 'properties': { 'value': { 'type': 'string' } } },
      'else': { 'properties': { 'other': { 'type': 'number' } } }
    });

    const classNode = nodes.find((n: any) => n['@id'] === 'https://example.com/Conditional') as any;

    assert.ok(classNode, 'class node must exist');
    assert.ok(classNode['jt:conditional'], 'jt:conditional must be present');
    assert.ok(classNode['jt:conditional']['if'], 'conditional must have if');
    assert.ok(classNode['jt:conditional']['then'], 'conditional must have then');
    assert.ok(classNode['jt:conditional']['else'], 'conditional must have else');
  });

  it('should serialize contains as jt:contains', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/Arr',
      'type': 'array',
      'contains': { 'type': 'string' }
    });

    const classNode = nodes.find((n: any) => n['@id'] === 'https://example.com/Arr') as any;

    assert.ok(classNode, 'class node must exist');
    assert.deepStrictEqual(classNode['jt:contains'], { '@id': 'xsd:string' });
  });

  it('should serialize prefixItems as jt:tupleItem entries', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/Tuple',
      'type': 'array',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' },
        { 'type': 'boolean' }
      ]
    });

    const classNode = nodes.find((n: any) => n['@id'] === 'https://example.com/Tuple') as any;

    assert.ok(classNode, 'class node must exist');
    assert.ok(Array.isArray(classNode['jt:tupleItem']), 'jt:tupleItem must be an array');
    assert.strictEqual(classNode['jt:tupleItem'].length, 3);
    assert.strictEqual(classNode['jt:tupleItem'][0]['jt:position'], 0);
    assert.deepStrictEqual(classNode['jt:tupleItem'][0]['jt:type'], { '@id': 'xsd:string' });
    assert.strictEqual(classNode['jt:tupleItem'][1]['jt:position'], 1);
    assert.deepStrictEqual(classNode['jt:tupleItem'][1]['jt:type'], { '@id': 'xsd:decimal' });
    assert.strictEqual(classNode['jt:tupleItem'][2]['jt:position'], 2);
    assert.deepStrictEqual(classNode['jt:tupleItem'][2]['jt:type'], { '@id': 'xsd:boolean' });
  });

  it('should serialize patternProperties as jt:patternProperty', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/PatternObj',
      'type': 'object',
      'patternProperties': {
        '^S_': { 'type': 'string' },
        '^I_': { 'type': 'integer' }
      }
    });

    const classNode = nodes.find((n: any) => n['@id'] === 'https://example.com/PatternObj') as any;

    assert.ok(classNode, 'class node must exist');
    assert.ok(Array.isArray(classNode['jt:patternProperty']), 'jt:patternProperty must be an array');
    assert.strictEqual(classNode['jt:patternProperty'].length, 2);
    assert.strictEqual(classNode['jt:patternProperty'][0]['jt:pattern'], '^S_');
    assert.deepStrictEqual(classNode['jt:patternProperty'][0]['jt:type'], { '@id': 'xsd:string' });
    assert.strictEqual(classNode['jt:patternProperty'][1]['jt:pattern'], '^I_');
    assert.deepStrictEqual(classNode['jt:patternProperty'][1]['jt:type'], { '@id': 'xsd:integer' });
  });
});
