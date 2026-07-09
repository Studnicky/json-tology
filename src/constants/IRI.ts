/**
 * IRI — canonical full-IRI constants for all RDF vocabulary terms used by json-tology.
 *
 * Every value is a full IRI (not a compact CURIE). Derived from STANDARD_PREFIXES.
 * Compact/display forms are produced on demand via Curie.compact() — they are never
 * stored at rest in the graph or as constants here.
 */
import { STANDARD_PREFIXES } from './STANDARD_PREFIXES.js';

const OWL_NS = STANDARD_PREFIXES.owl;
const RDF_NS = STANDARD_PREFIXES.rdf;
const RDFS_NS = STANDARD_PREFIXES.rdfs;
const SH_NS = STANDARD_PREFIXES.sh;
const XSD_NS = STANDARD_PREFIXES.xsd;
const DASH_NS = STANDARD_PREFIXES.dash;
const DCT_NS = STANDARD_PREFIXES.dct;
const JT_NS = STANDARD_PREFIXES.jt;

/**
 * Full-IRI constants for the OWL 2 vocabulary.
 *
 * @remarks
 * Each key is the local name of an OWL 2 term; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.owl`. Use these constants wherever OWL IRIs
 * are written to the graph or compared at runtime.
 *
 * @example
 * ```ts
 * graph.addTriple(classIri, RDF.type, OWL.Class);
 * graph.addTriple(propIri, RDF.type, OWL.ObjectProperty);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/owl2-overview/ OWL 2 Web Ontology Language}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const OWL = {
  'AllDifferent': `${OWL_NS}AllDifferent`,
  'allValuesFrom': `${OWL_NS}allValuesFrom`,
  'AnnotationProperty': `${OWL_NS}AnnotationProperty`,
  'assertionProperty': `${OWL_NS}assertionProperty`,
  'AsymmetricProperty': `${OWL_NS}AsymmetricProperty`,
  'cardinality': `${OWL_NS}cardinality`,
  'Class': `${OWL_NS}Class`,
  'complementOf': `${OWL_NS}complementOf`,
  'DatatypeProperty': `${OWL_NS}DatatypeProperty`,
  'deprecated': `${OWL_NS}deprecated`,
  'differentFrom': `${OWL_NS}differentFrom`,
  'disjointUnionOf': `${OWL_NS}disjointUnionOf`,
  'disjointWith': `${OWL_NS}disjointWith`,
  'distinctMembers': `${OWL_NS}distinctMembers`,
  'equivalentClass': `${OWL_NS}equivalentClass`,
  'FunctionalProperty': `${OWL_NS}FunctionalProperty`,
  'hasKey': `${OWL_NS}hasKey`,
  'hasValue': `${OWL_NS}hasValue`,
  'intersectionOf': `${OWL_NS}intersectionOf`,
  'InverseFunctionalProperty': `${OWL_NS}InverseFunctionalProperty`,
  'inverseOf': `${OWL_NS}inverseOf`,
  'IrreflexiveProperty': `${OWL_NS}IrreflexiveProperty`,
  'maxCardinality': `${OWL_NS}maxCardinality`,
  'maxQualifiedCardinality': `${OWL_NS}maxQualifiedCardinality`,
  'minCardinality': `${OWL_NS}minCardinality`,
  'minQualifiedCardinality': `${OWL_NS}minQualifiedCardinality`,
  'NamedIndividual': `${OWL_NS}NamedIndividual`,
  'NegativePropertyAssertion': `${OWL_NS}NegativePropertyAssertion`,
  'Nothing': `${OWL_NS}Nothing`,
  'ObjectProperty': `${OWL_NS}ObjectProperty`,
  'onDataRange': `${OWL_NS}onDataRange`,
  'onDatatype': `${OWL_NS}onDatatype`,
  'oneOf': `${OWL_NS}oneOf`,
  'onProperty': `${OWL_NS}onProperty`,
  'ReflexiveProperty': `${OWL_NS}ReflexiveProperty`,
  'Restriction': `${OWL_NS}Restriction`,
  'sameAs': `${OWL_NS}sameAs`,
  'someValuesFrom': `${OWL_NS}someValuesFrom`,
  'sourceIndividual': `${OWL_NS}sourceIndividual`,
  'SymmetricProperty': `${OWL_NS}SymmetricProperty`,
  'targetIndividual': `${OWL_NS}targetIndividual`,
  'targetValue': `${OWL_NS}targetValue`,
  'TransitiveProperty': `${OWL_NS}TransitiveProperty`,
  'unionOf': `${OWL_NS}unionOf`,
  'versionInfo': `${OWL_NS}versionInfo`,
  'withRestrictions': `${OWL_NS}withRestrictions`
} as const;

/**
 * Full-IRI constants for the RDF vocabulary.
 *
 * @remarks
 * Each key is the local name of an RDF term; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.rdf`. Use these constants when constructing
 * or comparing RDF triples at runtime.
 *
 * @example
 * ```ts
 * graph.addTriple(subjectIri, RDF.type, OWL.Class);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/rdf-concepts/ RDF 1.1 Concepts}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const RDF = {
  'first': `${RDF_NS}first`,
  'JSON': `${RDF_NS}JSON`,
  'langString': `${RDF_NS}langString`,
  'List': `${RDF_NS}List`,
  'nil': `${RDF_NS}nil`,
  'Property': `${RDF_NS}Property`,
  'rest': `${RDF_NS}rest`,
  'type': `${RDF_NS}type`
} as const;

/**
 * Full-IRI constants for the RDFS vocabulary.
 *
 * @remarks
 * Each key is the local name of an RDFS term; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.rdfs`. Use these constants when writing class
 * hierarchies, labels, and domain/range assertions to the graph.
 *
 * @example
 * ```ts
 * graph.addTriple(classIri, RDFS.subClassOf, parentClassIri);
 * graph.addTriple(propIri, RDFS.domain, classIri);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/rdf-schema/ RDF Schema 1.1}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const RDFS = {
  'Class': `${RDFS_NS}Class`,
  'comment': `${RDFS_NS}comment`,
  'Datatype': `${RDFS_NS}Datatype`,
  'domain': `${RDFS_NS}domain`,
  'label': `${RDFS_NS}label`,
  'member': `${RDFS_NS}member`,
  'range': `${RDFS_NS}range`,
  'subClassOf': `${RDFS_NS}subClassOf`,
  'subPropertyOf': `${RDFS_NS}subPropertyOf`
} as const;

/**
 * Compact prefix string for XSD datatypes (`xsd:`).
 *
 * @remarks
 * Used in modules that need to strip or match the `xsd:` compact prefix
 * without importing `STANDARD_PREFIXES`.
 *
 * @category IRI
 * @since 0.21.0
 * @group Constants
 */
