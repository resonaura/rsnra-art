import { create } from "zustand";

// A clipboard for the file explorer (My Computer). It records the *absolute
// path* of the node that was copied/cut, plus the mode, so a paste in any
// Explorer window can re-resolve the node against the live VFS and either
// duplicate it (copy) or relocate it (cut). Keeping only the path — not a node
// reference — means the clipboard never holds stale data if the source is
// deleted or renamed: paste simply no-ops when the path no longer resolves.

export type ClipboardMode = "copy" | "cut";

interface ClipboardState {
  mode: ClipboardMode | null;
  sourcePath: string | null; // absolute VFS path, e.g. "C:\\My Documents\\song.txt"

  /** Record a copy/cut of `sourcePath` (must already be absolute). */
  set: (mode: ClipboardMode, sourcePath: string) => void;
  /** Clear the clipboard (e.g. after a failed paste or when the source is gone). */
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  mode: null,
  sourcePath: null,
  set: (mode, sourcePath) => set({ mode, sourcePath }),
  clear: () => set({ mode: null, sourcePath: null }),
}));
