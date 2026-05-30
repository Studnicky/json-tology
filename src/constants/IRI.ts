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

export const OWL = {
  'allValuesFrom': `${OWL_NS}allValuesFrom`,
  'AsymmetricProperty': `${OWL_NS}AsymmetricProperty`,
  'cardinality': `${OWL_NS}cardinality`,
  'Class': `${OWL_NS}Class`,
  'complementOf': `${OWL_NS}complementOf`,
  'DatatypeProperty': `${OWL_NS}DatatypeProperty`,
  'deprecated': `${OWL_NS}deprecated`,
  'disjointUnionOf': `${OWL_NS}disjointUnionOf`,
  'disjointWith': `${OWL_NS}disjointWith`,
  'equivalentClass': `${OWL_NS}equivalentClass`,
  'FunctionalProperty': `${OWL_NS}FunctionalProperty`,
  'hasValue': `${OWL_NS}hasValue`,
  'intersectionOf': `${OWL_NS}intersectionOf`,
  'InverseFunctionalProperty': `${OWL_NS}InverseFunctionalProperty`,
  'inverseOf': `${OWL_NS}inverseOf`,
  'IrreflexiveProperty': `${OWL_NS}IrreflexiveProperty`,
  'maxCardinality': `${OWL_NS}maxCardinality`,
  'maxQualifiedCardinality': `${OWL_NS}maxQualifiedCardinality`,
  'minCardinality': `${OWL_NS}minCardinality`,
  'minQualifiedCardinality': `${OWL_NS}minQualifiedCardinality`,
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
  'SymmetricProperty': `${OWL_NS}SymmetricProperty`,
  'TransitiveProperty': `${OWL_NS}TransitiveProperty`,
  'unionOf': `${OWL_NS}unionOf`,
  'withRestrictions': `${OWL_NS}withRestrictions`
} as const;

export const RDF = {
  'first': `${RDF_NS}first`,
  'JSON': `${RDF_NS}JSON`,
  'langString': `${RDF_NS}langString`,
  'List': `${RDF_NS}List`,
  'nil': `${RDF_NS}nil`,
  'rest': `${RDF_NS}rest`,
  'type': `${RDF_NS}type`
} as const;

export const RDFS = {
  'comment': `${RDFS_NS}comment`,
  'Datatype': `${RDFS_NS}Datatype`,
  'domain': `${RDFS_NS}domain`,
  'label': `${RDFS_NS}label`,
  'member': `${RDFS_NS}member`,
  'range': `${RDFS_NS}range`,
  'subClassOf': `${RDFS_NS}subClassOf`,
  'subPropertyOf': `${RDFS_NS}subPropertyOf`
} as const;

export const SH = {
  'and': `${SH_NS}and`,
  'class': `${SH_NS}class`,
  'closed': `${SH_NS}closed`,
  'datatype': `${SH_NS}datatype`,
  'deactivated': `${SH_NS}deactivated`,
  'description': `${SH_NS}description`,
  'hasValue': `${SH_NS}hasValue`,
  'in': `${SH_NS}in`,
  'maxCount': `${SH_NS}maxCount`,
  'maxExclusive': `${SH_NS}maxExclusive`,
  'maxInclusive': `${SH_NS}maxInclusive`,
  'maxLength': `${SH_NS}maxLength`,
  'minCount': `${SH_NS}minCount`,
  'minExclusive': `${SH_NS}minExclusive`,
  'minInclusive': `${SH_NS}minInclusive`,
  'minLength': `${SH_NS}minLength`,
  'name': `${SH_NS}name`,
  'node': `${SH_NS}node`,
  'NodeShape': `${SH_NS}NodeShape`,
  'not': `${SH_NS}not`,
  'or': `${SH_NS}or`,
  'path': `${SH_NS}path`,
  'pattern': `${SH_NS}pattern`,
  'property': `${SH_NS}property`,
  'PROPERTY_IRI': `${SH_NS}property`,
  'PropertyShape': `${SH_NS}PropertyShape`,
  'qualifiedMaxCount': `${SH_NS}qualifiedMaxCount`,
  'qualifiedMinCount': `${SH_NS}qualifiedMinCount`,
  'qualifiedValueShape': `${SH_NS}qualifiedValueShape`
} as const;

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

export const DASH = {
  'readOnly': `${DASH_NS}readOnly`,
  'writeOnly': `${DASH_NS}writeOnly`
} as const;

export const DCT = { 'format': `${DCT_NS}format` } as const;

export const JT = {
  'annotatedEdge': `${JT_NS}annotatedEdge`,
  'dependentRequired': `${JT_NS}dependentRequired`,
  'else': `${JT_NS}else`,
  'format': `${JT_NS}format`,
  'if': `${JT_NS}if`,
  'multipleOf': `${JT_NS}multipleOf`,
  'thenBranch': `${JT_NS}then`
} as const;
