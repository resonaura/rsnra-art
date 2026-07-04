import { create } from "zustand";

export type MessageBoxButtons = "ok" | "okcancel" | "yesno" | "yesnocancel";
export type MessageBoxResult = "ok" | "cancel" | "yes" | "no";

export interface MessageBoxDescriptor {
  id: string;
  title: string;
  message: string;
  icon: string;
  buttons: MessageBoxButtons;
  resolve: (result: MessageBoxResult) => void;
}

interface DialogState {
  boxes: MessageBoxDescriptor[];
  push: (box: MessageBoxDescriptor) => void;
  remove: (id: string) => void;
}

// Stack of pending message boxes — unlike the old single-slot alert store,
// several can be open at once (e.g. two background actions both failing),
// each rendered as its own draggable SystemDialog by MessageBoxHost.
export const useDialogStore = create<DialogState>((set) => ({
  boxes: [],
  push: (box) => set((s) => ({ boxes: [...s.boxes, box] })),
  remove: (id) => set((s) => ({ boxes: s.boxes.filter((b) => b.id !== id) })),
}));
