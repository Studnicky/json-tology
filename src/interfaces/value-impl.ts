export interface ValueInterface {
  cast(schemaId: string, data: unknown): unknown;
  clean(schemaId: string, data: unknown): unknown;
  convert(schemaId: string, data: unknown): unknown;
  create(schemaId: string): unknown;
  parse(schemaId: string, data: unknown): unknown;
}
