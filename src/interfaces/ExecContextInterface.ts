import type { DynamicScopeEntryInterface } from '../interfaces/DynamicScopeEntryInterface.js';
import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';
import type { ApplyDefaultsFlagEntity } from '../entities/ApplyDefaultsFlagEntity.js';
import type { CollectErrorsFlagEntity } from '../entities/CollectErrorsFlagEntity.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';

export interface ExecContextInterface {
  'applyDefaults': ApplyDefaultsFlagEntity.Type;
  'coerce': BooleanValueEntity.Type;
  'collectErrors': CollectErrorsFlagEntity.Type;
  'depth': NumberValueEntity.Type;
  'dynamicScope': DynamicScopeEntryInterface[];
  'errors': ValidationErrorEntity.Type[];
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'ignoreAdditionalProperties': BooleanValueEntity.Type;
  'maxDepth': NumberValueEntity.Type;
  'refStack': Set<string>;
  'stripUnknown': BooleanValueEntity.Type;
  'synthesizeDefaults': BooleanValueEntity.Type;
  /** Whether evaluated properties/items are accumulated (required only for `unevaluated*`). */
  'trackEvaluated': BooleanValueEntity.Type;
}
