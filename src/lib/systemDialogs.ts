import { playSound } from "./audio";
import {
  useDialogStore,
  type MessageBoxButtons,
  type MessageBoxResult,
} from "../store/dialogStore";

// The single "call it like MsgBox" entry point for the whole app — any code,
// anywhere, pops up a system message box without owning any dialog state or
// markup itself. Multiple calls stack as independent, draggable dialogs
// instead of one replacing another.

const ERROR_ICON = "/icons/w98_msg_error.ico";
const WARNING_ICON = "/icons/w2k_warning.ico";
const INFO_ICON = "/icons/w98_msg_information.ico";

let nextId = 0;

function pushBox(
  title: string,
  message: string,
  icon: string,
  buttons: MessageBoxButtons,
): Promise<MessageBoxResult> {
  return new Promise((resolve) => {
    const id = `msgbox-${++nextId}`;
    playSound(icon === ERROR_ICON ? "error" : "question");
    useDialogStore.getState().push({
      id,
      title,
      message,
      icon,
      buttons,
      resolve: (result) => {
        useDialogStore.getState().remove(id);
        resolve(result);
      },
    });
  });
}

/** Win95-style error message box. Resolves once the user clicks OK. */
export function alertError(title: string, message: string): Promise<void> {
  return pushBox(title, message, ERROR_ICON, "ok").then(() => undefined);
}

/** Informational message box (no error connotation). */
export function alertInfo(title: string, message: string): Promise<void> {
  return pushBox(title, message, INFO_ICON, "ok").then(() => undefined);
}

/** Yes/No/Cancel-style confirmation, warning icon by default. */
export function confirmDialog(
  title: string,
  message: string,
  buttons: Extract<MessageBoxButtons, "okcancel" | "yesno" | "yesnocancel"> = "yesno",
): Promise<MessageBoxResult> {
  return pushBox(title, message, WARNING_ICON, buttons);
}

/** Convenience helper for "file is missing or corrupted" errors. */
export function showMissingFileAlert(
  title: string,
  fileName: string,
): Promise<void> {
  return alertError(
    title,
    `Cannot find '${fileName}'.\n\nThe file is missing or corrupted. Reinstall the application, or contact your system administrator.`,
  );
}
