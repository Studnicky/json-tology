import type { QuadFactoryQuadOptionsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { ProjectPropertyArgumentListType } from './ProjectPropertyArgumentListType.js';

/** Arguments for projectStringValue / projectNumberValue — shared scalar value context. */
export type ProjectScalarValueArgumentListType = {
  'instanceIri': string;
  'path': string;
  'propertyIri': string;
  'propertyNode': SchemaGraphNodeType;
  'propertySemantics': ProjectPropertyArgumentListType['propertySemantics'];
  'quadOptions': QuadFactoryQuadOptionsType;
  'quads': QuadInterface[];
};
