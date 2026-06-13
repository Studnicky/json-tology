import type { SimplePredicateEntry } from '../interfaces/SimplePredicateEntry.js';

import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from './IRI.js';
import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';

/**
 * Map from OWL restriction keyword names to their full IRI predicates.
 *
 * @remarks
 * Used during graph construction to convert short-form restriction keywords
 * (e.g. `'allValuesFrom'`) into canonical OWL property IRIs. Only keywords
 * that correspond to OWL restriction predicates are included; general schema
 * keywords are handled separately.
 *
 * @example
 * ```ts
 * const iri = RESTRICTION_PREDICATE['allValuesFrom'];
 * // 'http://www.w3.org/2002/07/owl#allValuesFrom'
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see OWL_CORE_PREDICATES
 * @defaultValue `{ allValuesFrom, cardinality, hasValue, maxCardinality, minCardinality, someValuesFrom }`
 * @group Constants
 */
export const RESTRICTION_PREDICATE: Partial<Record<string, string>> = {
  'allValuesFrom': OWL.allValuesFrom,
  'cardinality': OWL.cardinality,
  'hasValue': OWL.hasValue,
  'maxCardinality': OWL.maxCardinality,
  'minCardinality': OWL.minCardinality,
  'someValuesFrom': OWL.someValuesFrom
};

/**
 * Set of CURIE-style predicate names that belong to the OWL core vocabulary.
 *
 * @remarks
 * Used by graph serializers and importers to recognise which predicates are
 * native OWL/RDF/RDFS constructs vs. json-tology extensions. Predicates are
 * stored in `prefix:localName` CURIE form to match quad representations used
 * during graph traversal.
 *
 * @example
 * ```ts
 * if (OWL_CORE_PREDICATES.has('owl:Class')) { ... }
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see SHACL_CORE_PREDICATES
 * @defaultValue `new Set(['jt:format', 'owl:Class', 'rdf:type', 'rdfs:subClassOf', ...])`
 * @group Constants
 */
export const OWL_CORE_PREDICATES: ReadonlySet<string> = new Set([
  'jt:format',
  'jt:multipleOf',
  'owl:AllDifferent',
  'owl:AsymmetricProperty',
  'owl:cardinality',
  'owl:Class',
  'owl:complementOf',
  'owl:DatatypeProperty',
  'owl:distinctMembers',
  'owl:equivalentClass',
  'owl:FunctionalProperty',
  'owl:hasValue',
  'owl:intersectionOf',
  'owl:InverseFunctionalProperty',
  'owl:inverseOf',
  'owl:IrreflexiveProperty',
  'owl:maxCardinality',
  'owl:minCardinality',
  'owl:ObjectProperty',
  'owl:onDatatype',
  'owl:oneOf',
  'owl:onProperty',
  'owl:ReflexiveProperty',
  'owl:Restriction',
  'owl:sameAs',
  'owl:SymmetricProperty',
  'owl:TransitiveProperty',
  'owl:unionOf',
  'owl:withRestrictions',
  'rdf:first',
  'rdf:nil',
  'rdf:rest',
  'rdf:type',
  'rdf:value',
  'rdfs:comment',
  'rdfs:Datatype',
  'rdfs:domain',
  'rdfs:label',
  'rdfs:range',
  'rdfs:subClassOf',
  'rdfs:subPropertyOf'
]);

/**
 * Set of CURIE-style predicate names that belong to the SHACL core vocabulary.
 *
 * @remarks
 * Used by SHACL serializers and shape projections to recognise which predicates
 * are native SHACL/RDFS/DASH constructs. Predicates are stored in `prefix:localName`
 * CURIE form to match quad representations used during graph traversal.
 *
 * @example
 * ```ts
 * if (SHACL_CORE_PREDICATES.has('sh:property')) { ... }
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see OWL_CORE_PREDICATES
 * @defaultValue `new Set(['sh:property', 'sh:targetClass', 'sh:datatype', ...])`
 * @group Constants
 */
