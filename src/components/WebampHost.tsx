import { useEffect } from "react";
import { setVfsFilePicker } from "../lib/webamp";
import { useFileDialog } from "./FileDialog/FileDialog";

// Mounts once at the desktop level to give the Webamp manager access to the
// VFS file dialog (a React hook, so it must live inside a component). This is
// what lets Winamp's "Add file" browse the virtual filesystem instead of the
// host OS. Renders the (lazily-shown) dialog itself.
export function WebampHost() {
  const { showFileDialog, dialog } = useFileDialog();

  useEffect(() => {
    setVfsFilePicker((opts) => showFileDialog(opts));
    return () => setVfsFilePicker(() => Promise.resolve(null));
  }, [showFileDialog]);

  return <>{dialog}</>;
}
