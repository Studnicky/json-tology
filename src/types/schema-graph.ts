export type RelationPredicateType
  = | 'dash:readOnly'
  | 'dash:writeOnly'
  | 'dct:format'
  | 'jt:dependentRequired'
  | 'jt:multipleOf'
  | 'owl:complementOf'
  | 'owl:deprecated'
  | 'owl:disjointWith'
  | 'owl:equivalentClass'
  | 'owl:hasValue'
  | 'owl:inverseOf'
  | 'owl:maxQualifiedCardinality'
  | 'owl:minQualifiedCardinality'
  | 'owl:oneOf'
  | 'owl:Restriction'
  | 'owl:someValuesFrom'
  | 'owl:SymmetricProperty'
  | 'owl:TransitiveProperty'
  | 'owl:unionOf'
  | 'rdf:type'
  | 'rdfs:comment'
  | 'rdfs:domain'
  | 'rdfs:label'
  | 'rdfs:member'
  | 'rdfs:range'
  | 'rdfs:subClassOf'
  | 'sh:closed'
  | 'sh:datatype'
  | 'sh:maxCount'
  | 'sh:maxExclusive'
  | 'sh:maxInclusive'
  | 'sh:maxLength'
  | 'sh:minCount'
  | 'sh:minExclusive'
  | 'sh:minInclusive'
  | 'sh:minLength'
  | 'sh:pattern';

/**
 * Structure variants for complex RDF patterns that cannot be expressed
 * as a single flat relation. Each variant maps to a format-independent
 * RDF concept — not a serialization format shape.
 *
 * - restriction: OWL restriction blank node (onProperty + constraint predicates)
 * - list: RDF list (rdf:first/rdf:rest chain of IRIs or blank nodes)
 * - conditional: material conditional (union of intersections for if/then/else)
 */
export type RelationStructure
  = | { 'constraint': RelationPredicateType;
    'kind': 'restriction';
    'onProperty': string;
    'value': unknown }
  | { 'elseRef'?: string
    'ifRef': string;
    'kind': 'conditional';
    'thenRef'?: string; }
  | { 'kind': 'list';
    'members': string[] };
