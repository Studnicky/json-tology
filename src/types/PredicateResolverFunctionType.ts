import type { JsonSchemaType } from './Schema.js';

export type PredicateResolverFunctionType = (context: {
  readonly 'classId': string;
  readonly 'propertyName': string;
  readonly 'propertySchema': JsonSchemaType;
}) => string;
