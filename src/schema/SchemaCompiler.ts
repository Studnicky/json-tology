/**
 * Schema Compiler — Phases 6.2-6.5
 *
 * Compiles JSON Schema into optimized closure validators. Each schema node
 * becomes a captured closure with all constants pre-resolved. Falls back to
 * GraphEngine for unsupported constructs.
 */

import type { ValidationError } from '../interfaces/validation.js';
import type { GraphEngine } from './GraphEngine.js';
import type { FormatRegistry } from './FormatRegistry.js';

// FormatRegistry type is used in method signatures for the compiled validators

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface CompiledValidationResult {
  'errors': ValidationError[];
  'valid': boolean;
  'value': unknown;
}

export interface CompiledValidator {
  'check': (data: unknown) => boolean;
  /** True if this is a real compiled validator (not engine fallback) */
  'compiled': boolean;
  'validate': (data: unknown, options?: CompiledValidateOptions) => CompiledValidationResult;
}

export interface CompiledValidateOptions {
  'applyDefaults'?: boolean;
  'coerce'?: boolean;
  'collectErrors'?: boolean;
  'removeAdditional'?: boolean;
  'stripUnknownProperties'?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type CheckFn = (value: unknown) => boolean;

type JsonSchema = boolean | Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }

    return true;
  }

  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }

  return false;
}

function jsonSortedKeys(value: unknown): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      sorted[key] = (value as Record<string, unknown>)[key];
    }

    return JSON.stringify(sorted, (_k, v) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const s: Record<string, unknown> = {};

        for (const k2 of Object.keys(v).sort()) {
          s[k2] = v[k2];
        }

        return s;
      }

      return v;
    });
  }

  return JSON.stringify(value);
}

function makeError(
  path: string,
  keyword: string,
  message: string,
  params: Record<string, unknown> = {}
): ValidationError {
  return { keyword, message, params, path };
}

function coerceValue(types: string[], value: unknown): unknown {
  if (value === undefined || value === null) return value;

  for (const type of types) {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') return String(value);
        break;
      case 'number':
      case 'integer': {
        if (typeof value === 'string') {
          const n = Number(value);

          if (!Number.isNaN(n)) return type === 'integer' ? Math.trunc(n) : n;
        }
        if (typeof value === 'boolean') return value ? 1 : 0;
        break;
      }
      case 'boolean':
        if (value === 'true' || value === '1' || value === 1) return true;
        if (value === 'false' || value === '0' || value === 0) return false;
        break;
      case 'null':
        if (value === '' || value === 'null') return null;
        break;
      case 'array':
        if (!Array.isArray(value) && typeof value !== 'object') return [value];
        break;
    }
  }

  return value;
}

// ---------------------------------------------------------------------------
// SchemaCompiler
// ---------------------------------------------------------------------------

