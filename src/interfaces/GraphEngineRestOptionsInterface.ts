import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { AllowAdditionalPropertiesFlagEntity } from '../entities/AllowAdditionalPropertiesFlagEntity.js';
import type { ApplyDefaultsFlagEntity } from '../entities/ApplyDefaultsFlagEntity.js';
import type { CastTypesFlagEntity } from '../entities/CastTypesFlagEntity.js';
import type { CollectErrorsFlagEntity } from '../entities/CollectErrorsFlagEntity.js';
import type { EnforceSchemaPropertiesFlagEntity } from '../entities/EnforceSchemaPropertiesFlagEntity.js';
import type { MaterializeContainersFlagEntity } from '../entities/MaterializeContainersFlagEntity.js';
import type { MaximumSchemaDepthValueEntity } from '../entities/MaximumSchemaDepthValueEntity.js';
import type { RemoveAdditionalPropertiesFlagEntity } from '../entities/RemoveAdditionalPropertiesFlagEntity.js';
import type { SynthesizeDefaultsFlagEntity } from '../entities/SynthesizeDefaultsFlagEntity.js';

export interface GraphEngineRestOptionsInterface {
  'allowAdditionalProperties'?: AllowAdditionalPropertiesFlagEntity.Type;
  'applyDefaults'?: ApplyDefaultsFlagEntity.Type;
  'castTypes'?: CastTypesFlagEntity.Type;
  'collectErrors'?: CollectErrorsFlagEntity.Type;
  'enforceSchemaProperties'?: EnforceSchemaPropertiesFlagEntity.Type;
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: (schemaId: string) => Record<string, unknown> | undefined;
  'materializeContainers'?: MaterializeContainersFlagEntity.Type;
  'maxSchemaDepth'?: MaximumSchemaDepthValueEntity.Type;
  'removeAdditionalProperties'?: RemoveAdditionalPropertiesFlagEntity.Type;
  'synthesizeDefaults'?: SynthesizeDefaultsFlagEntity.Type;
}
