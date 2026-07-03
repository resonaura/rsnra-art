import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Checkbox, Separator, TextInput } from "react95";
import styled, { css } from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useFileDialog } from "../../components/FileDialog/FileDialog";
import { ScrollArea } from "../../components/ScrollArea";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useUnsavedStore } from "../../store/unsavedStore";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowData, useWindowStore } from "../../store/windowStore";

const DOC_PATHS: Record<string, string> = {
  bio: "C:\\My Documents\\bio.txt",
  press: "C:\\My Documents\\press-kit.txt",
};

const TEXT_FILTERS = [
  { label: "Text Documents (*.txt)", extensions: ["txt"] },
  { label: "All Files (*.*)", extensions: [] },
];

// How long a pause between edits before Undo treats the next keystroke as a
// new step, instead of folding it into the same one (so undoing a typing
// burst doesn't take a hundred single-character steps).
const UNDO_COALESCE_MS = 700;
const UNDO_LIMIT = 100;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

// The scrolling itself comes from wrapping this in <ScrollArea> — the
// textarea just sizes to fit its full content (no internal scroll of its
// own) so ScrollArea's viewport is what overflows and grows a thumb.
const EditorScroll = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: ${({ theme }) => theme.canvas};
`;

const TextArea = styled.textarea<{ $noWrap?: boolean }>`
  display: block;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 8px;
  font-size: 13px;
  line-height: 1.4;
  background: ${({ theme }) => theme.canvas};
  color: ${({ theme }) => theme.canvasText};
  overflow: hidden;

  ${({ $noWrap }) =>
    $noWrap &&
    css`
      white-space: pre;
      width: max-content;
      min-width: 100%;
    `}
`;

const StatusBar = styled.div`
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-top: 1px solid ${({ theme }) => theme.borderDark};
  background: ${({ theme }) => theme.material};
  color: ${({ theme }) => theme.materialText};
`;

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 500000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
`;

const DialogBox = styled.div`
  ${raised}
  background: ${({ theme }) => theme.material};
  width: 340px;
`;

const DialogHeader = styled.div`
  background: ${({ theme }) => theme.headerBackground};
  color: ${({ theme }) => theme.headerText};
  padding: 4px 8px;
  font-weight: bold;
  font-size: 13px;
`;

const DialogBody = styled.div`
  padding: 14px;
  font-size: 12px;
`;

const DialogRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  label {
    width: 80px;
    flex-shrink: 0;
  }
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
`;

export function Notepad({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const vfs = useVfsStore(
    useShallow((s) => ({
      read: s.read,
      writeFile: s.writeFile,
      exists: s.exists,
    })),
  );
  const updateTitle = useWindowStore((s) => s.updateTitle);
  const isFocused = useWindowStore(
    (s) => s.windows.find((w) => w.id === windowId)?.isFocused ?? false,
  );
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { showFileDialog, dialog } = useFileDialog();

  const initialPath =
    (data.path as string) ??
    DOC_PATHS[(data.docId as string) ?? "bio"] ??
    "C:\\My Documents\\bio.txt";
  const [filePath, setFilePath] = useState(initialPath);
  const fileName = filePath.split("\\").pop() ?? "untitled.txt";
  const initial = vfs.read(filePath) ?? "";
  const [text, setText] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const historyRef = useRef<string[]>([]);
  const lastEditAtRef = useRef(0);

  const requestClose = useUnsavedStore((s) => s.requestClose);
  useUnsavedChanges(windowId, {
    isDirty: dirty,
    save: () => handleSave(),
    name: fileName,
  });

  const updateWindowTitle = (name: string) => {
    updateTitle(windowId, `${name} - Notepad`);
  };

  // Every text mutation (typing, cut, paste, delete, replace, time/date)
  // flows through here so Undo has one consistent history stack. Typing
  // coalesces into the same step while it's a continuous burst; anything
  // else always starts a fresh step.
  const applyEdit = (next: string, coalesce: boolean) => {
    const now = Date.now();
    if (!coalesce || now - lastEditAtRef.current > UNDO_COALESCE_MS) {
      historyRef.current.push(text);
      if (historyRef.current.length > UNDO_LIMIT) historyRef.current.shift();
    }
    lastEditAtRef.current = now;
    setText(next);
    setDirty(true);
  };

  const handleUndo = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current.pop()!;
    setText(prev);
    setDirty(true);
    textRef.current?.focus();
  };

  const save = (): boolean => {
    vfs.writeFile(filePath, text);
    setDirty(false);
    return true;
  };

  const handleNew = () => {
    setFilePath("C:\\My Documents\\untitled.txt");
    setText("");
    setDirty(false);
    historyRef.current = [];
    setHasSelection(false);
    updateWindowTitle("untitled.txt");
  };

  const handleOpen = async () => {
    const dir = filePath.split("\\").slice(0, -1).join("\\") + "\\";
    const result = await showFileDialog({
      mode: "open",
      title: "Open",
      initialDir: dir,
      filters: TEXT_FILTERS,
    });
    if (!result) return;
    const content = vfs.read(result);
    if (content === null) return;
    setFilePath(result);
    setText(content);
    setDirty(false);
    historyRef.current = [];
    setHasSelection(false);
    const name = result.split("\\").pop() ?? "untitled.txt";
    updateWindowTitle(name);
  };

  const handleSaveAs = async (): Promise<boolean> => {
    const dir = filePath.split("\\").slice(0, -1).join("\\") + "\\";
    const defaultName = filePath.split("\\").pop() ?? "untitled.txt";
    const result = await showFileDialog({
      mode: "save",
      title: "Save As",
      initialDir: dir,
      initialFileName: defaultName,
      filters: TEXT_FILTERS,
    });
    if (!result) return false;
    vfs.writeFile(result, text);
    setFilePath(result);
    setDirty(false);
    const name = result.split("\\").pop() ?? "untitled.txt";
    updateWindowTitle(name);
    return true;
  };

  const handleSave = async (): Promise<boolean> => {
    // If the file is "untitled" (doesn't exist yet), prompt for Save As
    if (!vfs.exists(filePath)) {
      return handleSaveAs();
    }
    return save();
  };

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(
      `<title>${escapeHtml(fileName)}</title><pre style="font-family: monospace; white-space: pre-wrap; word-wrap: break-word; padding: 24px; font-size: 12px;">${escapeHtml(text)}</pre>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  const selectAll = () => {
    const el = textRef.current;
    if (el) {
      el.focus();
      el.select();
      setHasSelection(el.value.length > 0);
    }
  };

  const insertDateTime = () => {
    const now = new Date().toLocaleString();
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    applyEdit(text.slice(0, start) + now + text.slice(end), false);
    setHasSelection(false);
    const pos = start + now.length;
    requestAnimationFrame(() => {
      if (textRef.current) textRef.current.setSelectionRange(pos, pos);
    });
  };

  const handleCopy = async () => {
    const el = textRef.current;
    if (!el) return;
    const sel = text.slice(el.selectionStart, el.selectionEnd);
    if (!sel) return;
    try {
      await navigator.clipboard.writeText(sel);
    } catch {
      /* clipboard unavailable — nothing more we can do */
    }
  };

  const handleCut = async () => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    try {
      await navigator.clipboard.writeText(text.slice(start, end));
    } catch {
      /* clipboard unavailable — still remove the selection below */
    }
    applyEdit(text.slice(0, start) + text.slice(end), false);
    setHasSelection(false);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(start, start);
    });
  };

  const handleDelete = () => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    applyEdit(text.slice(0, start) + text.slice(end), false);
    setHasSelection(false);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(start, start);
    });
  };

  const handlePaste = async () => {
    const el = textRef.current;
    if (!el) return;
    let clip = "";
    try {
      clip = await navigator.clipboard.readText();
    } catch {
      return; // no permission / nothing on the clipboard
    }
    if (!clip) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    applyEdit(text.slice(0, start) + clip + text.slice(end), false);
    setHasSelection(false);
    const pos = start + clip.length;
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(pos, pos);
    });
  };

  // ── Find / Replace ──────────────────────────────────────────────────────

  const openFind = () => {
    const el = textRef.current;
    if (el && el.selectionStart !== el.selectionEnd) {
      setFindQuery(text.slice(el.selectionStart, el.selectionEnd));
    }
    setReplaceOpen(false);
    setFindOpen(true);
  };

  const openReplace = () => {
    const el = textRef.current;
    if (el && el.selectionStart !== el.selectionEnd) {
      setFindQuery(text.slice(el.selectionStart, el.selectionEnd));
    }
    setFindOpen(false);
    setReplaceOpen(true);
  };

  const findFrom = (query: string, fromIndex: number): number => {
    if (!query) return -1;
    const haystack = matchCase ? text : text.toLowerCase();
    const needle = matchCase ? query : query.toLowerCase();
    let idx = haystack.indexOf(needle, fromIndex);
    if (idx === -1) idx = haystack.indexOf(needle, 0); // wrap around
    return idx;
  };

  const selectRange = (start: number, end: number) => {
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    setHasSelection(start !== end);
  };

  const findNext = (query: string = findQuery) => {
    if (!query) {
      openFind();
      return;
    }
    const el = textRef.current;
    const from = el ? el.selectionEnd : 0;
    const idx = findFrom(query, from);
    if (idx === -1) {
      setNotFound(true);
      return;
    }
    selectRange(idx, idx + query.length);
  };

  const handleReplaceNext = () => {
    const el = textRef.current;
    if (!el || !findQuery) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end);
    const matches = matchCase
      ? selected === findQuery
      : selected.toLowerCase() === findQuery.toLowerCase();
    if (matches) {
      applyEdit(text.slice(0, start) + replaceQuery + text.slice(end), false);
      const pos = start + replaceQuery.length;
      requestAnimationFrame(() => selectRange(pos, pos));
    }
    findNext();
  };

  const handleReplaceAll = () => {
    if (!findQuery) return;
    const pattern = new RegExp(escapeRegExp(findQuery), matchCase ? "g" : "gi");
    if (!pattern.test(text)) {
      setNotFound(true);
      return;
    }
    applyEdit(text.replace(pattern, replaceQuery), false);
    setHasSelection(false);
    setReplaceOpen(false);
  };

  // The textarea has no scrollbar of its own — it grows to fit all of its
  // content, and <ScrollArea> (wrapped around it) does the actual scrolling.
  // Re-measure on every text/wrap change so it always matches its content.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, wordWrap]);

  // Keyboard shortcuts to match the menu — only while this window is
  // focused, so they don't fire while e.g. Terminal or Paint has focus.
  useEffect(() => {
    if (!isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openFind();
      } else if (mod && e.key.toLowerCase() === "h") {
        e.preventDefault();
        openReplace();
      } else if (e.key === "F3") {
        e.preventDefault();
        findNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, text, findQuery, matchCase]);

  const menus = [
    {
      label: "File",
      items: [
        { label: "New", action: handleNew },
        { label: "Open...", action: handleOpen },
        { label: "Save", action: handleSave },
        { label: "Save As...", action: handleSaveAs },
        { label: "Print...", action: handlePrint },
        { label: "", divider: true },
        { label: "Exit", action: () => requestClose(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Undo\tCtrl+Z",
          action: handleUndo,
          disabled: historyRef.current.length === 0,
        },
        { label: "", divider: true },
        { label: "Cut", action: handleCut, disabled: !hasSelection },
        { label: "Copy", action: handleCopy, disabled: !hasSelection },
        { label: "Paste", action: handlePaste },
        { label: "Delete", action: handleDelete, disabled: !hasSelection },
        { label: "", divider: true },
        { label: "Select All", action: selectAll },
        { label: "Time/Date", action: insertDateTime },
        { label: "", divider: true },
        {
          label: wordWrap ? "✓ Word Wrap" : "Word Wrap",
          action: () => setWordWrap((w) => !w),
        },
      ],
    },
    {
      label: "Search",
      items: [
        { label: "Find...", action: openFind },
        {
          label: "Find Next\tF3",
          action: () => findNext(),
          disabled: !findQuery,
        },
        { label: "Replace...", action: openReplace },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help Topics", disabled: true },
        { label: "", divider: true },
        { label: "About Notepad", disabled: true },
      ],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <Separator />
      <EditorScroll orientation={wordWrap ? "vertical" : "both"}>
        <TextArea
          ref={textRef}
          value={text}
          wrap={wordWrap ? "soft" : "off"}
          $noWrap={!wordWrap}
          onChange={(e) => applyEdit(e.target.value, true)}
          onSelect={(e) => {
            const el = e.currentTarget;
            setHasSelection(el.selectionStart !== el.selectionEnd);
          }}
          spellCheck={false}
        />
      </EditorScroll>
      <StatusBar>
        {dirty ? `${fileName} — unsaved` : fileName}
        {"  "}Ln 1, Col 1
      </StatusBar>
      {dialog}

      {findOpen && (
        <Overlay onMouseDown={() => setFindOpen(false)}>
          <DialogBox onMouseDown={(e) => e.stopPropagation()}>
            <DialogHeader>Find</DialogHeader>
            <DialogBody>
              <DialogRow>
                <label>Find what:</label>
                <TextInput
                  fullWidth
                  autoFocus
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  style={{ zoom: 0.8 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") findNext(findQuery);
                  }}
                />
              </DialogRow>
              <Checkbox
                style={{ zoom: 0.8 }}
                label="Match case"
                checked={matchCase}
                onChange={() => setMatchCase((m) => !m)}
              />
              <DialogFooter style={{ zoom: 0.8 }}>
                <Button
                  disabled={!findQuery}
                  onClick={() => findNext(findQuery)}
                  style={{ width: 90 }}
                >
                  Find Next
                </Button>
                <Button
                  onClick={() => setFindOpen(false)}
                  style={{ width: 75 }}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogBody>
          </DialogBox>
        </Overlay>
      )}

      {replaceOpen && (
        <Overlay onMouseDown={() => setReplaceOpen(false)}>
          <DialogBox onMouseDown={(e) => e.stopPropagation()}>
            <DialogHeader>Replace</DialogHeader>
            <DialogBody>
              <DialogRow>
                <label>Find what:</label>
                <TextInput
                  fullWidth
                  autoFocus
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                />
              </DialogRow>
              <DialogRow>
                <label>Replace with:</label>
                <TextInput
                  fullWidth
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                />
              </DialogRow>
              <Checkbox
                label="Match case"
                checked={matchCase}
                onChange={() => setMatchCase((m) => !m)}
              />
              <DialogFooter>
                <Button
                  disabled={!findQuery}
                  onClick={() => findNext(findQuery)}
                  style={{ width: 90 }}
                >
                  Find Next
                </Button>
                <Button
                  disabled={!findQuery}
                  onClick={handleReplaceNext}
                  style={{ width: 75 }}
                >
                  Replace
                </Button>
                <Button
                  disabled={!findQuery}
                  onClick={handleReplaceAll}
                  style={{ width: 90 }}
                >
                  Replace All
                </Button>
                <Button
                  onClick={() => setReplaceOpen(false)}
                  style={{ width: 75 }}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogBody>
          </DialogBox>
        </Overlay>
      )}

      {notFound && (
        <Overlay onMouseDown={() => setNotFound(false)}>
          <DialogBox onMouseDown={(e) => e.stopPropagation()}>
            <DialogHeader>Notepad</DialogHeader>
            <DialogBody>
              Cannot find "{findQuery}"
              <DialogFooter>
                <Button
                  onClick={() => setNotFound(false)}
                  style={{ width: 75 }}
                >
                  OK
                </Button>
              </DialogFooter>
            </DialogBody>
          </DialogBox>
        </Overlay>
      )}
    </Layout>
  );
}
