type DeleteUpload = (url: string, keepalive: boolean) => Promise<unknown>;

export class DraftUploads {
  private pending = new Set<string>();
  private urls: Array<string | undefined> = [];
  private mounted = true;
  private saving = false;

  constructor(private readonly deleteUpload: DeleteUpload) {}

  mount() { this.mounted = true; }

  unmount() {
    this.mounted = false;
    this.cleanup(true);
  }

  setUrls(urls: Array<string | undefined>) {
    this.urls = urls;
    this.cleanup();
  }

  track(url: string) {
    if (!this.mounted) {
      void this.deleteUpload(url, false);
      return false;
    }
    this.pending.add(url);
    return true;
  }

  commit(urls: Array<string | undefined>) {
    for (const url of urls) if (url) this.pending.delete(url);
  }

  startSaving() { this.saving = true; }

  finishSaving() {
    this.saving = false;
    this.cleanup(!this.mounted);
  }

  cleanup(keepalive = false) {
    if (this.saving) return;
    for (const url of this.pending) {
      if (!keepalive && this.mounted && this.urls.includes(url)) continue;
      this.pending.delete(url);
      void this.deleteUpload(url, keepalive);
    }
  }
}
