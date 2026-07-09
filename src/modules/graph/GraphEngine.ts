import type {
  GraphEngineOptionsType,
  KeywordDefinitionType
} from '../../types/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineInterface.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistryInterface.js';
import type { LoggerInterface } from '../../interfaces/LoggerInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { EffectiveOptionsType } from '../../types/EffectiveOptionsType.js';

import { DataType } from '../data/DataType.js';
import { FormatRegistry } from '../format/FormatRegistry.js';
import { LogScope } from '../data/LogScope.js';
import { SchemaGraph } from './SchemaGraph.js';
import { DEFAULT_OPTIONS } from '../../constants/DIALECT.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import type { JsonSchemaDocumentType } from '../../types/Schema.js';

/**
 * Graph construction and lookup helpers for the schema graph.
 *
 * @remarks
 * Builds and caches `SchemaGraph` instances and exposes the root schema,
 * format registry, custom keywords, and lookup functions consumed by
 * `SchemaRegistry` and the compiler. Validation runs through
 * `registry.validator(id).validate()`.
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
  private readonly logger: LoggerInterface;
  private readonly options: EffectiveOptionsType;

  public constructor(public readonly rootSchema: JsonSchemaDocumentType, options: GraphEngineOptionsType = {}) {
    const {
      formatRegistry, keywords, logger, ...rest
    } = options;

    this.formatRegistry = formatRegistry ?? FormatRegistry.builtin();
    this.customKeywords = keywords ?? [];
    this.logger = logger ?? SILENT_LOGGER;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...rest
    };
    this.logger.trace(LogScope.format('GraphEngine', 'constructor', `engine built for ${GraphEngineSupport.schemaId(rootSchema) ?? '<anonymous>'}`));
  }

  /** @internal Used by SchemaRegistry to obtain a cached graph for lookupGraph wiring. */
  public graphFor(rootSchema: JsonSchemaDocumentType): SchemaGraphInterface {
    if (!DataType.isRecord(rootSchema)) {
      return new SchemaGraph(rootSchema);
    }

    const cached = this.graphCache.get(rootSchema);

    if (cached !== undefined) {
      return cached;
    }

    this.logger.trace(LogScope.format('GraphEngine', 'graphFor', `building graph for ${GraphEngineSupport.schemaId(rootSchema) ?? '<anonymous>'}`));

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
    const result = GraphEngineSupport.schemaId(this.rootSchema);

    return result;
  }

  public schemaLookup(): ((schemaId: string) => Record<string, unknown> | undefined) | undefined {
    return this.options.lookupSchema;
  }
}
