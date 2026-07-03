import { useEffect, useState } from "react";
import { ThemeProvider } from "styled-components";
import { AlertDialog } from "./components/AlertDialog/AlertDialog";
import { BootScreen } from "./components/BootScreen/BootScreen";
import { CloseProgramDialog } from "./components/CloseProgramDialog/CloseProgramDialog";
import { Desktop } from "./components/Desktop/Desktop";
import { RunDialog } from "./components/RunDialog/RunDialog";
import { ShutdownScreen } from "./components/ShutdownScreen/ShutdownScreen";
import { StartMenu } from "./components/StartMenu/StartMenu";
import { Taskbar } from "./components/Taskbar/Taskbar";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { WebampHost } from "./components/WebampHost";
import { WindowManager } from "./components/WindowManager/WindowManager";
import { openApp } from "./data/apps";
import { getThemeById, useThemeStore } from "./store/themeStore";
import { useWindowStore } from "./store/windowStore";
import { CursorGlobalStyle } from "./styles/CursorGlobalStyle";
import { GlobalStyle } from "./styles/GlobalStyle";

function Desk() {
  const powerState = useWindowStore((s) => s.powerState);
  const setCloseProgramOpen = useWindowStore((s) => s.setCloseProgramOpen);

  useEffect(() => {
    if (powerState !== "on") return;
    openApp("welcome");
  }, [powerState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === "Delete" || e.key === "Del")) {
        e.preventDefault();
        setCloseProgramOpen(true);
      } else if (e.ctrlKey && e.shiftKey && e.key === "Escape") {
        e.preventDefault();
        openApp("task-manager");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCloseProgramOpen]);

  if (powerState !== "on") {
    return <ShutdownScreen />;
  }

  return (
    <>
      <Desktop />
      <WindowManager />
      <StartMenu />
      <Taskbar />
      <CloseProgramDialog />
      <RunDialog />
      <UnsavedChangesDialog />
      <AlertDialog />
      <WebampHost />
    </>
  );
}

function App() {
  const [booted, setBooted] = useState(false);
  const themeId = useThemeStore((s) => s.themeId);
  const theme = getThemeById(themeId);
  const desktopRestartCount = useWindowStore((s) => s.desktopRestartCount);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <CursorGlobalStyle />
      <div
        id="rsnra-desktop-root"
        style={{ position: "fixed", inset: 0, overflow: "hidden" }}
      >
        {!booted ? <BootScreen onDone={() => setBooted(true)} /> : <Desk key={desktopRestartCount} />}
      </div>
    </ThemeProvider>
  );
}

export default App;
