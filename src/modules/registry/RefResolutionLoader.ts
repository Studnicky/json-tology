/**
 * RefResolutionLoader — transitive $ref resolution walker.
 *
 * Extracted from JsonTology._resolveAllRefs. Takes a SchemaRegistryInterface
 * and a LoaderType; has no dependency on JsonTology itself.
 */

import type { RefResolutionLoaderInterface } from '../../interfaces/RefResolutionLoader.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type { LoaderType } from '../../types/Loader.js';

import { GraphError } from '../../errors/GraphError.js';

export class RefResolutionLoader implements RefResolutionLoaderInterface {
  private readonly registry: SchemaRegistryInterface;

  public constructor(registry: SchemaRegistryInterface) {
    this.registry = registry;
  }

  /**
   * Loads a set of root IRIs into the registry, skipping any already registered.
   * Throws `GraphError('REF_UNRESOLVED')` when the loader returns null.
   *
   * @param rootIds - IRIs to seed into the registry.
   * @param loader - Async loader invoked for each unregistered IRI.
   */
  public async loadRootIds(rootIds: readonly string[], loader: LoaderType): Promise<void> {
    for (const iri of rootIds) {
      if (this.registry.has(iri)) {
        continue;
      }

      const loaded = await loader(iri);

      if (loaded === null) {
        throw new GraphError('REF_UNRESOLVED', `loader returned null for IRI: ${iri}`, iri);
      }

      if (typeof loaded !== 'boolean') {
        const loadedId = loaded.$id;

        if (typeof loadedId === 'string') {
          this.registry.set(loaded, loadedId);
        }
      }
    }
  }

  /**
   * Eagerly walks all transitive `$ref` IRIs currently in the registry, calling
   * the loader for each unregistered IRI. Registers returned schemas and recurses
   * until the graph is fully resolved. Uses a visited Set to avoid redundant
   * loader calls.
   *
   * Throws `GraphError('REF_UNRESOLVED')` when the loader returns null for a
   * required IRI. Loader-thrown errors propagate unchanged.
   *
   * @param loader - Async loader invoked for each unregistered cross-schema IRI.
   */
  public async resolveAll(loader: LoaderType): Promise<void> {
    const visited = new Set<string>();

    const resolveSchema = async (schema: Record<string, unknown>): Promise<void> => {
      const unresolved = this.registry.collectUnresolvedRefIris(schema);
      const toFetch: string[] = [];

      for (const iri of unresolved) {
        if (!visited.has(iri)) {
          visited.add(iri);
          toFetch.push(iri);
        }
      }

      for (const iri of toFetch) {
        const loaded = await loader(iri);

        if (loaded === null) {
          throw new GraphError(
            'REF_UNRESOLVED',
            `loader returned null for IRI: ${iri}`,
            iri
          );
        }

        if (typeof loaded !== 'boolean') {
          const loadedId = loaded.$id;

          if (typeof loadedId === 'string') {
            this.registry.set(loaded, loadedId);
          }

          await resolveSchema(loaded);
        }
      }
    };

    for (const schema of this.registry.list()) {
      await resolveSchema(schema);
    }
  }
}
