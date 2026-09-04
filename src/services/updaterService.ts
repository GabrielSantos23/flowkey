import { check, Update, DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface ProgressCallback {
  (downloadedBytes: number, totalBytes?: number): void;
}

/**
 * Service responsible for interacting with the official Tauri 2 Updater and Process plugins.
 */
export class UpdaterService {
  /**
   * Checks for updates against the configured endpoint.
   * Resolves to the Tauri `Update` object if available, or `null` if up-to-date.
   */
  static async check(): Promise<Update | null> {
    try {
      return await check();
    } catch (err: unknown) {
      console.error("[UpdaterService] Check failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Update check failed: ${msg}`);
    }
  }

  /**
   * Downloads the update package without installing it.
   * Tracks download progress events (content length and chunk lengths).
   */
  static async download(
    update: Update,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    let totalBytes: number | undefined;
    let downloadedBytes = 0;

    try {
      await update.download((event: DownloadEvent) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength;
          downloadedBytes = 0;
          onProgress?.(0, totalBytes);
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          onProgress?.(downloadedBytes, totalBytes);
        } else if (event.event === "Finished") {
          if (totalBytes && downloadedBytes < totalBytes) {
            downloadedBytes = totalBytes;
          }
          onProgress?.(downloadedBytes, totalBytes);
        }
      });
    } catch (err: unknown) {
      console.error("[UpdaterService] Download failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Download failed: ${msg}`);
    }
  }

  /**
   * Installs the downloaded update package and restarts the application.
   */
  static async install(update: Update): Promise<void> {
    try {
      await update.install({ restartAfterInstall: true });
      // On macOS/Linux or fallback, relaunch if the installer doesn't automatically restart
      setTimeout(async () => {
        try {
          await relaunch();
        } catch {}
      }, 1000);
    } catch (err: unknown) {
      console.error("[UpdaterService] Installation failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Installation failed: ${msg}`);
    }
  }
}
