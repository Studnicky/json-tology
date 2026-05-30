/**
 * schema.org subset JSON-LD data — imported directly by browser-safe examples.
 *
 * This is the same content as schema-org-subset.jsonld but exported as a
 * TypeScript module so examples can import it without reading from disk.
 */

const isbnPatternRestriction = { 'xsd:pattern': '^\\d{13}$' };

export const schemaOrgSubset = {
  '@context': {
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'schema': 'https://schema.org/',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    {
      '@id': 'https://schema.org/Thing',
      '@type': 'owl:Class',
      'rdfs:comment': 'The most generic type.',
      'rdfs:label': 'Thing'
    },
    {
      '@id': 'https://schema.org/Person',
      '@type': 'owl:Class',
      'rdfs:comment': 'A person (alive, dead, undead, or fictional).',
      'rdfs:label': 'Person',
      'rdfs:subClassOf': { '@id': 'https://schema.org/Thing' }
    },
    {
      '@id': 'https://schema.org/Organization',
      '@type': 'owl:Class',
      'rdfs:comment': 'An organization such as a school, NGO, corporation, club, etc.',
      'rdfs:label': 'Organization',
      'rdfs:subClassOf': { '@id': 'https://schema.org/Thing' }
    },
    {
      '@id': 'https://schema.org/Book',
      '@type': 'owl:Class',
      'rdfs:comment': 'A book.',
      'rdfs:label': 'Book',
      'rdfs:subClassOf': { '@id': 'https://schema.org/Thing' }
    },
    {
      '@id': 'https://schema.org/IsbnType',
      '@type': 'rdfs:Datatype',
      'owl:onDatatype': { '@id': 'xsd:string' },
      'owl:withRestrictions': { '@list': [isbnPatternRestriction] },
      'rdfs:comment': 'A 13-digit ISBN string. XSD-facet restriction: pattern ^\\d{13}$.',
      'rdfs:label': 'IsbnType'
    },
    {
      '@id': 'https://schema.org/name',
      '@type': 'owl:DatatypeProperty',
      'rdfs:comment': 'The name of the item.',
      'rdfs:domain': { '@id': 'https://schema.org/Thing' },
      'rdfs:label': 'name',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'https://schema.org/Book#isbn',
      '@type': 'owl:ObjectProperty',
      'rdfs:comment': 'The ISBN of the book.',
      'rdfs:domain': { '@id': 'https://schema.org/Book' },
      'rdfs:label': 'isbn',
      'rdfs:range': { '@id': 'https://schema.org/IsbnType' }
    },
    {
      '@id': 'https://schema.org/author',
      '@type': 'owl:ObjectProperty',
      'rdfs:comment': 'The author of this content.',
      'rdfs:domain': { '@id': 'https://schema.org/Book' },
      'rdfs:label': 'author',
      'rdfs:range': { '@id': 'https://schema.org/Person' }
    },
    {
      '@id': 'https://schema.org/publisher',
      '@type': 'owl:ObjectProperty',
      'rdfs:comment': 'The publisher of the creative work.',
      'rdfs:domain': { '@id': 'https://schema.org/Book' },
      'rdfs:label': 'publisher',
      'rdfs:range': { '@id': 'https://schema.org/Organization' }
    }
  ]
} as const;
