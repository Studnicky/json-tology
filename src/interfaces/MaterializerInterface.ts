import type { MaterializationResultType } from '../types/Materializer.js';
import type { QuadInterface } from './QuadInterface.js';
import type { InferSchemaType } from '../types/Infer.js';

import type { JsonSchemaDocumentType } from '../types/Schema.js';
import type { AboxOptionsType } from '../types/AboxOptionsType.js';
import type { SchemaWithIdType } from '../types/SchemaWithIdType.js';
import type { MaterializerExecuteOptionsType } from '../types/MaterializerExecuteOptionsType.js';
import type { PartialInferSchemaType } from '../types/PartialInferSchemaType.js';

export interface MaterializerInterface {
  createDefault(schema: SchemaWithIdType): unknown;
  execute(
    schema: SchemaWithIdType,
    options?: MaterializerExecuteOptionsType
  ): MaterializationResultType;
  materialize<TSchema extends JsonSchemaDocumentType & { readonly '$id': string }>(
    schema: TSchema,
    partial?: PartialInferSchemaType<TSchema>,
  ): InferSchemaType<TSchema>;
  materialize(
    schema: SchemaWithIdType,
    partial?: Record<string, unknown>
  ): unknown;
  projectAbox(
    schema: SchemaWithIdType,
    data: unknown,
    baseIri: string,
    options?: AboxOptionsType
  ): QuadInterface[];
}
