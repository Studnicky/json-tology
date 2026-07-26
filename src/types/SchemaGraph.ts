import type { JsonSchemaType } from './Schema.js';

/**
 * Predicate IRI vocabulary recognised on a {@link SchemaGraphRelationInterface}.
 *
 * @remarks
 * The trailing `(string & {})` member is intentional and not a fixable
 * violation of `@studnicky/type-alias-invariants`'s `derivedFromSchema`
 * check: it admits any predicate IRI beyond the enumerated literals (custom
 * vocabulary / extension predicates resolved at runtime via
 * `PredicateResolver`) while still giving editor autocomplete for the known
 * vocabulary. JSON Schema's closed `enum` cannot express "one of these
 * literals, or any other string", so this union has no schema-derived
 * equivalent. It also has no interface remedy — a union of string literal
 * types is not an object contract, so `aliasMustBeInterface` does not apply
 * either; the violation reported here is `derivedFromSchema` specifically
 * because of the open `(string & {})` member. Documented exception.
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @group SchemaGraph
 */
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
 *   `edgeAnnotations` carries the raw annotation sub-schema for each annotation
 *   so predicate IRIs are resolved late (at projection/lift time) via PredicateResolver,
 *   consistent with every other predicate in the system.
 *
 * @remarks
 * This is a genuine discriminated union — a union of four structurally
 * distinct shapes distinguished by their `kind` literal — and TypeScript has
 * no interface syntax for a union type (`interface X` cannot itself be a
 * union), so `@studnicky/type-alias-invariants`'s `aliasMustBeInterface`
 * flags it with no interface remedy available.
 *
 * The `restriction` variant's `value: unknown` field is also not
 * schema-derivable data: an OWL restriction's constraint value is genuinely
 * polymorphic at the type level (a string, number, IRI, or nested list,
 * depending on which constraint predicate — `owl:hasValue`,
 * `owl:someValuesFrom`, a cardinality facet, etc. — populated the
 * restriction), so `unknown` is the honest type for a value whose shape is
 * determined by RDF data at runtime, not by this schema. Documented
 * exception.
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @group SchemaGraph
 */
export type RelationStructureType
  = | { 'constraint': RelationPredicateType;
    'kind': 'restriction';
    'onProperty': string;
    'value': unknown }
  | {
    'edgeAnnotations': ReadonlyArray<{
      'propertyName': string;
      'propertySchema': JsonSchemaType;
      'rangeRef': string;
    }>;
    'edgePredicate': string;
    'edgeTarget': string;
    'kind': 'annotatedEdge';
  }
  | { 'elseReference'?: string
    'ifReference': string;
    'kind': 'conditional';
    'thenReference'?: string; }
  | { 'kind': 'list';
    'members': string[] };
