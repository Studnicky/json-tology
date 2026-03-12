type JsonSchemaType = boolean | Record<string, unknown>;

export interface SchemaGraphNodeInterface {
  'id': string;
  'pointer': string;
  'schema': JsonSchemaType;
}

export interface SchemaGraphSemanticsInterface {
  'allOf': SchemaGraphNodeInterface[];
  'anyOf': SchemaGraphNodeInterface[];
  'containsNode': SchemaGraphNodeInterface | undefined;
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, SchemaGraphNodeInterface]>;
  'dynamicAnchor': string | undefined;
  'dynamicRef': string | undefined;
  'elseNode': SchemaGraphNodeInterface | undefined;
  'ifNode': SchemaGraphNodeInterface | undefined;
  'itemsNode': SchemaGraphNodeInterface | undefined;
  'oneOf': SchemaGraphNodeInterface[];
  'patternPropertyEntries': Array<[string, SchemaGraphNodeInterface]>;
  'prefixItems': SchemaGraphNodeInterface[];
  'properties': Array<[string, SchemaGraphNodeInterface]>;
  'propertyNamesNode': SchemaGraphNodeInterface | undefined;
  'ref': string | undefined;
  'refTargetNode': SchemaGraphNodeInterface | undefined;
  'required': string[];
  'schemaTypes': string[];
  'thenNode': SchemaGraphNodeInterface | undefined;
  'unevaluatedItemsNode': SchemaGraphNodeInterface | undefined;
  'unevaluatedPropertiesNode': SchemaGraphNodeInterface | undefined;
  'title': string | undefined;
  'description': string | undefined;
  'format': string | undefined;
  'defaultValue': unknown;
  'hasDefault': boolean;
  'constValue': unknown;
  'hasConst': boolean;
  'enumValues': unknown[] | undefined;
  'minimum': number | undefined;
  'maximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'exclusiveMaximum': number | undefined;
  'multipleOf': number | undefined;
  'minLength': number | undefined;
  'maxLength': number | undefined;
  'pattern': string | undefined;
  'minItems': number | undefined;
  'maxItems': number | undefined;
  'uniqueItems': boolean;
  'minProperties': number | undefined;
  'maxProperties': number | undefined;
  'additionalPropertiesNode': SchemaGraphNodeInterface | boolean | undefined;
  'notNode': SchemaGraphNodeInterface | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'readOnly': boolean;
  'writeOnly': boolean;
  'deprecated': boolean;
  'rdfsDomain': string | undefined;
  'rdfsRange': string | undefined;
  'disjointWith': string | undefined;
  'equivalentTo': string | undefined;
  'inverseOf': string | undefined;
  'transitive': boolean;
  'symmetric': boolean;
}

export type RelationPredicateType =
  | 'rdfs:domain'
  | 'rdfs:range'
  | 'rdfs:subClassOf'
  | 'rdfs:label'
  | 'rdfs:comment'
  | 'owl:equivalentClass'
  | 'owl:complementOf'
  | 'owl:disjointWith'
  | 'owl:inverseOf'
  | 'owl:TransitiveProperty'
  | 'owl:SymmetricProperty'
  | 'owl:deprecated'
  | 'owl:Restriction'
  | 'owl:oneOf';

export interface SchemaGraphRelationInterface {
  predicate: RelationPredicateType;
  source: SchemaGraphNodeInterface;
  target: SchemaGraphNodeInterface | string;
  metadata?: Record<string, unknown>;
}

export interface StructureWarningInterface {
  path: string;
  rule: string;
  message: string;
}
