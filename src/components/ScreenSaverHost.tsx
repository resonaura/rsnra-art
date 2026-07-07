import { useEffect, useRef } from "react";
import { getScreenSaver } from "../screensavers";
import { useDisplayStore } from "../store/displayStore";
import { useSaverRunStore } from "../store/saverRunStore";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel"] as const;
// Ignore input for a moment after the saver starts so the click on
// "Preview" (or the keypress that triggered idle) doesn't instantly close it.
const GRACE_MS = 400;
// Require some real mouse travel before waking up — exactly like Windows.
const WAKE_DISTANCE = 5;

/**
 * Runs the screen saver: watches for user idle (Display Properties ▸ Screen
 * Saver ▸ Wait) and renders the active saver fullscreen above everything.
 * Any key/click/mouse-move dismisses it.
 */
export function ScreenSaverHost() {
  const saverId = useDisplayStore((s) => s.screenSaverId);
  const waitMinutes = useDisplayStore((s) => s.screenSaverWait);
  const runningId = useSaverRunStore((s) => s.runningId);

  // ── idle detection ────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saverId === "none" || !getScreenSaver(saverId)) return;

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => {
          if (!useSaverRunStore.getState().runningId) {
            useSaverRunStore.getState().run(saverId);
          }
        },
        Math.max(1, waitMinutes) * 60_000,
      );
    };

    arm();
    const events = ["pointermove", ...ACTIVITY_EVENTS];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [saverId, waitMinutes]);

  // ── wake-up ───────────────────────────────────────────────────────────────
  const moveOrigin = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!runningId) return;
    moveOrigin.current = null;

    const stop = () => {
      if (Date.now() - useSaverRunStore.getState().startedAt < GRACE_MS) return;
      useSaverRunStore.getState().stop();
    };
    const onMove = (e: PointerEvent) => {
      if (Date.now() - useSaverRunStore.getState().startedAt < GRACE_MS) return;
      if (!moveOrigin.current) {
        moveOrigin.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - moveOrigin.current.x;
      const dy = e.clientY - moveOrigin.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > WAKE_DISTANCE) stop();
    };

    window.addEventListener("pointermove", onMove, true);
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, stop, true));
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, stop, true));
    };
  }, [runningId]);

  if (!runningId) return null;
  const def = getScreenSaver(runningId);
  if (!def) return null;
  const Saver = def.Component;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000000,
        background: "#000",
        cursor: "none",
      }}
    >
      <Saver />
    </div>
  );
}
