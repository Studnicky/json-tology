// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- {} is intentional for generic default
export interface ValueInterface<TMap = {}> {
  cast<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K];
  cast(schemaId: string, data: unknown): unknown;
  clean<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K];
  clean(schemaId: string, data: unknown): unknown;
  coerce<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K];
  coerce(schemaId: string, data: unknown): unknown;
  convert<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K];
  convert(schemaId: string, data: unknown): unknown;
  create<K extends keyof TMap & string>(schemaId: K): TMap[K];
  create(schemaId: string): unknown;
}
