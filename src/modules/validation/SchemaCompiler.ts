/**
 * Schema Compiler — Phases 6.2-6.5
 *
 * Compiles JSON Schema into optimized closure validators. Each schema node
 * becomes a captured closure with all constants pre-resolved. Falls back to
 * GraphEngine for unsupported constructs.
 *
 * All field reads come from graph semantics — never from schema[key].
 */

import type { ValidationErrorType } from '../../types/validation.js';
import type {
  CompiledValidateOptionsInterface, CompiledValidationResultInterface, CompiledValidatorInterface
} from '../../interfaces/compiler.js';
import type { GraphEngine } from '../graph/GraphEngine.js';
import type { FormatRegistry } from '../format/FormatRegistry.js';
import type {
  KeywordContextInterface, KeywordDefinitionInterface
} from '../../interfaces/graph-engine.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import type {
  SchemaGraphNodeInterface, SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';
import {
  deepEqual, isRecord
} from '../data/DataTypes.js';


// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type CheckFnType = (value: unknown) => boolean;

type ValidateWithErrorsFnType = (
  value: unknown,
  path: string,
  errors: ValidationErrorType[],
  collectErrors: boolean,
  applyDefaults: boolean,
  doCoerce: boolean,
  stripUnknown: boolean
) => { 'valid': boolean;
  'value': unknown; };

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
): ValidationErrorType {
  return {
    keyword,
    message,
    params,
    path
  };
}

function coerceValue(types: string[], value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  for (const type of types) {
    switch (type) {
      case 'array':
        if (!Array.isArray(value) && typeof value !== 'object') {
          return [value];
        }
        break;
      case 'boolean':
        if (value === 'true' || value === '1' || value === 1) {
          return true;
        }
        if (value === 'false' || value === '0' || value === 0) {
          return false;
        }
        break;
      case 'integer':

      case 'number':
        if (typeof value === 'string') {
          const n = Number(value);

          if (!Number.isNaN(n)) {
            return type === 'integer' ? Math.trunc(n) : n;
          }
        }
        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }
        break;
      case 'null':
        if (value === '' || value === 'null') {
          return null;
        }
        break;
      case 'string':
        if (typeof value !== 'string') {
          return String(value);
        }
        break;
    }
  }

  return value;
}

// ---------------------------------------------------------------------------
// SchemaCompiler
// ---------------------------------------------------------------------------

export class SchemaCompiler {
  private activeCustomKeywords: KeywordDefinitionInterface[] = [];
  private readonly compilingNodes = new Set<SchemaGraphNodeInterface>();
  public readonly lookupCompiled: ((schemaId: string) => CompiledValidatorInterface | undefined) | undefined;

  public constructor(options?: {
    'lookupCompiled'?: (schemaId: string) => CompiledValidatorInterface | undefined;
  }) {
    this.lookupCompiled = options?.lookupCompiled;
  }

