import type { Terminal } from "@xterm/xterm";

/**
 * Nano text editor — faithful recreation of GNU nano 9.1, drawn directly
 * into xterm.js via ANSI escape sequences.
 *
 * Based on the source code from https://git.savannah.gnu.org/git/nano.git
 *
 * Layout (matching real nano):
 *   Row 0:              Title bar (reverse video) — "  GNU nano 9.1" left,
 *                       filename centered, "Modified" right
 *   Rows 1..N-4:        Edit area
 *   Row N-3:            Status bar (prompt or centered "[ message ]")
 *   Row N-2:            Shortcut row 1 (key combo reverse video, tag normal)
 *   Row N-1:            Shortcut row 2
 *
 * Uses the alternate screen buffer so nano's content never pollutes the
 * shell's scrollback.
 */

// ─── Constants from nano source ──────────────────────────────────────────────

const BRANDING = "  GNU nano 9.1";
const WIDTH_OF_TAB = 8;

// ANSI styling.  Default nano uses reverse video (A_REVERSE) for title bar,
// status bar, prompt bar, and key combos.  Function tags use normal text.
const REV = "\x1b[7m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const ALT_SCREEN_ON = "\x1b[?1049h";
const ALT_SCREEN_OFF = "\x1b[?1049l";

// ─── Types ───────────────────────────────────────────────────────────────────

type NanoMode =
  | "edit"
  | "whereis" // ^W search prompt
  | "replace" // ^\ replace prompt
  | "replaceWith" // replace-with prompt
  | "writefile" // ^O write-out prompt
  | "insertfile" // ^R read-file prompt
  | "gotoline" // ^_ go-to-line prompt
  | "yesno"; // yes/no/cancel confirmation

interface Shortcut {
  key: string; // e.g. "^G", "M-C"
  tag: string; // e.g. "Help"
}

// ─── Menu definitions (from global.c shortcut_init) ──────────────────────────

// Main menu — the 12 functions shown in the bottom shortcut bars.
// Order matches the allfuncs list; bottombars uses a zigzag layout
// (index%2 = row, index/2 = column).
const MMAIN: Shortcut[] = [
  { key: "^G", tag: "Help" },
  { key: "^X", tag: "Exit" },
  { key: "^O", tag: "Write Out" },
  { key: "^R", tag: "Read File" },
  { key: "^W", tag: "Where Is" },
  { key: "^\\", tag: "Replace" },
  { key: "^K", tag: "Cut" },
  { key: "^U", tag: "Paste" },
  { key: "^T", tag: "Execute" },
  { key: "^J", tag: "Justify" },
  { key: "^C", tag: "Location" },
  { key: "^_", tag: "Go To Line" },
];

// Search (Where Is) menu.
const MWHEREIS: Shortcut[] = [
  { key: "^G", tag: "Help" },
  { key: "^C", tag: "Cancel" },
  { key: "M-C", tag: "Case sens" },
  { key: "M-R", tag: "Reg.exp" },
  { key: "M-B", tag: "Backwards" },
  { key: "^R", tag: "Replace" },
  { key: "^P", tag: "Older" },
  { key: "^N", tag: "Newer" },
];

// Replace menu (after entering the search string, entering replacement).
const MREPLACEWITH: Shortcut[] = [
  { key: "^G", tag: "Help" },
  { key: "^C", tag: "Cancel" },
  { key: "M-C", tag: "Case sens" },
  { key: "M-R", tag: "Reg.exp" },
  { key: "M-B", tag: "Backwards" },
  { key: "^W", tag: "No Replace" },
  { key: "^P", tag: "Older" },
  { key: "^N", tag: "Newer" },
];

// Write File menu.
const MWRITEFILE: Shortcut[] = [
  { key: "^G", tag: "Help" },
  { key: "^C", tag: "Cancel" },
  { key: "M-D", tag: "DOS Format" },
  { key: "M-B", tag: "Backup File" },
  { key: "M-A", tag: "Append" },
  { key: "M-P", tag: "Prepend" },
  { key: "^Q", tag: "Discard buf" },
  { key: "M-F", tag: "Browse" },
];

// Insert File menu.
const MINSERTFILE: Shortcut[] = [
  { key: "^G", tag: "Help" },
  { key: "^C", tag: "Cancel" },
  { key: "M-N", tag: "No Convert" },
  { key: "^X", tag: "Execute Cmd" },
  { key: "M-F", tag: "Browse" },
];

// Go To Line menu.
const MGOTOLINE: Shortcut[] = [
  { key: "^G", tag: "Help" },
  { key: "^C", tag: "Cancel" },
  { key: "^Y", tag: "First Line" },
  { key: "^V", tag: "Last Line" },
];

// ─── Helper: tab-aware column calculations ───────────────────────────────────

/**
 * Return the number of display columns that the first `count` bytes of
 * `text` occupy, expanding tabs to the next multiple of tabsize.
 * (Equivalent to nano's `wideness()` in utils.c.)
 */
function wideness(text: string, count: number): number {
  if (count <= 0) return 0;
  let width = 0;
  for (let i = 0; i < text.length && i < count; ) {
    const ch = text[i];
    if (ch === "\t") {
      width += WIDTH_OF_TAB - (width % WIDTH_OF_TAB);
      i++;
    } else if (ch.charCodeAt(0) < 0x20) {
      width += 2; // control char → ^X
      i++;
    } else {
      width += 1;
      i++;
    }
  }
  return width;
}

/**
 * Return the byte index in `text` of the character that starts at or
 * before the given display `column`.
 * (Equivalent to nano's `actual_x()` in utils.c.)
 */
function actualX(text: string, column: number): number {
  let width = 0;
  let i = 0;
  for (; i < text.length; ) {
    const ch = text[i];
    let charWidth: number;
    if (ch === "\t") {
      charWidth = WIDTH_OF_TAB - (width % WIDTH_OF_TAB);
    } else if (ch.charCodeAt(0) < 0x20) {
      charWidth = 2;
    } else {
      charWidth = 1;
    }
    if (width + charWidth > column) break;
    width += charWidth;
    i++;
  }
  return i; // byte index
}

/**
 * Return the total display width of a string (tabs expanded).
 * (Equivalent to nano's `breadth()` in utils.c.)
 */
function breadth(text: string): number {
  return wideness(text, text.length);
}

/**
 * Convert a string's display representation: expand tabs to spaces,
 * control chars to ^X form.  Starting from display column `fromCol`,
 * show up to `span` columns.  Used for rendering lines.
 */
function displayString(text: string, fromCol: number, span: number): string {
  const startX = actualX(text, fromCol);
  let result = "";
  let col = wideness(text, startX);
  const beyond = fromCol + span;
  let i = startX;

  // If the first char starts before fromCol (partial tab), show a space.
  if (col < fromCol && i < text.length) {
    const ch = text[i];
    if (ch === "\t") {
      // Partial tab — fill remaining columns with spaces
      while (col < fromCol) {
        result += " ";
        col++;
      }
      i++;
    } else if (ch.charCodeAt(0) < 0x20) {
      // Partial control char — show the second char (^ is at col-1)
      result += controlRep(ch);
      col++;
      i++;
    } else {
      result += " ";
      col++;
      i++;
    }
  }

  while (i < text.length && col < beyond) {
    const ch = text[i];
    if (ch === "\t") {
      result += " ";
      col++;
      while (col % WIDTH_OF_TAB !== 0 && col < beyond) {
        result += " ";
        col++;
      }
      i++;
    } else if (ch.charCodeAt(0) < 0x20) {
      result += "^" + controlRep(ch);
      col += 2;
      i++;
    } else {
      result += ch;
      col++;
      i++;
    }
  }

  return result;
}

/** Return the display representation of a control character (the char after ^). */
function controlRep(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code === 0) return "@";
  if (code === 0x7f) return "?";
  return String.fromCharCode(code + 0x40); // ^A → A, ^J → J, etc.
}

/**
 * Return the starting display column for horizontal scrolling.
 * (Equivalent to nano's `get_page_start()` in utils.c, non-softwrap path.)
 */
function getPageStart(column: number, editwincols: number): number {
  if (column === 0 || column + 2 < editwincols) return 0;
  if (editwincols > 8) return column - 6 - ((column - 6) % (editwincols - 8));
  return column - (editwincols - 2);
}

