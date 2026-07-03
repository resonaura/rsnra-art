import { useCallback, useMemo, useState } from "react";
import { Button, Window, WindowContent, WindowHeader } from "react95";
import styled, { css } from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "../../components/ScrollArea";
import { FileIcon } from "../FileIcon/FileIcon";

import { contentByteSize } from "../../lib/vfsSize";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";

// ─── styled helpers ──────────────────────────────────────────────────────────

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;
const sunken = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
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

const Dialog = styled(Window)`
  width: 440px;
  max-width: 95vw;
`;

const Body = styled(WindowContent)`
  padding: 12px;
`;

/** Toolbar with Up / Home / etc. buttons */
const ToolbarRow = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
`;

const ToolBtn = styled.button`
  ${raised}
  background: ${({ theme }) => theme.material};
  width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  padding: 0;
  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
  }
  &:active {
    ${sunken}
  }
`;

/** "Look in:" dropdown row */
const LookInRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
`;

const LookInLabel = styled.span`
  white-space: nowrap;
`;

const LookInSelect = styled.select`
  ${sunken}
  background: ${({ theme }) => theme.material};
  color: ${({ theme }) => theme.materialText};
  font-size: 12px;
  font-family: inherit;
  flex: 1;
  height: 22px;
  padding: 1px 4px;
`;

/** File listing area */
const FileList = styled(ScrollArea)`
  ${sunken}
  background: #fff;
  height: 180px;
  font-size: 12px;
`;

const FileEntry = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  cursor: default;
  white-space: nowrap;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) => ($selected ? theme.headerText : "#000")};
  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const InlineRenameInput = styled.input`
  ${sunken}
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-family: inherit;
  padding: 0 2px;
`;

/** "File name:" row */
const FileNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
`;

const FileNameInput = styled.input`
  ${sunken}
  background: #fff;
  flex: 1;
  height: 22px;
  font-size: 12px;
  font-family: inherit;
  padding: 1px 4px;
  outline: none;
`;

/** "Files of type:" row */
const FileTypeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
`;

const FileTypeSelect = styled.select`
  ${sunken}
  background: ${({ theme }) => theme.material};
  color: ${({ theme }) => theme.materialText};
  font-size: 12px;
  font-family: inherit;
  flex: 1;
  height: 22px;
  padding: 1px 4px;
`;

