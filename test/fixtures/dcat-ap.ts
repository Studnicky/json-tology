/**
 * DCAT-AP 3.0.0 reference schemas in JSON Schema notation.
 * Used for round-trip testing against official SHACL and OWL representations.
 */

export const AgentSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/Agent',
  'properties': { 'foaf:name': { 'type': 'string' } },
  'required': ['foaf:name'],
  'title': 'Agent',
  'type': 'object'
} as const;

export const ConceptSchema = {
  '$id': 'http://www.w3.org/2004/02/skos/core#Concept',
  'properties': { 'skos:prefLabel': { 'type': 'string' } },
  'required': ['skos:prefLabel'],
  'title': 'Concept',
  'type': 'object'
} as const;

export const PeriodOfTimeSchema = {
  '$id': 'http://purl.org/dc/terms/PeriodOfTime',
  'properties': {
    'dcat:endDate': { 'type': 'string' },
    'dcat:startDate': { 'type': 'string' }
  },
  'title': 'PeriodOfTime',
  'type': 'object'
} as const;

export const LocationSchema = {
  '$id': 'http://purl.org/dc/terms/Location',
  'properties': {
    'dct:title': { 'type': 'string' },
    'rdfs:label': { 'type': 'string' }
  },
  'title': 'Location',
  'type': 'object'
} as const;

export const DistributionSchema = {
  '$id': 'http://www.w3.org/ns/dcat#Distribution',
  'properties': {
    'dcat:accessURL': { 'type': 'string' },
    'dcat:byteSize': { 'type': 'number' },
    'dcat:downloadURL': { 'type': 'string' },
    'dcat:mediaType': { 'type': 'string' },
    'dct:format': { 'type': 'string' },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' }
  },
  'required': ['dcat:accessURL'],
  'title': 'Distribution',
  'type': 'object'
} as const;

export const DataServiceSchema = {
  '$id': 'http://www.w3.org/ns/dcat#DataService',
  'properties': {
    'dcat:endpointDescription': { 'type': 'string' },
    'dcat:endpointURL': { 'type': 'string' },
    'dcat:landingPage': { 'type': 'string' },
    'dcat:theme': {
      'items': { '$ref': 'http://www.w3.org/2004/02/skos/core#Concept' },
      'type': 'array'
    },
    'dct:conformsTo': { 'type': 'string' },
    'dct:description': { 'type': 'string' },
    'dct:license': { '$ref': 'http://purl.org/dc/terms/Location' },
    'dct:title': { 'type': 'string' }
  },
  'required': [
    'dct:title',
    'dcat:endpointURL'
  ],
  'title': 'DataService',
  'type': 'object'
} as const;

export const DatasetSchema = {
  '$id': 'http://www.w3.org/ns/dcat#Dataset',
  'properties': {
    'dcat:distribution': {
      'items': { '$ref': 'http://www.w3.org/ns/dcat#Distribution' },
      'type': 'array'
    },
    'dcat:keyword': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'dcat:landingPage': { 'type': 'string' },
    'dcat:spatial': {
      'items': { '$ref': 'http://purl.org/dc/terms/Location' },
      'type': 'array'
    },
    'dcat:spatialResolutionInMeters': { 'type': 'number' },
    'dcat:temporal': {
      'items': { '$ref': 'http://purl.org/dc/terms/PeriodOfTime' },
      'type': 'array'
    },
    'dcat:theme': {
      'items': { '$ref': 'http://www.w3.org/2004/02/skos/core#Concept' },
      'type': 'array'
    },
    'dcat:version': { 'type': 'string' },
    'dct:description': { 'type': 'string' },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' },
    'dct:publisher': { '$ref': 'http://xmlns.com/foaf/0.1/Agent' },
    'dct:title': { 'type': 'string' }
  },
  'required': [
    'dct:title',
    'dct:description'
  ],
  'title': 'Dataset',
  'type': 'object'
} as const;

export const CatalogSchema = {
  '$id': 'http://www.w3.org/ns/dcat#Catalog',
  'properties': {
    'dcat:catalog': {
      'items': { '$ref': 'http://www.w3.org/ns/dcat#Catalog' },
      'type': 'array'
    },
    'dcat:dataset': {
      'items': { '$ref': 'http://www.w3.org/ns/dcat#Dataset' },
      'type': 'array'
    },
    'dcat:homepage': { 'type': 'string' },
    'dcat:language': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'dcat:service': {
      'items': { '$ref': 'http://www.w3.org/ns/dcat#DataService' },
      'type': 'array'
    },
    'dcat:themeTaxonomy': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'dct:description': { 'type': 'string' },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' },
    'dct:publisher': { '$ref': 'http://xmlns.com/foaf/0.1/Agent' },
    'dct:title': { 'type': 'string' }
  },
  'required': [
    'dct:title',
    'dct:description',
    'dct:publisher'
  ],
  'title': 'Catalog',
  'type': 'object'
} as const;

