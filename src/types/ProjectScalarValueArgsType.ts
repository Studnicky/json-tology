import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectPropertyArgsType } from './ProjectPropertyArgsType.js';

/** Arguments for projectStringValue / projectNumberValue — shared scalar value context. */
export type ProjectScalarValueArgsType = {
  'instanceIri': string;
  'path': string;
  'propertyIri': string;
  'propertyNode': SchemaGraphNodeType;
  'propertySemantics': ProjectPropertyArgsType['propertySemantics'];
  'quadOpts': QuadFactoryQuadOptsType;
  'quads': QuadInterface[];
};