export class SchemaCompiler {
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidator | undefined) | undefined;

  public constructor(options?: {
    'lookupCompiled'?: (schemaId: string) => CompiledValidator | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
  }

  public compile(engine: GraphEngine): CompiledValidator {
    const rootSchema = engine.rootSchema;

    if (typeof rootSchema === 'boolean') {
      return this.compileBooleanSchema(rootSchema, engine);
    }

    const schema = rootSchema as Record<string, unknown>;
    const formatRegistry = engine.formatRegistry;
    const lookupSchema = engine.schemaLookup();

    // Check for unsupported features that require engine fallback
    if (engine.hasCustomKeywords() || this.needsEngineFallback(schema, lookupSchema)) {
      return this.engineFallback(engine);
    }

    try {
      const checkFn = this.compileCheck(schema, formatRegistry, lookupSchema);
      const validateFn = this.compileValidate(schema, formatRegistry, lookupSchema);

      return {
        'check': checkFn,
        'compiled': true,
        'validate': (data: unknown, options?: CompiledValidateOptions): CompiledValidationResult => {
          if (options?.applyDefaults || options?.coerce || options?.stripUnknownProperties || options?.removeAdditional) {
            // Use the full validate path for mutation modes
            const result = validateFn(data, options);

            return result;
          }
          // Fast validate path — just check + collect errors
          if (options?.collectErrors === false) {
            return { 'errors': [], 'valid': checkFn(data), 'value': data };
          }

          const errors: ValidationError[] = [];
          const result = this.compileValidateWithErrors(schema, formatRegistry, lookupSchema)(
            data, '', errors, true, false, false, false
          );

          return { errors, 'valid': result.valid, 'value': result.value };
        }
      };
    } catch {
      // Fallback to engine if compilation fails
      return this.engineFallback(engine);
    }
  }

  private compileBooleanSchema(schema: boolean, _engine: GraphEngine): CompiledValidator {
    if (schema) {
      return {
        'check': () => true,
        'compiled': true,
        'validate': (_data, _options) => ({ 'errors': [], 'valid': true, 'value': _data })
      };
    }

    return {
      'check': () => false,
      'compiled': true,
      'validate': (_data, _options) => ({
        'errors': [makeError('', 'falseSchema', 'must not match false schema')],
        'valid': false,
        'value': _data
      })
    };
  }

  private engineFallback(engine: GraphEngine): CompiledValidator {
    return {
      'compiled': false,
      'check': (data: unknown): boolean => {
        return engine.execute(data, '', { 'collectErrors': false }).valid;
      },
      'validate': (data: unknown, options?: CompiledValidateOptions): CompiledValidationResult => {
        const result = engine.execute(data, '', {
          'applyDefaults': options?.applyDefaults ?? false,
          'coerce': options?.coerce ?? false,
          'collectErrors': options?.collectErrors ?? true,
          'removeAdditional': options?.removeAdditional ?? false,
          'stripUnknownProperties': options?.stripUnknownProperties ?? false
        });

        return { 'errors': result.errors, 'valid': result.valid, 'value': result.value };
      }
    };
  }

  // ---------------------------------------------------------------------------
  // check() compilation — fast boolean path
  // ---------------------------------------------------------------------------

  private compileCheck(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFn {
    // Try fast-path for simple typed objects
    const fastPath = this.tryCompileFlatObjectCheck(schema, formatRegistry, lookupSchema);

    if (fastPath !== undefined) return fastPath;

    const checks: CheckFn[] = [];

    // Type check
    const types = this.extractTypes(schema);

    if (types.length > 0) {
      checks.push(this.compileTypeCheck(types));
    }

    // Const
    if ('const' in schema) {
      const constVal = schema['const'];

      if (constVal === null || typeof constVal === 'string' || typeof constVal === 'number' || typeof constVal === 'boolean') {
        checks.push((v) => v === constVal);
      } else {
        checks.push((v) => deepEqual(v, constVal));
      }
    }

    // Enum
    const enumValues = schema['enum'];

    if (Array.isArray(enumValues)) {
      const allPrimitive = enumValues.every((v) =>
        v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      );

      if (allPrimitive) {
        const enumSet = new Set(enumValues as (string | number | boolean | null)[]);

        checks.push((v) => enumSet.has(v as string | number | boolean | null));
      } else {
        checks.push((v) => enumValues.some((e) => deepEqual(e, v)));
      }
    }

    // String constraints
    const minLength = schema['minLength'] as number | undefined;
    const maxLength = schema['maxLength'] as number | undefined;
    const pattern = schema['pattern'] as string | undefined;
    const format = schema['format'] as string | undefined;

    if (minLength !== undefined || maxLength !== undefined || pattern !== undefined || format !== undefined) {
      const stringCheck = this.compileStringCheck(minLength, maxLength, pattern, format, formatRegistry, schema);

      if (stringCheck !== undefined) {
        checks.push(stringCheck);
      }
    }

    // Numeric constraints
    const minimum = schema['minimum'] as number | undefined;
    const maximum = schema['maximum'] as number | undefined;
    const exclusiveMinimum = schema['exclusiveMinimum'] as number | undefined;
    const exclusiveMaximum = schema['exclusiveMaximum'] as number | undefined;
    const multipleOf = schema['multipleOf'] as number | undefined;

    if (minimum !== undefined || maximum !== undefined || exclusiveMinimum !== undefined ||
        exclusiveMaximum !== undefined || multipleOf !== undefined) {
      const numCheck = this.compileNumberCheck(minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf);

      if (numCheck !== undefined) {
        checks.push(numCheck);
      }
    }

    // $ref
    const ref = schema['$ref'] as string | undefined;

    if (typeof ref === 'string') {
      const refCheck = this.compileRefCheck(ref, formatRegistry, lookupSchema);

      if (refCheck !== undefined) {
        checks.push(refCheck);
      }
    }

    // Object constraints
    if (schema['type'] === 'object' || schema['properties'] !== undefined || schema['required'] !== undefined) {
      const objCheck = this.compileObjectCheck(schema, formatRegistry, lookupSchema);

      if (objCheck !== undefined) {
        checks.push(objCheck);
      }
    }

    // Array constraints
    if (schema['type'] === 'array' || schema['items'] !== undefined || schema['prefixItems'] !== undefined) {
      const arrCheck = this.compileArrayCheck(schema, formatRegistry, lookupSchema);

      if (arrCheck !== undefined) {
        checks.push(arrCheck);
      }
    }

    // allOf
    const allOf = schema['allOf'];

    if (Array.isArray(allOf) && allOf.length > 0) {
      const allOfChecks = (allOf as JsonSchema[]).map((s) => {
        if (typeof s === 'boolean') return s ? () => true : () => false;

        return this.compileCheck(s as Record<string, unknown>, formatRegistry, lookupSchema);
      });

      checks.push((v) => allOfChecks.every((c) => c(v)));
    }

    // anyOf
    const anyOf = schema['anyOf'];

    if (Array.isArray(anyOf) && anyOf.length > 0) {
      const anyOfChecks = (anyOf as JsonSchema[]).map((s) => {
        if (typeof s === 'boolean') return s ? () => true : () => false;

        return this.compileCheck(s as Record<string, unknown>, formatRegistry, lookupSchema);
      });

      checks.push((v) => anyOfChecks.some((c) => c(v)));
    }

    // oneOf
    const oneOf = schema['oneOf'];

    if (Array.isArray(oneOf) && oneOf.length > 0) {
      const oneOfChecks = (oneOf as JsonSchema[]).map((s) => {
        if (typeof s === 'boolean') return s ? () => true : () => false;

        return this.compileCheck(s as Record<string, unknown>, formatRegistry, lookupSchema);
      });

      checks.push((v) => {
        let count = 0;

        for (const c of oneOfChecks) {
          if (c(v)) {
            count++;
            if (count > 1) return false;
          }
        }

        return count === 1;
      });
    }

    // not
    const notSchema = schema['not'];

    if (notSchema !== undefined) {
      if (typeof notSchema === 'boolean') {
        checks.push(notSchema ? () => false : () => true);
      } else if (isRecord(notSchema)) {
        const notCheck = this.compileCheck(notSchema, formatRegistry, lookupSchema);

        checks.push((v) => !notCheck(v));
      }
    }

    // if/then/else
    const ifSchema = schema['if'];

    if (ifSchema !== undefined && isRecord(ifSchema)) {
      const ifCheck = this.compileCheck(ifSchema, formatRegistry, lookupSchema);
      const thenSchema = schema['then'];
      const elseSchema = schema['else'];
      const thenCheck = thenSchema !== undefined && isRecord(thenSchema)
        ? this.compileCheck(thenSchema, formatRegistry, lookupSchema) : undefined;
      const elseCheck = elseSchema !== undefined && isRecord(elseSchema)
        ? this.compileCheck(elseSchema, formatRegistry, lookupSchema) : undefined;

      checks.push((v) => {
        if (ifCheck(v)) {
          return thenCheck === undefined || thenCheck(v);
        }

        return elseCheck === undefined || elseCheck(v);
      });
    }

    // Combine all checks
    if (checks.length === 0) return () => true;
    if (checks.length === 1) return checks[0];

    return (v) => {
      for (const check of checks) {
        if (!check(v)) return false;
      }

      return true;
    };
  }

  private compileTypeCheck(types: string[]): CheckFn {
    if (types.length === 1) {
      switch (types[0]) {
        case 'string': return (v) => typeof v === 'string';
        case 'number': return (v) => typeof v === 'number';
        case 'integer': return (v) => typeof v === 'number' && Number.isInteger(v);
        case 'boolean': return (v) => typeof v === 'boolean';
        case 'null': return (v) => v === null;
        case 'array': return (v) => Array.isArray(v);
        case 'object': return (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
      }
    }

    const typeSet = new Set(types);
    const hasNull = typeSet.has('null');
    const hasInteger = typeSet.has('integer');

    return (v) => {
      if (v === null) return hasNull;
      if (Array.isArray(v)) return typeSet.has('array');
      const t = typeof v;

      if (t === 'number') return typeSet.has('number') || (hasInteger && Number.isInteger(v));

      return typeSet.has(t);
    };
  }

  private compileStringCheck(
    minLength: number | undefined,
    maxLength: number | undefined,
    pattern: string | undefined,
    format: string | undefined,
    formatRegistry: FormatRegistry,
    schema: Record<string, unknown>
  ): CheckFn | undefined {
    const checks: Array<(v: string) => boolean> = [];

    if (minLength !== undefined) {
      checks.push((v) => [...v].length >= minLength);
    }
    if (maxLength !== undefined) {
      checks.push((v) => [...v].length <= maxLength);
    }
    if (pattern !== undefined) {
      const regex = new RegExp(pattern, 'u');

      checks.push((v) => regex.test(v));
    }
    // Format check is separate — it may apply to non-string types (e.g. int32, float)
    let formatCheck: CheckFn | undefined;

    if (format !== undefined) {
      const hasFormatAssertion = this.hasFormatAssertions(schema);

      if (hasFormatAssertion) {
        const formatValidator = formatRegistry.get(format);

        if (formatValidator !== undefined) {
          formatCheck = (v) => formatValidator(v);
        }
      }
    }

    if (checks.length === 0 && formatCheck === undefined) return undefined;

    // If only format check and no string checks, return format check directly
    // (it handles its own type checking)
    if (checks.length === 0 && formatCheck !== undefined) return formatCheck;

    const stringChecks = [...checks];

    return (v) => {
      if (typeof v === 'string') {
        for (const check of stringChecks) {
          if (!check(v)) return false;
        }
      }

      if (formatCheck !== undefined && !formatCheck(v)) return false;

      return true;
    };
  }

  private compileNumberCheck(
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ): CheckFn | undefined {
    const checks: Array<(v: number) => boolean> = [];

    if (minimum !== undefined) checks.push((v) => v >= minimum);
    if (maximum !== undefined) checks.push((v) => v <= maximum);
    if (exclusiveMinimum !== undefined) checks.push((v) => v > exclusiveMinimum);
    if (exclusiveMaximum !== undefined) checks.push((v) => v < exclusiveMaximum);
    if (multipleOf !== undefined) checks.push((v) => v % multipleOf === 0);

    if (checks.length === 0) return undefined;

    return (v) => {
      if (typeof v !== 'number') return true;

      for (const check of checks) {
        if (!check(v)) return false;
      }

      return true;
    };
  }

  private compileRefCheck(
    ref: string,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFn | undefined {
    // Try to get compiled validator from registry
    if (this.lookupCompiled !== undefined) {
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
      const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

      if (fragment === '' || fragment === '/') {
        // Simple ref — use compiled validator
        return (v) => {
          const compiled = this.lookupCompiled!(schemaId);

          return compiled !== undefined ? compiled.check(v) : true;
        };
      }
    }

    // Fallback: resolve ref through lookupSchema and compile inline
    if (lookupSchema !== undefined) {
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);

      if (hashIndex === -1 || ref.slice(hashIndex + 1) === '' || ref.slice(hashIndex + 1) === '/') {
        const refSchema = lookupSchema(schemaId);

        if (refSchema !== undefined) {
          // Lazy compilation to handle circular refs
          let cachedCheck: CheckFn | undefined;

          return (v) => {
            if (cachedCheck === undefined) {
              cachedCheck = this.compileCheck(refSchema, formatRegistry, lookupSchema);
            }

            return cachedCheck(v);
          };
        }
      }
    }

    return undefined;
  }

  private compileObjectCheck(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFn | undefined {
    const properties = schema['properties'] as Record<string, JsonSchema> | undefined;
    const required = schema['required'] as string[] | undefined;
    const additionalProperties = schema['additionalProperties'];
    const minProperties = schema['minProperties'] as number | undefined;
    const maxProperties = schema['maxProperties'] as number | undefined;

    // Compile property validators
    const propValidators = new Map<string, CheckFn>();

    if (properties !== undefined) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (typeof propSchema === 'boolean') {
          if (!propSchema) {
            propValidators.set(key, () => false);
          }
        } else if (isRecord(propSchema)) {
          propValidators.set(key, this.compileCheck(propSchema, formatRegistry, lookupSchema));
        }
      }
    }

    // Build allowed keys set for additionalProperties: false
    const allowedKeys = properties !== undefined ? new Set(Object.keys(properties)) : undefined;

    // Pattern properties
    const patternProperties = schema['patternProperties'] as Record<string, JsonSchema> | undefined;
    let patternChecks: Array<{ 'check': CheckFn; 'regex': RegExp }> | undefined;

    if (patternProperties !== undefined) {
      patternChecks = [];

      for (const [pat, patSchema] of Object.entries(patternProperties)) {
        const regex = new RegExp(pat, 'u');
        const check = typeof patSchema === 'boolean'
          ? (patSchema ? () => true : () => false)
          : this.compileCheck(patSchema as Record<string, unknown>, formatRegistry, lookupSchema);

        patternChecks.push({ check, regex });
      }
    }

    // Additional properties validator
    let additionalCheck: CheckFn | undefined;

    if (additionalProperties !== undefined && additionalProperties !== true && isRecord(additionalProperties)) {
      additionalCheck = this.compileCheck(additionalProperties, formatRegistry, lookupSchema);
    }

    return (v) => {
      if (!isRecord(v)) return true; // type check handles this

      // Required check
      if (required !== undefined) {
        for (const key of required) {
          if (!(key in v)) return false;
        }
      }

      // Min/max properties
      if (minProperties !== undefined || maxProperties !== undefined) {
        const count = Object.keys(v).length;

        if (minProperties !== undefined && count < minProperties) return false;
        if (maxProperties !== undefined && count > maxProperties) return false;
      }

      // Property validation
      for (const key of Object.keys(v)) {
        const propCheck = propValidators.get(key);

        if (propCheck !== undefined) {
          if (!propCheck(v[key])) return false;
          continue;
        }

        // Check pattern properties
        if (patternChecks !== undefined) {
          let matchedPattern = false;

          for (const pc of patternChecks) {
            if (pc.regex.test(key)) {
              matchedPattern = true;
              if (!pc.check(v[key])) return false;
            }
          }
          if (matchedPattern) continue;
        }

        // Additional properties
        if (additionalProperties === false) {
          if (allowedKeys !== undefined && !allowedKeys.has(key)) return false;
        } else if (additionalCheck !== undefined) {
          if (!additionalCheck(v[key])) return false;
        }
      }

      return true;
    };
  }

  private compileArrayCheck(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFn | undefined {
    const minItems = schema['minItems'] as number | undefined;
    const maxItems = schema['maxItems'] as number | undefined;
    const uniqueItems = schema['uniqueItems'] === true;
    const itemsSchema = schema['items'] as JsonSchema | undefined;
    const prefixItems = schema['prefixItems'] as JsonSchema[] | undefined;

    let itemCheck: CheckFn | undefined;

    if (itemsSchema !== undefined && typeof itemsSchema !== 'boolean' && isRecord(itemsSchema)) {
      itemCheck = this.compileCheck(itemsSchema, formatRegistry, lookupSchema);
    } else if (itemsSchema === false) {
      itemCheck = () => false;
    }

    let prefixChecks: CheckFn[] | undefined;

    if (Array.isArray(prefixItems)) {
      prefixChecks = prefixItems.map((s) => {
        if (typeof s === 'boolean') return s ? () => true : () => false;
        if (isRecord(s)) return this.compileCheck(s, formatRegistry, lookupSchema);

        return () => true;
      });
    }

    // Contains
    const containsSchema = schema['contains'];
    let containsCheck: CheckFn | undefined;

    if (containsSchema !== undefined && isRecord(containsSchema)) {
      containsCheck = this.compileCheck(containsSchema as Record<string, unknown>, formatRegistry, lookupSchema);
    }
    const minContains = schema['minContains'] as number | undefined;
    const maxContains = schema['maxContains'] as number | undefined;

    return (v) => {
      if (!Array.isArray(v)) return true;

      if (minItems !== undefined && v.length < minItems) return false;
      if (maxItems !== undefined && v.length > maxItems) return false;

      if (uniqueItems) {
        const seen = new Set();

        for (const item of v) {
          const key = typeof item === 'object' && item !== null ? jsonSortedKeys(item) : item;

          if (seen.has(key)) return false;
          seen.add(key);
        }
      }

      if (prefixChecks !== undefined) {
        for (let i = 0; i < prefixChecks.length && i < v.length; i++) {
          if (!prefixChecks[i](v[i])) return false;
        }
      }

      if (itemCheck !== undefined) {
        const startIndex = prefixChecks !== undefined ? prefixChecks.length : 0;

        for (let i = startIndex; i < v.length; i++) {
          if (!itemCheck(v[i])) return false;
        }
      }

      if (containsCheck !== undefined) {
        let count = 0;

        for (const item of v) {
          if (containsCheck(item)) count++;
        }
        if (minContains !== undefined && count < minContains) return false;
        if (maxContains !== undefined && count > maxContains) return false;
        if (minContains === undefined && maxContains === undefined && count === 0) return false;
      }

      return true;
    };
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private compileValidate(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): (data: unknown, options?: CompiledValidateOptions) => CompiledValidationResult {
    // For mutation modes (defaults, coerce, strip), we need the full engine path.
    // We'll compile that into a closure that captures the validate-with-errors fn.
    const validateWithErrors = this.compileValidateWithErrors(schema, formatRegistry, lookupSchema);
    const checkFn = this.compileCheck(schema, formatRegistry, lookupSchema);

    return (data: unknown, options?: CompiledValidateOptions): CompiledValidationResult => {
      let workingValue = data;

      // Apply coercion at root level
      if (options?.coerce) {
        const types = this.extractTypes(schema);

        if (types.length > 0) {
          workingValue = coerceValue(types, workingValue);
        }
      }

      // Apply defaults at root level
      if (options?.applyDefaults && workingValue === undefined && 'default' in schema) {
        workingValue = structuredClone(schema['default']);
      }

      // For full mutation modes, delegate to validateWithErrors
      if (options?.applyDefaults || options?.coerce || options?.stripUnknownProperties) {
        const errors: ValidationError[] = [];
        const result = validateWithErrors(
          workingValue, '', errors, options?.collectErrors ?? true,
          options?.applyDefaults ?? false, options?.coerce ?? false,
          options?.stripUnknownProperties ?? false
        );

        return { errors, 'valid': result.valid, 'value': result.value };
      }

      // Fast path — no mutations
      if (options?.collectErrors === false) {
        return { 'errors': [], 'valid': checkFn(workingValue), 'value': workingValue };
      }

      const errors: ValidationError[] = [];
      const result = validateWithErrors(workingValue, '', errors, true, false, false, false);

      return { errors, 'valid': result.valid, 'value': result.value };
    };
  }

  private compileValidateWithErrors(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): (
    value: unknown,
    path: string,
    errors: ValidationError[],
    collectErrors: boolean,
    applyDefaults: boolean,
    doCoerce: boolean,
    stripUnknown: boolean
  ) => { 'valid': boolean; 'value': unknown } {
    const types = this.extractTypes(schema);
    const constVal = 'const' in schema ? schema['const'] : undefined;
    const hasConst = 'const' in schema;
    const enumValues = schema['enum'] as unknown[] | undefined;
    const minLength = schema['minLength'] as number | undefined;
    const maxLength = schema['maxLength'] as number | undefined;
    const pattern = schema['pattern'] as string | undefined;
    const format = schema['format'] as string | undefined;
    const minimum = schema['minimum'] as number | undefined;
    const maximum = schema['maximum'] as number | undefined;
    const exclusiveMinimum = schema['exclusiveMinimum'] as number | undefined;
    const exclusiveMaximum = schema['exclusiveMaximum'] as number | undefined;
    const multipleOf = schema['multipleOf'] as number | undefined;
    const ref = schema['$ref'] as string | undefined;
    const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
    const required = schema['required'] as string[] | undefined;
    const additionalProperties = schema['additionalProperties'];
    const itemsSchema = schema['items'] as JsonSchema | undefined;

    const minItems = schema['minItems'] as number | undefined;
    const maxItems = schema['maxItems'] as number | undefined;
    const uniqueItems = schema['uniqueItems'] === true;
    const defaultValue = 'default' in schema ? schema['default'] : undefined;
    const hasDefault = 'default' in schema;
    const hasFormatAssertion = this.hasFormatAssertions(schema);

    const patternRegex = pattern !== undefined ? new RegExp(pattern, 'u') : undefined;
    const formatValidator = (format !== undefined && hasFormatAssertion)
      ? formatRegistry.get(format) : undefined;

    // Compile property validators
    const propValidators = new Map<string, ReturnType<SchemaCompiler['compileValidateWithErrors']>>();

    if (properties !== undefined) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (isRecord(propSchema)) {
          propValidators.set(key, this.compileValidateWithErrors(propSchema, formatRegistry, lookupSchema));
        }
      }
    }

    const allowedKeys = properties !== undefined ? new Set(Object.keys(properties)) : undefined;

    // Compile $ref validator
    let refValidator: ReturnType<SchemaCompiler['compileValidateWithErrors']> | undefined;

    if (typeof ref === 'string' && lookupSchema !== undefined) {
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
      const refSchema = lookupSchema(schemaId);

      if (refSchema !== undefined) {
        // Lazy to handle circular refs
        let cached: ReturnType<SchemaCompiler['compileValidateWithErrors']> | undefined;
        const self = this;

        refValidator = (v, p, e, c, ad, dc, su) => {
          if (cached === undefined) {
            cached = self.compileValidateWithErrors(refSchema, formatRegistry, lookupSchema);
          }

          return cached(v, p, e, c, ad, dc, su);
        };
      }
    }

    // Compile items validator
    let itemValidator: ReturnType<SchemaCompiler['compileValidateWithErrors']> | undefined;

    if (itemsSchema !== undefined && isRecord(itemsSchema)) {
      itemValidator = this.compileValidateWithErrors(itemsSchema as Record<string, unknown>, formatRegistry, lookupSchema);
    }

    // Compile allOf/anyOf/oneOf
    const allOf = schema['allOf'] as JsonSchema[] | undefined;
    let allOfValidators: Array<ReturnType<SchemaCompiler['compileValidateWithErrors']>> | undefined;

    if (Array.isArray(allOf) && allOf.length > 0) {
      allOfValidators = allOf.map((s) => {
        if (typeof s === 'boolean') {
          return s
            ? (_v: unknown, _p: string, _e: ValidationError[], _c: boolean, _ad: boolean, _dc: boolean, _su: boolean) => ({ 'valid': true, 'value': _v })
            : (v: unknown, p: string, e: ValidationError[], c: boolean) => {
              if (c) e.push(makeError(p, 'falseSchema', 'must not match false schema'));

              return { 'valid': false, 'value': v };
            };
        }

        return this.compileValidateWithErrors(s as Record<string, unknown>, formatRegistry, lookupSchema);
      });
    }

    // Compile not
    const notSchema = schema['not'];
    let notCheck: CheckFn | undefined;

    if (notSchema !== undefined && isRecord(notSchema)) {
      notCheck = this.compileCheck(notSchema, formatRegistry, lookupSchema);
    }

    // Compile if/then/else
    const ifSchema = schema['if'];
    let ifCheck: CheckFn | undefined;
    let thenValidator: ReturnType<SchemaCompiler['compileValidateWithErrors']> | undefined;
    let elseValidator: ReturnType<SchemaCompiler['compileValidateWithErrors']> | undefined;

    if (ifSchema !== undefined && isRecord(ifSchema)) {
      ifCheck = this.compileCheck(ifSchema, formatRegistry, lookupSchema);
      const thenSchema = schema['then'];
      const elseSchema = schema['else'];

      if (thenSchema !== undefined && isRecord(thenSchema)) {
        thenValidator = this.compileValidateWithErrors(thenSchema, formatRegistry, lookupSchema);
      }
      if (elseSchema !== undefined && isRecord(elseSchema)) {
        elseValidator = this.compileValidateWithErrors(elseSchema, formatRegistry, lookupSchema);
      }
    }

    // Enum set for O(1) lookup
    let enumSet: Set<string | number | boolean | null> | undefined;

    if (enumValues !== undefined) {
      const allPrimitive = enumValues.every((ev) =>
        ev === null || typeof ev === 'string' || typeof ev === 'number' || typeof ev === 'boolean'
      );

      if (allPrimitive) {
        enumSet = new Set(enumValues as (string | number | boolean | null)[]);
      }
    }

    return (
      value: unknown,
      path: string,
      errors: ValidationError[],
      collectErrors: boolean,
      applyDefaults: boolean,
      doCoerce: boolean,
      stripUnknown: boolean
    ): { 'valid': boolean; 'value': unknown } => {
      let workingValue = value;

      // Apply defaults
      if (applyDefaults && workingValue === undefined && hasDefault) {
        workingValue = structuredClone(defaultValue);
      }

      // Apply coercion
      if (doCoerce && types.length > 0) {
        workingValue = coerceValue(types, workingValue);
      }

      let valid = true;

      // $ref
      if (refValidator !== undefined) {
        const refResult = refValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

        if (!refResult.valid) {
          if (!collectErrors) return { 'valid': false, 'value': refResult.value };
          valid = false;
        }
        workingValue = refResult.value;
      }

      // Type check
      if (types.length > 0) {
        let typeValid = false;

        for (const t of types) {
          switch (t) {
            case 'string': if (typeof workingValue === 'string') typeValid = true; break;
            case 'number': if (typeof workingValue === 'number') typeValid = true; break;
            case 'integer': if (typeof workingValue === 'number' && Number.isInteger(workingValue)) typeValid = true; break;
            case 'boolean': if (typeof workingValue === 'boolean') typeValid = true; break;
            case 'null': if (workingValue === null) typeValid = true; break;
            case 'array': if (Array.isArray(workingValue)) typeValid = true; break;
            case 'object': if (typeof workingValue === 'object' && workingValue !== null && !Array.isArray(workingValue)) typeValid = true; break;
          }
        }
        if (!typeValid) {
          if (collectErrors) errors.push(makeError(path, 'type', types.length === 1 ? `must be ${types[0]}` : `must be one of: ${types.join(', ')}`, { 'type': types }));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
      }

      // Enum
      if (enumValues !== undefined) {
        const matched = enumSet !== undefined
          ? enumSet.has(workingValue as string | number | boolean | null)
          : enumValues.some((ev) => deepEqual(ev, workingValue));

        if (!matched) {
          if (collectErrors) errors.push(makeError(path, 'enum', 'must be one of the allowed values'));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
      }

      // Const
      if (hasConst && !deepEqual(constVal, workingValue)) {
        if (collectErrors) errors.push(makeError(path, 'const', `must be ${JSON.stringify(constVal)}`));
        if (!collectErrors) return { 'valid': false, 'value': workingValue };
        valid = false;
      }

      // String
      if (typeof workingValue === 'string') {
        const codePointLen = minLength !== undefined || maxLength !== undefined ? [...workingValue].length : 0;

        if (minLength !== undefined && codePointLen < minLength) {
          if (collectErrors) errors.push(makeError(path, 'minLength', `must be at least ${minLength} characters`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (maxLength !== undefined && codePointLen > maxLength) {
          if (collectErrors) errors.push(makeError(path, 'maxLength', `must be at most ${maxLength} characters`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (patternRegex !== undefined && !patternRegex.test(workingValue)) {
          if (collectErrors) errors.push(makeError(path, 'pattern', `must match pattern "${pattern}"`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
      }

      // Format (outside string block — numeric formats like int32, float apply to numbers)
      if (formatValidator !== undefined && !formatValidator(workingValue)) {
        if (collectErrors) errors.push(makeError(path, 'format', `must match format "${format}"`));
        if (!collectErrors) return { 'valid': false, 'value': workingValue };
        valid = false;
      }

      // Number
      if (typeof workingValue === 'number') {
        if (minimum !== undefined && workingValue < minimum) {
          if (collectErrors) errors.push(makeError(path, 'minimum', `must be >= ${minimum}`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (maximum !== undefined && workingValue > maximum) {
          if (collectErrors) errors.push(makeError(path, 'maximum', `must be <= ${maximum}`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (exclusiveMinimum !== undefined && workingValue <= exclusiveMinimum) {
          if (collectErrors) errors.push(makeError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (exclusiveMaximum !== undefined && workingValue >= exclusiveMaximum) {
          if (collectErrors) errors.push(makeError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (multipleOf !== undefined && workingValue % multipleOf !== 0) {
          if (collectErrors) errors.push(makeError(path, 'multipleOf', `must be a multiple of ${multipleOf}`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
      }

      // Object
      if (isRecord(workingValue)) {
        const obj = workingValue as Record<string, unknown>;

        // Apply defaults for missing properties BEFORE required check
        if (applyDefaults && properties !== undefined) {
          for (const [key, propSchema] of Object.entries(properties)) {
            if (!(key in obj) && 'default' in propSchema) {
              obj[key] = structuredClone(propSchema['default']);
            }
          }
        }

        // Required
        if (required !== undefined) {
          for (const key of required) {
            if (!(key in obj)) {
              if (collectErrors) errors.push(makeError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
              if (!collectErrors) return { 'valid': false, 'value': workingValue };
              valid = false;
            }
          }
        }

        // Properties + additionalProperties + strip
        for (const key of Object.keys(obj)) {
          const propValidator = propValidators.get(key);
          const childPath = path === '' ? `/${key}` : `${path}/${key}`;

          if (propValidator !== undefined) {
            // Apply defaults to property if missing
            let propValue = obj[key];

            if (applyDefaults && propValue === undefined && properties !== undefined) {
              const propSchema = properties[key];

              if (propSchema !== undefined && 'default' in propSchema) {
                propValue = structuredClone(propSchema['default']);
                obj[key] = propValue;
              }
            }

            const propResult = propValidator(propValue, childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!propResult.valid) {
              if (!collectErrors) return { 'valid': false, 'value': workingValue };
              valid = false;
            }
            if (propResult.value !== propValue) {
              obj[key] = propResult.value;
            }
          } else if (stripUnknown && allowedKeys !== undefined && !allowedKeys.has(key)) {
            delete obj[key];
          } else if (additionalProperties === false && allowedKeys !== undefined && !allowedKeys.has(key)) {
            if (collectErrors) errors.push(makeError(childPath, 'additionalProperties', `must NOT have additional property '${key}'`));
            if (!collectErrors) return { 'valid': false, 'value': workingValue };
            valid = false;
          }
        }

      }

      // Array
      if (Array.isArray(workingValue)) {
        const arr = workingValue;

        if (minItems !== undefined && arr.length < minItems) {
          if (collectErrors) errors.push(makeError(path, 'minItems', `must have at least ${minItems} items`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (maxItems !== undefined && arr.length > maxItems) {
          if (collectErrors) errors.push(makeError(path, 'maxItems', `must have at most ${maxItems} items`));
          if (!collectErrors) return { 'valid': false, 'value': workingValue };
          valid = false;
        }
        if (uniqueItems) {
          const seen = new Set<unknown>();
          let hasDup = false;

          for (const item of arr) {
            const key = typeof item === 'object' && item !== null ? jsonSortedKeys(item) : item;

            if (seen.has(key)) { hasDup = true; break; }
            seen.add(key);
          }
          if (hasDup) {
            if (collectErrors) errors.push(makeError(path, 'uniqueItems', 'must have unique items'));
            if (!collectErrors) return { 'valid': false, 'value': workingValue };
            valid = false;
          }
        }

        if (itemValidator !== undefined) {
          for (let i = 0; i < arr.length; i++) {
            const childPath = `${path}/${i}`;
            const itemResult = itemValidator(arr[i], childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!itemResult.valid) {
              if (!collectErrors) return { 'valid': false, 'value': workingValue };
              valid = false;
            }
            if (itemResult.value !== arr[i]) arr[i] = itemResult.value;
          }
        }
      }

      // allOf
      if (allOfValidators !== undefined) {
        for (const allOfValidator of allOfValidators) {
          const allOfResult = allOfValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

          if (!allOfResult.valid) {
            if (!collectErrors) return { 'valid': false, 'value': allOfResult.value };
            valid = false;
          }
          workingValue = allOfResult.value;
        }
      }

      // not
      if (notCheck !== undefined && notCheck(workingValue)) {
        if (collectErrors) errors.push(makeError(path, 'not', 'must not match schema'));
        if (!collectErrors) return { 'valid': false, 'value': workingValue };
        valid = false;
      }

      // if/then/else
      if (ifCheck !== undefined) {
        if (ifCheck(workingValue)) {
          if (thenValidator !== undefined) {
            const thenResult = thenValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!thenResult.valid) {
              if (!collectErrors) return { 'valid': false, 'value': thenResult.value };
              valid = false;
            }
            workingValue = thenResult.value;
          }
        } else if (elseValidator !== undefined) {
          const elseResult = elseValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

          if (!elseResult.valid) {
            if (!collectErrors) return { 'valid': false, 'value': elseResult.value };
            valid = false;
          }
          workingValue = elseResult.value;
        }
      }

      return { valid, 'value': workingValue };
    };
  }



  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Emit a single flat closure for simple object schemas:
   * - type: 'object'
   * - properties with primitive types + optional constraints
   * - required array
   * - additionalProperties: false (optional)
   * - No composition, no $ref, no pattern properties
   */
  private tryCompileFlatObjectCheck(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFn | undefined {
    if (schema['type'] !== 'object') return undefined;
    if (schema['allOf'] || schema['anyOf'] || schema['oneOf'] || schema['not'] || schema['if']) return undefined;
    if (schema['$ref']) return undefined;
    if (schema['patternProperties']) return undefined;

    const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;

    if (properties === undefined) return undefined;

    const required = schema['required'] as string[] | undefined;
    const requiredSet = new Set(required ?? []);
    const noAdditional = schema['additionalProperties'] === false;
    const propNames = Object.keys(properties);
    const propNameSet = new Set(propNames);

    // Build inline property checks
    type PropCheck = {
      'check': CheckFn;
      'name': string;
      'required': boolean;
    };

    const propChecks: PropCheck[] = [];

    for (const name of propNames) {
      const propSchema = properties[name];

      if (propSchema === undefined) continue;

      // Compile the property's validator — for nested objects, this recurses
      const check = this.compileCheck(propSchema, formatRegistry, lookupSchema);

      propChecks.push({
        check,
        name,
        'required': requiredSet.has(name)
      });
    }

    return (v: unknown): boolean => {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
      const obj = v as Record<string, unknown>;

      // Required + property checks in one pass
      for (let i = 0; i < propChecks.length; i++) {
        const pc = propChecks[i];
        const val = obj[pc.name];

        if (val === undefined && !(pc.name in obj)) {
          if (pc.required) return false;
          continue;
        }
        if (!pc.check(val)) return false;
      }

      // Additional properties check
      if (noAdditional) {
        for (const key of Object.keys(obj)) {
          if (!propNameSet.has(key)) return false;
        }
      }

      return true;
    };
  }

  private needsEngineFallback(
    schema: Record<string, unknown>,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): boolean {
    return this.schemaHasUnsupported(schema, lookupSchema, new Set());
  }

  private schemaHasUnsupported(
    schema: Record<string, unknown>,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ): boolean {
    if (visited.has(schema)) return false; // circular ref — already being checked
    visited.add(schema);

    // Anchor-based refs (require fragment resolution the compiler doesn't handle)
    if ('$anchor' in schema) {
      return true;
    }

    // $ref with fragment (anchor or pointer) — compiler only handles simple schema-id refs
    if (typeof schema['$ref'] === 'string') {
      const ref = schema['$ref'] as string;
      const hashIndex = ref.indexOf('#');

      if (hashIndex !== -1) {
        const fragment = ref.slice(hashIndex + 1);

        if (fragment !== '' && fragment !== '/') {
          return true;
        }
      }
    }

    // Dynamic refs
    if ('$dynamicRef' in schema || '$dynamicAnchor' in schema || '$recursiveRef' in schema || '$recursiveAnchor' in schema) {
      return true;
    }

    // Unevaluated properties/items (requires tracking across composition)
    if ('unevaluatedProperties' in schema || 'unevaluatedItems' in schema) {
      return true;
    }

    // dependentRequired / dependentSchemas
    if ('dependentRequired' in schema || 'dependentSchemas' in schema) {
      return true;
    }

    // propertyNames
    if ('propertyNames' in schema) {
      return true;
    }

    // rdfs:range / rdfs:domain (ontology extensions handled by engine)
    if ('rdfs:range' in schema || 'rdfs:domain' in schema) {
      return true;
    }

    // $defs with internal refs (needs proper fragment resolution)
    if ('$defs' in schema) {
      return true;
    }

    // Check $ref targets recursively
    if (typeof schema['$ref'] === 'string' && lookupSchema !== undefined) {
      const ref = schema['$ref'] as string;
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
      const refSchema = lookupSchema(schemaId);

      if (refSchema !== undefined && this.schemaHasUnsupported(refSchema, lookupSchema, visited)) {
        return true;
      }
    }

    // Check composition targets
    for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
      const arr = schema[key];

      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (isRecord(item) && this.schemaHasUnsupported(item, lookupSchema, visited)) {
            return true;
          }
        }
      }
    }

    // Check nested schemas
    if (schema['not'] !== undefined && isRecord(schema['not']) &&
        this.schemaHasUnsupported(schema['not'] as Record<string, unknown>, lookupSchema, visited)) {
      return true;
    }
    for (const key of ['if', 'then', 'else'] as const) {
      if (schema[key] !== undefined && isRecord(schema[key]) &&
          this.schemaHasUnsupported(schema[key] as Record<string, unknown>, lookupSchema, visited)) {
        return true;
      }
    }

    // Check properties
    const properties = schema['properties'];

    if (isRecord(properties)) {
      for (const propSchema of Object.values(properties)) {
        if (isRecord(propSchema) && this.schemaHasUnsupported(propSchema as Record<string, unknown>, lookupSchema, visited)) {
          return true;
        }
      }
    }

    // Check items
    if (isRecord(schema['items']) && this.schemaHasUnsupported(schema['items'] as Record<string, unknown>, lookupSchema, visited)) {
      return true;
    }

    // Check additionalProperties
    if (isRecord(schema['additionalProperties']) &&
        this.schemaHasUnsupported(schema['additionalProperties'] as Record<string, unknown>, lookupSchema, visited)) {
      return true;
    }

    return false;
  }

  private extractTypes(schema: Record<string, unknown>): string[] {
    const type = schema['type'];

    if (typeof type === 'string') return [type];
    if (Array.isArray(type)) return type as string[];

    return [];
  }

  private hasFormatAssertions(schema: Record<string, unknown>): boolean {
    const rootVocabulary = schema['$vocabulary'] as Record<string, boolean> | undefined;

    if (rootVocabulary !== undefined) {
      return rootVocabulary['https://json-schema.org/draft/2020-12/vocab/format-assertion'] === true;
    }

    const schemaUri = schema['$schema'] as string | undefined;

    // 2020-12 without explicit format-assertion vocabulary → annotation only
    if (schemaUri === 'https://json-schema.org/draft/2020-12/schema') {
      return false;
    }

    // No $schema or other dialect → default to enabled
    return true;
  }
}
