import type { QuadFactoryQuadOptsInterface } from './QuadFactoryOpts.js';
import type { QuadInterface } from './Quad.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { ProjectPropertyArgs } from './Projection.js';

/** Arguments for projectStringValue / projectNumberValue — shared scalar value context. */
export interface ProjectScalarValueArgsInterface {
  readonly 'instanceIri': string;
  readonly 'path': string;
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeInterface;
  readonly 'propertySemantics': ProjectPropertyArgs['propertySemantics'];
  readonly 'quadOpts': QuadFactoryQuadOptsInterface;
  readonly 'quads': QuadInterface[];
}