export const SHACL_CORE_PREDICATES: ReadonlySet<string> = new Set([
  'dash:readOnly',
  'dash:writeOnly',
  'rdfs:comment',
  'rdfs:domain',
  'rdfs:label',
  'rdfs:range',
  'sh:and',
  'sh:class',
  'sh:closed',
  'sh:datatype',
  'sh:description',
  'sh:hasValue',
  'sh:ignoredProperties',
  'sh:in',
  'sh:maxCount',
  'sh:maxExclusive',
  'sh:maxInclusive',
  'sh:maxLength',
  'sh:minCount',
  'sh:minExclusive',
  'sh:minInclusive',
  'sh:minLength',
  'sh:name',
  'sh:node',
  'sh:not',
  'sh:or',
  'sh:path',
  'sh:pattern',
  'sh:property',
  'sh:qualifiedMaxCount',
  'sh:qualifiedMinCount',
  'sh:qualifiedValueShape',
  'sh:targetClass',
  'sh:targetNode'
]);

/**
 * Set of OWL cardinality keyword names used to identify cardinality restriction types.
 *
 * @remarks
 * Checked during graph traversal to determine whether a restriction node expresses
 * exact, minimum, or maximum cardinality. These names correspond to the short-form
 * keys in `RESTRICTION_PREDICATE`.
 *
 * @example
 * ```ts
 * if (CARDINALITY_KINDS.has(keyword)) { ... }
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see RESTRICTION_PREDICATE
 * @defaultValue `new Set(['cardinality', 'maxCardinality', 'minCardinality'])`
 * @group Constants
 */
export const CARDINALITY_KINDS = new Set<string>([
  'cardinality',
  'maxCardinality',
  'minCardinality'
]);

/**
 * Map from full predicate IRIs to their coercion descriptor and XSD datatype.
 *
 * @remarks
 * Each entry describes how to deserialise a literal quad object into a typed
 * JavaScript value. The optional `coerce` function converts the raw string value
 * from the quad store into the appropriate runtime type. The `datatype` IRI is
 * used when emitting typed literals back to RDF serialisation formats.
 *
 * Supported predicates include DASH access flags, DCT and JT format annotations,
 * OWL deprecation and cardinality qualifiers, RDFS label/comment, and SHACL
 * numeric and string constraint predicates.
 *
 * @example
 * ```ts
 * const entry = SIMPLE_LITERAL_PREDICATES.get(SH.maxCount);
 * const value = entry?.coerce ? entry.coerce(rawString) : rawString;
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see IRI_PREDICATES
 * @defaultValue `new Map([[DASH.readOnly, ...], [SH.maxCount, ...], ...])`
 * @group Constants
 */
export const SIMPLE_LITERAL_PREDICATES = new Map<string, SimplePredicateEntry>([
  [
    DASH.readOnly,
    {
      'coerce': (value: string): boolean => {
        return value === 'true';
      },
      'datatype': XSD.boolean
    }
  ],
  [
    DASH.writeOnly,
    {
      'coerce': (value: string): boolean => {
        return value === 'true';
      },
      'datatype': XSD.boolean
    }
  ],
  [
    DCT.format,
    { 'datatype': XSD.string }
  ],
  [
    JT.format,
    { 'datatype': XSD.string }
  ],
  [
    JT.multipleOf,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    OWL.deprecated,
    { 'datatype': XSD.boolean }
  ],
  [
    OWL.hasValue,
    { 'datatype': XSD.string }
  ],
  [
    OWL.maxQualifiedCardinality,
    {
      'coerce': Number,
      'datatype': XSD.nonNegativeInteger
    }
  ],
  [
    OWL.minQualifiedCardinality,
    {
      'coerce': Number,
      'datatype': XSD.nonNegativeInteger
    }
  ],
  [
    OWL.oneOf,
    { 'datatype': XSD.string }
  ],
  [
    RDFS.comment,
    { 'datatype': XSD.string }
  ],
  [
    RDFS.label,
    { 'datatype': XSD.string }
  ],
  [
    SH.closed,
    { 'datatype': XSD.boolean }
  ],
  [
    SH.maxCount,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.maxExclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.maxInclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.maxLength,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.minCount,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ],
  [
    SH.minExclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.minInclusive,
    {
      'coerce': Number,
      'datatype': XSD.decimal
    }
  ],
  [
    SH.minLength,
    {
      'coerce': Number,
      'datatype': XSD.integer
    }
  ]
]);

