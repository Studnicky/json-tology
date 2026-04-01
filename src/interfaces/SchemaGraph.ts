import type {
  RelationPredicateType, RelationStructure
} from '../types/SchemaGraph.js';
import type { JsonSchemaType } from '../types/Schema.js';

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
  'allOf': SchemaGraphNodeInterface[];
  'anyOf': SchemaGraphNodeInterface[];
  'comment': string | undefined;
  'complementNode': SchemaGraphNodeInterface | undefined;
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
  'hasConst': boolean;
  'hasDefault': boolean;
  'ifNode': SchemaGraphNodeInterface | undefined;
  'inverseOf': string | undefined;
  'itemsNode': SchemaGraphNodeInterface | undefined;
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
  'properties': Map<string, SchemaGraphNodeInterface>;
  'propertyNamesNode': SchemaGraphNodeInterface | undefined;
  'rdfsDomain': string | undefined;
  'rdfsRange': string | undefined;
  'readOnly': boolean;
  'recursiveAnchor': boolean;
  'recursiveRef': string | undefined;
  'ref': string | undefined;
  'refTargetNode': SchemaGraphNodeInterface | undefined;
  'required': string[];
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
  'metadata'?: Record<string, unknown>;
  'predicate': RelationPredicateType;
  'source': SchemaGraphNodeInterface;
  'structure'?: RelationStructure;
  'target': SchemaGraphNodeInterface | string;
}

export interface StructureWarningInterface {
  'message': string;
  'path': string;
  'rule': string;
}
