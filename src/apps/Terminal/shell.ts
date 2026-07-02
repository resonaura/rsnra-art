import type { Terminal } from "@xterm/xterm";
import { useVfsStore } from "../../store/vfsStore";
import { executeLine, expandVars, type CmdContext } from "./commands";
import { Nano } from "./nano";

/**
 * Terminal shell — real VT100 input handling with cursor movement,
 * command history (ArrowUp/Down), Tab completion, Ctrl+C, and
 * seamless nano integration.
 */

const ANSI = {
  RED: "\x1b[31m",
  WHITE: "\x1b[37m",
  GREEN: "\x1b[32m",
  RESET: "\x1b[0m",
  CLEAR_LINE: "\x1b[2K\r",
  SAVE_CURSOR: "\x1b[s",
  RESTORE_CURSOR: "\x1b[u",
};

export class Shell {
  private term: Terminal;
  private closeWindow: (id: string) => void;
  private updateTitle: (id: string, title: string) => void;
  private windowId: string;

  private buffer = "";
  private cursorPos = 0;
  private history: string[] = [];
  private historyIndex = -1;
  private vars: Record<string, string> = {};
  private promptStr = "$P$G";
  private errorLevel = 0;
  private escapeBuffer = "";

  private disposable: { dispose: () => void };
  private resizeDisposable: { dispose: () => void };
  private active = true;
  private nano: Nano | null = null;
  private onSetColor?: (bg: string, fg: string) => void;
  // True while an async command (e.g. `ping`) is awaiting the network —
  // input is ignored meanwhile so keystrokes can't pile into a buffer for a
  // prompt that hasn't been shown yet.
  private busy = false;

  constructor(
    term: Terminal,
    windowId: string,
    closeWindow: (id: string) => void,
    updateTitle: (id: string, title: string) => void,
    onSetColor?: (bg: string, fg: string) => void,
  ) {
    this.term = term;
    this.windowId = windowId;
    this.closeWindow = closeWindow;
    this.updateTitle = updateTitle;
    this.onSetColor = onSetColor;

    this.disposable = term.onData((data) => this.onData(data));
    this.resizeDisposable = term.onResize(() => {
      if (this.active && !this.nano) this.redrawPrompt();
    });
  }

  start() {
    this.term.writeln("RSNRA 95 [Version 4.95.1996]");
    this.term.writeln("(c) RSNRA. All rights reserved.");
    this.term.writeln("");
    this.term.writeln('Type "help" to see what this thing can do.');
    this.term.writeln("");
    this.showPrompt();
  }

  destroy() {
    this.active = false;
    this.disposable.dispose();
    this.resizeDisposable.dispose();
    this.nano?.destroy?.();
  }

  /** The literal prompt text as displayed, no ANSI codes. */
  private get promptText(): string {
    const cwd = useVfsStore.getState().cwd;
    const formatted = this.promptStr
      .replace(/\$P/g, cwd)
      .replace(/\$G/g, ">")
      .replace(/\$L/g, "<")
      .replace(/\$D/g, new Date().toLocaleDateString())
      .replace(/\$T/g, new Date().toLocaleTimeString())
      .replace(/\$V/g, "RSNRA 95")
      .replace(/\$N/g, "C")
      .replace(/\$_/g, "\n")
      .replace(/\$\$/g, "$");
    return `${formatted} `;
  }

  private get promptLen(): number {
    return this.promptText.length;
  }

  private showPrompt() {
    this.term.write(`\r${this.promptText}`);
  }

  /** Redraw the current input line (prompt + buffer). */
  private redrawInput() {
    this.term.write(
      `\r\x1b[2K${this.promptText}${this.buffer}`,
    );
    // Position cursor
    const col = this.promptLen + this.cursorPos + 1;
    this.term.write(`\x1b[${col}G`);
  }

  private redrawPrompt() {
    this.term.write(`\r\x1b[2K`);
    this.showPrompt();
    if (this.buffer) this.term.write(this.buffer);
  }

  private onData(data: string) {
    if (!this.active) return;

    // Nano mode delegates to nano
    if (this.nano) return;

    // An async command (e.g. `ping`) is still running — ignore input until
    // it settles and the next prompt is shown.
    if (this.busy) return;

    // Handle escape sequences
    if (this.escapeBuffer || data === "\x1b") {
      this.escapeBuffer += data;
      if (this.escapeBuffer.length >= 3 && this.escapeBuffer[1] === "[") {
        const seq = this.escapeBuffer;
        this.escapeBuffer = "";
        this.handleEscape(seq);
        return;
      }
      if (this.escapeBuffer.length > 8) this.escapeBuffer = "";
      return;
    }

    if (data[0] === "\x1b") {
      this.escapeBuffer = data;
      if (data.length >= 3) {
        const seq = this.escapeBuffer;
        this.escapeBuffer = "";
        this.handleEscape(seq);
      }
      return;
    }

    // Control characters
    switch (data) {
      case "\r": // Enter
        this.executeLine();
        break;
      case "\x7f": // Backspace
        if (this.cursorPos > 0) {
          this.buffer =
            this.buffer.slice(0, this.cursorPos - 1) +
            this.buffer.slice(this.cursorPos);
          this.cursorPos--;
          this.redrawInput();
        }
        break;
      case "\x03": // Ctrl+C
        this.term.write("^C\r\n");
        this.buffer = "";
        this.cursorPos = 0;
        this.showPrompt();
        break;
      case "\x04": // Ctrl+D
        if (this.buffer.length === 0) {
          this.closeWindow(this.windowId);
        }
        break;
      case "\x0c": // Ctrl+L — clear screen
        this.term.clear();
        this.redrawPrompt();
        break;
      case "\t": // Tab — completion
        this.doComplete();
        break;
      default:
        // Printable characters
        if (data.charCodeAt(0) >= 0x20) {
          this.buffer =
            this.buffer.slice(0, this.cursorPos) +
            data +
            this.buffer.slice(this.cursorPos);
          this.cursorPos += data.length;
          this.redrawInput();
        }
        break;
    }
  }

