import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";

export const autostartService = {
  async isEnabled(): Promise<boolean> {
    try {
      return await isEnabled();
    } catch (err) {
      console.warn("Autostart isEnabled check failed:", err);
      return false;
    }
  },

  async setEnabled(targetState: boolean): Promise<boolean> {
    try {
      if (targetState) {
        await enable();
      } else {
        await disable();
      }
      return await isEnabled();
    } catch (err) {
      console.error("Autostart toggle failed:", err);
      throw err;
    }
  },
};