  public compile(engine: GraphEngine): CompiledValidatorInterface {
    const rootSchema = engine.rootSchema;

    if (typeof rootSchema === 'boolean') {
      return this.compileBooleanSchema(rootSchema, engine);
    }

    const schema = rootSchema as Record<string, unknown>;
    const formatRegistry = engine.formatRegistry;
    const lookupSchema = engine.schemaLookup();
    const graph = new SchemaGraph(schema);

    this.activeCustomKeywords = engine.keywords();

    // Check for unsupported features that require engine fallback
    if (this.needsEngineFallback(graph, lookupSchema)) {
      this.activeCustomKeywords = [];

      return this.engineFallback(engine);
    }

    try {
      const checkFn = this.compileCheck(schema, formatRegistry, graph, lookupSchema);
      const validateFn = this.compileValidate(schema, formatRegistry, graph, lookupSchema);

      return {
        'check': checkFn,
        'compiled': true,
        'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
          if (options?.applyDefaults || options?.coerce || options?.stripUnknownProperties || options?.removeAdditional) {
            // Use the full validate path for mutation modes
            const result = validateFn(data, options);

            return result;
          }
          // Fast validate path — just check + collect errors
          if (options?.collectErrors === false) {
            return {
              'errors': [],
              'valid': checkFn(data),
              'value': data
            };
          }

          const errors: ValidationErrorType[] = [];
          const result = this.compileValidateWithErrors(schema, formatRegistry, graph, lookupSchema)(data, '', errors, true, false, false, false);

          return {
            errors,
            'valid': result.valid,
            'value': result.value
          };
        }
      };
    } catch {
      // Fallback to engine if compilation fails
      return this.engineFallback(engine);
    }
  }

  private compileBooleanSchema(schema: boolean, _engine: GraphEngine): CompiledValidatorInterface {
    if (schema) {
      return {
        'check': () => {
          return true;
        },
        'compiled': true,
        'validate': (_data, _options) => {
          return {
            'errors': [],
            'valid': true,
            'value': _data
          };
        }
      };
    }

    return {
      'check': () => {
        return false;
      },
      'compiled': true,
      'validate': (_data, _options) => {
        return {
          'errors': [makeError('', 'falseSchema', 'must not match false schema')],
          'valid': false,
          'value': _data
        };
      }
    };
  }

  /**
   * Entry point: compiles a schema object into a check function.
   * Thin wrapper that resolves the graph node, then delegates to compileNodeCheck.
   */
  private compileCheck(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    const graphNode = graph.node(schema);

    if (graphNode === undefined) {
      return () => {
        return true;
      };
    }

    return this.compileNodeCheck(graphNode, formatRegistry, graph, lookupSchema);
  }

  // ---------------------------------------------------------------------------
  // Boolean schema helper
  // ---------------------------------------------------------------------------

  private compileNodeArrayCheck(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType | undefined {
    const sem = graph.semantics(graphNode);

    const minItems = sem.minItems;
    const maxItems = sem.maxItems;
    const uniqueItems = sem.uniqueItems;
    const itemsNode = sem.itemsNode;
    const prefixItemNodes = sem.prefixItems;
    const containsNode = sem.containsNode;
    const minContains = sem.minContains;
    const maxContains = sem.maxContains;

    let itemCheck: CheckFnType | undefined;

    if (itemsNode !== undefined) {
      if (typeof itemsNode.schema === 'boolean') {
        if (!itemsNode.schema) {
          itemCheck = () => {
            return false;
          };
        }
      } else {
        itemCheck = this.compileNodeCheck(itemsNode, formatRegistry, graph, lookupSchema);
      }
    }

    let prefixChecks: CheckFnType[] | undefined;

    if (prefixItemNodes.length > 0) {
      prefixChecks = prefixItemNodes.map((node) => {
        return this.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });
    }

    // Contains
    let containsCheck: CheckFnType | undefined;

    if (containsNode !== undefined) {
      containsCheck = this.compileNodeOrBooleanCheck(containsNode, formatRegistry, graph, lookupSchema);
    }

    return (v) => {
      if (!Array.isArray(v)) {
        return true;
      }

      if (minItems !== undefined && v.length < minItems) {
        return false;
      }
      if (maxItems !== undefined && v.length > maxItems) {
        return false;
      }

      if (uniqueItems) {
        const seen = new Set();

        for (const item of v) {
          const key = typeof item === 'object' && item !== null ? jsonSortedKeys(item) : item;

          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
        }
      }

      if (prefixChecks !== undefined) {
        for (let i = 0; i < prefixChecks.length && i < v.length; i++) {
          if (!prefixChecks[i](v[i])) {
            return false;
          }
        }
      }

      if (itemCheck !== undefined) {
        const startIndex = prefixChecks === undefined ? 0 : prefixChecks.length;

        for (let i = startIndex; i < v.length; i++) {
          if (!itemCheck(v[i])) {
            return false;
          }
        }
      }

      if (containsCheck !== undefined) {
        let count = 0;

        for (const item of v) {
          if (containsCheck(item)) {
            count++;
          }
        }
        if (minContains !== undefined && count < minContains) {
          return false;
        }
        if (maxContains !== undefined && count > maxContains) {
          return false;
        }
        if (minContains === undefined && maxContains === undefined && count === 0) {
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Node-native check compilation. Accepts a SchemaGraphNodeInterface directly.
   */
  private compileNodeCheck(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    this.compilingNodes.add(graphNode);

    try {
      return this.compileNodeCheckInner(graphNode, formatRegistry, graph, lookupSchema);
    } finally {
      this.compilingNodes.delete(graphNode);
    }
  }

  // ---------------------------------------------------------------------------
  // check() compilation — fast boolean path
  // ---------------------------------------------------------------------------

  private compileNodeCheckInner(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    // Try fast-path for simple typed objects
    const fastPath = this.tryCompileNodeFlatObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

    if (fastPath !== undefined) {
      return fastPath;
    }

    const checks: CheckFnType[] = [];

    const sem = graph.semantics(graphNode);

    // Type check
    const types = sem.schemaTypes;

    if (types.length > 0) {
      checks.push(this.compileTypeCheck(types));
    }

    // Const
    if (sem.hasConst) {
      const constVal = sem.constValue;

      if (constVal === null || typeof constVal === 'string' || typeof constVal === 'number' || typeof constVal === 'boolean') {
        checks.push((v) => {
          return v === constVal;
        });
      } else {
        checks.push((v) => {
          return deepEqual(v, constVal);
        });
      }
    }

    // Enum
    const enumValues = sem.enumValues;

    if (enumValues !== undefined) {
      const allPrimitive = enumValues.every((v) => {
        return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
      });

      if (allPrimitive) {
        const enumSet = new Set(enumValues);

        checks.push((v) => {
          return enumSet.has(v as boolean | null | number | string);
        });
      } else {
        checks.push((v) => {
          return enumValues.some((e) => {
            return deepEqual(e, v);
          });
        });
      }
    }

    // String constraints
    const minLength = sem.minLength;
    const maxLength = sem.maxLength;
    const pattern = sem.pattern;
    const format = sem.format;

    if (minLength !== undefined || maxLength !== undefined || pattern !== undefined || format !== undefined) {
      const stringCheck = this.compileStringCheck(minLength, maxLength, pattern, format, formatRegistry, sem);

      if (stringCheck !== undefined) {
        checks.push(stringCheck);
      }
    }

    // Numeric constraints
    const minimum = sem.minimum;
    const maximum = sem.maximum;
    const exclusiveMinimum = sem.exclusiveMinimum;
    const exclusiveMaximum = sem.exclusiveMaximum;
    const multipleOf = sem.multipleOf;

    if (minimum !== undefined || maximum !== undefined || exclusiveMinimum !== undefined
      || exclusiveMaximum !== undefined || multipleOf !== undefined) {
      const numCheck = this.compileNumberCheck(minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf);

      if (numCheck !== undefined) {
        checks.push(numCheck);
      }
    }

    // $ref — use graph for local fragment resolution
    const ref = sem.ref;

    if (typeof ref === 'string') {
      const refCheck = this.compileRefCheck(ref, formatRegistry, graph, lookupSchema);

      if (refCheck !== undefined) {
        checks.push(refCheck);
      }
    }

    // Object constraints
    if (sem.schemaTypes.includes('object') || sem.properties.size > 0 || sem.required.length > 0) {
      const objCheck = this.compileNodeObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

      if (objCheck !== undefined) {
        checks.push(objCheck);
      }
    }

    // dependentRequired
    const depRequired = sem.dependentRequired;

    if (Object.keys(depRequired).length > 0) {
      const depEntries = Object.entries(depRequired);

      checks.push((v) => {
        if (!isRecord(v)) {
          return true;
        }
        const obj = v;

        for (const [
          trigger,
          required
        ] of depEntries) {
          if (trigger in obj) {
            for (const req of required) {
              if (!(req in obj)) {
                return false;
              }
            }
          }
        }

        return true;
      });
    }

    // dependentSchemas
    const depSchemaEntries = sem.dependentSchemaEntries;

    if (depSchemaEntries.length > 0) {
      const depSchemaChecks: Array<{ 'check': CheckFnType;
        'trigger': string; }> = [];

      for (const [
        trigger,
        node
      ] of depSchemaEntries) {
        if (typeof node.schema === 'boolean') {
          if (!node.schema) {
            depSchemaChecks.push({
              'check': () => {
                return false;
              },
              'trigger': trigger
            });
          }
        } else {
          depSchemaChecks.push({
            'check': this.compileNodeCheck(node, formatRegistry, graph, lookupSchema),
            'trigger': trigger
          });
        }
      }

      if (depSchemaChecks.length > 0) {
        checks.push((v) => {
          if (!isRecord(v)) {
            return true;
          }
          const obj = v;

          for (const dep of depSchemaChecks) {
            if (dep.trigger in obj && !dep.check(v)) {
              return false;
            }
          }

          return true;
        });
      }
    }

    // propertyNames
    const propertyNamesNode = sem.propertyNamesNode;

    if (propertyNamesNode !== undefined) {
      const pnCheck = this.compileNodeOrBooleanCheck(propertyNamesNode, formatRegistry, graph, lookupSchema);

      checks.push((v) => {
        if (!isRecord(v)) {
          return true;
        }

        for (const key of Object.keys(v)) {
          if (!pnCheck(key)) {
            return false;
          }
        }

        return true;
      });
    }

    // Array constraints
    if (sem.schemaTypes.includes('array') || sem.itemsNode !== undefined || sem.prefixItems.length > 0) {
      const arrCheck = this.compileNodeArrayCheck(graphNode, formatRegistry, graph, lookupSchema);

      if (arrCheck !== undefined) {
        checks.push(arrCheck);
      }
    }

    // allOf
    const allOfNodes = sem.allOf;

    if (allOfNodes.length > 0) {
      const allOfChecks = allOfNodes.map((node) => {
        return this.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push((v) => {
        return allOfChecks.every((c) => {
          return c(v);
        });
      });
    }

    // anyOf
    const anyOfNodes = sem.anyOf;

    if (anyOfNodes.length > 0) {
      const anyOfChecks = anyOfNodes.map((node) => {
        return this.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push((v) => {
        return anyOfChecks.some((c) => {
          return c(v);
        });
      });
    }

    // oneOf
    const oneOfNodes = sem.oneOf;

    if (oneOfNodes.length > 0) {
      const oneOfChecks = oneOfNodes.map((node) => {
        return this.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });

      checks.push((v) => {
        let count = 0;

        for (const c of oneOfChecks) {
          if (c(v)) {
            count++;
            if (count > 1) {
              return false;
            }
          }
        }

        return count === 1;
      });
    }

    // not
    const notNode = sem.notNode;

    if (notNode !== undefined) {
      const notCheck = this.compileNodeOrBooleanCheck(notNode, formatRegistry, graph, lookupSchema);

      checks.push((v) => {
        return !notCheck(v);
      });
    }

    // if/then/else
    const ifNode = sem.ifNode;

    if (ifNode !== undefined) {
      const ifCheck = this.compileNodeOrBooleanCheck(ifNode, formatRegistry, graph, lookupSchema);
      const thenNode = sem.thenNode;
      const elseNode = sem.elseNode;
      const thenCheck = thenNode === undefined
        ? undefined
        : this.compileNodeOrBooleanCheck(thenNode, formatRegistry, graph, lookupSchema);
      const elseCheck = elseNode === undefined
        ? undefined
        : this.compileNodeOrBooleanCheck(elseNode, formatRegistry, graph, lookupSchema);

      checks.push((v) => {
        if (ifCheck(v)) {
          return thenCheck === undefined || thenCheck(v);
        }

        return elseCheck === undefined || elseCheck(v);
      });
    }

    // Custom keywords from graph extensions
    if (this.activeCustomKeywords.length > 0) {
      const extensionEntries: Array<{ 'allowedTypes': string[] | undefined;
        'keyword': string;
        'schemaValue': unknown;
        'validate': KeywordDefinitionInterface['validate']; }> = [];

      for (const kw of this.activeCustomKeywords) {
        if (kw.keyword in sem.extensions) {
          extensionEntries.push({
            'allowedTypes': kw.type === undefined ? undefined : (Array.isArray(kw.type) ? kw.type : [kw.type]),
            'keyword': kw.keyword,
            'schemaValue': sem.extensions[kw.keyword],
            'validate': kw.validate
          });
        }
      }

      if (extensionEntries.length > 0) {
        checks.push((v) => {
          const dataType = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

          for (const entry of extensionEntries) {
            if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
              continue;
            }

            const ctx: KeywordContextInterface = {
              'parentData': undefined,
              'parentKey': '',
              'path': '',
              'rootData': v
            };
            const result = entry.validate(entry.schemaValue, v, ctx);

            if (result === false) {
              return false;
            }
            if (Array.isArray(result) && result.length > 0) {
              return false;
            }
          }

          return true;
        });
      }
    }

    // Combine all checks
    if (checks.length === 0) {
      return () => {
        return true;
      };
    }
    if (checks.length === 1) {
      return checks[0];
    }

    return (v) => {
      for (const check of checks) {
        if (!check(v)) {
          return false;
        }
      }

      return true;
    };
  }

  private compileNodeObjectCheck(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType | undefined {
    const sem = graph.semantics(graphNode);

    // Compile property validators from graph semantics
    const propValidators = new Map<string, CheckFnType>();

    for (const [
      key,
      propNode
    ] of sem.properties) {
      if (typeof propNode.schema === 'boolean') {
        if (!propNode.schema) {
          propValidators.set(key, () => {
            return false;
          });
        }
      } else {
        propValidators.set(key, this.compileNodeCheck(propNode, formatRegistry, graph, lookupSchema));
      }
    }

    // Build allowed keys set for additionalProperties: false
    const allowedKeys = sem.properties.size > 0 ? new Set(sem.properties.keys()) : undefined;

    const required = sem.required.length > 0 ? sem.required : undefined;
    const additionalPropertiesNode = sem.additionalPropertiesNode;
    const minProperties = sem.minProperties;
    const maxProperties = sem.maxProperties;

    // Pattern properties
    let patternChecks: Array<{ 'check': CheckFnType;
      'regex': RegExp; }> | undefined;

    if (sem.patternPropertyEntries.length > 0) {
      patternChecks = [];

      for (const [
        pat,
        patNode
      ] of sem.patternPropertyEntries) {
        const regex = new RegExp(pat, 'u');
        const check = this.compileNodeOrBooleanCheck(patNode, formatRegistry, graph, lookupSchema);

        patternChecks.push({
          check,
          regex
        });
      }
    }

    // Additional properties validator
    let additionalCheck: CheckFnType | undefined;

    if (additionalPropertiesNode !== undefined && additionalPropertiesNode !== true && additionalPropertiesNode !== false) {
      additionalCheck = this.compileNodeOrBooleanCheck(additionalPropertiesNode, formatRegistry, graph, lookupSchema);
    }

    const additionalIsFalse = additionalPropertiesNode === false;

    return (v) => {
      if (!isRecord(v)) {
        return true;
      } // type check handles this

      // Required check
      if (required !== undefined) {
        for (const key of required) {
          if (!(key in v)) {
            return false;
          }
        }
      }

      // Min/max properties
      if (minProperties !== undefined || maxProperties !== undefined) {
        const count = Object.keys(v).length;

        if (minProperties !== undefined && count < minProperties) {
          return false;
        }
        if (maxProperties !== undefined && count > maxProperties) {
          return false;
        }
      }

      // Property validation
      for (const key of Object.keys(v)) {
        const propCheck = propValidators.get(key);

        if (propCheck !== undefined) {
          if (!propCheck(v[key])) {
            return false;
          }
          continue;
        }

        // Check pattern properties
        if (patternChecks !== undefined) {
          let matchedPattern = false;

          for (const pc of patternChecks) {
            if (pc.regex.test(key)) {
              matchedPattern = true;
              if (!pc.check(v[key])) {
                return false;
              }
            }
          }
          if (matchedPattern) {
            continue;
          }
        }

        // Additional properties
        if (additionalIsFalse) {
          if (allowedKeys !== undefined && !allowedKeys.has(key)) {
            return false;
          }
        } else if (additionalCheck !== undefined && !additionalCheck(v[key])) {
          return false;
        }
      }

      return true;
    };
  }

  private compileNodeOrBooleanCheck(
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? () => {
          return true;
        }
        : () => {
          return false;
        };
    }

    return this.compileNodeCheck(node, formatRegistry, graph, lookupSchema);
  }

  private compileNodeOrBooleanValidateWithErrors(
    node: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    if (typeof node.schema === 'boolean') {
      return node.schema
        ? (v, _p, _e, _c, _ad, _dc, _su) => {
          return {
            'valid': true,
            'value': v
          };
        }
        : (v, p, e, c) => {
          if (c) {
            e.push(makeError(p, 'falseSchema', 'must not match false schema'));
          }

          return {
            'valid': false,
            'value': v
          };
        };
    }

    return this.compileNodeValidateWithErrors(node, formatRegistry, graph, lookupSchema);
  }

  /**
   * Node-native validate-with-errors compilation. Accepts a SchemaGraphNodeInterface directly.
   */
  private compileNodeValidateWithErrors(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    const sem = graph.semantics(graphNode);

    const types = sem.schemaTypes;
    const constVal = sem.constValue;
    const hasConst = sem.hasConst;
    const enumValues = sem.enumValues;
    const minLength = sem.minLength;
    const maxLength = sem.maxLength;
    const pattern = sem.pattern;
    const format = sem.format;
    const minimum = sem.minimum;
    const maximum = sem.maximum;
    const exclusiveMinimum = sem.exclusiveMinimum;
    const exclusiveMaximum = sem.exclusiveMaximum;
    const multipleOf = sem.multipleOf;
    const ref = sem.ref;
    const required = sem.required.length > 0 ? sem.required : undefined;
    const additionalPropertiesNode = sem.additionalPropertiesNode;
    const itemsNode = sem.itemsNode;
    const minItems = sem.minItems;
    const maxItems = sem.maxItems;
    const uniqueItems = sem.uniqueItems;
    const defaultValue = sem.defaultValue;
    const hasDefault = sem.hasDefault;
    const hasFormatAssertion = this.hasFormatAssertions(sem);
    const minProperties = sem.minProperties;
    const maxProperties = sem.maxProperties;
    const prefixItemNodes = sem.prefixItems;
    const containsNode = sem.containsNode;
    const minContains = sem.minContains;
    const maxContains = sem.maxContains;

    const patternRegex = pattern === undefined ? undefined : new RegExp(pattern, 'u');
    const formatValidator = (format !== undefined && hasFormatAssertion)
      ? formatRegistry.get(format)
      : undefined;

    // Compile property validators from graph semantics
    const propValidators = new Map<string, ValidateWithErrorsFnType>();
    const propertyEntries = sem.properties;

    for (const [
      key,
      propNode
    ] of propertyEntries) {
      if (typeof propNode.schema === 'boolean') {
        propValidators.set(key, propNode.schema
          ? (v, _p, _e, _c, _ad, _dc, _su) => {
            return {
              'valid': true,
              'value': v
            };
          }
          : (v, p, e, c) => {
            if (c) {
              e.push(makeError(p, 'falseSchema', 'must not match false schema'));
            }

            return {
              'valid': false,
              'value': v
            };
          });
      } else {
        propValidators.set(key, this.compileNodeValidateWithErrors(propNode, formatRegistry, graph, lookupSchema));
      }
    }

    const allowedKeys = propertyEntries.size > 0 ? new Set(propertyEntries.keys()) : undefined;
    const additionalIsFalse = additionalPropertiesNode === false;

    // Compile typed additionalProperties validator
    let additionalValidator: undefined | ValidateWithErrorsFnType;

    if (additionalPropertiesNode !== undefined && additionalPropertiesNode !== true && additionalPropertiesNode !== false) {
      additionalValidator = this.compileNodeOrBooleanValidateWithErrors(additionalPropertiesNode, formatRegistry, graph, lookupSchema);
    }

    // Compile patternProperties validators
    let patternPropValidators: Array<{ 'regex': RegExp;
      'validator': ValidateWithErrorsFnType; }> | undefined;

    if (sem.patternPropertyEntries.length > 0) {
      patternPropValidators = [];

      for (const [
        pat,
        patNode
      ] of sem.patternPropertyEntries) {
        patternPropValidators.push({
          'regex': new RegExp(pat, 'u'),
          'validator': this.compileNodeOrBooleanValidateWithErrors(patNode, formatRegistry, graph, lookupSchema)
        });
      }

      if (patternPropValidators.length === 0) {
        patternPropValidators = undefined;
      }
    }

    // Compile prefixItems validators
    let prefixValidators: undefined | ValidateWithErrorsFnType[];

    if (prefixItemNodes.length > 0) {
      prefixValidators = prefixItemNodes.map((node) => {
        return this.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema);
      });
    }

    // Compile contains validator
    let containsCheck: CheckFnType | undefined;

    if (containsNode !== undefined) {
      containsCheck = this.compileNodeOrBooleanCheck(containsNode, formatRegistry, graph, lookupSchema);
    }

    // Compile $ref validator — use graph for local fragment resolution
    let refValidator: undefined | ValidateWithErrorsFnType;

    if (typeof ref === 'string') {
      if (ref.startsWith('#')) {
        // Local fragment ref — resolve via graph
        const fragment = ref.slice(1);
        let targetNode: SchemaGraphNodeInterface | undefined;

        try {
          targetNode = graph.resolveFragment(fragment);
        } catch {
          // Fall through
        }

        if (targetNode !== undefined) {
          if (typeof targetNode.schema === 'boolean') {
            refValidator = targetNode.schema
              ? (v, _p, _e, _c, _ad, _dc, _su) => {
                return {
                  'valid': true,
                  'value': v
                };
              }
              : (v, p, e, c) => {
                if (c) {
                  e.push(makeError(p, 'falseSchema', 'must not match false schema'));
                }

                return {
                  'valid': false,
                  'value': v
                };
              };
          } else {
            let cached: undefined | ValidateWithErrorsFnType;
            const self = this;

            refValidator = (v, p, e, c, ad, dc, su) => {
              if (cached === undefined) {
                cached = self.compileNodeValidateWithErrors(targetNode, formatRegistry, graph, lookupSchema);
              }

              return cached(v, p, e, c, ad, dc, su);
            };
          }
        }
      } else if (lookupSchema !== undefined) {
        const hashIndex = ref.indexOf('#');
        const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
        const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
        const refSchema = lookupSchema(schemaId);

        if (refSchema !== undefined) {
          const refGraph = new SchemaGraph(refSchema);

          if (fragment !== '' && fragment !== '/') {
            // Resolve anchor or pointer in external schema's graph
            let targetNode: SchemaGraphNodeInterface | undefined;

            try {
              targetNode = refGraph.resolveFragment(fragment);
            } catch {
              // Fall through
            }

            if (targetNode !== undefined) {
              if (typeof targetNode.schema === 'boolean') {
                refValidator = targetNode.schema
                  ? (v, _p, _e, _c, _ad, _dc, _su) => {
                    return {
                      'valid': true,
                      'value': v
                    };
                  }
                  : (v, p, e, c) => {
                    if (c) {
                      e.push(makeError(p, 'falseSchema', 'must not match false schema'));
                    }

                    return {
                      'valid': false,
                      'value': v
                    };
                  };
              } else {
                let cached: undefined | ValidateWithErrorsFnType;
                const self = this;

                refValidator = (v, p, e, c, ad, dc, su) => {
                  if (cached === undefined) {
                    cached = self.compileNodeValidateWithErrors(targetNode, formatRegistry, refGraph, lookupSchema);
                  }

                  return cached(v, p, e, c, ad, dc, su);
                };
              }
            }
          } else {
            // No fragment — compile the whole external schema via its root node
            let cached: undefined | ValidateWithErrorsFnType;
            const self = this;
            const rootNode = refGraph.rootNode;

            refValidator = (v, p, e, c, ad, dc, su) => {
              if (cached === undefined) {
                cached = self.compileNodeValidateWithErrors(rootNode, formatRegistry, refGraph, lookupSchema);
              }

              return cached(v, p, e, c, ad, dc, su);
            };
          }
        }
      }
    }

    // Compile items validator from graph semantics
    let itemValidator: undefined | ValidateWithErrorsFnType;

    if (itemsNode !== undefined) {
      itemValidator = this.compileNodeOrBooleanValidateWithErrors(itemsNode, formatRegistry, graph, lookupSchema);
    }

    // Compile allOf from graph semantics
    const allOfNodes = sem.allOf;
    let allOfValidators: undefined | ValidateWithErrorsFnType[];

    if (allOfNodes.length > 0) {
      allOfValidators = allOfNodes.map((node) => {
        return this.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema);
      });
    }

    // Compile anyOf from graph semantics
    const anyOfNodes = sem.anyOf;
    let anyOfChecks: CheckFnType[] | undefined;

    if (anyOfNodes.length > 0) {
      anyOfChecks = anyOfNodes.map((node) => {
        return this.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });
    }

    // Compile oneOf from graph semantics
    const oneOfNodes = sem.oneOf;
    let oneOfChecks: CheckFnType[] | undefined;

    if (oneOfNodes.length > 0) {
      oneOfChecks = oneOfNodes.map((node) => {
        return this.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
      });
    }

    // Compile not from graph semantics
    const notNode = sem.notNode;
    let notCheck: CheckFnType | undefined;

    if (notNode !== undefined) {
      notCheck = this.compileNodeOrBooleanCheck(notNode, formatRegistry, graph, lookupSchema);
    }

    // Compile if/then/else from graph semantics
    const ifNode = sem.ifNode;
    let ifCheck: CheckFnType | undefined;
    let thenValidator: undefined | ValidateWithErrorsFnType;
    let elseValidator: undefined | ValidateWithErrorsFnType;

    if (ifNode !== undefined) {
      ifCheck = this.compileNodeOrBooleanCheck(ifNode, formatRegistry, graph, lookupSchema);
      const thenNode = sem.thenNode;
      const elseNode = sem.elseNode;

      if (thenNode !== undefined) {
        thenValidator = this.compileNodeOrBooleanValidateWithErrors(thenNode, formatRegistry, graph, lookupSchema);
      }
      if (elseNode !== undefined) {
        elseValidator = this.compileNodeOrBooleanValidateWithErrors(elseNode, formatRegistry, graph, lookupSchema);
      }
    }

    // Compile dependentRequired from graph semantics
    const depRequired = sem.dependentRequired;
    const depRequiredEntries = Object.entries(depRequired).filter(([
      , v
    ]) => {
      return Array.isArray(v) && v.length > 0;
    });

    // Compile dependentSchemas from graph semantics
    const depSchemaEntries = sem.dependentSchemaEntries;
    let depSchemaValidators: Array<{ 'trigger': string;
      'validator': ValidateWithErrorsFnType; }> | undefined;

    if (depSchemaEntries.length > 0) {
      depSchemaValidators = [];

      for (const [
        trigger,
        node
      ] of depSchemaEntries) {
        depSchemaValidators.push({
          'trigger': trigger,
          'validator': this.compileNodeOrBooleanValidateWithErrors(node, formatRegistry, graph, lookupSchema)
        });
      }

      if (depSchemaValidators.length === 0) {
        depSchemaValidators = undefined;
      }
    }

    // Compile propertyNames from graph semantics
    const propertyNamesNode = sem.propertyNamesNode;
    let propertyNamesValidator: undefined | ValidateWithErrorsFnType;

    if (propertyNamesNode !== undefined) {
      propertyNamesValidator = this.compileNodeOrBooleanValidateWithErrors(propertyNamesNode, formatRegistry, graph, lookupSchema);
    }

    // Enum set for O(1) lookup
    let enumSet: Set<boolean | null | number | string> | undefined;

    if (enumValues !== undefined) {
      const allPrimitive = enumValues.every((ev) => {
        return ev === null || typeof ev === 'string' || typeof ev === 'number' || typeof ev === 'boolean';
      });

      if (allPrimitive) {
        enumSet = new Set(enumValues);
      }
    }

    // Compile custom keyword validators from extensions
    let customKeywordEntries: Array<{ 'allowedTypes': string[] | undefined;
      'keyword': string;
      'schemaValue': unknown;
      'validate': KeywordDefinitionInterface['validate']; }> | undefined;

    if (this.activeCustomKeywords.length > 0) {
      const entries: typeof customKeywordEntries = [];

      for (const kw of this.activeCustomKeywords) {
        if (kw.keyword in sem.extensions) {
          entries.push({
            'allowedTypes': kw.type === undefined ? undefined : (Array.isArray(kw.type) ? kw.type : [kw.type]),
            'keyword': kw.keyword,
            'schemaValue': sem.extensions[kw.keyword],
            'validate': kw.validate
          });
        }
      }

      if (entries.length > 0) {
        customKeywordEntries = entries;
      }
    }

    // Build a helper to look up property defaults from graph semantics.
    // Follows $ref chains and creates implicit parent objects when descendants
    // carry concrete defaults. Optional/nullable sub-objects without defaults
    // are omitted.
    const propertyDefaults = new Map<string, { 'defaultValue': unknown;
      'hasDefault': boolean; }>();

    for (const [
      key,
      propNode
    ] of propertyEntries) {
      if (isRecord(propNode.schema)) {
        const propSem = graph.semantics(propNode);

        if (propSem.hasDefault) {
          propertyDefaults.set(key, {
            'defaultValue': propSem.defaultValue,
            'hasDefault': true
          });
        } else {
          // Try resolving implicit default through $ref / nested properties
          const implicit = this.resolveImplicitDefault(propNode, graph, lookupSchema, new Set());

          if (implicit !== undefined) {
            propertyDefaults.set(key, {
              'defaultValue': implicit,
              'hasDefault': true
            });
          }
        }
      }
    }

    return (
      value: unknown,
      path: string,
      errors: ValidationErrorType[],
      collectErrors: boolean,
      applyDefaults: boolean,
      doCoerce: boolean,
      stripUnknown: boolean
    ): { 'valid': boolean;
      'value': unknown; } => {
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
          if (!collectErrors) {
            return {
              'valid': false,
              'value': refResult.value
            };
          }
          valid = false;
        }
        workingValue = refResult.value;
      }

      // Type check
      if (types.length > 0) {
        let typeValid = false;

        for (const t of types) {
          switch (t) {
            case 'array': if (Array.isArray(workingValue)) {
              typeValid = true;
            } break;
            case 'boolean': if (typeof workingValue === 'boolean') {
              typeValid = true;
            } break;
            case 'integer': if (typeof workingValue === 'number' && Number.isInteger(workingValue)) {
              typeValid = true;
            } break;
            case 'null': if (workingValue === null) {
              typeValid = true;
            } break;
            case 'number': if (typeof workingValue === 'number') {
              typeValid = true;
            } break;
            case 'object': if (typeof workingValue === 'object' && workingValue !== null && !Array.isArray(workingValue)) {
              typeValid = true;
            } break;
            case 'string': if (typeof workingValue === 'string') {
              typeValid = true;
            } break;
          }
        }
        if (!typeValid) {
          if (collectErrors) {
            errors.push(makeError(path, 'type', types.length === 1 ? `must be ${types[0]}` : `must be one of: ${types.join(', ')}`, { 'type': types }));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // Enum
      if (enumValues !== undefined) {
        const matched = enumSet === undefined
          ? enumValues.some((ev) => {
            return deepEqual(ev, workingValue);
          })
          : enumSet.has(workingValue as boolean | null | number | string);

        if (!matched) {
          if (collectErrors) {
            errors.push(makeError(path, 'enum', 'must be one of the allowed values'));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // Const
      if (hasConst && !deepEqual(constVal, workingValue)) {
        if (collectErrors) {
          errors.push(makeError(path, 'const', `must be ${JSON.stringify(constVal)}`));
        }
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // String
      if (typeof workingValue === 'string') {
        const codePointLen = minLength !== undefined || maxLength !== undefined ? [...workingValue].length : 0;

        if (minLength !== undefined && codePointLen < minLength) {
          if (collectErrors) {
            errors.push(makeError(path, 'minLength', `must be at least ${minLength} characters`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (maxLength !== undefined && codePointLen > maxLength) {
          if (collectErrors) {
            errors.push(makeError(path, 'maxLength', `must be at most ${maxLength} characters`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (patternRegex !== undefined && !patternRegex.test(workingValue)) {
          if (collectErrors) {
            errors.push(makeError(path, 'pattern', `must match pattern "${pattern}"`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // Format (outside string block — numeric formats like int32, float apply to numbers)
      if (formatValidator !== undefined && !formatValidator(workingValue)) {
        if (collectErrors) {
          errors.push(makeError(path, 'format', `must match format "${format}"`));
        }
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // Number
      if (typeof workingValue === 'number') {
        if (minimum !== undefined && workingValue < minimum) {
          if (collectErrors) {
            errors.push(makeError(path, 'minimum', `must be >= ${minimum}`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (maximum !== undefined && workingValue > maximum) {
          if (collectErrors) {
            errors.push(makeError(path, 'maximum', `must be <= ${maximum}`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (exclusiveMinimum !== undefined && workingValue <= exclusiveMinimum) {
          if (collectErrors) {
            errors.push(makeError(path, 'exclusiveMinimum', `must be > ${exclusiveMinimum}`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (exclusiveMaximum !== undefined && workingValue >= exclusiveMaximum) {
          if (collectErrors) {
            errors.push(makeError(path, 'exclusiveMaximum', `must be < ${exclusiveMaximum}`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (multipleOf !== undefined && workingValue % multipleOf !== 0) {
          if (collectErrors) {
            errors.push(makeError(path, 'multipleOf', `must be a multiple of ${multipleOf}`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // Object
      if (isRecord(workingValue)) {
        const obj = workingValue;

        // Apply defaults for missing properties BEFORE required check
        if (applyDefaults) {
          for (const [
            key,
            propDefault
          ] of propertyDefaults) {
            if (!(key in obj) && propDefault.hasDefault) {
              obj[key] = structuredClone(propDefault.defaultValue);
            }
          }
        }

        // Required
        if (required !== undefined) {
          for (const key of required) {
            if (!(key in obj)) {
              if (collectErrors) {
                errors.push(makeError(path, 'required', `must have required property '${key}'`, { 'missingProperty': key }));
              }
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': workingValue
                };
              }
              valid = false;
            }
          }
        }

        // Properties + additionalProperties + strip
        for (const key of Object.keys(obj)) {
          const propValidator = propValidators.get(key);
          const childPath = path === '' ? `/${key}` : `${path}/${key}`;

          if (propValidator === undefined) {
            // Check pattern properties first
            let matchedPattern = false;

            if (patternPropValidators !== undefined) {
              for (const pp of patternPropValidators) {
                if (pp.regex.test(key)) {
                  matchedPattern = true;
                  const ppResult = pp.validator(obj[key], childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

                  if (!ppResult.valid) {
                    if (!collectErrors) {
                      return {
                        'valid': false,
                        'value': workingValue
                      };
                    }
                    valid = false;
                  }
                  if (ppResult.value !== obj[key]) {
                    obj[key] = ppResult.value;
                  }
                }
              }
            }

            if (!matchedPattern) {
              if (stripUnknown && allowedKeys !== undefined && !allowedKeys.has(key)) {
                delete obj[key];
              } else if (additionalIsFalse && allowedKeys !== undefined && !allowedKeys.has(key)) {
                if (collectErrors) {
                  errors.push(makeError(childPath, 'additionalProperties', `must NOT have additional property '${key}'`));
                }
                if (!collectErrors) {
                  return {
                    'valid': false,
                    'value': workingValue
                  };
                }
                valid = false;
              } else if (additionalValidator !== undefined) {
                const addResult = additionalValidator(obj[key], childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

                if (!addResult.valid) {
                  if (!collectErrors) {
                    return {
                      'valid': false,
                      'value': workingValue
                    };
                  }
                  valid = false;
                }
                if (addResult.value !== obj[key]) {
                  obj[key] = addResult.value;
                }
              }
            }
          } else {
            // Apply defaults to property if missing
            let propValue = obj[key];

            if (applyDefaults && propValue === undefined) {
              const propDefault = propertyDefaults.get(key);

              if (propDefault !== undefined && propDefault.hasDefault) {
                propValue = structuredClone(propDefault.defaultValue);
                obj[key] = propValue;
              }
            }

            const propResult = propValidator(propValue, childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!propResult.valid) {
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': workingValue
                };
              }
              valid = false;
            }
            if (propResult.value !== propValue) {
              obj[key] = propResult.value;
            }
          }
        }

        // minProperties / maxProperties
        if (minProperties !== undefined || maxProperties !== undefined) {
          const count = Object.keys(obj).length;

          if (minProperties !== undefined && count < minProperties) {
            if (collectErrors) {
              errors.push(makeError(path, 'minProperties', `must have at least ${minProperties} properties`));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
          if (maxProperties !== undefined && count > maxProperties) {
            if (collectErrors) {
              errors.push(makeError(path, 'maxProperties', `must have at most ${maxProperties} properties`));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }
      }

      // Array
      if (Array.isArray(workingValue)) {
        const arr = workingValue;

        if (minItems !== undefined && arr.length < minItems) {
          if (collectErrors) {
            errors.push(makeError(path, 'minItems', `must have at least ${minItems} items`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (maxItems !== undefined && arr.length > maxItems) {
          if (collectErrors) {
            errors.push(makeError(path, 'maxItems', `must have at most ${maxItems} items`));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
        if (uniqueItems) {
          const seen = new Set<unknown>();
          let hasDup = false;

          for (const item of arr) {
            const key = typeof item === 'object' && item !== null ? jsonSortedKeys(item) : item;

            if (seen.has(key)) {
              hasDup = true; break;
            }
            seen.add(key);
          }
          if (hasDup) {
            if (collectErrors) {
              errors.push(makeError(path, 'uniqueItems', 'must have unique items'));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }

        // prefixItems
        if (prefixValidators !== undefined) {
          for (let i = 0; i < prefixValidators.length && i < arr.length; i++) {
            const childPath = `${path}/${i}`;
            const prefixResult = prefixValidators[i](arr[i], childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!prefixResult.valid) {
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': workingValue
                };
              }
              valid = false;
            }
            if (prefixResult.value !== arr[i]) {
              arr[i] = prefixResult.value;
            }
          }
        }

        if (itemValidator !== undefined) {
          const startIndex = prefixValidators === undefined ? 0 : prefixValidators.length;

          for (let i = startIndex; i < arr.length; i++) {
            const childPath = `${path}/${i}`;
            const itemResult = itemValidator(arr[i], childPath, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!itemResult.valid) {
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': workingValue
                };
              }
              valid = false;
            }
            if (itemResult.value !== arr[i]) {
              arr[i] = itemResult.value;
            }
          }
        }

        // contains
        if (containsCheck !== undefined) {
          let count = 0;

          for (const item of arr) {
            if (containsCheck(item)) {
              count++;
            }
          }
          if (minContains !== undefined && count < minContains) {
            if (collectErrors) {
              errors.push(makeError(path, 'contains', `must contain at least ${minContains} matching items`));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          } else if (maxContains !== undefined && count > maxContains) {
            if (collectErrors) {
              errors.push(makeError(path, 'contains', `must contain at most ${maxContains} matching items`));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          } else if (minContains === undefined && maxContains === undefined && count === 0) {
            if (collectErrors) {
              errors.push(makeError(path, 'contains', 'must contain at least one matching item'));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }
      }

      // allOf
      if (allOfValidators !== undefined) {
        for (const allOfValidator of allOfValidators) {
          const allOfResult = allOfValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

          if (!allOfResult.valid) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': allOfResult.value
              };
            }
            valid = false;
          }
          workingValue = allOfResult.value;
        }
      }

      // anyOf
      if (anyOfChecks !== undefined) {
        const matched = anyOfChecks.some((c) => {
          return c(workingValue);
        });

        if (!matched) {
          if (collectErrors) {
            errors.push(makeError(path, 'anyOf', 'must match at least one schema in anyOf'));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // oneOf
      if (oneOfChecks !== undefined) {
        let count = 0;

        for (const c of oneOfChecks) {
          if (c(workingValue)) {
            count++;
            if (count > 1) {
              break;
            }
          }
        }

        if (count !== 1) {
          if (collectErrors) {
            const msg = count === 0
              ? 'must match exactly one schema in oneOf (matched none)'
              : 'must match exactly one schema in oneOf (matched multiple)';

            errors.push(makeError(path, 'oneOf', msg, { 'matchCount': count }));
          }
          if (!collectErrors) {
            return {
              'valid': false,
              'value': workingValue
            };
          }
          valid = false;
        }
      }

      // not
      if (notCheck !== undefined && notCheck(workingValue)) {
        if (collectErrors) {
          errors.push(makeError(path, 'not', 'must not match schema'));
        }
        if (!collectErrors) {
          return {
            'valid': false,
            'value': workingValue
          };
        }
        valid = false;
      }

      // if/then/else
      if (ifCheck !== undefined) {
        if (ifCheck(workingValue)) {
          if (thenValidator !== undefined) {
            const thenResult = thenValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!thenResult.valid) {
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': thenResult.value
                };
              }
              valid = false;
            }
            workingValue = thenResult.value;
          }
        } else if (elseValidator !== undefined) {
          const elseResult = elseValidator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

          if (!elseResult.valid) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': elseResult.value
              };
            }
            valid = false;
          }
          workingValue = elseResult.value;
        }
      }

      // dependentRequired
      if (depRequiredEntries.length > 0 && isRecord(workingValue)) {
        const obj = workingValue;

        for (const [
          trigger,
          deps
        ] of depRequiredEntries) {
          if (trigger in obj) {
            for (const dep of deps) {
              if (!(dep in obj)) {
                if (collectErrors) {
                  errors.push(makeError(path, 'dependentRequired', `property '${trigger}' requires property '${dep}'`, {
                    'missingProperty': dep,
                    'property': trigger
                  }));
                }
                if (!collectErrors) {
                  return {
                    'valid': false,
                    'value': workingValue
                  };
                }
                valid = false;
              }
            }
          }
        }
      }

      // dependentSchemas
      if (depSchemaValidators !== undefined && isRecord(workingValue)) {
        const obj = workingValue;

        for (const dep of depSchemaValidators) {
          if (dep.trigger in obj) {
            const depResult = dep.validator(workingValue, path, errors, collectErrors, applyDefaults, doCoerce, stripUnknown);

            if (!depResult.valid) {
              if (!collectErrors) {
                return {
                  'valid': false,
                  'value': depResult.value
                };
              }
              valid = false;
            }
            workingValue = depResult.value;
          }
        }
      }

      // propertyNames
      if (propertyNamesValidator !== undefined && isRecord(workingValue)) {
        for (const key of Object.keys(workingValue)) {
          const pnResult = propertyNamesValidator(key, path === '' ? `/${key}` : `${path}/${key}`, errors, collectErrors, false, false, false);

          if (!pnResult.valid) {
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }
      }

      // Custom keywords from graph extensions
      if (customKeywordEntries !== undefined) {
        const dataType = workingValue === null ? 'null' : Array.isArray(workingValue) ? 'array' : typeof workingValue;

        for (const entry of customKeywordEntries) {
          if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
            continue;
          }

          const ctx: KeywordContextInterface = {
            'parentData': undefined,
            'parentKey': '',
            path,
            'rootData': workingValue
          };
          const kwResult = entry.validate(entry.schemaValue, workingValue, ctx);

          if (kwResult === false) {
            if (collectErrors) {
              errors.push(makeError(path, entry.keyword, `must pass "${entry.keyword}" validation`));
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          } else if (Array.isArray(kwResult) && kwResult.length > 0) {
            if (collectErrors) {
              errors.push(...kwResult);
            }
            if (!collectErrors) {
              return {
                'valid': false,
                'value': workingValue
              };
            }
            valid = false;
          }
        }
      }

      return {
        valid,
        'value': workingValue
      };
    };
  }

  private compileNumberCheck(
    minimum: number | undefined,
    maximum: number | undefined,
    exclusiveMinimum: number | undefined,
    exclusiveMaximum: number | undefined,
    multipleOf: number | undefined
  ): CheckFnType | undefined {
    const checks: Array<(v: number) => boolean> = [];

    if (minimum !== undefined) {
      checks.push((v) => {
        return v >= minimum;
      });
    }
    if (maximum !== undefined) {
      checks.push((v) => {
        return v <= maximum;
      });
    }
    if (exclusiveMinimum !== undefined) {
      checks.push((v) => {
        return v > exclusiveMinimum;
      });
    }
    if (exclusiveMaximum !== undefined) {
      checks.push((v) => {
        return v < exclusiveMaximum;
      });
    }
    if (multipleOf !== undefined) {
      checks.push((v) => {
        return v % multipleOf === 0;
      });
    }

    if (checks.length === 0) {
      return undefined;
    }

    return (v) => {
      if (typeof v !== 'number') {
        return true;
      }

      for (const check of checks) {
        if (!check(v)) {
          return false;
        }
      }

      return true;
    };
  }

  private compileRefCheck(
    ref: string,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType | undefined {
    // Local fragment refs — resolve via graph
    if (ref.startsWith('#')) {
      const fragment = ref.slice(1);
      let targetNode: SchemaGraphNodeInterface;

      try {
        targetNode = graph.resolveFragment(fragment);
      } catch {
        return undefined;
      }

      if (typeof targetNode.schema === 'boolean') {
        return targetNode.schema
          ? () => {
            return true;
          }
          : () => {
            return false;
          };
      }

      // Eager compilation for non-circular refs, lazy for circular
      if (this.compilingNodes.has(targetNode)) {
        let cachedCheck: CheckFnType | undefined;

        return (v) => {
          if (cachedCheck === undefined) {
            cachedCheck = this.compileNodeCheck(targetNode, formatRegistry, graph, lookupSchema);
          }

          return cachedCheck(v);
        };
      }

      return this.compileNodeCheck(targetNode, formatRegistry, graph, lookupSchema);
    }

    // Non-local refs
    const hashIndex = ref.indexOf('#');
    const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

    if ((fragment === '' || fragment === '/') && this.lookupCompiled !== undefined) {
      // Simple ref — use compiled validator from registry
      return (v) => {
        const compiled = this.lookupCompiled!(schemaId);

        return compiled === undefined ? true : compiled.check(v);
      };
    }

    // Resolve ref through lookupSchema (handles anchors and pointer fragments)
    if (lookupSchema !== undefined) {
      const refSchema = lookupSchema(schemaId);

      if (refSchema !== undefined) {
        const refGraph = new SchemaGraph(refSchema);

        if (fragment !== '' && fragment !== '/') {
          // Resolve anchor or pointer in external schema's graph
          let targetNode: SchemaGraphNodeInterface | undefined;

          try {
            targetNode = refGraph.resolveFragment(fragment);
          } catch {
            // Fall through
          }

          if (targetNode !== undefined) {
            if (typeof targetNode.schema === 'boolean') {
              return targetNode.schema
                ? () => {
                  return true;
                }
                : () => {
                  return false;
                };
            }

            // External refs are never circular (different graph)
            return this.compileNodeCheck(targetNode, formatRegistry, refGraph, lookupSchema);
          }
        } else {
          // No fragment — compile the whole external schema via its root node
          return this.compileNodeCheck(refGraph.rootNode, formatRegistry, refGraph, lookupSchema);
        }
      }
    }

    return undefined;
  }

  private compileStringCheck(
    minLength: number | undefined,
    maxLength: number | undefined,
    pattern: string | undefined,
    format: string | undefined,
    formatRegistry: FormatRegistry,
    sem: SchemaGraphSemanticsInterface
  ): CheckFnType | undefined {
    const checks: Array<(v: string) => boolean> = [];

    if (minLength !== undefined) {
      checks.push((v) => {
        return [...v].length >= minLength;
      });
    }
    if (maxLength !== undefined) {
      checks.push((v) => {
        return [...v].length <= maxLength;
      });
    }
    if (pattern !== undefined) {
      const regex = new RegExp(pattern, 'u');

      checks.push((v) => {
        return regex.test(v);
      });
    }
    // Format check is separate — it may apply to non-string types (e.g. int32, float)
    let formatCheck: CheckFnType | undefined;

    if (format !== undefined) {
      const hasFormatAssertion = this.hasFormatAssertions(sem);

      if (hasFormatAssertion) {
        const formatValidator = formatRegistry.get(format);

        if (formatValidator !== undefined) {
          formatCheck = (v) => {
            return formatValidator(v);
          };
        }
      }
    }

    if (checks.length === 0 && formatCheck === undefined) {
      return undefined;
    }

    // If only format check and no string checks, return format check directly
    // (it handles its own type checking)
    if (checks.length === 0 && formatCheck !== undefined) {
      return formatCheck;
    }

    const stringChecks = [...checks];

    return (v) => {
      if (typeof v === 'string') {
        for (const check of stringChecks) {
          if (!check(v)) {
            return false;
          }
        }
      }

      if (formatCheck !== undefined && !formatCheck(v)) {
        return false;
      }

      return true;
    };
  }

  private compileTypeCheck(types: string[]): CheckFnType {
    if (types.length === 1) {
      switch (types[0]) {
        case 'array': return (v) => {
          return Array.isArray(v);
        };
        case 'boolean': return (v) => {
          return typeof v === 'boolean';
        };
        case 'integer': return (v) => {
          return typeof v === 'number' && Number.isInteger(v);
        };
        case 'null': return (v) => {
          return v === null;
        };
        case 'number': return (v) => {
          return typeof v === 'number';
        };
        case 'object': return (v) => {
          return typeof v === 'object' && v !== null && !Array.isArray(v);
        };
        case 'string': return (v) => {
          return typeof v === 'string';
        };
      }
    }

    const typeSet = new Set(types);
    const hasNull = typeSet.has('null');
    const hasInteger = typeSet.has('integer');

    return (v) => {
      if (v === null) {
        return hasNull;
      }
      if (Array.isArray(v)) {
        return typeSet.has('array');
      }
      const t = typeof v;

      if (t === 'number') {
        return typeSet.has('number') || (hasInteger && Number.isInteger(v));
      }

      return typeSet.has(t);
    };
  }

  // ---------------------------------------------------------------------------
  // validate() compilation — with errors and mutation support
  // ---------------------------------------------------------------------------

  private compileValidate(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): (data: unknown, options?: CompiledValidateOptionsInterface) => CompiledValidationResultInterface {
    const validateWithErrors = this.compileValidateWithErrors(schema, formatRegistry, graph, lookupSchema);
    const checkFn = this.compileCheck(schema, formatRegistry, graph, lookupSchema);

    // Get types from graph semantics for root coercion
    const graphNode = graph.node(schema);
    const rootSem = graphNode === undefined ? undefined : graph.semantics(graphNode);
    const rootTypes = rootSem === undefined ? [] : rootSem.schemaTypes;
    const rootHasDefault = rootSem === undefined ? false : rootSem.hasDefault;
    const rootDefaultValue = rootSem === undefined ? undefined : rootSem.defaultValue;

    return (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
      let workingValue = data;

      // Apply coercion at root level
      if (options?.coerce && rootTypes.length > 0) {
        workingValue = coerceValue(rootTypes, workingValue);
      }

      // Apply defaults at root level
      if (options?.applyDefaults && workingValue === undefined && rootHasDefault) {
        workingValue = structuredClone(rootDefaultValue);
      }

      // For full mutation modes, delegate to validateWithErrors
      if (options?.applyDefaults || options?.coerce || options?.stripUnknownProperties) {
        const errors: ValidationErrorType[] = [];
        const result = validateWithErrors(workingValue, '', errors, options?.collectErrors ?? true, options?.applyDefaults ?? false, options?.coerce ?? false, options?.stripUnknownProperties ?? false);

        return {
          errors,
          'valid': result.valid,
          'value': result.value
        };
      }

      // Fast path — no mutations
      if (options?.collectErrors === false) {
        return {
          'errors': [],
          'valid': checkFn(workingValue),
          'value': workingValue
        };
      }

      const errors: ValidationErrorType[] = [];
      const result = validateWithErrors(workingValue, '', errors, true, false, false, false);

      return {
        errors,
        'valid': result.valid,
        'value': result.value
      };
    };
  }

  /**
   * Entry point: compiles a schema object into a validate-with-errors function.
   * Thin wrapper that resolves the graph node, then delegates to compileNodeValidateWithErrors.
   */
  private compileValidateWithErrors(
    schema: Record<string, unknown>,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ValidateWithErrorsFnType {
    const graphNode = graph.node(schema);

    if (graphNode === undefined) {
      return (value, _path, _errors, _collectErrors, _applyDefaults, _doCoerce, _stripUnknown) => {
        return {
          'valid': true,
          'value': value
        };
      };
    }

    return this.compileNodeValidateWithErrors(graphNode, formatRegistry, graph, lookupSchema);
  }

  private engineFallback(engine: GraphEngine): CompiledValidatorInterface {
    return {
      'check': (data: unknown): boolean => {
        return engine.execute(data, '', { 'collectErrors': false }).valid;
      },
      'compiled': false,
      'validate': (data: unknown, options?: CompiledValidateOptionsInterface): CompiledValidationResultInterface => {
        const result = engine.execute(data, '', {
          'applyDefaults': options?.applyDefaults ?? false,
          'coerce': options?.coerce ?? false,
          'collectErrors': options?.collectErrors ?? true,
          'removeAdditional': options?.removeAdditional ?? false,
          'stripUnknownProperties': options?.stripUnknownProperties ?? false
        });

        return {
          'errors': result.errors,
          'valid': result.valid,
          'value': result.value
        };
      }
    };
  }


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private hasFormatAssertions(sem: SchemaGraphSemanticsInterface): boolean {
    const rootVocabulary = sem.schemaVocabulary;

    if (rootVocabulary !== undefined && rootVocabulary !== null && typeof rootVocabulary === 'object') {
      return (rootVocabulary as Record<string, unknown>)['https://json-schema.org/draft/2020-12/vocab/format-assertion'] === true;
    }

    const schemaUri = sem.schemaDialect;

    // 2020-12 without explicit format-assertion vocabulary → annotation only
    if (schemaUri === 'https://json-schema.org/draft/2020-12/schema') {
      return false;
    }

    // No $schema or other dialect → default to enabled
    return true;
  }

  private needsEngineFallback(
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): boolean {
    return this.nodeHasUnsupported(graph, graph.rootNode, lookupSchema, new Set());
  }

  private nodeHasUnsupported(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<SchemaGraphNodeInterface>
  ): boolean {
    if (visited.has(node)) {
      return false;
    }
    visited.add(node);

    const sem = graph.semantics(node);

    // Dynamic refs/anchors
    if (sem.dynamicRef !== undefined || sem.dynamicAnchor !== undefined) {
      return true;
    }

    // Unevaluated properties/items
    if (sem.unevaluatedPropertiesNode !== undefined || sem.unevaluatedItemsNode !== undefined) {
      return true;
    }

    // Ontology extensions
    if (sem.rdfsRange !== undefined || sem.rdfsDomain !== undefined) {
      return true;
    }

    // Check $ref targets recursively
    if (sem.ref !== undefined) {
      if (sem.refTargetNode !== undefined) {
        if (this.nodeHasUnsupported(graph, sem.refTargetNode, lookupSchema, visited)) {
          return true;
        }
      } else if (lookupSchema !== undefined) {
        const hashIndex = sem.ref.indexOf('#');
        const schemaId = hashIndex === -1 ? sem.ref : sem.ref.slice(0, hashIndex);
        const refSchema = lookupSchema(schemaId);

        if (refSchema !== undefined) {
          const refGraph = new SchemaGraph(refSchema);

          if (this.nodeHasUnsupported(refGraph, refGraph.rootNode, lookupSchema, visited)) {
            return true;
          }
        }
      }
    }

    // Check composition targets
    for (const branch of [
      ...sem.allOf,
      ...sem.anyOf,
      ...sem.oneOf
    ]) {
      if (this.nodeHasUnsupported(graph, branch, lookupSchema, visited)) {
        return true;
      }
    }

    // Check not, if, then, else
    for (const child of [
      sem.notNode,
      sem.ifNode,
      sem.thenNode,
      sem.elseNode
    ]) {
      if (child !== undefined && this.nodeHasUnsupported(graph, child, lookupSchema, visited)) {
        return true;
      }
    }

    // Check properties
    for (const [
      , propNode
    ] of sem.properties) {
      if (this.nodeHasUnsupported(graph, propNode, lookupSchema, visited)) {
        return true;
      }
    }

    // Check items
    if (sem.itemsNode !== undefined && this.nodeHasUnsupported(graph, sem.itemsNode, lookupSchema, visited)) {
      return true;
    }

    // Check additionalProperties
    if (sem.additionalPropertiesNode !== undefined && typeof sem.additionalPropertiesNode !== 'boolean'
      && this.nodeHasUnsupported(graph, sem.additionalPropertiesNode, lookupSchema, visited)) {
      return true;
    }

    return false;
  }

  /**
   * Compute an implicit default for a schema node by recursively following
   * $ref chains and collecting explicit `default` values from leaf properties.
   *
   * Only creates parent objects when at least one descendant carries a concrete
   * default. Optional / nullable sub-objects without defaults are omitted.
   */
  private resolveImplicitDefault(
    node: SchemaGraphNodeInterface,
    graph: SchemaGraph,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>
  ): unknown {
    if (!isRecord(node.schema)) {
      return undefined;
    }

    // Guard against circular refs
    if (visited.has(node.schema)) {
      return undefined;
    }
    visited.add(node.schema);

    const sem = graph.semantics(node);

    // Explicit default wins immediately
    if (sem.hasDefault) {
      return structuredClone(sem.defaultValue);
    }

    // Const value is also a concrete default
    if (sem.hasConst) {
      return sem.constValue;
    }

    // Follow $ref
    if (sem.ref !== undefined) {
      const ref = sem.ref;

      if (ref.startsWith('#')) {
        // Local ref
        try {
          const targetNode = graph.resolveFragment(ref.slice(1));

          return this.resolveImplicitDefault(targetNode, graph, lookupSchema, visited);
        } catch {
          return undefined;
        }
      }

      // External ref
      if (lookupSchema !== undefined) {
        const hashIndex = ref.indexOf('#');
        const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
        const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
        const refSchema = lookupSchema(schemaId);

        if (refSchema !== undefined) {
          const refGraph = new SchemaGraph(refSchema);

          if (fragment !== '' && fragment !== '/') {
            try {
              const targetNode = refGraph.resolveFragment(fragment);

              return this.resolveImplicitDefault(targetNode, refGraph, lookupSchema, visited);
            } catch {
              return undefined;
            }
          }

          const rootNode = refGraph.rootNode;

          return this.resolveImplicitDefault(rootNode, refGraph, lookupSchema, visited);
        }
      }

      return undefined;
    }

    // Object with properties — recurse into children, only emit if ≥1 child has a value
    const types = sem.schemaTypes;

    if (types.includes('object') || sem.properties.size > 0) {
      const result: Record<string, unknown> = {};
      let hasValue = false;

      for (const [
        key,
        propNode
      ] of sem.properties) {
        const childValue = this.resolveImplicitDefault(propNode, graph, lookupSchema, new Set(visited));

        if (childValue !== undefined) {
          result[key] = childValue;
          hasValue = true;
        }
      }

      return hasValue ? result : undefined;
    }

    return undefined;
  }

  /**
   * Emit a single flat closure for simple object schemas:
   * - type: 'object'
   * - properties with primitive types + optional constraints
   * - required array
   * - additionalProperties: false (optional)
   * - No composition, no $ref, no pattern properties
   */
  private tryCompileNodeFlatObjectCheck(
    graphNode: SchemaGraphNodeInterface,
    formatRegistry: FormatRegistry,
    graph: SchemaGraph,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): CheckFnType | undefined {
    const sem = graph.semantics(graphNode);

    if (!sem.schemaTypes.includes('object')) {
      return undefined;
    }
    if (sem.allOf.length > 0 || sem.anyOf.length > 0 || sem.oneOf.length > 0 || sem.notNode !== undefined || sem.ifNode !== undefined) {
      return undefined;
    }
    if (sem.ref !== undefined) {
      return undefined;
    }
    if (sem.patternPropertyEntries.length > 0) {
      return undefined;
    }
    if (sem.minProperties !== undefined || sem.maxProperties !== undefined) {
      return undefined;
    }
    if (sem.additionalPropertiesNode !== undefined && sem.additionalPropertiesNode !== false && sem.additionalPropertiesNode !== true) {
      return undefined;
    }
    if (sem.containsNode !== undefined) {
      return undefined;
    }
    if (Object.keys(sem.dependentRequired).length > 0) {
      return undefined;
    }
    if (this.activeCustomKeywords.length > 0 && Object.keys(sem.extensions).length > 0) {
      return undefined;
    }

    if (sem.properties.size === 0) {
      return undefined;
    }

    const requiredSet = new Set(sem.required);
    const additionalPropertiesNode = sem.additionalPropertiesNode;
    const noAdditional = additionalPropertiesNode === false;
    const propNames = [...sem.properties.keys()];
    const propNameSet = new Set(propNames);

    // Build inline property checks
    interface PropCheck {
      'check': CheckFnType;
      'name': string;
      'required': boolean;
    }

    const propChecks: PropCheck[] = [];

    for (const [
      name,
      propNode
    ] of sem.properties) {
      // Compile the property's validator — for nested objects, this recurses
      const check = this.compileNodeOrBooleanCheck(propNode, formatRegistry, graph, lookupSchema);

      propChecks.push({
        check,
        name,
        'required': requiredSet.has(name)
      });
    }

    return (v: unknown): boolean => {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        return false;
      }
      const obj = v as Record<string, unknown>;

      // Required + property checks in one pass
      for (const pc of propChecks) {
        const val = obj[pc.name];

        if (val === undefined && !(pc.name in obj)) {
          if (pc.required) {
            return false;
          }
          continue;
        }
        if (!pc.check(val)) {
          return false;
        }
      }

      // Additional properties check
      if (noAdditional) {
        for (const key of Object.keys(obj)) {
          if (!propNameSet.has(key)) {
            return false;
          }
        }
      }

      return true;
    };
  }
}