export const CatalogRecordSchema = {
  '$id': 'http://www.w3.org/ns/dcat#CatalogRecord',
  'properties': {
    'dcat:status': { 'type': 'string' },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' },
    'foaf:mailbox': { 'type': 'string' },
    'foaf:primaryTopic': { 'type': 'string' }
  },
  'required': [
    'dct:modified',
    'foaf:primaryTopic'
  ],
  'title': 'CatalogRecord',
  'type': 'object'
} as const;

export const ResourceSchema = {
  '$id': 'http://www.w3.org/ns/dcat#Resource',
  'properties': {
    'dct:accessRights': { 'type': 'string' },
    'dct:accrualMethod': { 'type': 'string' },
    'dct:accrualPeriodicity': { 'type': 'string' },
    'dct:conformsTo': { 'type': 'string' },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' },
    'rdfs:comment': { 'type': 'string' },
    'rdfs:label': { 'type': 'string' }
  },
  'title': 'Resource',
  'type': 'object'
} as const;

export const DatasetSeriesSchema = {
  '$id': 'http://www.w3.org/ns/dcat#DatasetSeries',
  'properties': {
    'dcat:first': { '$ref': 'http://www.w3.org/ns/dcat#Dataset' },
    'dcat:last': { '$ref': 'http://www.w3.org/ns/dcat#Dataset' },
    'dct:description': { 'type': 'string' },
    'dct:hasPart': {
      'items': { '$ref': 'http://www.w3.org/ns/dcat#Dataset' },
      'type': 'array'
    },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' },
    'dct:title': { 'type': 'string' }
  },
  'required': ['dct:title'],
  'title': 'DatasetSeries',
  'type': 'object'
} as const;

export const RelationshipSchema = {
  '$id': 'http://www.w3.org/ns/dcat#Relationship',
  'properties': {
    'dcat:hadRole': { 'type': 'string' },
    'dct:relation': { 'type': 'string' }
  },
  'title': 'Relationship',
  'type': 'object'
} as const;

export const DocumentSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/Document',
  'properties': {
    'foaf:primaryTopic': { 'type': 'string' },
    'rdfs:label': { 'type': 'string' }
  },
  'title': 'Document',
  'type': 'object'
} as const;

export const IdentifierSchema = {
  '$id': 'http://www.w3.org/ns/adms#Identifier',
  'properties': {
    'adms:notation': { 'type': 'string' },
    'dct:issued': { 'type': 'string' },
    'dct:modified': { 'type': 'string' }
  },
  'required': ['adms:notation'],
  'title': 'Identifier',
  'type': 'object'
} as const;

export const ChecksumSchema = {
  '$id': 'http://spdx.org/rdf/terms#Checksum',
  'properties': {
    'spdx:algorithm': { 'type': 'string' },
    'spdx:checksumValue': { 'type': 'string' }
  },
  'required': [
    'spdx:algorithm',
    'spdx:checksumValue'
  ],
  'title': 'Checksum',
  'type': 'object'
} as const;

export const LicenseDocumentSchema = {
  '$id': 'http://purl.org/dc/terms/LicenseDocument',
  'properties': {
    'dct:issued': { 'type': 'string' },
    'dct:title': { 'type': 'string' },
    'rdfs:label': { 'type': 'string' }
  },
  'title': 'LicenseDocument',
  'type': 'object'
} as const;

export const MediaTypeSchema = {
  '$id': 'http://purl.org/dc/terms/MediaType',
  'properties': { 'rdfs:label': { 'type': 'string' } },
  'title': 'MediaType',
  'type': 'object'
} as const;

export const StandardSchema = {
  '$id': 'http://purl.org/dc/terms/Standard',
  'properties': {
    'dct:issued': { 'type': 'string' },
    'dct:title': { 'type': 'string' },
    'rdfs:label': { 'type': 'string' }
  },
  'title': 'Standard',
  'type': 'object'
} as const;

export const RightsStatementSchema = {
  '$id': 'http://purl.org/dc/terms/RightsStatement',
  'properties': { 'rdfs:label': { 'type': 'string' } },
  'title': 'RightsStatement',
  'type': 'object'
} as const;

export const ConceptSchemeSchema = {
  '$id': 'http://www.w3.org/2004/02/skos/core#ConceptScheme',
  'properties': {
    'dct:title': { 'type': 'string' },
    'skos:hasTopConcept': {
      'items': { '$ref': 'http://www.w3.org/2004/02/skos/core#Concept' },
      'type': 'array'
    }
  },
  'title': 'ConceptScheme',
  'type': 'object'
} as const;

export const AllSchemas = [
  AgentSchema,
  ConceptSchema,
  PeriodOfTimeSchema,
  LocationSchema,
  DistributionSchema,
  DataServiceSchema,
  DatasetSchema,
  CatalogSchema,
  CatalogRecordSchema,
  ResourceSchema,
  DatasetSeriesSchema,
  RelationshipSchema,
  DocumentSchema,
  IdentifierSchema,
  ChecksumSchema,
  LicenseDocumentSchema,
  MediaTypeSchema,
  StandardSchema,
  RightsStatementSchema,
  ConceptSchemeSchema
];