  private handleEscape(seq: string) {
    switch (seq) {
      case "\x1b[A": // Up — history
        if (this.history.length === 0) return;
        if (this.historyIndex === -1) {
          this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex > 0) {
          this.historyIndex--;
        }
        this.buffer = this.history[this.historyIndex] ?? "";
        this.cursorPos = this.buffer.length;
        this.redrawInput();
        break;
      case "\x1b[B": // Down — history
        if (this.historyIndex === -1) return;
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.buffer = this.history[this.historyIndex];
        } else {
          this.historyIndex = -1;
          this.buffer = "";
        }
        this.cursorPos = this.buffer.length;
        this.redrawInput();
        break;
      case "\x1b[C": // Right
        if (this.cursorPos < this.buffer.length) {
          this.cursorPos++;
          const col = this.promptLen + this.cursorPos + 1;
          this.term.write(`\x1b[${col}G`);
        }
        break;
      case "\x1b[D": // Left
        if (this.cursorPos > 0) {
          this.cursorPos--;
          const col = this.promptLen + this.cursorPos + 1;
          this.term.write(`\x1b[${col}G`);
        }
        break;
      case "\x1b[H": // Home
        this.cursorPos = 0;
        this.term.write(`\x1b[${this.promptLen + 1}G`);
        break;
      case "\x1b[F": // End
        this.cursorPos = this.buffer.length;
        this.term.write(`\x1b[${this.promptLen + this.cursorPos + 1}G`);
        break;
      case "\x1b[3~": // Delete
        if (this.cursorPos < this.buffer.length) {
          this.buffer =
            this.buffer.slice(0, this.cursorPos) +
            this.buffer.slice(this.cursorPos + 1);
          this.redrawInput();
        }
        break;
      default:
        break;
    }
  }

  private doComplete() {
    const parts = this.buffer.split(/\s+/);
    const partial = parts[parts.length - 1].toLowerCase();
    if (!partial) return;
    const vfs = useVfsStore.getState();
    const dir = vfs.cwd;
    const node = vfs.resolve(dir);
    if (!node || node.type !== "dir" || !node.children) return;
    const matches = node.children
      .filter((c) => c.name.toLowerCase().startsWith(partial))
      .map((c) => (c.type === "dir" ? c.name + "\\" : c.name));
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0];
      this.buffer = parts.join(" ");
      this.cursorPos = this.buffer.length;
      this.redrawInput();
    } else if (matches.length > 1) {
      this.term.write("\r\n" + matches.join("  ") + "\r\n");
      this.showPrompt();
      this.term.write(this.buffer);
    }
  }

  private async executeLine() {
    const line = this.buffer;
    this.term.write("\r\n");

    if (line.trim()) {
      this.history.push(line);
      this.historyIndex = -1;
    }

    this.buffer = "";
    this.cursorPos = 0;

    if (!line.trim()) {
      this.showPrompt();
      return;
    }

    const vfs = useVfsStore.getState();
    const expanded = expandVars(line.trim(), this.vars, vfs);

    const print = (lines: string[], kind?: "echo" | "output" | "error") => {
      // The window may have been closed while an async command (e.g. an
      // in-flight `ping`) was still awaiting the network — don't touch the
      // now-disposed terminal.
      if (!this.active) return;
      for (const text of lines) {
        if (kind === "error")
          this.term.writeln(`${ANSI.RED}${text}${ANSI.RESET}`);
        else this.term.writeln(text);
      }
    };

    const ctx: CmdContext = {
      vfs,
      print,
      clear: () => this.term.clear(),
      closeWindow: this.closeWindow,
      windowId: this.windowId,
      enterNano: (path: string) => this.enterNano(path),
      vars: this.vars,
      setVar: (name: string, value: string) => {
        this.vars[name] = value;
      },
      setTitle: (title: string) => this.updateTitle(this.windowId, title),
      setPromptStr: (p: string) => {
        this.promptStr = p;
      },
      promptStr: this.promptStr,
      errorLevel: this.errorLevel,
      setErrorLevel: (n: number) => {
        this.errorLevel = n;
      },
      setColor: (bg: string, fg: string) => {
        this.term.options.theme = {
          ...this.term.options.theme,
          background: bg,
          foreground: fg,
          cursor: fg,
          selectionBackground: fg,
        };
        if (this.onSetColor) {
          this.onSetColor(bg, fg);
        }
      },
    };

    this.busy = true;
    try {
      await executeLine(expanded, ctx);
    } finally {
      this.busy = false;
    }

    // If the window was closed by a command, don't show prompt
    if (!this.active) return;
    if (this.nano) return; // nano took over

    this.showPrompt();
  }

  private enterNano(path: string) {
    const vfs = useVfsStore.getState();
    const content = vfs.read(path) ?? "";

    this.nano = new Nano(
      this.term,
      path,
      content,
      (savePath: string, content: string) => {
        useVfsStore.getState().writeFile(savePath, content);
      },
      () => {
        this.nano = null;
        // After alternate screen buffer restore, the cursor is back where
        // it was before nano started. Move to a new line and show prompt.
        this.term.write("\r\n");
        this.showPrompt();
      },
    );
    this.nano.setVfsRead((p) => useVfsStore.getState().read(p));
    this.nano.start();
  }
}
