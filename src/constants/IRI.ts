export const OWL = {
  'allValuesFrom': 'owl:allValuesFrom',
  'Class': 'owl:Class',
  'complementOf': 'owl:complementOf',
  'DatatypeProperty': 'owl:DatatypeProperty',
  'deprecated': 'owl:deprecated',
  'disjointWith': 'owl:disjointWith',
  'equivalentClass': 'owl:equivalentClass',
  'hasValue': 'owl:hasValue',
  'intersectionOf': 'owl:intersectionOf',
  'inverseOf': 'owl:inverseOf',
  'maxQualifiedCardinality': 'owl:maxQualifiedCardinality',
  'minCardinality': 'owl:minCardinality',
  'minQualifiedCardinality': 'owl:minQualifiedCardinality',
  'ObjectProperty': 'owl:ObjectProperty',
  'onDataRange': 'owl:onDataRange',
  'oneOf': 'owl:oneOf',
  'onProperty': 'owl:onProperty',
  'Restriction': 'owl:Restriction',
  'someValuesFrom': 'owl:someValuesFrom',
  'SymmetricProperty': 'owl:SymmetricProperty',
  'TransitiveProperty': 'owl:TransitiveProperty',
  'unionOf': 'owl:unionOf'
} as const;

export const RDF = {
  'JSON': 'rdf:JSON',
  'List': 'rdf:List',
  'type': 'rdf:type'
} as const;

export const RDFS = {
  'comment': 'rdfs:comment',
  'domain': 'rdfs:domain',
  'label': 'rdfs:label',
  'member': 'rdfs:member',
  'range': 'rdfs:range',
  'subClassOf': 'rdfs:subClassOf'
} as const;

export const SH = {
  'and': 'sh:and',
  'class': 'sh:class',
  'closed': 'sh:closed',
  'datatype': 'sh:datatype',
  'deactivated': 'sh:deactivated',
  'description': 'sh:description',
  'hasValue': 'sh:hasValue',
  'in': 'sh:in',
  'maxCount': 'sh:maxCount',
  'maxExclusive': 'sh:maxExclusive',
  'maxInclusive': 'sh:maxInclusive',
  'maxLength': 'sh:maxLength',
  'minCount': 'sh:minCount',
  'minExclusive': 'sh:minExclusive',
  'minInclusive': 'sh:minInclusive',
  'minLength': 'sh:minLength',
  'name': 'sh:name',
  'node': 'sh:node',
  'NodeShape': 'sh:NodeShape',
  'not': 'sh:not',
  'or': 'sh:or',
  'path': 'sh:path',
  'pattern': 'sh:pattern',
  'property': 'sh:property',
  'PROPERTY_IRI': 'http://www.w3.org/ns/shacl#property',
  'PropertyShape': 'sh:PropertyShape',
  'qualifiedMaxCount': 'sh:qualifiedMaxCount',
  'qualifiedMinCount': 'sh:qualifiedMinCount',
  'qualifiedValueShape': 'sh:qualifiedValueShape'
} as const;

export const XSD = {
  'boolean': 'xsd:boolean',
  'decimal': 'xsd:decimal',
  'double': 'xsd:double',
  'integer': 'xsd:integer',
  'nonNegativeInteger': 'xsd:nonNegativeInteger',
  'string': 'xsd:string'
} as const;

export const DASH = {
  'readOnly': 'dash:readOnly',
  'writeOnly': 'dash:writeOnly'
} as const;

export const DCT = { 'format': 'dct:format' } as const;

export const JT = {
  'dependentRequired': 'jt:dependentRequired',
  'else': 'jt:else',
  'if': 'jt:if',
  'multipleOf': 'jt:multipleOf',
  'thenBranch': 'jt:then'
} as const;
