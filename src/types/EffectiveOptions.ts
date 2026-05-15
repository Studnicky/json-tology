import type { GraphEngineOptionsInterface } from '../interfaces/GraphEngine.js';

export type EffectiveOptionsType = Pick<GraphEngineOptionsInterface, 'lookupGraph' | 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupGraph' | 'lookupSchema'>>;
