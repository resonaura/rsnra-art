import { useEffect, useRef } from "react";
import { useUnsavedStore } from "../store/unsavedStore";

// Register an unsaved-changes guard for a window. Pass the *current* values
// (evaluated every render) — the hook funnels them through a ref so the guard
// the store holds always reads live state, even though it's registered once.
//
//   useUnsavedChanges(windowId, {
//     isDirty: dirty,
//     save: () => handleSave(),   // return true if saved, false if aborted
//     name: fileName,
//   });
//
// Then trigger closes via `useUnsavedStore.getState().requestClose(windowId)`
// (or just `requestClose`) instead of `closeWindow` — dirty windows prompt
// first.

export interface UnsavedGuardInput {
  isDirty: boolean;
  save: () => boolean | Promise<boolean>;
  name: string;
}

export function useUnsavedChanges(
  windowId: string,
  guard: UnsavedGuardInput,
): void {
  const ref = useRef(guard);
  ref.current = guard;

  const registerGuard = useUnsavedStore((s) => s.registerGuard);
  const unregisterGuard = useUnsavedStore((s) => s.unregisterGuard);

  useEffect(() => {
    registerGuard(windowId, {
      isDirty: () => ref.current.isDirty,
      save: () => ref.current.save(),
      name: () => ref.current.name,
    });
    return () => unregisterGuard(windowId);
  }, [windowId, registerGuard, unregisterGuard]);
}
