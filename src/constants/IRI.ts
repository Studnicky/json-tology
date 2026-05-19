export const OWL = {
  'allValuesFrom': 'owl:allValuesFrom',
  'AsymmetricProperty': 'owl:AsymmetricProperty',
  'cardinality': 'owl:cardinality',
  'Class': 'owl:Class',
  'complementOf': 'owl:complementOf',
  'DatatypeProperty': 'owl:DatatypeProperty',
  'deprecated': 'owl:deprecated',
  'disjointWith': 'owl:disjointWith',
  'equivalentClass': 'owl:equivalentClass',
  'FunctionalProperty': 'owl:FunctionalProperty',
  'hasValue': 'owl:hasValue',
  'intersectionOf': 'owl:intersectionOf',
  'InverseFunctionalProperty': 'owl:InverseFunctionalProperty',
  'inverseOf': 'owl:inverseOf',
  'IrreflexiveProperty': 'owl:IrreflexiveProperty',
  'maxCardinality': 'owl:maxCardinality',
  'maxQualifiedCardinality': 'owl:maxQualifiedCardinality',
  'minCardinality': 'owl:minCardinality',
  'minQualifiedCardinality': 'owl:minQualifiedCardinality',
  'ObjectProperty': 'owl:ObjectProperty',
  'onDataRange': 'owl:onDataRange',
  'onDatatype': 'owl:onDatatype',
  'oneOf': 'owl:oneOf',
  'onProperty': 'owl:onProperty',
  'ReflexiveProperty': 'owl:ReflexiveProperty',
  'Restriction': 'owl:Restriction',
  'sameAs': 'owl:sameAs',
  'someValuesFrom': 'owl:someValuesFrom',
  'SymmetricProperty': 'owl:SymmetricProperty',
  'TransitiveProperty': 'owl:TransitiveProperty',
  'unionOf': 'owl:unionOf',
  'withRestrictions': 'owl:withRestrictions'
} as const;

export const RDF = {
  'JSON': 'rdf:JSON',
  'List': 'rdf:List',
  'type': 'rdf:type'
} as const;

export const RDFS = {
  'comment': 'rdfs:comment',
  'Datatype': 'rdfs:Datatype',
  'domain': 'rdfs:domain',
  'label': 'rdfs:label',
  'member': 'rdfs:member',
  'range': 'rdfs:range',
  'subClassOf': 'rdfs:subClassOf',
  'subPropertyOf': 'rdfs:subPropertyOf'
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
  'format': 'jt:format',
  'if': 'jt:if',
  'multipleOf': 'jt:multipleOf',
  'thenBranch': 'jt:then'
} as const;
