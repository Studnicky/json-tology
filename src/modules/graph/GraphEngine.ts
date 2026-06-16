import type { ValidationErrorType } from '../../types/Validation.js';
import type {
  GraphEngineOptionsType, GraphExecutionResultType,
  KeywordDefinitionType
} from '../../types/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { EffectiveOptionsType } from '../../types/EffectiveOptions.js';

import { isRecord } from '../data/DataTypes.js';
import { FormatRegistry } from '../format/FormatRegistry.js';
import { SchemaGraph } from './SchemaGraph.js';
import { DEFAULT_OPTIONS } from '../../constants/DIALECT.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import { GraphError } from '../../errors/GraphError.js';
import type { JsonSchemaDocumentType } from '../../types/Schema.js';

/**
 * Core validation and execution engine for compiled JSON Schema graphs.
 *
 * @remarks
 * `execute()`, `check()`, and `errors()` are removed — use
 * `registry.validator(id).validate()` instead.  This class is retained for
 * its graph construction helpers (`rootSchemaId`, `graphLookup`,
 * `hasRegisteredCustomKeywords`, `keywords`) which are consumed by
 * `SchemaRegistry` and related infrastructure.
 *
 * @category Validation
 * @since 0.1.0
 * @see {@link GraphEngineInterface}
 * @group Graph
 */
export class GraphEngine implements GraphEngineInterface {
  private readonly customKeywords: KeywordDefinitionType[];
  public readonly formatRegistry: FormatRegistryInterface;
  private readonly graphCache = new WeakMap<object, SchemaGraph>();
  private readonly options: EffectiveOptionsType;

  public constructor(public readonly rootSchema: JsonSchemaDocumentType, options: GraphEngineOptionsType = {}) {
    const {
      formatRegistry, keywords, ...rest
    } = options;

    this.formatRegistry = formatRegistry ?? FormatRegistry.builtin();
    this.customKeywords = keywords ?? [];
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest
    };
  }

  public check(value: unknown, options?: { 'pointer'?: string }): boolean {
    void value;
    void options;
    throw new GraphError('GraphEngine.check() is removed; use registry.validator(id).validate()', {
      'code': 'EXEC_NOT_SUPPORTED',
      'pointer': ''
    });
  }

  public errors(value: unknown, options?: { 'pointer'?: string }): ValidationErrorType[] {
    void value;
    void options;
    throw new GraphError('GraphEngine.errors() is removed; use registry.validator(id).validate()', {
      'code': 'EXEC_NOT_SUPPORTED',
      'pointer': ''
    });
  }

  public execute(
    value: unknown,
    options?: { 'overrides'?: Partial<Omit<GraphEngineOptionsType, 'formatRegistry' | 'lookupSchema'>>
      'pointer'?: string; }
  ): GraphExecutionResultType {
    void value;
    void options;
    throw new GraphError('GraphEngine.execute() is removed; use registry.validator(id).validate()', {
      'code': 'EXEC_NOT_SUPPORTED',
      'pointer': ''
    });
  }

  /** @internal Used by SchemaRegistry to obtain a cached graph for lookupGraph wiring. */
  public graphFor(rootSchema: JsonSchemaDocumentType): SchemaGraphInterface {
    if (!isRecord(rootSchema)) {
      return new SchemaGraph(rootSchema);
    }

    const cached = this.graphCache.get(rootSchema);

    if (cached !== undefined) {
      return cached;
    }

    const graph = new SchemaGraph(rootSchema);

    this.graphCache.set(rootSchema, graph);

    return graph;
  }

  public graphLookup(): ((schemaId: string) => SchemaGraphInterface | undefined) | undefined {
    return this.options.lookupGraph;
  }

  public hasRegisteredCustomKeywords(): boolean {
    return this.customKeywords.length > 0;
  }

  public keywords(): KeywordDefinitionType[] {
    return this.customKeywords;
  }

  public rootSchemaId(): string | undefined {
    return GraphEngineSupport.schemaId(this.rootSchema);
  }

  public schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined {
    return this.options.lookupSchema;
  }
}
