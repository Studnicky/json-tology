/**
 * Item produced by `SchemaGraphInterface.collectList` when walking an
 * `rdf:first` / `rdf:rest` / `rdf:nil` chain.
 *
 * Preserves the term shape from the underlying quad store so callers can
 * distinguish blank nodes (anonymous class expressions / facet bnodes),
 * named nodes (IRI references), and literals (with language tags / datatype
 * IRIs) without having to walk raw quads themselves.
 */
export interface ListItemType {
  /** XSD datatype IRI for Literal items (omitted for NamedNode / BlankNode). */
  readonly 'datatype'?: string;
  /** BCP47 language tag for Literal items (omitted for NamedNode / BlankNode). */
  readonly 'language'?: string;
  /** Target value: IRI for NamedNode, bnode id for BlankNode, lexical string for Literal. */
  readonly 'target': string;
  /** rdf/js term-type discriminator for the list item. */
  readonly 'termType': 'BlankNode' | 'Literal' | 'NamedNode';
}

export type RelationPredicateType
  = | 'dash:readOnly'
  | 'dash:writeOnly'
  | 'dct:format'
  | 'jt:dependentRequired'
  | 'jt:multipleOf'
  | 'owl:AsymmetricProperty'
  | 'owl:complementOf'
  | 'owl:deprecated'
  | 'owl:disjointWith'
  | 'owl:equivalentClass'
  | 'owl:FunctionalProperty'
  | 'owl:hasValue'
  | 'owl:InverseFunctionalProperty'
  | 'owl:inverseOf'
  | 'owl:IrreflexiveProperty'
  | 'owl:maxQualifiedCardinality'
  | 'owl:minQualifiedCardinality'
  | 'owl:oneOf'
  | 'owl:ReflexiveProperty'
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
  | 'sh:pattern'
  | (string & {});

/**
 * Structure variants for complex RDF patterns that cannot be expressed
 * as a single flat relation. Each variant maps to a format-independent
 * RDF concept — not a serialization format shape.
 *
 * - restriction: OWL restriction blank node (onProperty + constraint predicates)
 * - list: RDF list (rdf:first/rdf:rest chain of IRIs or blank nodes)
 * - conditional: material conditional (union of intersections for if/then/else)
 * - annotatedEdge: RDF 1.2 triple-term — base triple plus one annotation per entry.
 *   `edgePredicate` is the predicate IRI of the base triple;
 *   `edgeTarget` is the IRI of the base triple object;
 *   `edgeAnnotations` maps annotation property names to their predicate IRIs and range IRIs.
 */
export type RelationStructure
  = | { 'constraint': RelationPredicateType;
    'kind': 'restriction';
    'onProperty': string;
    'value': unknown }
  | {
    'edgeAnnotations': ReadonlyArray<{
      readonly 'annotationPredicate': string;
      readonly 'propertyName': string;
      readonly 'rangeRef': string;
    }>;
    'edgePredicate': string;
    'edgeTarget': string;
    'kind': 'annotatedEdge';
  }
  | { 'elseRef'?: string
    'ifRef': string;
    'kind': 'conditional';
    'thenRef'?: string; }
  | { 'kind': 'list';
    'members': string[] };