/** Open / Cancel buttons */
const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
`;

// ─── types ───────────────────────────────────────────────────────────────────

export interface FileFilter {
  label: string;
  extensions: string[]; // e.g. ["txt", "log"] — empty = all files
}

export interface FileDialogProps {
  mode: "open" | "save";
  title?: string;
  initialDir?: string;
  initialFileName?: string;
  filters?: FileFilter[];
  onConfirm: (path: string) => void;
  onCancel: () => void;
}

const SEP = "\\";

/** Sort: directories first, then files, alphabetically (case-insensitive). */
function sortNodes(a: VfsNode, b: VfsNode): number {
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

/** Check if a file name matches any of the filter's extensions. */
function matchesFilter(name: string, filter: FileFilter): boolean {
  if (filter.extensions.length === 0) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return filter.extensions.includes(ext);
}

/** Format the file size for the listing. */
function formatSize(node: VfsNode): string {
  if (node.type === "dir") return "";
  return `${(contentByteSize(node.content) / 1024).toFixed(1)} KB`;
}



export function FileDialog({
  mode,
  title,
  initialDir = "C:\\",
  initialFileName = "",
  filters = [{ label: "All Files (*.*)", extensions: [] }],
  onConfirm,
  onCancel,
}: FileDialogProps) {
  const vfs = useVfsStore(
    useShallow((s) => ({
      root: s.root,
      resolve: s.resolve,
      resolvePath: s.resolvePath,
      exists: s.exists,
      mkdir: s.mkdir,
      rename: s.rename,
    })),
  );
  const [currentDir, setCurrentDir] = useState(() => {
    return vfs.resolvePath(initialDir) ?? initialDir;
  });
  const [selectedName, setSelectedName] = useState(initialFileName);
  const [fileName, setFileName] = useState(initialFileName);
  const [filterIndex, setFilterIndex] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const currentFilter = filters[filterIndex] ?? filters[0];

  // List the nodes in the current directory
  const entries = useMemo(() => {
    const node = vfs.resolve(currentDir);
    if (!node || node.type !== "dir" || !node.children) return [];
    return node.children
      .filter((c) => !c.hidden)
      .filter((c) => c.type === "dir" || matchesFilter(c.name, currentFilter))
      .sort(sortNodes);
  }, [vfs, currentDir, currentFilter]);

  // Build the breadcrumb path stack for the "Look in" dropdown. Each entry's
  // `path` must exactly match how `currentDir` is formatted (single
  // backslashes) so the <select>'s value can match one of the <option>s.
  const dirStack = useMemo(() => {
    const parts = currentDir.split(SEP).filter(Boolean);
    return parts.map((label, i) => ({
      label,
      path: i === 0 ? label + SEP : parts.slice(0, i + 1).join(SEP),
    }));
  }, [currentDir]);

  const navigateTo = (path: string) => {
    const abs = vfs.resolvePath(path);
    if (abs) {
      setCurrentDir(abs);
      setSelectedName("");
      setFileName("");
      setRenaming(null);
    }
  };

  const goUp = () => {
    const parts = currentDir.split(SEP).filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    navigateTo(parts.join(SEP) + SEP);
  };

  // Matches Explorer: a single click only selects/highlights the entry
  // (folder or file) and mirrors its name into the "File name" field.
  // Only a double-click (or Enter) actually navigates into a folder.
  const handleEntryClick = (node: VfsNode) => {
    if (renaming) return;
    setSelectedName(node.name);
    setFileName(node.name);
  };

  const handleEntryDoubleClick = (node: VfsNode) => {
    if (renaming) return;
    if (node.type === "dir") {
      const abs = vfs.resolvePath(currentDir + SEP + node.name);
      if (abs) navigateTo(abs);
    } else {
      const abs = vfs.resolvePath(currentDir + SEP + node.name);
      if (abs) onConfirm(abs);
    }
  };

  const newFolder = () => {
    let name = "New Folder";
    let i = 1;
    while (vfs.exists(vfs.resolvePath(name, currentDir)!))
      name = `New Folder (${++i})`;
    const abs = vfs.resolvePath(name, currentDir);
    if (!abs || !vfs.mkdir(abs)) return;
    setSelectedName(name);
    setFileName(name);
    setRenaming(name);
    setRenameVal(name);
  };

  const commitRename = () => {
    const trimmed = renameVal.trim();
    if (renaming && trimmed && trimmed !== renaming) {
      const abs = vfs.resolvePath(renaming, currentDir);
      if (abs && vfs.rename(abs, trimmed)) {
        setSelectedName(trimmed);
        setFileName(trimmed);
      }
    }
    setRenaming(null);
  };

  const handleConfirm = () => {
    const trimmed = fileName.trim();
    if (!trimmed) return;

    // If the user typed a path (contains backslashes), resolve it directly
    if (trimmed.includes(SEP)) {
      const abs = vfs.resolvePath(trimmed);
      if (abs) {
        onConfirm(abs);
        return;
      }
    }

    // If the typed name matches a directory, navigate into it
    const match = entries.find(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match?.type === "dir") {
      const abs = vfs.resolvePath(currentDir + SEP + match.name);
      if (abs) navigateTo(abs);
      return;
    }

    const abs = vfs.resolvePath(currentDir + SEP + trimmed);
    if (!abs) return;

    if (mode === "open") {
      // Check that the file exists
      if (!vfs.exists(abs)) return;
      onConfirm(abs);
    } else {
      // Save mode: accept any path
      onConfirm(abs);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (renaming) return; // the rename input handles its own Enter/Escape
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const dialogTitle = title ?? (mode === "open" ? "Open" : "Save As");
  const confirmLabel = mode === "open" ? "Open" : "Save";

  return (
    <Overlay onMouseDown={onCancel}>
      <Dialog onMouseDown={(e) => e.stopPropagation()}>
        <WindowHeader style={{ zoom: 0.8 }}>
          <span>{dialogTitle}</span>
        </WindowHeader>
        <Body onKeyDown={handleKeyDown}>
          {/* Toolbar */}
          <ToolbarRow>
            <ToolBtn
              title="Up one level"
              onClick={goUp}
              disabled={dirStack.length <= 1}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{ imageRendering: "pixelated" }}
              >
                <path
                  d="M1 7 L8 1 L15 7 L12 7 L12 15 L4 15 L4 7 Z"
                  fill="#ffff80"
                  stroke="#000"
                  strokeWidth="1"
                />
              </svg>
            </ToolBtn>
            <ToolBtn title="Create New Folder" onClick={newFolder}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{ imageRendering: "pixelated" }}
              >
                <path
                  d="M1 3 L6 3 L7 5 L15 5 L15 13 L1 13 Z"
                  fill="#ffff80"
                  stroke="#000"
                  strokeWidth="1"
                />
                <path
                  d="M8 7 L8 11 M6 9 L10 9"
                  stroke="#000"
                  strokeWidth="1.4"
                />
              </svg>
            </ToolBtn>
          </ToolbarRow>

          {/* Look in */}
          <LookInRow>
            <LookInLabel>Look in:</LookInLabel>
            <LookInSelect
              value={currentDir}
              onChange={(e) => navigateTo(e.target.value)}
            >
              {dirStack.map((d, i) => (
                <option key={i} value={d.path}>
                  {SEP.repeat(0)} {d.label}
                </option>
              ))}
            </LookInSelect>
          </LookInRow>

          {/* File list */}
          <FileList orientation="vertical">
            {entries.length === 0 && (
              <div style={{ padding: "8px", color: "#888", fontSize: 12 }}>
                This folder is empty.
              </div>
            )}
            {entries.map((node) => (
              <FileEntry
                key={node.name}
                $selected={
                  selectedName.toLowerCase() === node.name.toLowerCase()
                }
                onClick={() => handleEntryClick(node)}
                onDoubleClick={() => handleEntryDoubleClick(node)}
              >
                <FileIcon node={node} />
                {renaming === node.name ? (
                  <InlineRenameInput
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {node.name}
                  </span>
                )}
                {node.type === "file" && (
                  <span style={{ color: "#666", fontSize: 11 }}>
                    {formatSize(node)}
                  </span>
                )}
              </FileEntry>
            ))}
          </FileList>

          {/* File name */}
          <FileNameRow>
            <span>File name:</span>
            <FileNameInput
              autoFocus
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                setSelectedName(e.target.value);
              }}
              onKeyDown={handleKeyDown}
            />
          </FileNameRow>

          {/* File type */}
          <FileTypeRow>
            <span>Files of type:</span>
            <FileTypeSelect
              value={filterIndex}
              onChange={(e) => setFilterIndex(Number(e.target.value))}
            >
              {filters.map((f, i) => (
                <option key={i} value={i}>
                  {f.label}
                </option>
              ))}
            </FileTypeSelect>
          </FileTypeRow>

          {/* Buttons */}
          <Footer style={{ zoom: 0.8 }}>
            <Button
              style={{ width: "80px" }}
              onClick={handleConfirm}
              primary
              disabled={!fileName.trim()}
            >
              {confirmLabel}
            </Button>
            <Button style={{ width: "80px" }} onClick={onCancel}>
              Cancel
            </Button>
          </Footer>
        </Body>
      </Dialog>
    </Overlay>
  );
}

// ─── Convenience hook: manages dialog visibility + result ─────────────────────

export function useFileDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "open" | "save";
    title?: string;
    initialDir?: string;
    initialFileName?: string;
    filters?: FileFilter[];
    resolve: ((path: string | null) => void) | null;
  }>({
    open: false,
    mode: "open",
    resolve: null,
  });

  const showFileDialog = useCallback(
    (opts: {
      mode: "open" | "save";
      title?: string;
      initialDir?: string;
      initialFileName?: string;
      filters?: FileFilter[];
    }): Promise<string | null> => {
      return new Promise((resolve) => {
        setDialogState({
          open: true,
          resolve,
          ...opts,
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback(
    (path: string) => {
      dialogState.resolve?.(path);
      setDialogState((s) => ({ ...s, open: false, resolve: null }));
    },
    [dialogState],
  );

  const handleCancel = useCallback(() => {
    dialogState.resolve?.(null);
    setDialogState((s) => ({ ...s, open: false, resolve: null }));
  }, [dialogState]);

  const dialog = dialogState.open ? (
    <FileDialog
      mode={dialogState.mode}
      title={dialogState.title}
      initialDir={dialogState.initialDir}
      initialFileName={dialogState.initialFileName}
      filters={dialogState.filters}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { showFileDialog, dialog };
}