export const XSD_COMPACT_PREFIX = 'xsd:';

/**
 * Full-IRI constants for the SHACL vocabulary.
 *
 * @remarks
 * Each key is the local name of a SHACL term; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.sh`. Use these constants when projecting
 * JSON Schema constraints to SHACL shapes.
 *
 * @example
 * ```ts
 * graph.addTriple(shapeIri, RDF.type, SH.NodeShape);
 * graph.addTriple(shapeIri, SH.closed, literalTrue);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/shacl/ SHACL W3C Recommendation}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const SH = {
  'and': `${SH_NS}and`,
  'AndConstraintComponent': `${SH_NS}AndConstraintComponent`,
  'class': `${SH_NS}class`,
  'ClassConstraintComponent': `${SH_NS}ClassConstraintComponent`,
  'closed': `${SH_NS}closed`,
  'ClosedConstraintComponent': `${SH_NS}ClosedConstraintComponent`,
  'datatype': `${SH_NS}datatype`,
  'DatatypeConstraintComponent': `${SH_NS}DatatypeConstraintComponent`,
  'deactivated': `${SH_NS}deactivated`,
  'description': `${SH_NS}description`,
  'hasValue': `${SH_NS}hasValue`,
  'HasValueConstraintComponent': `${SH_NS}HasValueConstraintComponent`,
  'in': `${SH_NS}in`,
  'InConstraintComponent': `${SH_NS}InConstraintComponent`,
  'maxCount': `${SH_NS}maxCount`,
  'MaxCountConstraintComponent': `${SH_NS}MaxCountConstraintComponent`,
  'maxExclusive': `${SH_NS}maxExclusive`,
  'MaxExclusiveConstraintComponent': `${SH_NS}MaxExclusiveConstraintComponent`,
  'maxInclusive': `${SH_NS}maxInclusive`,
  'MaxInclusiveConstraintComponent': `${SH_NS}MaxInclusiveConstraintComponent`,
  'maxLength': `${SH_NS}maxLength`,
  'MaxLengthConstraintComponent': `${SH_NS}MaxLengthConstraintComponent`,
  'minCount': `${SH_NS}minCount`,
  'MinCountConstraintComponent': `${SH_NS}MinCountConstraintComponent`,
  'minExclusive': `${SH_NS}minExclusive`,
  'MinExclusiveConstraintComponent': `${SH_NS}MinExclusiveConstraintComponent`,
  'minInclusive': `${SH_NS}minInclusive`,
  'MinInclusiveConstraintComponent': `${SH_NS}MinInclusiveConstraintComponent`,
  'minLength': `${SH_NS}minLength`,
  'MinLengthConstraintComponent': `${SH_NS}MinLengthConstraintComponent`,
  'name': `${SH_NS}name`,
  'node': `${SH_NS}node`,
  'NodeConstraintComponent': `${SH_NS}NodeConstraintComponent`,
  'NodeShape': `${SH_NS}NodeShape`,
  'not': `${SH_NS}not`,
  'NotConstraintComponent': `${SH_NS}NotConstraintComponent`,
  'or': `${SH_NS}or`,
  'OrConstraintComponent': `${SH_NS}OrConstraintComponent`,
  'path': `${SH_NS}path`,
  'pattern': `${SH_NS}pattern`,
  'PatternConstraintComponent': `${SH_NS}PatternConstraintComponent`,
  'property': `${SH_NS}property`,
  'PROPERTY_IRI': `${SH_NS}property`,
  'PropertyShape': `${SH_NS}PropertyShape`,
  'qualifiedMaxCount': `${SH_NS}qualifiedMaxCount`,
  'QualifiedMaxCountConstraintComponent': `${SH_NS}QualifiedMaxCountConstraintComponent`,
  'qualifiedMinCount': `${SH_NS}qualifiedMinCount`,
  'QualifiedMinCountConstraintComponent': `${SH_NS}QualifiedMinCountConstraintComponent`,
  'qualifiedValueShape': `${SH_NS}qualifiedValueShape`
} as const;

/**
 * Full-IRI constants for the XSD datatype vocabulary.
 *
 * @remarks
 * Each key is the local name of an XSD datatype; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.xsd`. Used when mapping JSON Schema types and
 * formats to XSD datatypes in graph nodes and SHACL shapes.
 *
 * @example
 * ```ts
 * graph.addTriple(propIri, SH.datatype, XSD.string);
 * graph.addTriple(propIri, SH.datatype, XSD.dateTime);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/xmlschema11-2/ XML Schema Definition Language Part 2}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const XSD = {
  'anyURI': `${XSD_NS}anyURI`,
  'base64Binary': `${XSD_NS}base64Binary`,
  'boolean': `${XSD_NS}boolean`,
  'date': `${XSD_NS}date`,
  'dateTime': `${XSD_NS}dateTime`,
  'decimal': `${XSD_NS}decimal`,
  'double': `${XSD_NS}double`,
  'duration': `${XSD_NS}duration`,
  'float': `${XSD_NS}float`,
  'hexBinary': `${XSD_NS}hexBinary`,
  'int': `${XSD_NS}int`,
  'integer': `${XSD_NS}integer`,
  'long': `${XSD_NS}long`,
  'nonNegativeInteger': `${XSD_NS}nonNegativeInteger`,
  'short': `${XSD_NS}short`,
  'string': `${XSD_NS}string`,
  'time': `${XSD_NS}time`
} as const;

/**
 * Full-IRI constants for the DASH vocabulary.
 *
 * @remarks
 * Each key is the local name of a DASH term; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.dash`. Used for `readOnly` and `writeOnly`
 * SHACL shape annotations.
 *
 * @example
 * ```ts
 * graph.addTriple(shapeIri, DASH.readOnly, literalTrue);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://datashapes.org/dash.html DASH Constraint Components}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const DASH = {
  'readOnly': `${DASH_NS}readOnly`,
  'writeOnly': `${DASH_NS}writeOnly`
} as const;

/**
 * Full-IRI constants for the Dublin Core Terms vocabulary.
 *
 * @remarks
 * Each key is the local name of a DCT term; each value is its canonical full IRI
 * constructed from `STANDARD_PREFIXES.dct`. Currently exposes `dct:format` for
 * format annotation on property shapes.
 *
 * @example
 * ```ts
 * graph.addTriple(propIri, DCT.format, literalFormatValue);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see {@link https://www.dublincore.org/specifications/dublin-core/dcmi-terms/ DCMI Metadata Terms}
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const DCT = { 'format': `${DCT_NS}format` } as const;

/**
 * Full-IRI constants for the json-tology extension vocabulary.
 *
 * @remarks
 * Each key is the local name of a json-tology extension term; each value is its
 * canonical full IRI constructed from `STANDARD_PREFIXES.jt`. These IRIs are used
 * to represent json-tology-specific graph relations that have no equivalent in
 * standard RDF vocabularies (e.g. conditional branches, annotated edges).
 *
 * @example
 * ```ts
 * graph.addTriple(ifNodeIri, JT.thenBranch, thenNodeIri);
 * graph.addTriple(propIri, JT.multipleOf, multiplierLiteral);
 * ```
 *
 * @category IRI
 * @since 0.1.0
 * @see STANDARD_PREFIXES
 * @defaultValue `{...} as const`
 * @group Constants
 */
