import type { ReferenceTargetInterface } from './ReferenceTargetInterface.js';

/** Map from property name to effective lift property (graph+node). */
export interface EffectivePropertyMapInterface extends Map<string, ReferenceTargetInterface> {}
