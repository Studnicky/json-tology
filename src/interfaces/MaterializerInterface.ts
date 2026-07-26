import type { MaterializationResultInterface } from './MaterializationResultInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { InferSchemaType } from '../types/Infer.js';

import type { JsonSchemaDocumentType } from '../types/Schema.js';
import type { AboxOptionsInterface } from './AboxOptionsInterface.js';
import type { SchemaWithIdEntity } from '../entities/SchemaWithIdEntity.js';
import type { MaterializerExecuteOptionsEntity } from '../entities/MaterializerExecuteOptionsEntity.js';
import type { PartialInferSchemaType } from '../types/PartialInferSchemaType.js';

export interface MaterializerInterface {
  createDefault(schema: SchemaWithIdEntity.Type): unknown;
  execute(
    schema: SchemaWithIdEntity.Type,
    options?: MaterializerExecuteOptionsEntity.Type
  ): MaterializationResultInterface;
  materialize<TSchema extends JsonSchemaDocumentType & { readonly '$id': string }>(
    schema: TSchema,
    partial?: PartialInferSchemaType<TSchema>,
  ): InferSchemaType<TSchema>;
  materialize(
    schema: SchemaWithIdEntity.Type,
    partial?: Record<string, unknown>
  ): unknown;
  projectAbox(
    schema: SchemaWithIdEntity.Type,
    data: unknown,
    baseIri: string,
    options?: AboxOptionsInterface
  ): QuadInterface[];
}
