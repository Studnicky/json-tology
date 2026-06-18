import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectPropertyArgsType } from './ProjectPropertyArgsType.js';

/** Arguments for projectStringValue / projectNumberValue — shared scalar value context. */
export type ProjectScalarValueArgsType = {
  readonly 'instanceIri': string;
  readonly 'path': string;
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeType;
  readonly 'propertySemantics': ProjectPropertyArgsType['propertySemantics'];
  readonly 'quadOpts': QuadFactoryQuadOptsType;
  readonly 'quads': QuadInterface[];
};
