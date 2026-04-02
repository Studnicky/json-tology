import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type {
  KeywordContextInterface, KeywordDefinitionInterface
} from '../../interfaces/GraphEngine.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import { isRecord } from '../data/dataTypes.js';
import {
  compileConstCheck,
  compileEnumCheck
} from './schemaCompilerGraph.js';
import { normalizeKeywordTypes } from './schemaCompilerSupport.js';
import type { CheckFnType } from '../../types/Validation.js';
import type { SchemaCompilerCheckExecutionContextInterface } from '../../interfaces/SchemaCompilerCheckExecutionContext.js';

export type { SchemaCompilerCheckExecutionContextInterface } from '../../interfaces/SchemaCompilerCheckExecutionContext.js';

export function buildNodeCheckExecution(
  context: SchemaCompilerCheckExecutionContextInterface,
  graphNode: SchemaGraphNodeInterface,
  formatRegistry: FormatRegistryInterface,
  graph: SchemaGraphInterface,
  lookupSchema?: (id: string) => Record<string, unknown> | undefined
): CheckFnType {
  const fastPath = context.tryCompileNodeFlatObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

  if (fastPath !== undefined) {
    return fastPath;
  }

  const checks: CheckFnType[] = [];
  const sem = graph.semantics(graphNode);
  const types = sem.schemaTypes;

  if (types.length > 0) {
    checks.push(context.compileTypeCheck(types));
  }

  if (sem.hasConst) {
    checks.push(compileConstCheck(sem.constValue));
  }

  if (sem.enumValues !== undefined) {
    checks.push(compileEnumCheck(sem.enumValues));
  }

  if (sem.minLength !== undefined || sem.maxLength !== undefined
    || sem.pattern !== undefined || sem.format !== undefined) {
    const stringCheck = context.compileStringCheck(
      sem.minLength,
      sem.maxLength,
      sem.pattern,
      sem.format,
      formatRegistry,
      sem
    );

    if (stringCheck !== undefined) {
      checks.push(stringCheck);
    }
  }

  if (sem.minimum !== undefined || sem.maximum !== undefined || sem.exclusiveMinimum !== undefined
    || sem.exclusiveMaximum !== undefined || sem.multipleOf !== undefined) {
    const numCheck = context.compileNumberCheck(
      sem.minimum,
      sem.maximum,
      sem.exclusiveMinimum,
      sem.exclusiveMaximum,
      sem.multipleOf
    );

    if (numCheck !== undefined) {
      checks.push(numCheck);
    }
  }

  if (typeof sem.ref === 'string') {
    const refCheck = context.compileRefCheck(sem.ref, formatRegistry, graph, lookupSchema);

    if (refCheck !== undefined) {
      checks.push(refCheck);
    }
  }

  if (sem.schemaTypes.includes('object') || sem.properties.size > 0 || sem.required.length > 0) {
    const objCheck = context.compileNodeObjectCheck(graphNode, formatRegistry, graph, lookupSchema);

    if (objCheck !== undefined) {
      checks.push(objCheck);
    }
  }

  if (Object.keys(sem.dependentRequired).length > 0) {
    const depEntries = Object.entries(sem.dependentRequired);

    checks.push((value) => {
      if (!isRecord(value)) {
        return true;
      }
      const obj = value;

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

  if (sem.dependentSchemaEntries.length > 0) {
    const depSchemaChecks: Array<{ 'check': CheckFnType;
      'trigger': string; }> = [];

    for (const [
      trigger,
      node
    ] of sem.dependentSchemaEntries) {
      let depCheck: CheckFnType;

      if (typeof node.schema === 'boolean') {
        depCheck = node.schema
          ? () => {
            return true;
          }
          : () => {
            return false;
          };
      } else {
        depCheck = context.compileNodeCheck(node, formatRegistry, graph, lookupSchema);
      }
      depSchemaChecks.push({
        'check': depCheck,
        'trigger': trigger
      });
    }

    if (depSchemaChecks.length > 0) {
      checks.push((value) => {
        if (!isRecord(value)) {
          return true;
        }
        const obj = value;

        for (const dep of depSchemaChecks) {
          if (dep.trigger in obj && !dep.check(value)) {
            return false;
          }
        }

        return true;
      });
    }
  }

  if (sem.propertyNamesNode !== undefined) {
    const pnCheck = context.compileNodeOrBooleanCheck(sem.propertyNamesNode, formatRegistry, graph, lookupSchema);

    checks.push((value) => {
      if (!isRecord(value)) {
        return true;
      }

      for (const key of Object.keys(value)) {
        if (!pnCheck(key)) {
          return false;
        }
      }

      return true;
    });
  }

  if (sem.schemaTypes.includes('array') || sem.itemsNode !== undefined || sem.prefixItems.length > 0) {
    const arrCheck = context.compileNodeArrayCheck(graphNode, formatRegistry, graph, lookupSchema);

    if (arrCheck !== undefined) {
      checks.push(arrCheck);
    }
  }

  if (sem.allOf.length > 0) {
    const allOfChecks = sem.allOf.map((node) => {
      return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
    });

    checks.push((value) => {
      return allOfChecks.every((check) => {
        return check(value);
      });
    });
  }

  if (sem.anyOf.length > 0) {
    const anyOfChecks = sem.anyOf.map((node) => {
      return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
    });

    checks.push((value) => {
      return anyOfChecks.some((check) => {
        return check(value);
      });
    });
  }

  if (sem.oneOf.length > 0) {
    const oneOfChecks = sem.oneOf.map((node) => {
      return context.compileNodeOrBooleanCheck(node, formatRegistry, graph, lookupSchema);
    });

    checks.push((value) => {
      let count = 0;

      for (const check of oneOfChecks) {
        if (check(value)) {
          count++;
          if (count > 1) {
            return false;
          }
        }
      }

      return count === 1;
    });
  }

  if (sem.complementNode !== undefined) {
    const complementCheck = context.compileNodeOrBooleanCheck(sem.complementNode, formatRegistry, graph, lookupSchema);

    checks.push((value) => {
      return !complementCheck(value);
    });
  }

  if (sem.ifNode !== undefined) {
    const ifCheck = context.compileNodeOrBooleanCheck(sem.ifNode, formatRegistry, graph, lookupSchema);
    const thenCheck = sem.thenNode === undefined
      ? undefined
      : context.compileNodeOrBooleanCheck(sem.thenNode, formatRegistry, graph, lookupSchema);
    const elseCheck = sem.elseNode === undefined
      ? undefined
      : context.compileNodeOrBooleanCheck(sem.elseNode, formatRegistry, graph, lookupSchema);

    checks.push((value) => {
      if (ifCheck(value)) {
        return thenCheck === undefined || thenCheck(value);
      }

      return elseCheck === undefined || elseCheck(value);
    });
  }

  if (context.activeCustomKeywords.length > 0) {
    const extensionEntries: Array<{ 'allowedTypes': string[] | undefined;
      'keyword': string;
      'schemaValue': unknown;
      'validate': KeywordDefinitionInterface['validate']; }> = [];

    for (const kw of context.activeCustomKeywords) {
      if (kw.keyword in sem.extensions) {
        extensionEntries.push({
          'allowedTypes': normalizeKeywordTypes(kw.type),
          'keyword': kw.keyword,
          'schemaValue': sem.extensions[kw.keyword],
          'validate': kw.validate
        });
      }
    }

    if (extensionEntries.length > 0) {
      checks.push((value) => {
        let dataType: string;

        if (value === null) {
          dataType = 'null';
        } else if (Array.isArray(value)) {
          dataType = 'array';
        } else {
          dataType = typeof value;
        }

        for (const entry of extensionEntries) {
          if (entry.allowedTypes !== undefined && !entry.allowedTypes.includes(dataType)) {
            continue;
          }

          const ctx: KeywordContextInterface = {
            'parentData': undefined,
            'parentKey': '',
            'path': '',
            'rootData': value
          };
          const result = entry.validate(entry.schemaValue, value, ctx);

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

  if (checks.length === 0) {
    return () => {
      return true;
    };
  }
  if (checks.length === 1) {
    return checks[0];
  }

  return (value) => {
    for (const check of checks) {
      if (!check(value)) {
        return false;
      }
    }

    return true;
  };
}
