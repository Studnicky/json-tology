import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Curie } from '../../src/modules/rdf/curie.js';

const standardPrefixes: Record<string, string> = {
  'dc': 'http://purl.org/dc/elements/1.1/',
  'dct': 'http://purl.org/dc/terms/',
  'ex': 'https://example.com/',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'sh': 'http://www.w3.org/ns/shacl#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#'
};

void describe('Curie', () => {
  void it('expands CURIEs to full IRIs', () => {
    const curie = new Curie(standardPrefixes);
    const scenarios: Array<{ 'expected': string;
      'input': string;
      'name': string }> = [
      {
        'expected': 'http://www.w3.org/ns/shacl#property',
        'input': 'sh:property',
        'name': 'expands sh: prefix'
      },
      {
        'expected': 'http://www.w3.org/2002/07/owl#Class',
        'input': 'owl:Class',
        'name': 'expands owl: prefix'
      },
      {
        'expected': 'http://www.w3.org/2000/01/rdf-schema#label',
        'input': 'rdfs:label',
        'name': 'expands rdfs: prefix'
      },
      {
        'expected': 'http://www.w3.org/2001/XMLSchema#string',
        'input': 'xsd:string',
        'name': 'expands xsd: prefix'
      },
      {
        'expected': 'http://purl.org/dc/elements/1.1/title',
        'input': 'dc:title',
        'name': 'expands dc: prefix'
      },
      {
        'expected': 'http://purl.org/dc/terms/title',
        'input': 'dct:title',
        'name': 'expands dct: prefix (distinguishes substring prefixes)'
      },
      {
        'expected': 'https://example.com/path/to/resource',
        'input': 'ex:path/to/resource',
        'name': 'expands local part with slashes'
      },
      {
        'expected': 'https://example.com/name.first',
        'input': 'ex:name.first',
        'name': 'expands local part with dot'
      },
      {
        'expected': 'https://example.com/fragment#sub',
        'input': 'ex:fragment#sub',
        'name': 'expands local part with hash'
      },
      {
        'expected': 'https://example.com/',
        'input': 'ex:',
        'name': 'expands prefix with empty local part'
      }
    ];

    for (const {
      expected, input, name
    } of scenarios) {
      assert.equal(curie.expand(input), expected, name);
    }
  });

  void it('returns input unchanged when no expansion applies', () => {
    const curie = new Curie(standardPrefixes);
    const scenarios: Array<{ 'expected': string;
      'input': string;
      'name': string }> = [
      {
        'expected': 'foo:bar',
        'input': 'foo:bar',
        'name': 'unknown prefix foo:'
      },
      {
        'expected': 'unknown:value',
        'input': 'unknown:value',
        'name': 'unknown prefix unknown:'
      },
      {
        'expected': 'noColon',
        'input': 'noColon',
        'name': 'no colon in value'
      },
      {
        'expected': 'justAWord',
        'input': 'justAWord',
        'name': 'plain word without colon'
      },
      {
        'expected': 'http://www.w3.org/ns/shacl#property',
        'input': 'http://www.w3.org/ns/shacl#property',
        'name': 'full IRI with http:// not treated as prefix'
      },
      {
        'expected': '',
        'input': '',
        'name': 'empty string unchanged'
      }
    ];

    for (const {
      expected, input, name
    } of scenarios) {
      assert.equal(curie.expand(input), expected, name);
    }
  });

  void it('handles edge cases for expand (blank nodes, URNs, multiple colons)', () => {
    const scenarios: Array<{ 'expected': string;
      'input': string;
      'name': string;
      'prefixes': Record<string, string> }> = [
      {
        'expected': '_:b0',
        'input': '_:b0',
        'name': 'blank node _:b0 passes through',
        'prefixes': standardPrefixes
      },
      {
        'expected': '_:genid42',
        'input': '_:genid42',
        'name': 'blank node _:genid42 passes through',
        'prefixes': standardPrefixes
      },
      {
        'expected': 'urn:uuid',
        'input': 'urn:uuid:abc-123',
        'name': 'multiple colons splits on first only (urn prefix)',
        'prefixes': { 'urn': 'urn:' }
      },
      {
        'expected': 'urn:uuid:abc-123',
        'input': 'urn:uuid:abc-123',
        'name': 'multiple colons passes through with no matching prefix',
        'prefixes': {}
      }
    ];

    for (const {
      expected, input, name, prefixes
    } of scenarios) {
      const curie = new Curie(prefixes);

      assert.equal(curie.expand(input), expected, name);
    }
  });

  void it('compacts full IRIs to CURIEs', () => {
    const curie = new Curie(standardPrefixes);
    const scenarios: Array<{ 'expected': string;
      'input': string;
      'name': string }> = [
      {
        'expected': 'sh:property',
        'input': 'http://www.w3.org/ns/shacl#property',
        'name': 'compacts sh: namespace'
      },
      {
        'expected': 'owl:Class',
        'input': 'http://www.w3.org/2002/07/owl#Class',
        'name': 'compacts owl: namespace'
      },
      {
        'expected': 'rdfs:label',
        'input': 'http://www.w3.org/2000/01/rdf-schema#label',
        'name': 'compacts rdfs: namespace'
      },
      {
        'expected': 'ex:path/to/resource',
        'input': 'https://example.com/path/to/resource',
        'name': 'compacts IRI with slashes in local part'
      },
      {
        'expected': 'ex:name.first',
        'input': 'https://example.com/name.first',
        'name': 'compacts IRI with dot in local part'
      },
      {
        'expected': 'ex:',
        'input': 'https://example.com/',
        'name': 'compacts IRI equal to namespace (empty local part)'
      }
    ];

    for (const {
      expected, input, name
    } of scenarios) {
      assert.equal(curie.compact(input), expected, name);
    }
  });

  void it('returns input unchanged when no compact applies', () => {
    const curie = new Curie(standardPrefixes);
    const scenarios: Array<{ 'expected': string;
      'input': string;
      'name': string }> = [
      {
        'expected': 'https://unknown.org/thing',
        'input': 'https://unknown.org/thing',
        'name': 'unknown namespace'
      },
      {
        'expected': 'urn:isbn:12345',
        'input': 'urn:isbn:12345',
        'name': 'URN not matching any prefix'
      },
      {
        'expected': '',
        'input': '',
        'name': 'empty string unchanged'
      }
    ];

    for (const {
      expected, input, name
    } of scenarios) {
      assert.equal(curie.compact(input), expected, name);
    }
  });

  void it('prefers the longer namespace when namespaces overlap', () => {
    const curie = new Curie({
      'base': 'https://example.com/',
      'specific': 'https://example.com/vocab/'
    });

    assert.equal(curie.compact('https://example.com/vocab/Term'), 'specific:Term', 'longer namespace wins');
  });

  void it('roundtrips compact(expand(curie)) for known prefixes', () => {
    const curie = new Curie(standardPrefixes);
    const scenarios: Array<{ 'name': string;
      'value': string }> = [
      {
        'name': 'sh:property roundtrip',
        'value': 'sh:property'
      },
      {
        'name': 'owl:Class roundtrip',
        'value': 'owl:Class'
      },
      {
        'name': 'rdfs:label roundtrip',
        'value': 'rdfs:label'
      },
      {
        'name': 'xsd:integer roundtrip',
        'value': 'xsd:integer'
      },
      {
        'name': 'ex:Thing roundtrip',
        'value': 'ex:Thing'
      }
    ];

    for (const {
      name, value
    } of scenarios) {
      assert.equal(curie.compact(curie.expand(value)), value, name);
    }
  });

  void it('roundtrips expand(compact(iri)) for known namespaces', () => {
    const curie = new Curie(standardPrefixes);
    const scenarios: Array<{ 'name': string;
      'value': string }> = [
      {
        'name': 'shacl IRI roundtrip',
        'value': 'http://www.w3.org/ns/shacl#property'
      },
      {
        'name': 'owl IRI roundtrip',
        'value': 'http://www.w3.org/2002/07/owl#Class'
      },
      {
        'name': 'rdfs IRI roundtrip',
        'value': 'http://www.w3.org/2000/01/rdf-schema#label'
      },
      {
        'name': 'example IRI roundtrip',
        'value': 'https://example.com/Thing'
      }
    ];

    for (const {
      name, value
    } of scenarios) {
      assert.equal(curie.expand(curie.compact(value)), value, name);
    }
  });
});
