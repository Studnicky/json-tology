import type { SimplePredicateEntry } from '../interfaces/SimplePredicateEntry.js';

import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from './IRI.js';

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
