import { useRef, useState } from "react";
import { Separator } from "react95";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useFileDialog } from "../../components/FileDialog/FileDialog";
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

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const TextArea = styled.textarea`
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 8px;
  font-family: "ms_sans_serif", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.4;
  background: white;
  color: #000;
`;

const StatusBar = styled.div`
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-top: 1px solid ${({ theme }) => theme.borderDark};
  background: ${({ theme }) => theme.material};
  color: ${({ theme }) => theme.materialText};
`;

export function Notepad({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const vfs = useVfsStore();
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const updateTitle = useWindowStore((s) => s.updateTitle);
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

  const updateWindowTitle = (name: string) => {
    updateTitle(windowId, `${name} - Notepad`);
  };

  const save = () => {
    vfs.writeFile(filePath, text);
    setDirty(false);
  };

  const handleNew = () => {
    setFilePath("C:\\My Documents\\untitled.txt");
    setText("");
    setDirty(false);
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
    const name = result.split("\\").pop() ?? "untitled.txt";
    updateWindowTitle(name);
  };

  const handleSaveAs = async () => {
    const dir = filePath.split("\\").slice(0, -1).join("\\") + "\\";
    const defaultName = filePath.split("\\").pop() ?? "untitled.txt";
    const result = await showFileDialog({
      mode: "save",
      title: "Save As",
      initialDir: dir,
      initialFileName: defaultName,
      filters: TEXT_FILTERS,
    });
    if (!result) return;
    vfs.writeFile(result, text);
    setFilePath(result);
    setDirty(false);
    const name = result.split("\\").pop() ?? "untitled.txt";
    updateWindowTitle(name);
  };

  const handleSave = () => {
    // If the file is "untitled" (doesn't exist yet), prompt for Save As
    if (!vfs.exists(filePath)) {
      handleSaveAs();
    } else {
      save();
    }
  };

  const selectAll = () => {
    const el = textRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  };

  const insertDateTime = () => {
    const now = new Date().toLocaleString();
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + now + text.slice(end);
    setText(next);
    setDirty(true);
    setTimeout(() => {
      if (textRef.current) {
        textRef.current.selectionStart = start + now.length;
        textRef.current.selectionEnd = start + now.length;
      }
    }, 0);
  };

  const menus = [
    {
      label: "File",
      items: [
        { label: "New", action: handleNew },
        { label: "Open...", action: handleOpen },
        { label: "Save", action: handleSave },
        { label: "Save As...", action: handleSaveAs },
        { label: "Print...", disabled: true },
        { label: "", divider: true },
        { label: "Exit", action: () => closeWindow(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", disabled: true },
        { label: "", divider: true },
        { label: "Cut", disabled: true },
        { label: "Copy", disabled: true },
        { label: "Paste", disabled: true },
        { label: "Delete", disabled: true },
        { label: "", divider: true },
        { label: "Select All", action: selectAll },
        { label: "Time/Date", action: insertDateTime },
        { label: "", divider: true },
        { label: "Word Wrap", disabled: true },
      ],
    },
    {
      label: "Search",
      items: [
        { label: "Find...", disabled: true },
        { label: "Find Next\tF3", disabled: true },
        { label: "Replace...", disabled: true },
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
      <TextArea
        ref={textRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        spellCheck={false}
      />
      <StatusBar>
        {dirty ? `${fileName} — unsaved` : fileName}
        {"  "}Ln 1, Col 1
      </StatusBar>
      {dialog}
    </Layout>
  );
}
