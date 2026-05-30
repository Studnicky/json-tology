/**
 * DCAT-AP subset JSON-LD data — imported directly by browser-safe examples.
 *
 * This is the same content as dcat-subset.jsonld but exported as a TypeScript
 * module so examples can import it without reading from disk.
 */

export const dcatSubset = {
  '@context': {
    'dcat': 'http://www.w3.org/ns/dcat#',
    'dcterms': 'http://purl.org/dc/terms/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    {
      '@id': 'http://purl.org/dc/terms/Resource',
      '@type': 'owl:Class',
      'rdfs:comment': 'Anything described by RDF (external Dublin Core class, kept as a stub).',
      'rdfs:label': 'Resource'
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#Dataset',
      '@type': 'owl:Class',
      'rdfs:comment': 'A collection of data, published or curated by a single agent.',
      'rdfs:label': 'Dataset',
      'rdfs:subClassOf': { '@id': 'http://purl.org/dc/terms/Resource' }
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#Distribution',
      '@type': 'owl:Class',
      'rdfs:comment': 'A specific representation of a dataset.',
      'rdfs:label': 'Distribution'
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#Catalog',
      '@type': 'owl:Class',
      'rdfs:comment': 'A curated collection of metadata about resources.',
      'rdfs:label': 'Catalog',
      'rdfs:subClassOf': { '@id': 'http://purl.org/dc/terms/Resource' }
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#title',
      '@type': 'owl:DatatypeProperty',
      'rdfs:comment': 'A name given to the resource.',
      'rdfs:domain': { '@id': 'http://purl.org/dc/terms/Resource' },
      'rdfs:label': 'title',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#description',
      '@type': 'owl:DatatypeProperty',
      'rdfs:comment': 'A free-text account of the resource.',
      'rdfs:domain': { '@id': 'http://purl.org/dc/terms/Resource' },
      'rdfs:label': 'description',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#distribution',
      '@type': 'owl:ObjectProperty',
      'rdfs:comment': 'An available distribution of the dataset.',
      'rdfs:domain': { '@id': 'http://www.w3.org/ns/dcat#Dataset' },
      'rdfs:label': 'distribution',
      'rdfs:range': { '@id': 'http://www.w3.org/ns/dcat#Distribution' }
    },
    {
      '@id': 'http://www.w3.org/ns/dcat#accessURL',
      '@type': 'owl:DatatypeProperty',
      'rdfs:comment': 'A URL of the resource that gives access to a distribution. Range is xsd:string in this subset (xsd:anyURI would produce a { format: uri } inline constraint that requires enableStrictGraph: false).',
      'rdfs:domain': { '@id': 'http://www.w3.org/ns/dcat#Distribution' },
      'rdfs:label': 'access URL',
      'rdfs:range': { '@id': 'xsd:string' }
    }
  ]
} as const;
