export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");

export interface StorageService {
  put(key: string, contents: Buffer): Promise<void>;
  path(key: string): string;
  remove(key: string): Promise<void>;
  writable(): Promise<boolean>;
}
