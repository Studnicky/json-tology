import type { GraphEngineOptionsType } from '../types/GraphEngine.js';

export type EffectiveOptionsType = Pick<GraphEngineOptionsType, 'lookupGraph' | 'lookupSchema'> & Required<Omit<GraphEngineOptionsType, 'formatRegistry' | 'keywords' | 'lookupGraph' | 'lookupSchema'>>;
