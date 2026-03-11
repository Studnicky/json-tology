/**
 * JIT Schema Compiler
 *
 * Generates optimised JavaScript validator functions from JSON Schema objects
 * using `new Function(...)` — similar in approach to TypeBox's TypeCompiler.
 *
 * Returns null for schemas that use unsupported keywords (e.g. $ref, if/then/else)
 * so the caller can fall back to AJV.
 *
 * Two compiled forms per schema:
 *   check(v)  — fast boolean path, no allocations
 *   errors(v) — returns ValidationError[], used when details are needed
 */

import type { ValidationError } from '../interfaces/validation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompiledSchema {
  /** Fast boolean check — no error collection. */
  check(value: unknown): boolean;
  /** Collect all validation errors. */
  errors(value: unknown): ValidationError[];
  /**
   * In-place normalizer: coerce types + fill defaults + strip unknown properties.
   * Mutates the object — only call on a clone you own.
   */
  normalize(obj: Record<string, unknown>): void;
  /**
   * Combined single-pass normalize + check.
   * Coerces, fills defaults, strips additionalProperties, then validates — all in one traversal.
   * Returns false if validation fails after normalization.
   * Mutates the object — only call on a clone you own.
   */
  normalizeAndCheck(obj: Record<string, unknown>): boolean;
}

type Schema = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Format validators — passed into generated functions via closure
// ---------------------------------------------------------------------------

const FMT: Record<string, (v: string) => boolean> = {
  email:       (v) => v.length > 3 && v.indexOf('@') > 0 && v.lastIndexOf('.') > v.indexOf('@'),
  'date-time': (v) => v.length > 15 && v.includes('T') && !isNaN(Date.parse(v)),
  date:        (v) => v.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(v),
  time:        (v) => v.length >= 8 && /^\d{2}:\d{2}:\d{2}/.test(v),
  uri:         (v) => { try { new URL(v); return true; } catch { return false; } },
  uuid:        (v) => v.length === 36 && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v),
  hostname:    (v) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(v),
  ipv4:        (v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split('.').every((n) => Number(n) <= 255),
};

// ---------------------------------------------------------------------------
// Keywords that require AJV fallback
// ---------------------------------------------------------------------------

const UNSUPPORTED = new Set([
  '$ref', 'if', 'then', 'else',
  'unevaluatedProperties', 'unevaluatedItems',
  'contains', 'propertyNames',
  'dependentSchemas', 'dependentRequired',
]);

