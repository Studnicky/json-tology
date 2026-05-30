import type { JsonSchemaType } from './Schema.js';

export type PredicateResolverFnType = (ctx: {
  readonly 'classId': string;
  readonly 'propertyName': string;
  readonly 'propertySchema': JsonSchemaType;
}) => string;