export const JT = {
  'annotatedEdge': `${JT_NS}annotatedEdge`,
  'dependentRequired': `${JT_NS}dependentRequired`,
  'else': `${JT_NS}else`,
  'format': `${JT_NS}format`,
  'if': `${JT_NS}if`,
  'multipleOf': `${JT_NS}multipleOf`,
  'thenBranch': `${JT_NS}then`
} as const;

/**
 * RFC 7807 Problem Details type IRI for json-tology validation failures.
 *
 * @category IRI
 * @since 0.25.0
 * @group Constants
 */
export const JT_VALIDATION_PROBLEM_TYPE = 'https://json-tology.dev/problems/validation';

/**
 * Static base IRI used by ephemeral single-schema registries (static convenience methods).
 *
 * @category IRI
 * @since 0.25.0
 * @group Constants
 */
export const JT_STATIC_BASE_IRI = 'http://json-tology.dev/_/static';

/**
 * The literal string `'blank-node'` requests anonymous-node subjects
 * for every object in a quad projection. Exposed as a separate constant
 * so consumers can spell the magic value without hard-coding it inline.
 *
 * @remarks
 * Pass as the `iriFor` option to `JsonTology.toQuads()` or the constructor to enable
 * blank-node subjects for every projected object, rather than minting well-known
 * genid IRIs.
 *
 * @example
 * ```ts
 * const quads = jt.toQuads(UserSchema, user, { iriFor: BLANK_NODE_IRI_FOR });
 * ```
 *
 * @defaultValue `'blank-node'`
 * @category Skolemization
 * @since 0.1.0
 * @group Constants
 */
export const BLANK_NODE_IRI_FOR = 'blank-node';