/**
 * Set of full predicate IRIs whose object values must be treated as IRI references.
 *
 * @remarks
 * Used during graph traversal to decide whether a quad object should be
 * interpreted as a named node (IRI) or a typed literal. Predicates in this set
 * always carry IRI objects — they are never plain literals.
 *
 * @example
 * ```ts
 * if (IRI_PREDICATES.has(predicate)) {
 *   // emit a named node, not a typed literal
 * }
 * ```
 *
 * @category Ontology
 * @since 0.1.0
 * @see SIMPLE_LITERAL_PREDICATES
 * @defaultValue `new Set([OWL.equivalentClass, RDF.type, RDFS.subClassOf, ...])`
 * @group Constants
 */
export const IRI_PREDICATES = new Set<string>([
  OWL.AsymmetricProperty,
  OWL.complementOf,
  OWL.disjointUnionOf,
  OWL.disjointWith,
  OWL.equivalentClass,
  OWL.FunctionalProperty,
  OWL.InverseFunctionalProperty,
  OWL.inverseOf,
  OWL.IrreflexiveProperty,
  OWL.ReflexiveProperty,
  OWL.someValuesFrom,
  OWL.SymmetricProperty,
  OWL.TransitiveProperty,
  OWL.unionOf,
  RDF.type,
  RDFS.domain,
  RDFS.member,
  RDFS.range,
  RDFS.subClassOf,
  SH.datatype
]);

// ---------------------------------------------------------------------------
// Merged predicate sets — canonical single exports for constants centralization
// ---------------------------------------------------------------------------

export const RDF_TYPE_PREDICATES: ReadonlySet<string> = new Set([
  RDF.type,
  'rdf:type'
]);

export const UNION_OF_IRIS: ReadonlySet<string> = new Set([
  OWL.unionOf,
  'owl:unionOf'
]);

export const DISJOINT_UNION_OF_IRIS: ReadonlySet<string> = new Set([
  OWL.disjointUnionOf,
  'owl:disjointUnionOf'
]);

export const EQUIVALENT_CLASS_PREDICATES: ReadonlySet<string> = new Set([
  OWL.equivalentClass,
  'owl:equivalentClass'
]);

export const ONE_OF_IRIS: ReadonlySet<string> = new Set([
  OWL.oneOf,
  'owl:oneOf'
]);

// ---------------------------------------------------------------------------
// Annotation predicate sets
// ---------------------------------------------------------------------------

export const LABEL_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.rdfs}label`,
  `${STANDARD_PREFIXES.skos}prefLabel`,
  'rdfs:label',
  'skos:prefLabel'
]);

export const COMMENT_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.rdfs}comment`,
  `${STANDARD_PREFIXES.skos}definition`,
  'rdfs:comment',
  'skos:definition'
]);

export const DEPRECATED_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.owl}deprecated`,
  'owl:deprecated'
]);

export const VERSION_INFO_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.owl}versionInfo`,
  'owl:versionInfo'
]);

export const IS_DEFINED_BY_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.rdfs}isDefinedBy`,
  'rdfs:isDefinedBy'
]);

export const SEE_ALSO_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.rdfs}seeAlso`,
  'rdfs:seeAlso'
]);

export const ALT_LABEL_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.skos}altLabel`,
  'skos:altLabel'
]);

export const ANNOTATION_PROPERTY_PREDICATES: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.owl}AnnotationProperty`,
  'owl:AnnotationProperty'
]);

// ---------------------------------------------------------------------------
// Property predicate sets
// ---------------------------------------------------------------------------

export const OBJECT_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  OWL.ObjectProperty,
  'owl:ObjectProperty'
]);

export const DATATYPE_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  OWL.DatatypeProperty,
  'owl:DatatypeProperty'
]);

