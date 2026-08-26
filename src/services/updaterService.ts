import { check, Update } from "@tauri-apps/plugin-updater";

export interface UpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
}

class UpdaterService {
  private currentUpdate: Update | null = null;
  private isChecking = false;
  private isDownloading = false;
  private downloadProgress = 0;

  public async checkForUpdates(): Promise<UpdateInfo> {
    if (this.isChecking) {
      return { available: Boolean(this.currentUpdate) };
    }

    this.isChecking = true;
    try {
      const update = await check();
      if (update) {
        this.currentUpdate = update;
        this.notifyUpdateState(true);
        return {
          available: true,
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body,
          date: update.date,
        };
      } else {
        this.currentUpdate = null;
        this.notifyUpdateState(false);
        return { available: false };
      }
    } catch (error) {
      console.warn("Failed to check for updates:", error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  public getCachedUpdate(): Update | null {
    return this.currentUpdate;
  }

  public getDownloadProgress(): number {
    return this.downloadProgress;
  }

  public async downloadAndInstall(
    onProgress?: (downloaded: number, total: number | undefined) => void
  ): Promise<void> {
    if (!this.currentUpdate) {
      throw new Error("No update available to download");
    }

    if (this.isDownloading) return;
    this.isDownloading = true;

    try {
      let downloadedBytes = 0;
      let totalBytes: number | undefined = undefined;

      await this.currentUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength;
            downloadedBytes = 0;
            onProgress?.(0, totalBytes);
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            this.downloadProgress = totalBytes
              ? Math.round((downloadedBytes / totalBytes) * 100)
              : 0;
            onProgress?.(downloadedBytes, totalBytes);
            break;
          case "Finished":
            this.downloadProgress = 100;
            onProgress?.(downloadedBytes, totalBytes);
            break;
        }
      });
    } catch (err) {
      console.error("Failed to download/install update:", err);
      throw err;
    } finally {
      this.isDownloading = false;
    }
  }

  private notifyUpdateState(available: boolean) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("flowkey_update_status", {
          detail: {
            available,
            version: this.currentUpdate?.version,
          },
        })
      );
    }
  }
}

export const updaterService = new UpdaterService();
