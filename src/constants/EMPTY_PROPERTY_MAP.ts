import type { PropertyMapInterface } from '../interfaces/PropertyMapInterface.js';

/** Canonical frozen-empty PropertyMapInterface, shared wherever a schema node has no properties. */
export const EMPTY_PROPERTY_MAP: PropertyMapInterface = new Map();
