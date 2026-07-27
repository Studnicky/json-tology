import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { QuadOptionsInterface } from './QuadOptionsInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { ProjectPropertyArgumentListInterface } from './ProjectPropertyArgumentListInterface.js';
import type { InstanceIriValueEntity } from '../entities/InstanceIriValueEntity.js';
import type { PathValueEntity } from '../entities/PathValueEntity.js';
import type { PropertyIriValueEntity } from '../entities/PropertyIriValueEntity.js';

/** Arguments for projectStringValue / projectNumberValue — shared scalar value context. */
export interface ProjectScalarValueArgumentListInterface {
  'instanceIri': InstanceIriValueEntity.Type;
  'path': PathValueEntity.Type;
  'propertyIri': PropertyIriValueEntity.Type;
  'propertyNode': SchemaGraphNodeInterface;
  'propertySemantics': ProjectPropertyArgumentListInterface['propertySemantics'];
  'quadOptions': QuadOptionsInterface;
  'quads': QuadInterface[];
}
