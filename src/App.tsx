import { useEffect, useState } from "react";
import { ThemeProvider } from "styled-components";
import { BootScreen } from "./components/BootScreen/BootScreen";
import { CloseProgramDialog } from "./components/CloseProgramDialog/CloseProgramDialog";
import { Desktop } from "./components/Desktop/Desktop";
import { RunDialog } from "./components/RunDialog/RunDialog";
import { ShutdownScreen } from "./components/ShutdownScreen/ShutdownScreen";
import { StartMenu } from "./components/StartMenu/StartMenu";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { Taskbar } from "./components/Taskbar/Taskbar";
import { WindowManager } from "./components/WindowManager/WindowManager";
import { openApp } from "./data/apps";
import { getThemeById, useThemeStore } from "./store/themeStore";
import { useWindowStore } from "./store/windowStore";
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
    </>
  );
}

function App() {
  const [booted, setBooted] = useState(false);
  const themeId = useThemeStore((s) => s.themeId);
  const theme = getThemeById(themeId);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
        {!booted ? <BootScreen onDone={() => setBooted(true)} /> : <Desk />}
      </div>
    </ThemeProvider>
  );
}

export default App;
