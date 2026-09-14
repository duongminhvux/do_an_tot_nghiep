import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { StorageService } from "./storage.service";

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>("MEDIA_ROOT") ?? "./storage/media");
  }

  async put(key: string, contents: Buffer): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, { flag: "wx" });
  }

  path(key: string): string {
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error("Unsafe storage key.");
    }
    return target;
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async writable(): Promise<boolean> {
    await mkdir(this.root, { recursive: true });
    await access(this.root);
    return true;
  }
}
