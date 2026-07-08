import { TASKBAR_HEIGHT } from "../../constants";
import { useWindowStore } from "../../store/windowStore";
import { AppWindow } from "./AppWindow";

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);

  return (
    // Windows are dragged/resized within this area (bounds="parent" on Rnd),
    // so they can never end up underneath the taskbar.
    <div
      id="window-bounds"
      style={{
        position: "absolute",
        inset: 0,
        bottom: TASKBAR_HEIGHT,
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