export const DOMAIN_PREDICATES: ReadonlySet<string> = new Set([
  RDFS.domain,
  'rdfs:domain'
]);

export const RANGE_PREDICATES: ReadonlySet<string> = new Set([
  RDFS.range,
  'rdfs:range'
]);

export const SUB_PROPERTY_PREDICATES: ReadonlySet<string> = new Set([
  RDFS.subPropertyOf,
  'rdfs:subPropertyOf'
]);

export const INVERSE_OF_PREDICATES: ReadonlySet<string> = new Set([
  OWL.inverseOf,
  'owl:inverseOf'
]);

// ---------------------------------------------------------------------------
// Individual predicate sets
// ---------------------------------------------------------------------------

export const NAMED_INDIVIDUAL_IRIS: ReadonlySet<string> = new Set([
  OWL.NamedIndividual,
  'owl:NamedIndividual'
]);

export const SAME_AS_IRIS: ReadonlySet<string> = new Set([
  OWL.sameAs,
  'owl:sameAs'
]);

export const DIFFERENT_FROM_IRIS: ReadonlySet<string> = new Set([
  OWL.differentFrom,
  'owl:differentFrom'
]);

export const ALL_DIFFERENT_IRIS: ReadonlySet<string> = new Set([
  OWL.AllDifferent,
  'owl:AllDifferent'
]);

export const DISTINCT_MEMBERS_IRIS: ReadonlySet<string> = new Set([
  OWL.distinctMembers,
  'owl:distinctMembers'
]);

export const NEGATIVE_PROPERTY_ASSERTION_IRIS: ReadonlySet<string> = new Set([
  OWL.NegativePropertyAssertion,
  'owl:NegativePropertyAssertion'
]);

export const SOURCE_INDIVIDUAL_IRIS: ReadonlySet<string> = new Set([
  OWL.sourceIndividual,
  'owl:sourceIndividual'
]);

export const ASSERTION_PROPERTY_IRIS: ReadonlySet<string> = new Set([
  OWL.assertionProperty,
  'owl:assertionProperty'
]);

export const TARGET_INDIVIDUAL_IRIS: ReadonlySet<string> = new Set([
  OWL.targetIndividual,
  'owl:targetIndividual'
]);

export const TARGET_VALUE_IRIS: ReadonlySet<string> = new Set([
  OWL.targetValue,
  'owl:targetValue'
]);

export const HAS_KEY_IRIS: ReadonlySet<string> = new Set([
  OWL.hasKey,
  'owl:hasKey'
]);

// ---------------------------------------------------------------------------
// Class expression predicate sets
// ---------------------------------------------------------------------------

export const INTERSECTION_OF_IRIS: ReadonlySet<string> = new Set([
  OWL.intersectionOf,
  'owl:intersectionOf'
]);

export const HAS_VALUE_IRIS: ReadonlySet<string> = new Set([
  OWL.hasValue,
  'owl:hasValue'
]);

export const ON_PROPERTY_IRIS: ReadonlySet<string> = new Set([
  OWL.onProperty,
  'owl:onProperty'
]);

export const RESTRICTION_IRIS: ReadonlySet<string> = new Set([
  OWL.Restriction,
  'owl:Restriction'
]);

// ---------------------------------------------------------------------------
// Class axiom predicate sets
// ---------------------------------------------------------------------------

export const COMPLEMENT_OF_PREDICATES: ReadonlySet<string> = new Set([
  OWL.complementOf,
  'owl:complementOf'
]);

export const DISJOINT_WITH_PREDICATES: ReadonlySet<string> = new Set([
  OWL.disjointWith,
  'owl:disjointWith'
]);

export const CLASS_TYPE_IRIS: ReadonlySet<string> = new Set([
  OWL.Class,
  'owl:Class',
  RDFS.Class,
  'rdfs:Class'
]);

// ---------------------------------------------------------------------------
// Datatype predicate sets
// ---------------------------------------------------------------------------

export const RDFS_DATATYPE_IRIS: ReadonlySet<string> = new Set([
  RDFS.Datatype,
  'rdfs:Datatype'
]);

