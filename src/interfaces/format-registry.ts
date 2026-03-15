export interface FormatRegistryInterface {
  get(name: string): ((value: unknown) => boolean) | undefined;
  has(name: string): boolean;
  register(name: string, validator: (value: unknown) => boolean): void;
}