// ─── The Nano editor ─────────────────────────────────────────────────────────

export class Nano {
  private term: Terminal;

  // Buffer data
  private lines: string[];
  private path: string;
  private savePath: string;

  // Cursor position (byte indices) and desired column (display columns)
  private row = 0;
  private col = 0; // byte index within current line
  private placeCol = 0; // placewewant — display column target

  // Viewport
  private editTopRow = 0; // first visible line (edittop->lineno - 1)
  private firstColumn = 0; // horizontal scroll position (display columns)

  // State
  private modified = false;
  private mode: NanoMode = "edit";
  private statusMsg = "";
  private statusImportance: "HUSH" | "INFO" | "NOTICE" | "ALERT" = "HUSH";
  private countdown = 0; // keystrokes until statusbar is wiped

  // Prompt input
  private answer = ""; // current prompt answer text
  private answerCursor = 0; // cursor position within answer (byte index)
  private promptText = ""; // the prompt prefix shown before the answer
  private promptMenu: Shortcut[] = MMAIN; // which shortcut list to show

  // Search state
  private lastSearch = "";
  private caseSensitive = false;
  private backwards = false;

  // Cut buffer
  private cutBuffer: string[] = [];
  private keepCutbuffer = false;

  // Mark (selection)
  private markRow = -1;
  private markCol = -1;

  // Callbacks
  private onSave: (path: string, content: string) => void;
  private onExit: () => void;
  private vfsRead: (path: string) => string | null = () => null;

  // Event handlers
  private disposable: { dispose: () => void };
  private resizeDisposable: { dispose: () => void };
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private escapeBuffer = "";

  constructor(
    term: Terminal,
    path: string,
    content: string,
    onSave: (path: string, content: string) => void,
    onExit: () => void,
  ) {
    this.term = term;
    this.path = path;
    this.savePath = path;
    this.lines = content.length ? content.split("\n") : [""];
    this.onSave = onSave;
    this.onExit = onExit;
    this.disposable = term.onData((data) => this.handleData(data));
    this.resizeDisposable = term.onResize(() => this.render());
  }

  setVfsRead(fn: (path: string) => string | null) {
    this.vfsRead = fn;
  }

