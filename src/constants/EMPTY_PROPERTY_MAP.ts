import type { PropertyMapType } from '../types/SchemaGraphSupport.js';

/** Canonical frozen-empty PropertyMapType, shared wherever a schema node has no properties. */
export const EMPTY_PROPERTY_MAP: PropertyMapType = new Map();