function hasUnsupported(schema: Schema, visited = new Set<Schema>()): boolean {
  if (visited.has(schema)) return false;
  visited.add(schema);
  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (UNSUPPORTED.has(key)) return true;
    const val = schema[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (hasUnsupported(val as Schema, visited)) return true;
    }
    if (Array.isArray(val)) {
      for (let j = 0; j < val.length; j++) {
        if (val[j] && typeof val[j] === 'object' && hasUnsupported(val[j] as Schema, visited)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const compiledCache = new WeakMap<object, CompiledSchema>();

// ---------------------------------------------------------------------------
// Compiler entry point
// ---------------------------------------------------------------------------

export class Compiler {
  /**
   * Compile a schema to fast check + errors functions.
   * Returns null if the schema uses keywords that require AJV.
   */
  public static compile(schema: object): CompiledSchema | null {
    const cached = compiledCache.get(schema);
    if (cached) return cached;

    const s = schema as Schema;
    if (hasUnsupported(s)) return null;

    try {
      const ctx = new CodegenContext();
      const result = ctx.build(s);
      compiledCache.set(schema, result);
      return result;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Code generation context
// ---------------------------------------------------------------------------

class CodegenContext {
  private fns: string[] = [];   // top-level function declarations
  private fnCount = 0;

  build(root: Schema): CompiledSchema {
    const checkName   = this.genCheckFn(root, 'root');
    const errorsName  = this.genErrorsFn(root, 'root');
    const normName    = this.genNormalizerFn(root, 'root');
    const nrcName     = this.genNrcFn(root, 'root');

    const src = [
      ...this.fns,
      `return { check: ${checkName}, errors: ${errorsName}, normalize: ${normName}, normalizeAndCheck: ${nrcName} };`,
    ].join('\n');

    // eslint-disable-next-line no-new-func
    return new Function('FMT', src)(FMT) as CompiledSchema;
  }

  // -------------------------------------------------------------------------
  // Check function generation (fast boolean path)
  // -------------------------------------------------------------------------

  private genCheckFn(schema: Schema, hint: string): string {
    const name = `chk_${hint}_${this.fnCount++}`;
    const body = this.genCheckBody(schema, 'v', '');
    this.fns.push(`function ${name}(v) {\n${body}\n  return true;\n}`);
    return name;
  }

  private genCheckBody(schema: Schema, expr: string, path: string, indent = '  '): string {
    const lines: string[] = [];
    const type = schema['type'] as string | undefined;
    const types = Array.isArray(type) ? type : type ? [type] : [];

    // --- type check ---
    if (types.length === 1) {
      const typeCheck = this.typeCheckExpr(types[0], expr);
      if (typeCheck) lines.push(`${indent}if (!(${typeCheck})) return false;`);
    } else if (types.length > 1) {
      const checks = types.map((t) => this.typeCheckExpr(t, expr)).filter(Boolean);
      lines.push(`${indent}if (!(${checks.join(' || ')})) return false;`);
    }

    // --- enum / const ---
    const enumValues = schema['enum'] as unknown[] | undefined;
    if (enumValues) {
      const literal = JSON.stringify(enumValues);
      lines.push(`${indent}if (${literal}.indexOf(${expr}) === -1) return false;`);
    }
    const constValue = schema['const'];
    if (constValue !== undefined) {
      lines.push(`${indent}if (${expr} !== ${JSON.stringify(constValue)}) return false;`);
    }

    // --- string constraints ---
    if (types.includes('string') || (!types.length && schema['minLength'] !== undefined)) {
      lines.push(...this.genStringChecks(schema, expr, indent));
    }

    // --- number constraints ---
    if (types.includes('number') || types.includes('integer') || (!types.length && schema['minimum'] !== undefined)) {
      lines.push(...this.genNumberChecks(schema, expr, indent));
    }

    // --- object ---
    if (types.includes('object') || (!types.length && schema['properties'])) {
      lines.push(...this.genObjectChecks(schema, expr, path, indent));
    }

    // --- array ---
    if (types.includes('array') || (!types.length && schema['items'])) {
      lines.push(...this.genArrayChecks(schema, expr, path, indent));
    }

    // --- allOf ---
    const allOf = schema['allOf'] as Schema[] | undefined;
    if (allOf) {
      for (let i = 0; i < allOf.length; i++) {
        lines.push(this.genCheckBody(allOf[i], expr, path, indent));
      }
    }

    // --- anyOf ---
    const anyOf = schema['anyOf'] as Schema[] | undefined;
    if (anyOf) {
      const subFns: string[] = [];
      for (let i = 0; i < anyOf.length; i++) subFns.push(this.genCheckFn(anyOf[i], `anyOf${i}`));
      lines.push(`${indent}if (!(${subFns.map((fn) => `${fn}(${expr})`).join(' || ')})) return false;`);
    }

    // --- oneOf ---
    const oneOf = schema['oneOf'] as Schema[] | undefined;
    if (oneOf) {
      const subFns: string[] = [];
      for (let i = 0; i < oneOf.length; i++) subFns.push(this.genCheckFn(oneOf[i], `oneOf${i}`));
      lines.push(`${indent}if ((${subFns.map((fn) => `(${fn}(${expr}) ? 1 : 0)`).join(' + ')}) !== 1) return false;`);
    }

    // --- not ---
    const not = schema['not'] as Schema | undefined;
    if (not) {
      const notFn = this.genCheckFn(not, 'not');
      lines.push(`${indent}if (${notFn}(${expr})) return false;`);
    }

    return lines.join('\n');
  }

  private typeCheckExpr(type: string, expr: string): string {
    switch (type) {
      case 'string':  return `typeof ${expr} === 'string'`;
      case 'number':  return `typeof ${expr} === 'number'`;
      case 'integer': return `typeof ${expr} === 'number' && Number.isInteger(${expr})`;
      case 'boolean': return `typeof ${expr} === 'boolean'`;
      case 'null':    return `${expr} === null`;
      case 'object':  return `typeof ${expr} === 'object' && ${expr} !== null && !Array.isArray(${expr})`;
      case 'array':   return `Array.isArray(${expr})`;
      default:        return '';
    }
  }

  private genStringChecks(schema: Schema, expr: string, indent: string): string[] {
    const lines: string[] = [];
    const min = schema['minLength'] as number | undefined;
    const max = schema['maxLength'] as number | undefined;
    const pattern = schema['pattern'] as string | undefined;
    const format = schema['format'] as string | undefined;

    if (min !== undefined) lines.push(`${indent}if (${expr}.length < ${min}) return false;`);
    if (max !== undefined) lines.push(`${indent}if (${expr}.length > ${max}) return false;`);
    if (pattern) lines.push(`${indent}if (!/${pattern}/.test(${expr})) return false;`);
    if (format && FMT[format]) lines.push(`${indent}if (!FMT[${JSON.stringify(format)}](${expr})) return false;`);

    return lines;
  }

  private genNumberChecks(schema: Schema, expr: string, indent: string): string[] {
    const lines: string[] = [];
    const min = schema['minimum'] as number | undefined;
    const max = schema['maximum'] as number | undefined;
    const exMin = schema['exclusiveMinimum'] as number | undefined;
    const exMax = schema['exclusiveMaximum'] as number | undefined;
    const mul = schema['multipleOf'] as number | undefined;

    if (min !== undefined)  lines.push(`${indent}if (${expr} < ${min}) return false;`);
    if (max !== undefined)  lines.push(`${indent}if (${expr} > ${max}) return false;`);
    if (exMin !== undefined) lines.push(`${indent}if (${expr} <= ${exMin}) return false;`);
    if (exMax !== undefined) lines.push(`${indent}if (${expr} >= ${exMax}) return false;`);
    if (mul !== undefined)  lines.push(`${indent}if (${expr} % ${mul} !== 0) return false;`);

    return lines;
  }

  private genObjectChecks(schema: Schema, expr: string, _path: string, indent: string): string[] {
    const lines: string[] = [];
    const props    = schema['properties'] as Record<string, Schema> | undefined;
    const required = schema['required']   as string[]               | undefined;
    const addProps = schema['additionalProperties'];
    const reqSet   = new Set(required ?? []);

    // Required props: inline type-check catches both "missing" and "wrong type"
    // (typeof undefined === 'number' → false, etc.), so no 'in' check needed.
    // Optional props: guard with `!== undefined` only — avoids the 'in' operator.
    if (props) {
      const propEntries = Object.entries(props);
      for (let i = 0; i < propEntries.length; i++) {
        const key = propEntries[i][0];
        const propSchema = propEntries[i][1];
        const safeKey  = JSON.stringify(key);
        const propExpr = `${expr}[${safeKey}]`;
        const isReq    = reqSet.has(key);
        const propType = propSchema['type'] as string | undefined;

        if (isReq) {
          // For required props with a simple type: one type-check catches missing + wrong-type.
          // Null-type needs explicit check since typeof null === 'object'.
          const hasSimpleType = propType && propType !== 'object' && propType !== 'array';
          if (!hasSimpleType) {
            // Explicit presence check for object/array/untyped required props
            lines.push(`${indent}if (${propExpr} === undefined) return false;`);
          }
          const sub = this.genCheckBody(propSchema, propExpr, '', indent);
          if (sub) lines.push(sub);
        } else {
          // Optional: skip entirely if undefined (undefined === absent in JSON)
          lines.push(`${indent}if (${propExpr} !== undefined) {`);
          const sub = this.genCheckBody(propSchema, propExpr, '', indent + '  ');
          if (sub) lines.push(sub);
          lines.push(`${indent}}`);
        }
      }
    }

    // additionalProperties: false — inline key comparison for small schemas
    if (addProps === false && props) {
      const keys = Object.keys(props);
      if (keys.length <= 16) {
        const notAllowed = keys.map((k) => `_k !== ${JSON.stringify(k)}`).join(' && ');
        lines.push(`${indent}for (var _k in ${expr}) { if (${expr}[_k] !== undefined && ${notAllowed}) return false; }`);
      } else {
        const allowed = keys.map((k) => JSON.stringify(k)).join(', ');
        lines.push(`${indent}{ var _s = new Set([${allowed}]); for (var _k in ${expr}) { if (${expr}[_k] !== undefined && !_s.has(_k)) return false; } }`);
      }
    }

    return lines;
  }

  private genArrayChecks(schema: Schema, expr: string, path: string, indent: string): string[] {
    const lines: string[] = [];
    const minItems = schema['minItems'] as number | undefined;
    const maxItems = schema['maxItems'] as number | undefined;
    const items = schema['items'] as Schema | Schema[] | undefined;

    if (minItems !== undefined) lines.push(`${indent}if (${expr}.length < ${minItems}) return false;`);
    if (maxItems !== undefined) lines.push(`${indent}if (${expr}.length > ${maxItems}) return false;`);

    if (items && !Array.isArray(items)) {
      const itemFn = this.genCheckFn(items, `item_${path}`);
      lines.push(`${indent}for (var _i = 0; _i < ${expr}.length; _i++) {`);
      lines.push(`${indent}  if (!${itemFn}(${expr}[_i])) return false;`);
      lines.push(`${indent}}`);
    } else if (Array.isArray(items)) {
      // tuple validation
      for (let i = 0; i < items.length; i++) {
        const itemFn = this.genCheckFn(items[i], `tuple${i}`);
        lines.push(`${indent}if (${expr}.length > ${i} && !${itemFn}(${expr}[${i}])) return false;`);
      }
    }

    return lines;
  }

  // -------------------------------------------------------------------------
  // Errors function generation (collects ValidationError[])
  // -------------------------------------------------------------------------

  private genErrorsFn(schema: Schema, hint: string): string {
    const name = `err_${hint}_${this.fnCount++}`;
    const body = this.genErrorsBody(schema, 'v', '""', '  ');
    this.fns.push(
      `function ${name}(v) {\n  var e = [];\n${body}\n  return e;\n}`,
    );
    return name;
  }

  private genErrorsBody(schema: Schema, expr: string, pathExpr: string, indent: string): string {
    const lines: string[] = [];
    const type = schema['type'] as string | undefined;
    const types = Array.isArray(type) ? type : type ? [type] : [];

    // type check
    if (types.length === 1) {
      const check = this.typeCheckExpr(types[0], expr);
      if (check) {
        lines.push(`${indent}if (!(${check})) { e.push({ path: ${pathExpr}, message: 'must be ${types[0]}', keyword: 'type', params: {} }); return e; }`);
      }
    } else if (types.length > 1) {
      const checks = types.map((t) => this.typeCheckExpr(t, expr)).filter(Boolean);
      lines.push(`${indent}if (!(${checks.join(' || ')})) { e.push({ path: ${pathExpr}, message: 'must be one of: ${types.join(', ')}', keyword: 'type', params: {} }); return e; }`);
    }

    // enum
    const enumValues = schema['enum'] as unknown[] | undefined;
    if (enumValues) {
      const literal = JSON.stringify(enumValues);
      lines.push(`${indent}if (${literal}.indexOf(${expr}) === -1) { e.push({ path: ${pathExpr}, message: 'must be one of the allowed values', keyword: 'enum', params: {} }); }`);
    }

    // const
    const constValue = schema['const'];
    if (constValue !== undefined) {
      lines.push(`${indent}if (${expr} !== ${JSON.stringify(constValue)}) { e.push({ path: ${pathExpr}, message: 'must be ${JSON.stringify(constValue)}', keyword: 'const', params: {} }); }`);
    }

    // string constraints
    if (types.includes('string') || (!types.length && schema['minLength'] !== undefined)) {
      lines.push(...this.genStringErrors(schema, expr, pathExpr, indent));
    }

    // number constraints
    if (types.includes('number') || types.includes('integer') || (!types.length && schema['minimum'] !== undefined)) {
      lines.push(...this.genNumberErrors(schema, expr, pathExpr, indent));
    }

    // object
    if (types.includes('object') || (!types.length && schema['properties'])) {
      lines.push(...this.genObjectErrors(schema, expr, pathExpr, indent));
    }

    // array
    if (types.includes('array') || (!types.length && schema['items'])) {
      lines.push(...this.genArrayErrors(schema, expr, pathExpr, indent));
    }

    // allOf
    const allOf = schema['allOf'] as Schema[] | undefined;
    if (allOf) {
      for (let i = 0; i < allOf.length; i++) {
        lines.push(this.genErrorsBody(allOf[i], expr, pathExpr, indent));
      }
    }

    // anyOf
    const anyOf = schema['anyOf'] as Schema[] | undefined;
    if (anyOf) {
      const subFns: string[] = [];
      for (let i = 0; i < anyOf.length; i++) subFns.push(this.genCheckFn(anyOf[i], `anyOf${i}`));
      lines.push(`${indent}if (!(${subFns.map((fn) => `${fn}(${expr})`).join(' || ')})) { e.push({ path: ${pathExpr}, message: 'must match at least one schema', keyword: 'anyOf', params: {} }); }`);
    }

    // oneOf
    const oneOf = schema['oneOf'] as Schema[] | undefined;
    if (oneOf) {
      const subFns: string[] = [];
      for (let i = 0; i < oneOf.length; i++) subFns.push(this.genCheckFn(oneOf[i], `oneOf${i}`));
      lines.push(`${indent}if ((${subFns.map((fn) => `(${fn}(${expr}) ? 1 : 0)`).join(' + ')}) !== 1) { e.push({ path: ${pathExpr}, message: 'must match exactly one schema', keyword: 'oneOf', params: {} }); }`);
    }

    // not
    const not = schema['not'] as Schema | undefined;
    if (not) {
      const notFn = this.genCheckFn(not, 'not');
      lines.push(`${indent}if (${notFn}(${expr})) { e.push({ path: ${pathExpr}, message: 'must not match schema', keyword: 'not', params: {} }); }`);
    }

    return lines.join('\n');
  }

  private genStringErrors(schema: Schema, expr: string, pathExpr: string, indent: string): string[] {
    const lines: string[] = [];
    const min = schema['minLength'] as number | undefined;
    const max = schema['maxLength'] as number | undefined;
    const pattern = schema['pattern'] as string | undefined;
    const format = schema['format'] as string | undefined;

    if (min !== undefined) lines.push(`${indent}if (${expr}.length < ${min}) { e.push({ path: ${pathExpr}, message: 'must be at least ${min} characters', keyword: 'minLength', params: { limit: ${min} } }); }`);
    if (max !== undefined) lines.push(`${indent}if (${expr}.length > ${max}) { e.push({ path: ${pathExpr}, message: 'must be at most ${max} characters', keyword: 'maxLength', params: { limit: ${max} } }); }`);
    if (pattern) lines.push(`${indent}if (!/${pattern}/.test(${expr})) { e.push({ path: ${pathExpr}, message: 'must match pattern ${pattern}', keyword: 'pattern', params: { pattern: ${JSON.stringify(pattern)} } }); }`);
    if (format && FMT[format]) lines.push(`${indent}if (!FMT[${JSON.stringify(format)}](${expr})) { e.push({ path: ${pathExpr}, message: 'must be a valid ${format}', keyword: 'format', params: { format: ${JSON.stringify(format)} } }); }`);

    return lines;
  }

  private genNumberErrors(schema: Schema, expr: string, pathExpr: string, indent: string): string[] {
    const lines: string[] = [];
    const min = schema['minimum'] as number | undefined;
    const max = schema['maximum'] as number | undefined;
    const exMin = schema['exclusiveMinimum'] as number | undefined;
    const exMax = schema['exclusiveMaximum'] as number | undefined;
    const mul = schema['multipleOf'] as number | undefined;

    if (min !== undefined)  lines.push(`${indent}if (${expr} < ${min}) { e.push({ path: ${pathExpr}, message: 'must be >= ${min}', keyword: 'minimum', params: { limit: ${min} } }); }`);
    if (max !== undefined)  lines.push(`${indent}if (${expr} > ${max}) { e.push({ path: ${pathExpr}, message: 'must be <= ${max}', keyword: 'maximum', params: { limit: ${max} } }); }`);
    if (exMin !== undefined) lines.push(`${indent}if (${expr} <= ${exMin}) { e.push({ path: ${pathExpr}, message: 'must be > ${exMin}', keyword: 'exclusiveMinimum', params: { limit: ${exMin} } }); }`);
    if (exMax !== undefined) lines.push(`${indent}if (${expr} >= ${exMax}) { e.push({ path: ${pathExpr}, message: 'must be < ${exMax}', keyword: 'exclusiveMaximum', params: { limit: ${exMax} } }); }`);
    if (mul !== undefined)  lines.push(`${indent}if (${expr} % ${mul} !== 0) { e.push({ path: ${pathExpr}, message: 'must be multiple of ${mul}', keyword: 'multipleOf', params: { multipleOf: ${mul} } }); }`);

    return lines;
  }

  private genObjectErrors(schema: Schema, expr: string, pathExpr: string, indent: string): string[] {
    const lines: string[] = [];
    const props    = schema['properties'] as Record<string, Schema> | undefined;
    const required = schema['required']   as string[]               | undefined;
    const addProps = schema['additionalProperties'];

    // Required presence check
    if (required) {
      for (let i = 0; i < required.length; i++) {
        const safeKey  = JSON.stringify(required[i]);
        const propExpr = `${expr}[${safeKey}]`;
        lines.push(`${indent}if (${propExpr} === undefined) { e.push({ path: ${pathExpr}, message: 'required property ${required[i]} is missing', keyword: 'required', params: { missingProperty: ${safeKey} } }); }`);
      }
    }

    // Property type checks — skip undefined (treated as absent)
    if (props) {
      const propEntries = Object.entries(props);
      for (let i = 0; i < propEntries.length; i++) {
        const key          = propEntries[i][0];
        const propSchema   = propEntries[i][1];
        const safeKey      = JSON.stringify(key);
        const propExpr     = `${expr}[${safeKey}]`;
        const propPathExpr = `${pathExpr} + ${JSON.stringify('/' + key)}`;
        lines.push(`${indent}if (${propExpr} !== undefined) {`);
        const sub = this.genErrorsBody(propSchema, propExpr, propPathExpr, indent + '  ');
        if (sub) lines.push(sub);
        lines.push(`${indent}}`);
      }
    }

    if (addProps === false && props) {
      const keys = Object.keys(props);
      if (keys.length <= 16) {
        const notAllowed = keys.map((k) => `_k !== ${JSON.stringify(k)}`).join(' && ');
        lines.push(`${indent}for (var _k in ${expr}) { if (${expr}[_k] !== undefined && ${notAllowed}) { e.push({ path: ${pathExpr} + '/' + _k, message: 'additional property is not allowed', keyword: 'additionalProperties', params: {} }); } }`);
      } else {
        const allowed = keys.map((k) => JSON.stringify(k)).join(', ');
        lines.push(`${indent}{ var _s = new Set([${allowed}]); for (var _k in ${expr}) { if (${expr}[_k] !== undefined && !_s.has(_k)) { e.push({ path: ${pathExpr} + '/' + _k, message: 'additional property is not allowed', keyword: 'additionalProperties', params: {} }); } } }`);
      }
    }

    return lines;
  }

  private genArrayErrors(schema: Schema, expr: string, pathExpr: string, indent: string): string[] {
    const lines: string[] = [];
    const minItems = schema['minItems'] as number | undefined;
    const maxItems = schema['maxItems'] as number | undefined;
    const items = schema['items'] as Schema | Schema[] | undefined;

    if (minItems !== undefined) lines.push(`${indent}if (${expr}.length < ${minItems}) { e.push({ path: ${pathExpr}, message: 'must have at least ${minItems} items', keyword: 'minItems', params: { limit: ${minItems} } }); }`);
    if (maxItems !== undefined) lines.push(`${indent}if (${expr}.length > ${maxItems}) { e.push({ path: ${pathExpr}, message: 'must have at most ${maxItems} items', keyword: 'maxItems', params: { limit: ${maxItems} } }); }`);

    if (items && !Array.isArray(items)) {
      const itemFn = this.genErrorsFn(items, 'item');
      lines.push(`${indent}for (var _i = 0; _i < ${expr}.length; _i++) {`);
      lines.push(`${indent}  var _ie = ${itemFn}(${expr}[_i]);`);
      lines.push(`${indent}  for (var _j = 0; _j < _ie.length; _j++) { e.push(_ie[_j]); }`);
      lines.push(`${indent}}`);
    } else if (Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const itemFn = this.genErrorsFn(items[i], `tuple${i}`);
        lines.push(`${indent}if (${expr}.length > ${i}) { var _te${i} = ${itemFn}(${expr}[${i}]); for (var _tj${i} = 0; _tj${i} < _te${i}.length; _tj${i}++) { e.push(_te${i}[_tj${i}]); } }`);
      }
    }

    return lines;
  }

  // -------------------------------------------------------------------------
  // Normalizer: single-pass in-place coerce + defaults + clean
  // -------------------------------------------------------------------------

  private genNormalizerFn(schema: Schema, hint: string): string {
    const name = `nrm_${hint}_${this.fnCount++}`;
    const body = this.genNormalizerBody(schema, 'obj', 0, '  ');
    this.fns.push(`function ${name}(obj) {\n${body || '  /* no-op */'}\n}`);
    return name;
  }

  private genNormalizerBody(schema: Schema, expr: string, depth: number, indent: string): string {
    if (depth > 12) return '';
    const lines: string[] = [];
    const type     = schema['type']       as string                        | undefined;
    const props    = schema['properties'] as Record<string, Schema>        | undefined;
    const addProps = schema['additionalProperties'];

    if (!props && !(type === 'object')) return '';

    const propEntries = Object.entries(props ?? {});
    for (let pi = 0; pi < propEntries.length; pi++) {
      const key = propEntries[pi][0];
      const propSchema = propEntries[pi][1];
      const safeKey  = JSON.stringify(key);
      const propExpr = `${expr}[${safeKey}]`;
      const pType    = propSchema['type'] as string | undefined;
      const hasDef   = 'default' in propSchema;
      const defVal   = hasDef ? JSON.stringify(propSchema['default']) : '';

      const coerceLines: string[] = [];

      if (pType === 'number' || pType === 'integer') {
        const trunc = pType === 'integer' ? 'Math.trunc(_n)' : '_n';
        coerceLines.push(`if (typeof ${propExpr} === 'string') { var _n = +${propExpr}; if (_n === _n) ${propExpr} = ${trunc}; }`);
      } else if (pType === 'boolean') {
        coerceLines.push(`if (typeof ${propExpr} === 'string') { if (${propExpr} === 'true' || ${propExpr} === '1') ${propExpr} = true; else if (${propExpr} === 'false' || ${propExpr} === '0') ${propExpr} = false; }`);
      } else if (pType === 'string') {
        coerceLines.push(`if (${propExpr} !== undefined && typeof ${propExpr} !== 'string') ${propExpr} = String(${propExpr});`);
      }

      if (hasDef) {
        // Fill default, then coerce
        lines.push(`${indent}if (${propExpr} === undefined) ${propExpr} = ${defVal};`);
        for (let ci = 0; ci < coerceLines.length; ci++) lines.push(`${indent}${coerceLines[ci]}`);
      } else if (coerceLines.length) {
        // Coerce only if present
        lines.push(`${indent}if (${propExpr} !== undefined) { ${coerceLines.join(' ')} }`);
      }

      // Recurse into nested object
      if ((pType === 'object' || (!pType && propSchema['properties'])) && propSchema['properties']) {
        const childLines = this.genNormalizerBody(propSchema as Schema, propExpr, depth + 1, indent + '  ');
        if (childLines) {
          lines.push(`${indent}if (${propExpr} !== null && typeof ${propExpr} === 'object') {`);
          lines.push(childLines);
          lines.push(`${indent}}`);
        }
      }

      // Recurse into array items
      if (pType === 'array' && propSchema['items'] && !Array.isArray(propSchema['items'])) {
        const itemSchema = propSchema['items'] as Schema;
        const itemFn = this.genNormalizerFn(itemSchema, `item_${key}_${depth}`);
        lines.push(`${indent}if (Array.isArray(${propExpr})) { for (var _ai${depth} = 0; _ai${depth} < ${propExpr}.length; _ai${depth}++) { var _it${depth} = ${propExpr}[_ai${depth}]; if (_it${depth} !== null && typeof _it${depth} === 'object') ${itemFn}(_it${depth}); } }`);
      }
    }

    // Strip additional properties in-place (delete unknown keys)
    if (addProps === false && props) {
      const keys = Object.keys(props);
      if (keys.length <= 16) {
        const notAllowed = keys.map((k) => `_k !== ${JSON.stringify(k)}`).join(' && ');
        lines.push(`${indent}for (var _k in ${expr}) { if (${notAllowed}) delete ${expr}[_k]; }`);
      } else {
        const allowed = keys.map((k) => JSON.stringify(k)).join(', ');
        lines.push(`${indent}{ var _ks = new Set([${allowed}]); for (var _k in ${expr}) { if (!_ks.has(_k)) delete ${expr}[_k]; } }`);
      }
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // normalizeAndCheck: single-pass normalize + validate
  // Coerce/defaults/clean inline, return false on first check failure.
  // -------------------------------------------------------------------------

  private genNrcFn(schema: Schema, hint: string): string {
    const name = `nrc_${hint}_${this.fnCount++}`;
    const body = this.genNrcBody(schema, 'obj', 0, '  ');
    this.fns.push(`function ${name}(obj) {\n${body || '  /* no-op */'}\n  return true;\n}`);
    return name;
  }

  private genNrcBody(schema: Schema, expr: string, depth: number, indent: string): string {
    if (depth > 12) return '';
    const lines: string[] = [];
    const type     = schema['type']       as string                 | undefined;
    const props    = schema['properties'] as Record<string, Schema> | undefined;
    const required = schema['required']   as string[]               | undefined;
    const addProps = schema['additionalProperties'];
    const reqSet   = new Set(required ?? []);

    if (!props && !(type === 'object')) return '';

    // Per-property: default → coerce → validate (all inline)
    if (props) {
      const propEntries = Object.entries(props);
      for (let pi = 0; pi < propEntries.length; pi++) {
        const key        = propEntries[pi][0];
        const propSchema = propEntries[pi][1];
        const safeKey    = JSON.stringify(key);
        const propExpr   = `${expr}[${safeKey}]`;
        const pType      = propSchema['type'] as string | undefined;
        const hasDef     = 'default' in propSchema;
        const defVal     = hasDef ? JSON.stringify(propSchema['default']) : '';
        const isReq      = reqSet.has(key);

        // 1. Fill default
        if (hasDef) {
          lines.push(`${indent}if (${propExpr} === undefined) ${propExpr} = ${defVal};`);
        }

        // 2. Coerce
        if (pType === 'number' || pType === 'integer') {
          const trunc = pType === 'integer' ? 'Math.trunc(_n)' : '_n';
          lines.push(`${indent}if (typeof ${propExpr} === 'string') { var _n${depth}_${pi} = +${propExpr}; if (_n${depth}_${pi} === _n${depth}_${pi}) ${propExpr} = ${trunc.replace('_n', `_n${depth}_${pi}`)}; }`);
        } else if (pType === 'boolean') {
          lines.push(`${indent}if (typeof ${propExpr} === 'string') { if (${propExpr} === 'true' || ${propExpr} === '1') ${propExpr} = true; else if (${propExpr} === 'false' || ${propExpr} === '0') ${propExpr} = false; }`);
        } else if (pType === 'string') {
          lines.push(`${indent}if (${propExpr} !== undefined && typeof ${propExpr} !== 'string') ${propExpr} = String(${propExpr});`);
        }

        // 3. Validate
        if (isReq) {
          const hasSimpleType = pType && pType !== 'object' && pType !== 'array';
          if (!hasSimpleType) {
            lines.push(`${indent}if (${propExpr} === undefined) return false;`);
          }
          const sub = this.genCheckBody(propSchema, propExpr, '', indent);
          if (sub) lines.push(sub);
        } else {
          lines.push(`${indent}if (${propExpr} !== undefined) {`);
          const sub = this.genCheckBody(propSchema, propExpr, '', indent + '  ');
          if (sub) lines.push(sub);
          lines.push(`${indent}}`);
        }

        // 4. Recurse into nested object
        if ((pType === 'object' || (!pType && propSchema['properties'])) && propSchema['properties']) {
          const childBody = this.genNrcBody(propSchema as Schema, propExpr, depth + 1, indent + '  ');
          if (childBody) {
            lines.push(`${indent}if (${propExpr} !== null && typeof ${propExpr} === 'object') {`);
            lines.push(childBody);
            lines.push(`${indent}}`);
          }
        }

        // 5. Recurse into array items
        if (pType === 'array' && propSchema['items'] && !Array.isArray(propSchema['items'])) {
          const itemSchema = propSchema['items'] as Schema;
          const itemFn = this.genNrcFn(itemSchema, `item_${key}_${depth}`);
          lines.push(`${indent}if (Array.isArray(${propExpr})) { for (var _ai${depth}_${pi} = 0; _ai${depth}_${pi} < ${propExpr}.length; _ai${depth}_${pi}++) { var _it${depth}_${pi} = ${propExpr}[_ai${depth}_${pi}]; if (_it${depth}_${pi} !== null && typeof _it${depth}_${pi} === 'object' && !${itemFn}(_it${depth}_${pi})) return false; } }`);
        }
      }
    }

    // Strip additional properties in-place
    if (addProps === false && props) {
      const keys = Object.keys(props);
      if (keys.length <= 16) {
        const notAllowed = keys.map((k) => `_k !== ${JSON.stringify(k)}`).join(' && ');
        lines.push(`${indent}for (var _k in ${expr}) { if (${notAllowed}) delete ${expr}[_k]; }`);
      } else {
        const allowed = keys.map((k) => JSON.stringify(k)).join(', ');
        lines.push(`${indent}{ var _ks = new Set([${allowed}]); for (var _k in ${expr}) { if (!_ks.has(_k)) delete ${expr}[_k]; } }`);
      }
    }

    return lines.join('\n');
  }
}
