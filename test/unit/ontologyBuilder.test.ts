/**
 * Ontology Builder Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { OntologyBuilder } from '../../src/ontology/OntologyBuilder.js';

describe('OntologyBuilder', () => {
  it('should create an ontology builder with configuration', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      },
      'graphBuilders': [],
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
      'graphBuilders': [],
    });

    const context = builder.context();

    assert.deepStrictEqual(context, prefixes);
  });

  it('should build graph by invoking graphBuilders', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
      },
      'graphBuilders': [
        (graph) => {
          graph.push({
            '@id': 'ex:Thing',
            '@type': 'owl:Class',
            'rdfs:label': 'Thing',
          });
        },
        (graph) => {
          graph.push({
            '@id': 'ex:SubThing',
            '@type': 'owl:Class',
            'rdfs:subClassOf': 'ex:Thing',
          });
        },
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
      'graphBuilders': [],
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
      'graphBuilders': [],
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
      'graphBuilders': [
        (graph) => {
          graph.push({
            '@id': 'ex:Thing',
            '@type': 'owl:Class',
          });
        },
      ],
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
      'graphBuilders': [],
    });

    const jsonLdString = builder.jsonLd();

    assert.ok(typeof jsonLdString === 'string');
    assert.ok(jsonLdString.includes('@context'));
    const parsed = JSON.parse(jsonLdString);
    assert.ok(parsed['@context']);
  });

  it('should handle empty graph builders', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'prefixes': {
        'ex': 'https://example.io/ns#',
      },
      'graphBuilders': [],
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
      'graphBuilders': [
        (graph) => {
          graph.push({
            '@id': 'ex:Thing',
            '@type': 'owl:Class',
            'rdfs:label': 'Thing',
            'rdfs:subClassOf': 'ex:Parent',
          });
        },
      ],
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
      'graphBuilders': [
        (graph) => {
          graph.push({
            '@id': 'ex:Foo',
            '@type': 'https://example.io/ns#Bar',
          });
        },
      ],
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
      'graphBuilders': [
        (graph) => {
          graph.push({
            '@id': 'ex:Multi',
            '@type': ['owl:Class', 'owl:Thing'],
          });
        },
      ],
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
      'graphBuilders': [
        (graph) => {
          graph.push({
            '@id': 'ex:Widget',
            '@type': 'owl:Class',
            'rdfs:label': 'Widget',
          });
        },
      ],
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
      'graphBuilders': [
        (graph) => {
          graph.push(
            { '@id': 'ex:A', '@type': 'owl:Class' },
            { '@id': 'ex:B', '@type': 'owl:Class', 'ex:related': 'ex:A' },
          );
        },
      ],
    });

    const n3 = builder.n3();

    assert.ok(n3.includes('ex:A'), 'first node subject must appear');
    assert.ok(n3.includes('ex:B'), 'second node subject must appear');
    assert.ok(n3.includes('ex:related ex:A'), 'cross-reference must be preserved');
  });
});
