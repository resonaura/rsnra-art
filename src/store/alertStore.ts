import { create } from "zustand";

// A single global Win98-style message box (Control Panel/Games "missing
// component" errors, and anywhere else a modal alert is needed). Only one
// alert is shown at a time — a new show() replaces whatever is queued.
interface AlertState {
  open: boolean;
  title: string;
  message: string;
  icon: string;
  show: (title: string, message: string, icon?: string) => void;
  close: () => void;
}

const DEFAULT_ICON = "/icons/w98_msg_error.ico";

export const useAlertStore = create<AlertState>((set) => ({
  open: false,
  title: "",
  message: "",
  icon: DEFAULT_ICON,
  show: (title, message, icon = DEFAULT_ICON) =>
    set({ open: true, title, message, icon }),
  close: () => set({ open: false }),
}));

// Convenience helper for call sites that just want "file not found or
// corrupted" without touching the store directly.
export function showMissingFileAlert(title: string, fileName: string) {
  useAlertStore
    .getState()
    .show(
      title,
      `Cannot find '${fileName}'.\n\nThe file is missing or corrupted. Reinstall the application, or contact your system administrator.`,
    );
}
