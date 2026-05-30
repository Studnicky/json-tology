import type {
  RelationPredicateType, RelationStructure
} from '../types/SchemaGraph.js';
import type { AnnotatedEdgeDescriptorInterface } from './AnnotatedEdgeDescriptorInterface.js';


import type { JsonSchemaType } from '../types/Schema.js';
import type { JtConfigType } from '../types/JtConfig.js';
import type { RawRestrictionDescriptorType } from '../types/RawRestrictionDescriptor.js';

export interface NormIRNodeInterface {
  readonly 'id': string;
  readonly 'pointer': string;
}

export interface NormIRInterface {
  readonly 'anchors': Record<string, string>;
  readonly 'children': Record<string, Record<string, string>>;
  readonly 'entries': Record<string, Record<string, Array<[string, string]>>>;
  readonly 'indexedChildren': Record<string, Record<string, string[]>>;
  readonly 'nodes': NormIRNodeInterface[];
  readonly 'rootSchema': JsonSchemaType;
}

export interface SchemaGraphNodeInterface {
  'id': string;
  'pointer': string;
  'schema': JsonSchemaType;
}

export interface SchemaGraphSemanticsInterface {
  'additionalItemsNode': boolean | SchemaGraphNodeInterface | undefined;
  'additionalPropertiesNode': boolean | SchemaGraphNodeInterface | undefined;
  'aliases': readonly string[];
  'allOf': SchemaGraphNodeInterface[];
  'annotatedEdge': AnnotatedEdgeDescriptorInterface | undefined;
  'anyOf': SchemaGraphNodeInterface[];
  'asymmetric': boolean;
  'comment': string | undefined;
  'complementNode': SchemaGraphNodeInterface | undefined;
  'computed': boolean;
  'constValue': unknown;
  'containsNode': SchemaGraphNodeInterface | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'defaultValue': unknown;
  'definitions': Array<[string, SchemaGraphNodeInterface]>;
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, SchemaGraphNodeInterface]>;
  'deprecated': boolean;
  'description': string | undefined;
  'discriminatorMapping': Record<string, string> | undefined;
  'discriminatorPropertyName': string | undefined;
  'disjointWith': string | undefined;
  'dynamicAnchor': string | undefined;
  'dynamicRef': string | undefined;
  'elseNode': SchemaGraphNodeInterface | undefined;
  'enumValues': undefined | unknown[];
  'equivalentTo': string | undefined;
  'examples': undefined | unknown[];
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'extensions': Record<string, unknown>;
  'format': string | undefined;
  'functional': boolean;
  'hasConst': boolean;
  'hasDefault': boolean;
  'ifNode': SchemaGraphNodeInterface | undefined;
  'inverseFunctional': boolean;
  'inverseOf': string | undefined;
  'iriRef': boolean;
  'irreflexive': boolean;
  'itemsNode': SchemaGraphNodeInterface | undefined;
  'jtConfig': JtConfigType | undefined;
  'jtFrozen': boolean;
  'jtStrict': boolean | undefined;
  'language': string | undefined;
  'maxContains': number | undefined;
  'maximum': number | undefined;
  'maxItems': number | undefined;
  'maxLength': number | undefined;
  'maxProperties': number | undefined;
  'minContains': number | undefined;
  'minimum': number | undefined;
  'minItems': number | undefined;
  'minLength': number | undefined;
  'minProperties': number | undefined;
  'multipleOf': number | undefined;
  'oneOf': SchemaGraphNodeInterface[];
  'pattern': string | undefined;
  'patternPropertyEntries': Array<[string, SchemaGraphNodeInterface]>;
  'prefixItems': SchemaGraphNodeInterface[];
  'properties': ReadonlyMap<string, SchemaGraphNodeInterface>;
  'propertyNamesNode': SchemaGraphNodeInterface | undefined;
  'rdfsDomain': string | undefined;
  'rdfsRange': string | undefined;
  'readOnly': boolean;
  'recursiveAnchor': boolean;
  'recursiveRef': string | undefined;
  'ref': string | undefined;
  'reflexive': boolean;
  'refTargetNode': SchemaGraphNodeInterface | undefined;
  'required': string[];
  'restrictions': readonly RawRestrictionDescriptorType[];
  'schemaAnchor': string | undefined;
  'schemaDialect': string | undefined;
  'schemaId': string | undefined;
  'schemaTypes': string[];
  'schemaVocabulary': unknown;
  'symmetric': boolean;
  'thenNode': SchemaGraphNodeInterface | undefined;
  'title': string | undefined;
  'transitive': boolean;
  'unevaluatedItemsNode': SchemaGraphNodeInterface | undefined;
  'unevaluatedPropertiesNode': SchemaGraphNodeInterface | undefined;
  'uniqueItems': boolean;
  'writeOnly': boolean;
}

export interface SchemaGraphRelationInterface {
  /**
   * XSD datatype IRI when `target` is a Literal — empty / undefined for
   * NamedNode or BlankNode targets. Populated by the quad-backed graph from
   * the source quad's `object.datatype.value`; the forward-projection graph
   * leaves it undefined because datatype is computed at projection time.
   */
  readonly 'datatype'?: string;
  /**
   * BCP47 language tag when `target` is a language-tagged Literal — empty /
   * undefined otherwise. Populated by the quad-backed graph from the source
   * quad's `object.language`.
   */
  readonly 'language'?: string;
  'metadata'?: Record<string, unknown>;
  'predicate': RelationPredicateType;
  'source': SchemaGraphNodeInterface;
  'structure'?: RelationStructure;
  'target': SchemaGraphNodeInterface | string;
  /**
   * rdf/js term-type discriminator for the relation's target. Populated by
   * the quad-backed graph during construction; left undefined by the
   * forward-projection graph (whose targets are always graph nodes or IRIs).
   */
  readonly 'termType'?: 'BlankNode' | 'Literal' | 'NamedNode';
}

export interface StructureWarningInterface {
  'message': string;
  'path': string;
  'rule': string;
}

export { type ListItemType } from '../types/SchemaGraph.js';
