import type { AboxOptionsInterface } from './AboxOptionsInterface.js';
import type { BaseIriValueEntity } from '../entities/BaseIriValueEntity.js';
import type { SynthesizeDefaultsFlagEntity } from '../entities/SynthesizeDefaultsFlagEntity.js';

/** Options accepted by {@link MaterializerInterface.run}. */
export interface MaterializerRunOptionsInterface {
  /** Overrides passed through to ABox projection when baseIri is set. */
  'aboxOptions'?: AboxOptionsInterface;
  'baseIri'?: BaseIriValueEntity.Type;
  'synthesizeDefaults'?: SynthesizeDefaultsFlagEntity.Type;
}
