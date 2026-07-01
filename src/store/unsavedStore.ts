import { create } from "zustand";
import { useWindowStore } from "./windowStore";

// Unsaved-changes guard registry. Apps that edit files (Notepad, Paint, …)
// register a guard via `useUnsavedChanges` so the system can ask "Save
// changes?" before their window is closed — whether via the X button, the
// File ▸ Exit menu, or a new-document action.
//
// A guard supplies three live values (kept fresh through a ref in the hook):
//   isDirty — does the window have unsaved changes right now?
//   save    — persist them; returns true if saved, false if the user aborted
//             (e.g. cancelled the Save As dialog) so the window stays open
//   name    — the file name to show in the confirmation prompt

export interface DirtyGuard {
  isDirty: () => boolean;
  save: () => boolean | Promise<boolean>;
  name: () => string;
}

interface UnsavedState {
  guards: Record<string, DirtyGuard>;
  /** windowId currently awaiting a "save changes?" confirmation, or null. */
  confirmClose: string | null;

  registerGuard: (windowId: string, guard: DirtyGuard) => void;
  unregisterGuard: (windowId: string) => void;
  /** Interactive close: prompts if dirty, otherwise closes immediately. */
  requestClose: (windowId: string) => void;
  // Confirmation dialog actions:
  confirmSave: () => Promise<void>;
  confirmDiscard: () => void;
  confirmCancel: () => void;
}

export const useUnsavedStore = create<UnsavedState>((set, get) => ({
  guards: {},
  confirmClose: null,

  registerGuard: (windowId, guard) =>
    set((s) => ({ guards: { ...s.guards, [windowId]: guard } })),

  unregisterGuard: (windowId) =>
    set((s) => {
      const { [windowId]: _omit, ...rest } = s.guards;
      void _omit;
      return { guards: rest };
    }),

  requestClose: (windowId) => {
    const guard = get().guards[windowId];
    if (guard && guard.isDirty()) {
      set({ confirmClose: windowId });
    } else {
      useWindowStore.getState().closeWindow(windowId);
    }
  },

  confirmSave: async () => {
    const id = get().confirmClose;
    if (!id) return;
    const guard = get().guards[id];
    set({ confirmClose: null });
    if (!guard) {
      useWindowStore.getState().closeWindow(id);
      return;
    }
    const ok = await guard.save();
    if (ok) useWindowStore.getState().closeWindow(id);
  },

  confirmDiscard: () => {
    const id = get().confirmClose;
    if (!id) return;
    set({ confirmClose: null });
    useWindowStore.getState().closeWindow(id);
  },

  confirmCancel: () => set({ confirmClose: null }),
}));