export const OWL_ON_DATATYPE_IRIS: ReadonlySet<string> = new Set([
  OWL.onDatatype,
  'owl:onDatatype'
]);

export const OWL_WITH_RESTRICTIONS_IRIS: ReadonlySet<string> = new Set([
  OWL.withRestrictions,
  'owl:withRestrictions'
]);

export const JT_MULTIPLE_OF_IRIS: ReadonlySet<string> = new Set([
  JT.multipleOf,
  'jt:multipleOf'
]);

export const JT_FORMAT_IRIS: ReadonlySet<string> = new Set([
  JT.format,
  'jt:format'
]);

// ---------------------------------------------------------------------------
// Graph node type sets (from QuadBackedSchemaGraph)
// ---------------------------------------------------------------------------

export const OWL_NODE_TYPE_IRIS: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.owl}AsymmetricProperty`,
  `${STANDARD_PREFIXES.owl}Class`,
  `${STANDARD_PREFIXES.owl}DatatypeProperty`,
  `${STANDARD_PREFIXES.owl}FunctionalProperty`,
  `${STANDARD_PREFIXES.owl}InverseFunctionalProperty`,
  `${STANDARD_PREFIXES.owl}IrreflexiveProperty`,
  `${STANDARD_PREFIXES.owl}NamedIndividual`,
  `${STANDARD_PREFIXES.owl}ObjectProperty`,
  `${STANDARD_PREFIXES.owl}ReflexiveProperty`,
  `${STANDARD_PREFIXES.owl}Restriction`,
  `${STANDARD_PREFIXES.owl}SymmetricProperty`,
  `${STANDARD_PREFIXES.owl}TransitiveProperty`,
  `${STANDARD_PREFIXES.rdfs}Class`,
  `${STANDARD_PREFIXES.rdfs}Datatype`,
  `${STANDARD_PREFIXES.rdf}Property`,
  OWL.AsymmetricProperty,
  OWL.Class,
  OWL.DatatypeProperty,
  OWL.FunctionalProperty,
  OWL.InverseFunctionalProperty,
  OWL.IrreflexiveProperty,
  OWL.ObjectProperty,
  OWL.ReflexiveProperty,
  OWL.Restriction,
  OWL.SymmetricProperty,
  OWL.TransitiveProperty,
  'owl:AsymmetricProperty',
  'owl:FunctionalProperty',
  'owl:InverseFunctionalProperty',
  'owl:IrreflexiveProperty',
  'owl:NamedIndividual',
  'owl:ReflexiveProperty',
  'owl:SymmetricProperty',
  'owl:TransitiveProperty',
  'rdf:Property',
  'rdfs:Class',
  'rdfs:Datatype'
]);

export const OWL_RESTRICTION_CONSTRAINT_IRIS: ReadonlySet<string> = new Set([
  `${STANDARD_PREFIXES.owl}allValuesFrom`,
  `${STANDARD_PREFIXES.owl}cardinality`,
  `${STANDARD_PREFIXES.owl}hasValue`,
  `${STANDARD_PREFIXES.owl}maxCardinality`,
  `${STANDARD_PREFIXES.owl}maxQualifiedCardinality`,
  `${STANDARD_PREFIXES.owl}minCardinality`,
  `${STANDARD_PREFIXES.owl}minQualifiedCardinality`,
  `${STANDARD_PREFIXES.owl}someValuesFrom`,
  OWL.allValuesFrom,
  OWL.cardinality,
  OWL.hasValue,
  OWL.maxCardinality,
  OWL.maxQualifiedCardinality,
  OWL.minCardinality,
  OWL.minQualifiedCardinality,
  OWL.someValuesFrom
]);

// ---------------------------------------------------------------------------
// OWL projection cardinality predicate set
// ---------------------------------------------------------------------------

export const OWL_CARDINALITY_PREDICATE_IRIS: ReadonlySet<string> = new Set([
  OWL.cardinality,
  OWL.maxCardinality,
  OWL.maxQualifiedCardinality,
  OWL.minCardinality,
  OWL.minQualifiedCardinality
]);