  start() {
    this.term.write(ALT_SCREEN_ON + HIDE_CURSOR);
    this.wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY > 0) this.scrollDown(3);
      else if (e.deltaY < 0) this.scrollUp(3);
    };
    this.term.element?.addEventListener("wheel", this.wheelHandler, {
      passive: false,
    });
    this.render();
  }

  destroy() {
    this.disposable.dispose();
    this.resizeDisposable.dispose();
    if (this.wheelHandler) {
      this.term.element?.removeEventListener("wheel", this.wheelHandler);
      this.wheelHandler = null;
    }
  }

  // ─── Derived properties ──────────────────────────────────────────────────

  private get fileName(): string {
    return this.path.split("\\").pop() ?? this.path;
  }

  private get editRows(): number {
    return Math.max(1, this.term.rows - 4);
  }

  private get editCols(): number {
    return this.term.cols;
  }

  /** Display column of the cursor on the current line (xplustabs). */
  private get cursorCol(): number {
    return wideness(this.lines[this.row], this.col);
  }

  // ─── Scrolling ───────────────────────────────────────────────────────────

  private ensureCursorVisible() {
    const rows = this.editRows;
    if (this.row < this.editTopRow) this.editTopRow = this.row;
    else if (this.row >= this.editTopRow + rows)
      this.editTopRow = this.row - rows + 1;

    // Horizontal scroll
    const cols = this.editCols;
    const page = getPageStart(this.placeCol, cols);
    if (page !== this.firstColumn) this.firstColumn = page;
  }

  private scrollUp(lines = 1) {
    this.editTopRow = Math.max(0, this.editTopRow - lines);
    this.render();
  }

  private scrollDown(lines = 1) {
    const maxScroll = Math.max(0, this.lines.length - this.editRows);
    this.editTopRow = Math.min(maxScroll, this.editTopRow + lines);
    this.render();
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  private render() {
    const t = this.term;
    const cols = t.cols;
    const edRows = this.editRows;
    const edCols = this.editCols;

    this.ensureCursorVisible();

    // Clear screen + hide cursor during redraw
    t.write("\x1b[H\x1b[2J");

    // Row 1: title bar
    this.gotoRow(1);
    this.renderTitleBar(cols);

    // Rows 2..edRows+1: edit area
    for (let i = 0; i < edRows; i++) {
      this.gotoRow(2 + i);
      this.renderEditLine(i, edCols);
    }

    // Row edRows+2: status bar
    this.gotoRow(edRows + 2);
    this.renderStatusBar(cols);

    // Rows edRows+3 and edRows+4: shortcut bars
    this.gotoRow(edRows + 3);
    this.renderBottomRow1(cols);
    this.gotoRow(edRows + 4);
    this.renderBottomRow2(cols);

    this.positionCursor(edCols);
  }

  /** Move cursor to the start of the given 1-based row. */
  private gotoRow(row: number) {
    this.term.write(`\x1b[${row};1H`);
  }

  /** Title bar — reverse video, "  GNU nano 9.1" left, filename center, state right.
   *  Mirrors titlebar() in winio.c. */
  private renderTitleBar(cols: number) {
    const t = this.term;
    const modText = this.modified ? "Modified" : "";
    const nameStr = this.path ? this.fileName : "New Buffer";

    // Widths of the three regions (plus their padding).
    // verlen = branding string + 2 leading spaces + 1 trailing space
    const verlen = BRANDING.length + 3;
    // statelen = state text + 1 leading space + 1 trailing space (if present)
    const statelen = modText.length > 0 ? modText.length + 2 : 0;
    // When not modified, reserve room for "Modified" so the title bar
    // doesn't shift when the file is edited.
    let pluglen = modText.length > 0 ? 0 : breadth("Modified") + 1;
    const pathlen = nameStr.length + (statelen > 2 ? 1 : 0);

    // Determine whether the version string fits.
    const showVer = verlen + pathlen + pluglen + statelen <= cols;
    if (!showVer && verlen + pathlen + pluglen + statelen > cols) pluglen = 0;

    // The left edge of the centered path.
    const usedLeft = showVer ? verlen : 0;
    let offset = usedLeft;
    if (showVer) {
      const free = cols - usedLeft - pluglen - statelen - pathlen;
      if (free > 0) offset = usedLeft + Math.floor(free / 2);
    }

    // Build the bar from left to right.
    let bar = "";
    if (showVer) bar += BRANDING + " ";

    // Pad to the offset.
    while (breadth(bar) < offset) bar += " ";

    // Add the filename, truncating with "..." if it doesn't fit.
    const availForPath = cols - offset - pluglen - statelen;
    if (nameStr.length <= availForPath) {
      bar += nameStr;
    } else if (availForPath > 5) {
      bar += "..." + nameStr.slice(nameStr.length - availForPath + 3);
    }

    // Pad up to the right-aligned state text.
    const rightPos = cols - statelen;
    while (breadth(bar) < rightPos) bar += " ";

    if (modText) bar += " " + modText;

    // Ensure exact terminal width.
    bar = bar.slice(0, cols).padEnd(cols);
    t.write(`\x1b[2K${REV}${bar}${RESET}`);
  }

  /** Render one edit-area line (0-indexed by visible row). */
  private renderEditLine(i: number, edCols: number) {
    const t = this.term;
    const fromCol = this.firstColumn;
    const lineIdx = this.editTopRow + i;
    const line = lineIdx < this.lines.length ? this.lines[lineIdx] : "";
    const displayed = displayString(line, fromCol, edCols);

    // Mark selection on the current line
    let renderStr = displayed;
    if (this.markRow >= 0 && this.isInSelectionRange(lineIdx)) {
      renderStr = this.renderSelection(
        line,
        lineIdx,
        fromCol,
        edCols,
        displayed,
      );
    }

    // Left scroll indicator: overwrite first character with '<'
    if (fromCol > 0 && renderStr.length > 0) {
      renderStr = REV + "<" + RESET + renderStr.slice(1);
    }

    t.write(`\x1b[2K${renderStr}`);
    // Right scroll indicator if there's more text beyond the viewport
    const lineBreadth = breadth(line);
    if (fromCol + edCols < lineBreadth && lineBreadth > 0) {
      // Overwrite last char with '>'
      t.write(`\x1b[${edCols}G${REV}>${RESET}`);
    }
  }

  /** Check if the given line index is within the selection range. */
  private isInSelectionRange(lineIdx: number): boolean {
    const startRow = Math.min(this.markRow, this.row);
    const endRow = Math.max(this.markRow, this.row);
    return lineIdx >= startRow && lineIdx <= endRow;
  }

  /** Render a line with selection highlighting (reverse video on selected text). */
  private renderSelection(
    line: string,
    lineIdx: number,
    fromCol: number,
    edCols: number,
    displayed: string,
  ): string {
    const selStart =
      this.markRow < this.row ||
      (this.markRow === this.row && this.markCol < this.col)
        ? { row: this.markRow, col: this.markCol }
        : { row: this.row, col: this.col };
    const selEnd =
      this.markRow > this.row ||
      (this.markRow === this.row && this.markCol > this.col)
        ? { row: this.markRow, col: this.markCol }
        : { row: this.row, col: this.col };

    // Determine selection start/end columns on this line
    let startCol = 0;
    let endCol = breadth(line);
    if (lineIdx === selStart.row) {
      startCol = wideness(line, selStart.col);
    }
    if (lineIdx === selEnd.row) {
      endCol = wideness(line, selEnd.col);
    }

    // Adjust for horizontal scroll
    const screenStart = Math.max(0, startCol - fromCol);
    const screenEnd = Math.min(edCols, endCol - fromCol);

    if (screenEnd <= screenStart) return displayed;

    // Build the string with reverse video on the selected portion
    let result = "";
    for (let c = 0; c < displayed.length; c++) {
      if (c >= screenStart && c < screenEnd) {
        result += REV + displayed[c] + RESET;
      } else {
        result += displayed[c];
      }
    }
    return result;
  }

  /** Status bar — prompt (reverse video) or message (centered with [ ]). */
  private renderStatusBar(cols: number) {
    const t = this.term;

    if (this.mode !== "edit" && this.mode !== "yesno") {
      // Prompt mode: reverse video, prompt text + answer
      // The prompt is shown as "prompt: answer", with paging when the
      // answer extends beyond the visible width (matching draw_the_promptbar).
      const base = this.promptText.length + 2; // ": " after prompt
      const cursorDisplayCol = base + wideness(this.answer, this.answerCursor);
      let page = 0;
      if (cursorDisplayCol >= cols) {
        page =
          Math.floor((cursorDisplayCol - cols + 1) / (cols - base)) *
          (cols - base);
        if (page < 0) page = 0;
      }

      // Show the prompt prefix (only on page 0)
      let line: string;
      if (page === 0) {
        line = this.promptText + ": " + this.answer;
      } else {
        line = "<" + this.answer.slice(actualX(this.answer, page - 1));
      }
      // Pad or truncate to full width
      if (line.length < cols) {
        line = line + " ".repeat(cols - line.length);
      } else {
        line = line.slice(0, cols);
      }
      t.write(`\x1b[2K${REV}${line}${RESET}`);
      return;
    }

    if (this.mode === "yesno") {
      // Yes/No prompt: reverse video with the question
      let line = this.statusMsg;
      if (line.length < cols) {
        line = line + " ".repeat(cols - line.length);
      } else {
        line = line.slice(0, cols);
      }
      t.write(`\x1b[2K${REV}${line}${RESET}`);
      return;
    }

    // Message mode: centered with [ message ] brackets, or empty
    if (this.statusMsg) {
      const msg = this.statusMsg;
      const innerLen = msg.length;
      const totalLen = innerLen + 4; // "[ " + msg + " ]"
      if (totalLen <= cols) {
        const startCol = Math.floor((cols - totalLen) / 2);
        const isError = this.statusImportance === "ALERT";
        const attr = isError ? BOLD + REV : REV;
        t.write(
          `\x1b[2K${" ".repeat(startCol)}${attr}[ ${msg} ]${RESET}${" ".repeat(cols - startCol - totalLen)}`,
        );
      } else {
        t.write(`\x1b[2K${msg.slice(0, cols)}`);
      }
    } else {
      // Blank status bar
      t.write(`\x1b[2K`);
    }
  }

  /** Render the first bottom shortcut row (row N-2). */
  private renderBottomRow1(cols: number) {
    if (this.mode === "yesno") {
      const width = Math.max(1, Math.floor(cols / 2));
      const row =
        this.formatKeyTag(" Y", "Yes", width) +
        this.formatKeyTag("^C", "Cancel", width);
      this.term.write(`\x1b[2K${row.slice(0, cols)}`);
      return;
    }

    const menu = this.mode === "edit" ? MMAIN : this.promptMenu;
    const number = Math.min(menu.length, Math.floor((cols + 40) / 20) * 2);
    if (number === 0 || Math.floor(cols / Math.ceil(number / 2)) === 0) {
      this.term.write("\x1b[2K");
      return;
    }
    const itemwidth = Math.floor(cols / Math.ceil(number / 2));
    const row = this.buildShortcutRow(menu, number, 0, itemwidth, cols);
    this.term.write(`\x1b[2K${row.slice(0, cols)}`);
  }

  /** Render the second bottom shortcut row (row N-1). */
  private renderBottomRow2(cols: number) {
    if (this.mode === "yesno") {
      const width = Math.max(1, Math.floor(cols / 2));
      const row = this.formatKeyTag(" N", "No", width);
      this.term.write(`\x1b[2K${row.slice(0, cols)}`);
      return;
    }

    const menu = this.mode === "edit" ? MMAIN : this.promptMenu;
    const number = Math.min(menu.length, Math.floor((cols + 40) / 20) * 2);
    if (number === 0 || Math.floor(cols / Math.ceil(number / 2)) === 0) {
      this.term.write("\x1b[2K");
      return;
    }
    const itemwidth = Math.floor(cols / Math.ceil(number / 2));
    const row = this.buildShortcutRow(menu, number, 1, itemwidth, cols);
    this.term.write(`\x1b[2K${row.slice(0, cols)}`);
  }

  /**
   * Build one shortcut row.  `parity` selects odd or even indices
   * (0 → indices 0,2,4... = row 1; 1 → indices 1,3,5... = row 2).
   */
  private buildShortcutRow(
    menu: Shortcut[],
    number: number,
    parity: number,
    itemwidth: number,
    cols: number,
  ): string {
    let line = "";
    for (let index = parity; index < number; index += 2) {
      const sc = menu[index];
      if (!sc) continue;
      let thiswidth = itemwidth;
      // When odd count, penultimate item is double-wide
      if (number % 2 === 1 && index + 2 === number) thiswidth += itemwidth;
      // Last two items get remaining slack
      if (index + 2 >= number) thiswidth += cols % itemwidth;

      line += this.formatKeyTag(sc.key, sc.tag, thiswidth);
    }
    return line;
  }

  /**
   * Format a key combo + tag for one shortcut cell.
   * Key combo in reverse video, tag in normal text (matching post_one_key).
   */
  private formatKeyTag(keystroke: string, tag: string, width: number): string {
    let cell = `${REV}${keystroke}${RESET}`;

    const keyLen = keystroke.length;
    if (width - keyLen < 2) return cell.slice(0, width);

    cell += " ";
    const tagAvail = width - keyLen - 1;
    cell += tag.slice(0, tagAvail);

    // Pad to width
    const currentLen = keyLen + 1 + Math.min(tag.length, tagAvail);
    cell += " ".repeat(Math.max(0, width - currentLen));

    return cell;
  }

  /** Position the cursor on screen. */
  private positionCursor(edCols: number) {
    const t = this.term;
    const edRows = this.editRows;
    const statusBarRow = edRows + 2; // 1-based row of the status bar

    if (this.mode === "yesno") {
      // In yesno mode, hide cursor
      t.write(HIDE_CURSOR);
      t.write(`\x1b[${statusBarRow};1H`);
      return;
    }

    if (this.mode !== "edit") {
      // Prompt mode: cursor after the answer text on the status bar row
      t.write(SHOW_CURSOR);
      const base = this.promptText.length + 2; // ": " after prompt
      const cursorDisplayCol = base + wideness(this.answer, this.answerCursor);
      // Handle paging in the prompt
      let page = 0;
      if (cursorDisplayCol >= edCols) {
        page =
          Math.floor((cursorDisplayCol - edCols + 1) / (edCols - base)) *
          (edCols - base);
        if (page < 0) page = 0;
      }
      const screenCol = Math.min(cursorDisplayCol - page + 1, edCols);
      t.write(`\x1b[${statusBarRow};${screenCol}H`);
      return;
    }

    // Edit mode: cursor at row (2 + row - editTopRow), col (cursorCol - firstColumn + 1)
    // Row 1 = title bar, Row 2 = first edit line
    t.write(SHOW_CURSOR);
    const screenRow = 2 + (this.row - this.editTopRow);
    const screenCol = this.cursorCol - this.firstColumn + 1;
    t.write(`\x1b[${screenRow};${Math.min(screenCol, edCols)}H`);
  }

  // ─── Status messages ─────────────────────────────────────────────────────

  private statusline(
    importance: "HUSH" | "INFO" | "NOTICE" | "ALERT",
    msg: string,
  ) {
    this.statusMsg = msg;
    this.statusImportance = importance;
    this.countdown = 20;
    this.render();
  }

  private wipeStatusbar() {
    this.statusMsg = "";
    this.statusImportance = "HUSH";
  }

  /** Called on each keystroke to auto-wipe the status bar (blank_it_when_expired). */
  private tickStatus() {
    if (this.countdown > 0) {
      this.countdown--;
      if (this.countdown === 0) this.wipeStatusbar();
    }
  }

  // ─── Text editing ────────────────────────────────────────────────────────

  private setModified() {
    this.modified = true;
  }

  private insertText(text: string) {
    this.keepCutbuffer = false;
    const line = this.lines[this.row];
    this.lines[this.row] =
      line.slice(0, this.col) + text + line.slice(this.col);
    this.col += text.length;
    this.placeCol = this.cursorCol;
    this.setModified();
    this.wipeStatusbar();
    this.render();
  }

  private doBackspace() {
    this.keepCutbuffer = false;
    if (this.col > 0) {
      const line = this.lines[this.row];
      this.lines[this.row] = line.slice(0, this.col - 1) + line.slice(this.col);
      this.col--;
      this.placeCol = this.cursorCol;
      this.setModified();
      this.wipeStatusbar();
      this.render();
    } else if (this.row > 0) {
      const prev = this.lines[this.row - 1];
      this.col = prev.length;
      this.lines[this.row - 1] = prev + this.lines[this.row];
      this.lines.splice(this.row, 1);
      this.row--;
      this.placeCol = this.cursorCol;
      this.setModified();
      this.wipeStatusbar();
      this.render();
    }
  }

  private doDelete() {
    this.keepCutbuffer = false;
    const line = this.lines[this.row];
    if (this.col < line.length) {
      this.lines[this.row] = line.slice(0, this.col) + line.slice(this.col + 1);
      this.setModified();
      this.wipeStatusbar();
      this.render();
    } else if (this.row < this.lines.length - 1) {
      this.lines[this.row] = line + this.lines[this.row + 1];
      this.lines.splice(this.row + 1, 1);
      this.setModified();
      this.wipeStatusbar();
      this.render();
    }
  }

  private doEnter() {
    this.keepCutbuffer = false;
    const line = this.lines[this.row];
    const after = line.slice(this.col);
    this.lines[this.row] = line.slice(0, this.col);
    this.lines.splice(this.row + 1, 0, after);
    this.row++;
    this.col = 0;
    this.placeCol = 0;
    this.setModified();
    this.wipeStatusbar();
    this.render();
  }

  private doTab() {
    // Insert a real tab character (nano default: inject "\t")
    this.insertText("\t");
  }

  // ─── Cut / Paste / Copy ──────────────────────────────────────────────────

  private cutText() {
    if (this.markRow >= 0) {
      this.cutMarkedRegion();
      return;
    }

    // Default: cut full line (not CUT_FROM_CURSOR)
    if (!this.keepCutbuffer) this.cutBuffer = [];

    if (this.row < this.lines.length - 1) {
      this.cutBuffer.push(this.lines[this.row]);
      this.lines.splice(this.row, 1);
    } else {
      // At end of buffer: cut until end-of-line
      this.cutBuffer.push(this.lines[this.row]);
      this.lines[this.row] = "";
    }

    if (this.lines.length === 0) this.lines = [""];
    if (this.row >= this.lines.length) this.row = this.lines.length - 1;
    this.col = 0;
    this.placeCol = 0;
    this.keepCutbuffer = true;
    this.setModified();
    this.render();
  }

  private copyText() {
    if (this.markRow >= 0) {
      this.copyMarkedRegion();
      return;
    }
    // Copy full line
    if (!this.keepCutbuffer) this.cutBuffer = [];
    this.cutBuffer.push(this.lines[this.row]);
    this.keepCutbuffer = true;
  }

  private cutMarkedRegion() {
    const sel = this.getSelectionRange();
    const newBuffer: string[] = [];
    const startRow = sel.start.row;
    const endRow = sel.end.row;

    if (startRow === endRow) {
      const line = this.lines[startRow];
      newBuffer.push(line.slice(sel.start.col, sel.end.col));
      this.lines[startRow] =
        line.slice(0, sel.start.col) + line.slice(sel.end.col);
    } else {
      newBuffer.push(this.lines[startRow].slice(sel.start.col));
      for (let r = startRow + 1; r < endRow; r++) {
        newBuffer.push(this.lines[r]);
      }
      newBuffer.push(this.lines[endRow].slice(0, sel.end.col));
      // Merge the remaining parts
      const merged =
        this.lines[startRow].slice(0, sel.start.col) +
        this.lines[endRow].slice(sel.end.col);
      this.lines.splice(startRow, endRow - startRow + 1, merged);
    }

    this.cutBuffer = newBuffer;
    this.row = startRow;
    this.col = sel.start.col;
    this.placeCol = this.cursorCol;
    this.markRow = -1;
    this.markCol = -1;
    this.keepCutbuffer = false;
    this.setModified();
    this.render();
  }

  private copyMarkedRegion() {
    const sel = this.getSelectionRange();
    const newBuffer: string[] = [];
    const startRow = sel.start.row;
    const endRow = sel.end.row;

    if (startRow === endRow) {
      newBuffer.push(this.lines[startRow].slice(sel.start.col, sel.end.col));
    } else {
      newBuffer.push(this.lines[startRow].slice(sel.start.col));
      for (let r = startRow + 1; r < endRow; r++) {
        newBuffer.push(this.lines[r]);
      }
      newBuffer.push(this.lines[endRow].slice(0, sel.end.col));
    }
    this.cutBuffer = newBuffer;
    this.keepCutbuffer = false;
  }

  private getSelectionRange(): {
    start: { row: number; col: number };
    end: { row: number; col: number };
  } {
    const a = { row: this.markRow, col: this.markCol };
    const b = { row: this.row, col: this.col };
    if (a.row < b.row || (a.row === b.row && a.col <= b.col)) {
      return { start: a, end: b };
    }
    return { start: b, end: a };
  }

  private pasteText() {
    if (this.cutBuffer.length === 0) {
      this.statusline("ALERT", "Cutbuffer is empty");
      return;
    }

    const line = this.lines[this.row];
    const before = line.slice(0, this.col);
    const after = line.slice(this.col);

    if (this.cutBuffer.length === 1) {
      this.lines[this.row] = before + this.cutBuffer[0] + after;
      this.col = (before + this.cutBuffer[0]).length;
    } else {
      this.lines[this.row] = before + this.cutBuffer[0];
      for (let i = 1; i < this.cutBuffer.length; i++) {
        this.lines.splice(this.row + i, 0, this.cutBuffer[i]);
      }
      this.lines[this.row + this.cutBuffer.length - 1] += after;
      this.row += this.cutBuffer.length - 1;
      this.col = this.cutBuffer[this.cutBuffer.length - 1].length;
    }

    this.placeCol = this.cursorCol;
    this.setModified();
    this.wipeStatusbar();
    this.render();
  }

  // ─── Mark (selection) ────────────────────────────────────────────────────

  private doMark() {
    if (this.markRow >= 0) {
      this.markRow = -1;
      this.markCol = -1;
      this.statusline("HUSH", "Mark Unset");
    } else {
      this.markRow = this.row;
      this.markCol = this.col;
      this.statusline("HUSH", "Mark Set");
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  private doSearchForward() {
    this.backwards = false;
    this.mode = "whereis";
    this.promptMenu = MWHEREIS;
    this.answer = "";
    this.answerCursor = 0;
    this.wipeStatusbar();
    this.updatePromptText();
    this.render();
  }

  private doSearchBackward() {
    this.backwards = true;
    this.mode = "whereis";
    this.promptMenu = MWHEREIS;
    this.answer = "";
    this.answerCursor = 0;
    this.wipeStatusbar();
    this.updatePromptText();
    this.render();
  }

  private doReplace() {
    this.backwards = false;
    this.mode = "replace";
    this.promptMenu = MWHEREIS;
    this.answer = "";
    this.answerCursor = 0;
    this.wipeStatusbar();
    this.updatePromptText();
    this.render();
  }

  private executeSearch() {
    if (!this.answer) {
      if (!this.lastSearch) {
        this.statusline("HUSH", "Cancelled");
        return;
      }
      this.answer = this.lastSearch;
    }
    this.lastSearch = this.answer;

    if (this.mode === "whereis") {
      this.goLooking(this.answer);
    } else if (this.mode === "replace") {
      // Switch to replace-with prompt
      this.enterPrompt("replaceWith", "Replace with", MREPLACEWITH, "");
      return;
    }
    this.mode = "edit";
    this.render();
  }

  private executeReplaceWith(replaceStr: string) {
    const needle = this.lastSearch;
    let count = 0;
    let replaced = false;

    // Search and replace all occurrences
    let searchRow = 0;
    let searchCol = 0;

    while (true) {
      const found = this.findNext(needle, searchRow, searchCol);
      if (!found) break;

      // Replace the occurrence
      const line = this.lines[found.row];
      this.lines[found.row] =
        line.slice(0, found.col) +
        replaceStr +
        line.slice(found.col + needle.length);
      this.row = found.row;
      this.col = found.col + replaceStr.length;
      this.placeCol = this.cursorCol;
      this.setModified();
      count++;
      replaced = true;

      // Continue from after the replacement
      searchRow = found.row;
      searchCol = found.col + replaceStr.length;
    }

    if (replaced) {
      this.statusline(
        "HUSH",
        count === 1 ? "Replaced 1 occurrence" : `Replaced ${count} occurrences`,
      );
    } else {
      this.statusline("ALERT", `"${needle}" not found`);
    }
    this.mode = "edit";
    this.render();
  }

  /** Find next occurrence of needle starting from (searchRow, searchCol). */
  private findNext(
    needle: string,
    searchRow: number,
    searchCol: number,
  ): { row: number; col: number } | null {
    if (!needle) return null;
    const hay = (r: number, c: number) => {
      const line = this.lines[r];
      const idx = this.caseSensitive
        ? line.indexOf(needle, c)
        : line.toLowerCase().indexOf(needle.toLowerCase(), c);
      return idx;
    };

    if (!this.backwards) {
      // Forward search
      for (let r = searchRow; r < this.lines.length; r++) {
        const startC = r === searchRow ? searchCol : 0;
        const idx = hay(r, startC);
        if (idx >= 0) return { row: r, col: idx };
      }
      // Wrap
      for (let r = 0; r <= searchRow; r++) {
        const idx = hay(r, 0);
        if (idx >= 0) return { row: r, col: idx };
      }
    } else {
      // Backward search
      for (let r = searchRow; r >= 0; r--) {
        const line = this.lines[r];
        const startC = r === searchRow ? searchCol : line.length;
        const idx = this.caseSensitive
          ? line.lastIndexOf(needle, startC)
          : line.toLowerCase().lastIndexOf(needle.toLowerCase(), startC);
        if (idx >= 0) return { row: r, col: idx };
      }
      // Wrap
      for (let r = this.lines.length - 1; r >= searchRow; r--) {
        const line = this.lines[r];
        const idx = this.caseSensitive
          ? line.lastIndexOf(needle)
          : line.toLowerCase().lastIndexOf(needle.toLowerCase());
        if (idx >= 0) return { row: r, col: idx };
      }
    }
    return null;
  }

  private goLooking(needle: string) {
    // Search from current position
    const startRow = this.row;
    const startCol = this.backwards ? this.col - 1 : this.col + 1;

    const found = this.findNext(needle, startRow, Math.max(0, startCol));
    if (found) {
      this.row = found.row;
      this.col = found.col;
      this.placeCol = this.cursorCol;
      // Detect wrapping: forward search wraps when found is before start;
      // backward search wraps when found is after start.
      let wrapped: boolean;
      if (!this.backwards) {
        wrapped =
          found.row < startRow ||
          (found.row === startRow && found.col < startCol);
      } else {
        wrapped =
          found.row > startRow ||
          (found.row === startRow && found.col > this.col + 1);
      }
      if (wrapped) {
        this.statusline("HUSH", "Search Wrapped");
      } else {
        this.wipeStatusbar();
      }
    } else {
      this.statusline("ALERT", `"${needle}" not found`);
    }
  }

  /** Repeat last search (do_research / ^W ^W, or M-W). */
  private doResearch() {
    if (!this.lastSearch) {
      this.statusline("ALERT", "No current search pattern");
      return;
    }
    this.goLooking(this.lastSearch);
    this.render();
  }

  // ─── Go To Line ──────────────────────────────────────────────────────────

  private doGoToLine() {
    this.enterPrompt("gotoline", "Go to line and column", MGOTOLINE, "");
  }

  private executeGoToLine(input: string) {
    // Parse "line,col" or "line" or "line,column"
    const parts = input.split(/[,;]/);
    const lineNum = parseInt(parts[0], 10);
    const colNum = parts[1] ? parseInt(parts[1], 10) : 1;

    if (isNaN(lineNum)) {
      this.statusline("ALERT", "Invalid line number");
      return;
    }

    this.row = Math.max(0, Math.min(this.lines.length - 1, lineNum - 1));
    const lineLen = this.lines[this.row].length;
    this.col = Math.max(0, Math.min(lineLen, (colNum || 1) - 1));
    this.placeCol = this.cursorCol;
    this.mode = "edit";
    this.wipeStatusbar();
    this.render();
  }

  // ─── Read File ───────────────────────────────────────────────────────────

  private doInsertFile() {
    this.enterPrompt("insertfile", "File to insert", MINSERTFILE, "");
  }

  private executeInsertFile(filePath: string) {
    if (!filePath) {
      this.statusline("HUSH", "Cancelled");
      return;
    }
    const content = this.vfsRead(filePath);
    if (content === null) {
      this.statusline("ALERT", `Error reading ${filePath}`);
      return;
    }
    const fileLines = content.split("\n");
    const currentLine = this.lines[this.row];
    const before = currentLine.slice(0, this.col);
    const after = currentLine.slice(this.col);
    this.lines[this.row] = before + fileLines[0];
    for (let i = 1; i < fileLines.length; i++) {
      this.lines.splice(this.row + i, 0, fileLines[i]);
    }
    this.lines[this.row + fileLines.length - 1] += after;
    this.row += fileLines.length - 1;
    this.col = fileLines[fileLines.length - 1].length;
    this.placeCol = this.cursorCol;
    this.setModified();
    this.statusline("HUSH", `Read ${fileLines.length} lines`);
    this.mode = "edit";
    this.render();
  }

  // ─── Write Out / Save ────────────────────────────────────────────────────

  private doWriteOut() {
    this.enterPrompt("writefile", "Write to File", MWRITEFILE, this.savePath);
  }

  private doSaveFile() {
    // Save without prompting (^S)
    this.onSave(this.savePath, this.lines.join("\n"));
    this.modified = false;
    this.path = this.savePath;
    this.statusline("HUSH", "Saved");
  }

  private executeWriteFile(filePath: string) {
    if (!filePath) {
      this.statusline("HUSH", "Cancelled");
      return;
    }
    this.savePath = filePath;
    this.onSave(this.savePath, this.lines.join("\n"));
    this.modified = false;
    this.path = this.savePath;
    this.statusline("HUSH", "Saved");
    this.mode = "edit";
    this.render();
  }

  // ─── Exit ────────────────────────────────────────────────────────────────

  private doExit() {
    if (this.modified) {
      this.mode = "yesno";
      this.statusMsg = "Save modified buffer?";
      this.statusImportance = "HUSH";
      this.answer = "";
      this.render();
    } else {
      this.doExitNow();
    }
  }

  private doExitNow() {
    this.term.write(SHOW_CURSOR);
    this.term.write(ALT_SCREEN_OFF);
    this.destroy();
    this.onExit();
  }

  // ─── Cursor movement (matching nano's move.c) ────────────────────────────

  private syncCol() {
    // placeCol is in display columns (placewewant), col is in bytes.
    // Convert the desired display column to the actual byte index.
    this.col = actualX(this.lines[this.row], this.placeCol);
  }

  private doUp() {
    if (this.row <= 0) return;
    const cursorScreenRow = this.row - this.editTopRow;
    this.row--;
    this.syncCol();
    // Smooth scroll: if cursor was at top of viewport, scroll up
    if (cursorScreenRow === 0) this.editTopRow = this.row;
    this.tickStatus();
    this.render();
  }

  private doDown() {
    if (this.row >= this.lines.length - 1) return;
    const cursorScreenRow = this.row - this.editTopRow;
    this.row++;
    this.syncCol();
    // Smooth scroll: if cursor was at bottom of viewport, scroll down
    if (cursorScreenRow === this.editRows - 1) this.editTopRow = this.row;
    this.tickStatus();
    this.render();
  }

  private doLeft() {
    if (this.col > 0) {
      this.col--;
      this.placeCol = this.cursorCol;
      this.tickStatus();
      this.render();
    } else if (this.row > 0) {
      this.row--;
      this.col = this.lines[this.row].length;
      this.placeCol = this.cursorCol;
      if (this.row < this.editTopRow) this.editTopRow = this.row;
      this.tickStatus();
      this.render();
    }
  }

  private doRight() {
    if (this.col < this.lines[this.row].length) {
      this.col++;
      this.placeCol = this.cursorCol;
      this.tickStatus();
      this.render();
    } else if (this.row < this.lines.length - 1) {
      this.row++;
      this.col = 0;
      this.placeCol = 0;
      if (this.row >= this.editTopRow + this.editRows)
        this.editTopRow = this.row - this.editRows + 1;
      this.tickStatus();
      this.render();
    }
  }

  /** Smart Home — first non-whitespace, then column 0. */
  private doHome() {
    const line = this.lines[this.row];
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (this.col === indent && indent > 0) {
      this.col = 0;
    } else if (this.col === 0 && indent > 0) {
      this.col = indent;
    } else {
      this.col = indent;
    }
    this.placeCol = this.cursorCol;
    this.tickStatus();
    this.render();
  }

  private doEnd() {
    this.col = this.lines[this.row].length;
    this.placeCol = this.cursorCol;
    this.tickStatus();
    this.render();
  }

  /** PageUp — move editRows-2 lines, keep cursor on same screen row (STATIONARY). */
  private doPageUp() {
    const mustmove = this.editRows < 3 ? 1 : this.editRows - 2;
    const oldScreenRow = this.row - this.editTopRow;
    this.row = Math.max(0, this.row - mustmove);
    this.syncCol();
    this.editTopRow = Math.max(0, this.row - oldScreenRow);
    this.tickStatus();
    this.render();
  }

  /** PageDown — move editRows-2 lines, keep cursor on same screen row (STATIONARY). */
  private doPageDown() {
    const mustmove = this.editRows < 3 ? 1 : this.editRows - 2;
    const oldScreenRow = this.row - this.editTopRow;
    this.row = Math.min(this.lines.length - 1, this.row + mustmove);
    this.syncCol();
    this.editTopRow = Math.max(0, this.row - oldScreenRow);
    this.tickStatus();
    this.render();
  }

  private toFirstLine() {
    this.row = 0;
    this.col = 0;
    this.placeCol = 0;
    this.tickStatus();
    this.render();
  }

  private toLastLine() {
    this.row = this.lines.length - 1;
    this.col = this.lines[this.row].length;
    this.placeCol = this.cursorCol;
    this.tickStatus();
    this.render();
  }

  /** Move to previous word (M-Space in nano). */
  private toPrevWord() {
    if (this.col > 0) {
      const line = this.lines[this.row];
      // Skip whitespace backwards
      while (this.col > 0 && /\s/.test(line[this.col - 1])) this.col--;
      // Skip word chars backwards
      while (this.col > 0 && !/\s/.test(line[this.col - 1])) this.col--;
    } else if (this.row > 0) {
      this.row--;
      this.col = this.lines[this.row].length;
      // Recurse to find word start on this line
      const line = this.lines[this.row];
      while (this.col > 0 && /\s/.test(line[this.col - 1])) this.col--;
      while (this.col > 0 && !/\s/.test(line[this.col - 1])) this.col--;
    }
    this.placeCol = this.cursorCol;
    this.tickStatus();
    this.render();
  }

  /** Move to next word (^Space in nano). */
  private toNextWord() {
    const line = this.lines[this.row];
    if (this.col < line.length) {
      // Skip word chars forward
      while (this.col < line.length && !/\s/.test(line[this.col])) this.col++;
      // Skip whitespace forward
      while (this.col < line.length && /\s/.test(line[this.col])) this.col++;
    }
    if (this.col >= line.length && this.row < this.lines.length - 1) {
      this.row++;
      this.col = 0;
      const nextLine = this.lines[this.row];
      while (this.col < nextLine.length && /\s/.test(nextLine[this.col]))
        this.col++;
    }
    this.placeCol = this.cursorCol;
    this.tickStatus();
    this.render();
  }

  /** Scroll viewport up one line without moving cursor (M-- or M-Up). */
  private doScrollUp() {
    if (this.editTopRow > 0) {
      this.editTopRow--;
      this.render();
    }
  }

  /** Scroll viewport down one line without moving cursor (M-+ or M-Down). */
  private doScrollDown() {
    if (this.editTopRow < this.lines.length - this.editRows) {
      this.editTopRow++;
      this.render();
    }
  }

  /** Move to the previous block of text (a line that is non-blank after blanks). */
  private toPrevBlock() {
    let r = this.row;
    // Skip current block
    while (r > 0 && this.lines[r].trim().length > 0) r--;
    // Skip blank lines
    while (r > 0 && this.lines[r].trim().length === 0) r--;
    this.row = r;
    this.col = 0;
    this.placeCol = 0;
    this.tickStatus();
    this.render();
  }

  /** Move to the next block of text (a line that is non-blank after blanks). */
  private toNextBlock() {
    let r = this.row;
    // Skip current block
    while (r < this.lines.length - 1 && this.lines[r].trim().length > 0) r++;
    // Skip blank lines
    while (r < this.lines.length - 1 && this.lines[r].trim().length === 0) r++;
    this.row = r;
    this.col = 0;
    this.placeCol = 0;
    this.tickStatus();
    this.render();
  }

  /** Center the cursor line (^L). */
  private doCenter() {
    const center = Math.floor(this.editRows / 2);
    this.editTopRow = Math.max(0, this.row - center);
    this.render();
  }

  /** Report cursor position (^C in edit mode). */
  private reportCursorPosition() {
    const lineno = this.row + 1;
    const totalLines = this.lines.length;
    const column = this.cursorCol + 1;
    const fullwidth = breadth(this.lines[this.row]) + 1;
    const linepct =
      totalLines > 0 ? Math.round((100 * lineno) / totalLines) : 0;
    const colpct = fullwidth > 0 ? Math.round((100 * column) / fullwidth) : 0;
    const totsize = this.lines.join("\n").length;
    const sum = this.lines.slice(0, this.row).join("\n").length + this.col;
    const charpct = totsize > 0 ? Math.round((100 * sum) / totsize) : 0;
    const lineDigits = String(totalLines).length;
    const charDigits = String(totsize).length;

    const msg = `line ${String(lineno).padStart(lineDigits)}/${totalLines} (${String(linepct).padStart(2)}%), col ${String(column).padStart(2)}/${String(fullwidth).padStart(2)} (${String(colpct).padStart(3)}%), char ${String(sum).padStart(charDigits)}/${totsize} (${String(charpct).padStart(2)}%)`;
    this.statusline("INFO", msg);
  }

  // ─── Justify (^J) ────────────────────────────────────────────────────────

  private doJustify() {
    // Simplified justify: join the current paragraph into one line,
    // then wrap at editCols - 1 columns.
    const maxCol = this.editCols - 1;

    // Find paragraph boundaries
    const isBlank = (r: number) => this.lines[r].trim().length === 0;

    let startRow = this.row;
    while (startRow > 0 && !isBlank(startRow - 1)) startRow--;

    let endRow = this.row;
    while (endRow < this.lines.length - 1 && !isBlank(endRow + 1)) endRow++;

    // Join lines into one paragraph
    const para = this.lines
      .slice(startRow, endRow + 1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(" ");

    // Wrap
    const wrapped: string[] = [];
    let pos = 0;
    while (pos < para.length) {
      if (para.length - pos <= maxCol) {
        wrapped.push(para.slice(pos));
        break;
      }
      let breakAt = para.lastIndexOf(" ", pos + maxCol);
      if (breakAt <= pos) breakAt = pos + maxCol;
      wrapped.push(para.slice(pos, breakAt));
      pos = breakAt + 1;
    }

    // Replace lines
    this.lines.splice(startRow, endRow - startRow + 1, ...wrapped);
    this.row = startRow;
    this.col = 0;
    this.placeCol = 0;
    this.setModified();
    this.statusline("HUSH", "Justified paragraph");
    this.render();
  }

  // ─── Word count (M-D) ────────────────────────────────────────────────────

  private countLinesWordsAndChars() {
    const lines = this.lines.length;
    const text = this.lines.join("\n");
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const chars = text.length;
    this.statusline(
      "INFO",
      `Lines: ${lines}, Words: ${words}, Chars: ${chars}`,
    );
  }

  // ─── Prompt handling ─────────────────────────────────────────────────────

  private enterPrompt(
    mode: NanoMode,
    promptText: string,
    menu: Shortcut[],
    initial: string,
  ) {
    this.mode = mode;
    this.promptText = promptText;
    this.promptMenu = menu;
    this.answer = initial;
    this.answerCursor = initial.length;
    this.wipeStatusbar();
    this.render();
  }

  /** Rebuild the prompt text with toggle indicators (matching search_init). */
  private updatePromptText() {
    if (this.mode === "whereis" || this.mode === "replace") {
      let p = "Search";
      if (this.caseSensitive) p += " [Case sensitive]";
      if (this.backwards) p += " [Backwards]";
      if (this.mode === "replace") p += " (to replace)";
      // Include last search as default
      if (this.lastSearch) {
        const disp = this.lastSearch.slice(0, Math.floor(this.term.cols / 3));
        p += ` [${disp}${this.lastSearch.length > disp.length ? "..." : ""}]`;
      }
      this.promptText = p;
    } else if (this.mode === "replaceWith") {
      this.promptText = "Replace with";
    }
  }

  private handlePromptInput(data: string) {
    switch (data) {
      case "\r": // Enter — confirm
        this.confirmPrompt();
        break;
      case "\x1b": // Esc — cancel
        this.cancelPrompt();
        break;
      case "\x7f": // Backspace
      case "\x08":
        if (this.answerCursor > 0) {
          this.answer =
            this.answer.slice(0, this.answerCursor - 1) +
            this.answer.slice(this.answerCursor);
          this.answerCursor--;
          this.render();
        }
        break;
      case "\x03": // ^C — cancel
        this.cancelPrompt();
        break;
      case "\x19": // ^Y — first line (in whereis/gotoline modes)
        if (this.mode === "whereis" || this.mode === "gotoline") {
          this.cancelPrompt();
          this.toFirstLine();
        }
        break;
      case "\x16": // ^V — last line (in whereis/gotoline modes)
        if (this.mode === "whereis" || this.mode === "gotoline") {
          this.cancelPrompt();
          this.toLastLine();
        }
        break;
      case "\x12": // ^R — flip replace/search (in whereis/replace modes)
        if (this.mode === "whereis") {
          this.mode = "replace";
          this.promptMenu = MWHEREIS;
          this.updatePromptText();
          this.render();
        } else if (this.mode === "replace") {
          this.mode = "whereis";
          this.promptMenu = MWHEREIS;
          this.updatePromptText();
          this.render();
        }
        break;
      case "\x17": // ^W — flip to no-replace (in replaceWith mode)
        if (this.mode === "replaceWith") {
          // Go back to search mode
          this.mode = "whereis";
          this.promptMenu = MWHEREIS;
          this.updatePromptText();
          this.render();
        }
        break;
      case "\x01": // ^A — Home
        this.answerCursor = 0;
        this.render();
        break;
      case "\x05": // ^E — End
        this.answerCursor = this.answer.length;
        this.render();
        break;
      case "\x0b": // ^K — cut to end of answer
        this.answer = this.answer.slice(0, this.answerCursor);
        this.render();
        break;
      default:
        if (data.charCodeAt(0) >= 0x20) {
          this.answer =
            this.answer.slice(0, this.answerCursor) +
            data +
            this.answer.slice(this.answerCursor);
          this.answerCursor += data.length;
          this.render();
        }
        break;
    }
  }

  private handlePromptEscape(seq: string) {
    const code = seq[2];
    switch (code) {
      case "C": // Right
        if (this.answerCursor < this.answer.length) {
          this.answerCursor++;
          this.render();
        }
        break;
      case "D": // Left
        if (this.answerCursor > 0) {
          this.answerCursor--;
          this.render();
        }
        break;
      case "H": // Home
        this.answerCursor = 0;
        this.render();
        break;
      case "F": // End
        this.answerCursor = this.answer.length;
        this.render();
        break;
      case "3": // Delete
        if (this.answerCursor < this.answer.length) {
          this.answer =
            this.answer.slice(0, this.answerCursor) +
            this.answer.slice(this.answerCursor + 1);
          this.render();
        }
        break;
      default:
        break;
    }
  }

  private confirmPrompt() {
    const answer = this.answer;
    switch (this.mode) {
      case "whereis":
        this.executeSearch();
        break;
      case "replace":
        this.executeSearch(); // will switch to replaceWith
        break;
      case "replaceWith":
        this.mode = "edit";
        this.executeReplaceWith(answer);
        break;
      case "writefile":
        this.executeWriteFile(answer);
        break;
      case "insertfile":
        this.executeInsertFile(answer);
        break;
      case "gotoline":
        this.executeGoToLine(answer);
        break;
      default:
        this.mode = "edit";
        this.render();
        break;
    }
  }

  private cancelPrompt() {
    this.mode = "edit";
    this.wipeStatusbar();
    this.statusline("HUSH", "Cancelled");
    this.render();
  }

  // ─── Input handling ──────────────────────────────────────────────────────

  private handleData(data: string) {
    // ── Escape sequence / Alt-key accumulation ──
    // An ESC (\x1b) can start either a CSI/SS3 escape sequence (ESC [ ...)
    // or a Meta/Alt key (ESC <char>).
    if (this.escapeBuffer || data === "\x1b") {
      this.escapeBuffer += data;

      // CSI or SS3 sequence: ESC [ ... or ESC O ...
      if (
        this.escapeBuffer.length >= 2 &&
        (this.escapeBuffer[1] === "[" || this.escapeBuffer[1] === "O")
      ) {
        // Wait for the final byte (a letter, ~, or home/end code)
        const last = this.escapeBuffer[this.escapeBuffer.length - 1];
        if (this.escapeBuffer.length >= 3 && /[A-Za-z0-9~]/.test(last)) {
          const seq = this.escapeBuffer;
          this.escapeBuffer = "";
          this.handleEscape(seq);
        }
        if (this.escapeBuffer.length > 8) this.escapeBuffer = "";
        return;
      }

      // Alt+key: ESC followed by a single non-CSI character
      if (this.escapeBuffer.length >= 2) {
        const altChar = this.escapeBuffer[1];
        this.escapeBuffer = "";
        // If the second char is also ESC, it might be Alt+arrow (ESC ESC [ ...)
        if (altChar === "\x1b") {
          // Re-buffer and wait for the rest
          this.escapeBuffer = "\x1b";
          return;
        }
        this.handleAltKey(altChar);
        return;
      }
      return;
    }

    if (data[0] === "\x1b") {
      this.escapeBuffer = data;
      if (data.length >= 3 && (data[1] === "[" || data[1] === "O")) {
        const seq = this.escapeBuffer;
        this.escapeBuffer = "";
        this.handleEscape(seq);
      } else if (data.length >= 2) {
        // Alt+key in a single data chunk
        const altChar = data[1];
        this.escapeBuffer = "";
        this.handleAltKey(altChar);
      }
      return;
    }

    // Handle prompt modes
    if (this.mode !== "edit" && this.mode !== "yesno") {
      this.handlePromptInput(data);
      return;
    }

    // Yes/No confirmation
    if (this.mode === "yesno") {
      this.handleYesNo(data);
      return;
    }

    // Edit mode
    this.tickStatus();
    this.handleEditMode(data);
  }

  /** Handle a Meta/Alt key (ESC + char). */
  private handleAltKey(ch: string) {
    // In search/replace prompt modes, handle toggle keys
    if (
      this.mode === "whereis" ||
      this.mode === "replace" ||
      this.mode === "replaceWith"
    ) {
      switch (ch) {
        case "C":
        case "c":
          this.caseSensitive = !this.caseSensitive;
          this.updatePromptText();
          this.render();
          return;
        case "B":
        case "b":
          this.backwards = !this.backwards;
          this.updatePromptText();
          this.render();
          return;
        default:
          return;
      }
    }

    if (this.mode !== "edit") return;

    this.tickStatus();
    switch (ch) {
      case "6":
      case "^":
        // M-6 / M-^ — Copy
        this.copyText();
        this.tickStatus();
        break;
      case "W":
      case "w":
        // M-W — find next (repeat last search)
        this.doResearch();
        break;
      case "Q":
      case "q":
        // M-Q — find previous
        this.backwards = true;
        this.doResearch();
        break;
      case "\\":
        // M-\ — first line
        this.toFirstLine();
        break;
      case "/":
        // M-/ — last line
        this.toLastLine();
        break;
      case " ":
        // M-Space — previous word
        this.toPrevWord();
        break;
      case "D":
      case "d":
        // M-D — word count
        this.countLinesWordsAndChars();
        break;
      case "A":
      case "a":
        // M-A — set mark
        this.doMark();
        break;
      case "-":
      case "_":
        // M-- — scroll up
        this.doScrollUp();
        break;
      case "+":
      case "=":
        // M-+ — scroll down
        this.doScrollDown();
        break;
      default:
        break;
    }
  }

  private handleYesNo(data: string) {
    switch (data) {
      case "y":
      case "Y":
        // Save then exit
        this.doSaveFile();
        this.doExitNow();
        break;
      case "n":
      case "N":
        // Exit without saving
        this.doExitNow();
        break;
      case "\x03": // ^C — cancel
        this.mode = "edit";
        this.statusline("HUSH", "Cancelled");
        this.render();
        break;
      default:
        break;
    }
  }

  private handleEditMode(data: string) {
    switch (data) {
      case "\r": // Enter
        this.doEnter();
        break;
      case "\x7f": // Backspace
      case "\x08":
        this.doBackspace();
        break;
      case "\t": // Tab
        this.doTab();
        break;
      case "\x00": // ^@ (Ctrl+Space) — next word
        this.toNextWord();
        break;

      // ── Cursor movement (Pico-style control keys) ──
      case "\x01": // ^A — Home
        this.doHome();
        break;
      case "\x05": // ^E — End
        this.doEnd();
        break;
      case "\x10": // ^P — Up
        this.doUp();
        break;
      case "\x0e": // ^N — Down
        this.doDown();
        break;
      case "\x02": // ^B — search backward (in main: actually unused for left in main)
        // In non-modern bindings, ^B is do_search_backward in MMAIN
        this.doSearchBackward();
        break;
      case "\x06": // ^F — search forward
        this.doSearchForward();
        break;
      case "\x19": // ^Y — Page Up
        this.doPageUp();
        break;
      case "\x16": // ^V — Page Down
        this.doPageDown();
        break;

      // ── File operations ──
      case "\x0f": // ^O — Write Out
        this.doWriteOut();
        break;
      case "\x13": // ^S — Save without prompting
        this.doSaveFile();
        this.render();
        break;
      case "\x12": // ^R — Read File (insert)
        this.doInsertFile();
        break;

      // ── Search/Replace ──
      case "\x17": // ^W — Where Is (search forward)
        this.doSearchForward();
        break;
      case "\x1c": // ^\ — Replace
        this.doReplace();
        break;
      case "\x11": // ^Q — search backward (when not PRESERVE)
        this.doSearchBackward();
        break;

      // ── Cut/Paste/Copy ──
      case "\x0b": // ^K — Cut
        this.cutText();
        this.tickStatus();
        break;
      case "\x15": // ^U — Paste
        this.pasteText();
        break;

      // ── Exit ──
      case "\x18": // ^X — Exit
        this.doExit();
        break;

      // ── Misc ──
      case "\x03": // ^C — report cursor position
        this.reportCursorPosition();
        break;
      case "\x07": // ^G — Help
        this.showHelpGist();
        break;
      case "\x0a": // ^J — Justify
        this.doJustify();
        break;
      case "\x1f": // ^_ — Go To Line
        this.doGoToLine();
        break;
      case "\x1e": // ^^ — Set Mark (Ctrl+6)
        this.doMark();
        break;
      case "\x14": // ^T — Execute (not available in web terminal)
        this.statusline("HUSH", "Command execution not available");
        break;
      case "\x0c": // ^L — refresh/center
        this.doCenter();
        break;

      default:
        if (data.charCodeAt(0) >= 0x20) {
          this.insertText(data);
        }
        break;
    }
  }

  /** Show a brief help message in the status bar (simplified ^G). */
  private showHelpGist() {
    this.statusline(
      "HUSH",
      "^G Help  ^O WriteOut  ^R ReadFile  ^W WhereIs  ^\\ Replace  ^K Cut  ^U Paste  ^T Execute  ^X Exit  ^C Location  ^_ GoToLine",
    );
  }

  private handleEscape(seq: string) {
    // In prompt modes, delegate to prompt escape handler
    if (this.mode !== "edit" && this.mode !== "yesno") {
      this.handlePromptEscape(seq);
      return;
    }

    // In yesno mode, don't process escape sequences
    if (this.mode === "yesno") return;

    // Handle modified arrow keys: ESC [ 1 ; <mod> <final>
    // mod 3 = Alt, 5 = Ctrl, 2 = Shift
    const modMatch = seq.match(/^\x1b\[1;(\d+)([A-D])/);
    if (modMatch) {
      const mod = modMatch[1];
      const final = modMatch[2];
      if (mod === "5") {
        // Ctrl+Arrow — word movement
        if (final === "C") this.toNextWord();
        else if (final === "D") this.toPrevWord();
        else if (final === "A") this.toPrevBlock();
        else if (final === "B") this.toNextBlock();
      } else if (mod === "3") {
        // Alt+Arrow — scroll without moving cursor
        if (final === "A") this.doScrollUp();
        else if (final === "B") this.doScrollDown();
        else if (final === "C") this.toNextWord();
        else if (final === "D") this.toPrevWord();
      }
      return;
    }

    // Ctrl+Home / Ctrl+End: ESC [ 1 ; 5 H / F
    const homeEndMod = seq.match(/^\x1b\[1;(\d+)([HF])/);
    if (homeEndMod) {
      const mod = homeEndMod[1];
      if (mod === "5") {
        // Ctrl+Home → first line, Ctrl+End → last line
        if (homeEndMod[2] === "H") this.toFirstLine();
        else this.toLastLine();
        return;
      }
      // Fall through to normal Home/End
    }

    const code = seq[2];
    switch (code) {
      case "A": // Up
        this.doUp();
        break;
      case "B": // Down
        this.doDown();
        break;
      case "C": // Right
        this.doRight();
        break;
      case "D": // Left
        this.doLeft();
        break;
      case "H": // Home
        this.doHome();
        break;
      case "F": // End
        this.doEnd();
        break;
      case "5": // Page Up (ESC [5~)
        this.doPageUp();
        break;
      case "6": // Page Down (ESC [6~)
        this.doPageDown();
        break;
      case "3": // Delete (ESC [3~)
        this.doDelete();
        break;
      case "1": // Home (ESC [1~)
        this.doHome();
        break;
      case "4": // End (ESC [4~)
        this.doEnd();
        break;
      default:
        if (seq === "\x1bOH") this.doHome();
        else if (seq === "\x1bOF") this.doEnd();
        break;
    }
  }
}
