import { TASKBAR_HEIGHT } from "../../constants";
import { useTaskbarPrefsStore } from "../../store/taskbarPrefsStore";
import { useWindowStore } from "../../store/windowStore";
import { AppWindow } from "./AppWindow";

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);
  const autoHideTaskbar = useTaskbarPrefsStore((s) => s.autoHide);
  const alwaysOnTop = useTaskbarPrefsStore((s) => s.alwaysOnTop);

  return (
    // Windows are dragged/resized within this area (bounds="parent" on Rnd),
    // which normally reserves the taskbar strip. Auto-hide gives maximized
    // windows the full screen; disabling Always on top lets them cover it too.
    <div
      id="window-bounds"
      style={{
        position: "absolute",
        inset: 0,
        bottom: autoHideTaskbar || !alwaysOnTop ? 0 : TASKBAR_HEIGHT,
        pointerEvents: "none",
      }}
    >
      {windows
        .filter((w) => !w.isMinimized && w.appId !== "winamp")
        .map((w) => (
          <AppWindow key={w.id} win={w} />
        ))}
    </div>
  );
}
