/**
 * FOAF subset JSON-LD data — imported directly by browser-safe examples.
 *
 * This is the same content as foaf-subset.jsonld but exported as a TypeScript
 * module so examples can import it without reading from disk.
 */

export const foafSubset = {
  '@context': {
    'foaf': 'http://xmlns.com/foaf/0.1/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  },
  '@graph': [
    {
      '@id': 'http://xmlns.com/foaf/0.1/Agent',
      '@type': 'owl:Class',
      'rdfs:comment': 'An agent (e.g. a person, group, software or physical artifact).',
      'rdfs:label': 'Agent'
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/Person',
      '@type': 'owl:Class',
      'owl:disjointWith': { '@id': 'http://xmlns.com/foaf/0.1/Group' },
      'rdfs:comment': 'A person.',
      'rdfs:label': 'Person',
      'rdfs:subClassOf': { '@id': 'http://xmlns.com/foaf/0.1/Agent' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/Group',
      '@type': 'owl:Class',
      'owl:disjointWith': { '@id': 'http://xmlns.com/foaf/0.1/Person' },
      'rdfs:comment': 'A class of Agents.',
      'rdfs:label': 'Group',
      'rdfs:subClassOf': { '@id': 'http://xmlns.com/foaf/0.1/Agent' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/name',
      '@type': 'owl:DatatypeProperty',
      'rdfs:comment': 'A name for some thing.',
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Agent' },
      'rdfs:label': 'name',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/mbox',
      '@type': 'owl:DatatypeProperty',
      'rdfs:comment': 'A personal mailbox, ie. an Internet mailbox associated with exactly one owner.',
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Agent' },
      'rdfs:label': 'personal mailbox',
      'rdfs:range': { '@id': 'xsd:string' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/knows',
      '@type': 'owl:ObjectProperty',
      'rdfs:comment': 'A person known by this person (indicating some level of reciprocated interaction between the parties).',
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Person' },
      'rdfs:label': 'knows',
      'rdfs:range': { '@id': 'http://xmlns.com/foaf/0.1/Person' }
    },
    {
      '@id': 'http://xmlns.com/foaf/0.1/member',
      '@type': 'owl:ObjectProperty',
      'rdfs:comment': 'Indicates a member of a Group.',
      'rdfs:domain': { '@id': 'http://xmlns.com/foaf/0.1/Group' },
      'rdfs:label': 'member',
      'rdfs:range': { '@id': 'http://xmlns.com/foaf/0.1/Agent' }
    }
  ]
} as const;
