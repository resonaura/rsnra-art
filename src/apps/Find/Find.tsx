import { useMemo, useState } from "react";
import { Button, Separator, TextField } from "react95";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useFileDialog } from "../../components/FileDialog/FileDialog";
import { Icon } from "../../components/Icon/Icon";
import { ScrollArea } from "../../components/ScrollArea";
import { iconForNode } from "../../data/fileIcons";
import { alertError } from "../../lib/systemDialogs";
import { openVfsNode } from "../../lib/openVfsNode";
import { vfsNodeByteSize } from "../../lib/vfsSize";
import { USER_DOCUMENTS_PATH } from "../../lib/windowsPaths";
import { R95_SCALE } from "../../react95.conf";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  zoom: ${R95_SCALE};
`;

const Field = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
`;

const FieldLabel = styled.label`
  white-space: nowrap;
`;

const ResultHead = styled.div`
  display: flex;
  padding: 4px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
  background: ${({ theme }) => theme.material};
  gap: 24px;
`;

const ResultList = styled.div`
  flex: 1;
  min-height: 0;
`;

const Row = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 3px 8px;
  cursor: default;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.materialText};

  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const ColName = styled.span`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const ColFolder = styled.span`
  width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const ColSize = styled.span`
  width: 70px;
  text-align: right;
`;

const StatusBar = styled.div`
  padding: 3px 8px;
  border-top: 1px solid ${({ theme }) => theme.borderDark};
  background: ${({ theme }) => theme.material};
`;

interface Hit {
  path: string; // absolute, e.g. C:\My Documents\bio.txt
  folder: string; // parent path
  node: VfsNode;
}

// Recursively walk the VFS tree from `root`, collecting nodes whose name
// matches the (wildcard) pattern. `*` matches any run, `?` matches one char.
function search(
  root: VfsNode,
  rootPath: string,
  pattern: string,
  showHidden: boolean,
  hideProtectedSystemFiles: boolean,
): Hit[] {
  const trimmed = pattern.trim();
  if (!trimmed) return [];
  // The dialog says "all or part" so plain text is a substring search.
  // Explicit DOS wildcards remain exact; *.* is the standard all-files mask.
  const glob = trimmed === "*.*"
    ? "*"
    : /[*?]/.test(trimmed)
      ? trimmed
      : `*${trimmed}*`;
  const rx = new RegExp(
    "^" +
      glob
        .toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
    "i",
  );
  const out: Hit[] = [];
  const walk = (node: VfsNode, path: string) => {
    if (node.type === "dir" && node.children) {
      for (const c of node.children) {
        const childPath =
          path.endsWith("\\") ? `${path}${c.name}` : `${path}\\${c.name}`;
        if (c.hidden && (!showHidden || (c.system && hideProtectedSystemFiles))) {
          continue;
        }
        if (rx.test(c.name)) {
          out.push({ path: childPath, folder: path, node: c });
        }
        walk(c, childPath);
      }
    }
  };
  walk(root, rootPath);
  return out;
}

function describeSize(node: VfsNode): string {
  if (node.type === "dir") return "";
  const bytes = vfsNodeByteSize(node);
  if (bytes < 1024) return `${bytes} bytes`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function openHit(hit: Hit): void {
  openVfsNode(hit.node, hit.path);
}

export function Find({ windowId }: { windowId: string }) {
  const vfs = useVfsStore(
    useShallow((s) => ({
      root: s.root,
      resolve: s.resolve,
      resolvePath: s.resolvePath,
      writeFile: s.writeFile,
    })),
  );
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const showHidden = useFilePrefsStore((s) => s.showHidden);
  const hideProtectedSystemFiles = useFilePrefsStore(
    (s) => s.hideProtectedSystemFiles,
  );
  const { showFileDialog, dialog } = useFileDialog();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [lookIn, setLookIn] = useState("C:\\");
  const [submittedLocation, setSubmittedLocation] = useState("C:\\");
  const [selected, setSelected] = useState<string[]>([]);
  const [locationError, setLocationError] = useState("");

  const resolvedLocation = vfs.resolvePath(submittedLocation);
  const searchRoot = resolvedLocation ? vfs.resolve(resolvedLocation) : null;
  const hits = useMemo(() => {
    if (!submitted || !searchRoot || searchRoot.type !== "dir" || !resolvedLocation) {
      return [];
    }
    return search(
      searchRoot,
      resolvedLocation,
      submitted,
      showHidden,
      hideProtectedSystemFiles,
    );
  }, [
    submitted,
    resolvedLocation,
    searchRoot,
    showHidden,
    hideProtectedSystemFiles,
  ]);

  const runSearch = () => {
    setSubmitted(query);
    setSubmittedLocation(lookIn);
    setSelected([]);
    const abs = vfs.resolvePath(lookIn);
    const node = abs ? vfs.resolve(abs) : null;
    setLocationError(
      !abs || !node
        ? "The folder could not be found."
        : node.type !== "dir"
          ? "Look in must be a folder."
          : "",
    );
  };

  const saveResults = async () => {
    if (hits.length === 0) return;
    const path = await showFileDialog({
      mode: "save",
      title: "Save Search Results",
      initialDir: USER_DOCUMENTS_PATH,
      initialFileName: "Search Results.txt",
      filters: [{ label: "Text Files (*.txt)", extensions: ["txt"] }],
    });
    if (!path) return;
    const contents = [
      `Search results for: ${submitted}`,
      `Look in: ${submittedLocation}`,
      "",
      ...hits.map(
        (hit) => `${hit.node.name}\t${hit.folder}\t${describeSize(hit.node)}`,
      ),
      "",
      `${hits.length} object(s) found`,
    ].join("\r\n");
    if (!vfs.writeFile(path, contents)) {
      await alertError(
        "Save Search Results",
        "The results could not be saved to that location.",
      );
    }
  };

  const menus = [
    {
      label: "File",
      items: [{ label: "Close", action: () => closeWindow(windowId) }],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Select All",
          disabled: hits.length === 0,
          action: () => setSelected(hits.map((hit) => hit.path)),
        },
      ],
    },
    {
      label: "View",
      items: [{ label: "Details", checked: true, radio: true }],
    },
    {
      label: "Options",
      items: [
        {
          label: "Save Results",
          disabled: hits.length === 0,
          action: () => void saveResults(),
        },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About Find", disabled: true }],
    },
  ];

  return (
    <Layout>
      <AppMenuBar isInReact95 menus={menus} />
      <Field>
        <FieldLabel>Named:</FieldLabel>
        <TextField
          style={{ flex: 1 }}
          value={query}
          placeholder="all or part of the name"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              runSearch();
            }
          }}
        />
      </Field>
      <Field style={{ paddingTop: 0 }}>
        <FieldLabel>Look in:</FieldLabel>
        <TextField
          style={{ flex: 1 }}
          value={lookIn}
          onChange={(e) => setLookIn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
        <Button
          onClick={runSearch}
        >
          Find Now
        </Button>
      </Field>
      <Separator />
      <ResultHead>
        <ColName>Name</ColName>
        <ColFolder>In Folder</ColFolder>
        <ColSize>Size</ColSize>
      </ResultHead>
      <ResultList>
        <ScrollArea style={{ height: "100%" }}>
          {hits.length === 0 ? (
            <div
              style={{
                padding: 24,
                color: "#888",
                textAlign: "center",
              }}
            >
              {locationError
                ? locationError
                : submitted
                  ? `No files found matching "${submitted}".`
                  : "Enter all or part of the file name, then click Find Now."}
            </div>
          ) : (
            hits.map((h) => (
              <Row
                key={h.path}
                $selected={selected.includes(h.path)}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey) {
                    setSelected((current) =>
                      current.includes(h.path)
                        ? current.filter((path) => path !== h.path)
                        : [...current, h.path],
                    );
                  } else if (event.shiftKey && selected.length > 0) {
                    const anchor = hits.findIndex(
                      (hit) => hit.path === selected[0],
                    );
                    const target = hits.findIndex((hit) => hit.path === h.path);
                    const start = Math.min(anchor < 0 ? target : anchor, target);
                    const end = Math.max(anchor < 0 ? target : anchor, target);
                    setSelected(hits.slice(start, end + 1).map((hit) => hit.path));
                  } else {
                    setSelected([h.path]);
                  }
                }}
                onDoubleClick={() => openHit(h)}
              >
                <ColName>
                  <Icon
                    src={iconForNode(h.node)}
                    size={16}
                    style={{ width: 16, height: 16, flexShrink: 0 }}
                  />
                  {h.node.name}
                </ColName>
                <ColFolder>{h.folder}</ColFolder>
                <ColSize>{describeSize(h.node)}</ColSize>
              </Row>
            ))
          )}
        </ScrollArea>
      </ResultList>
      <StatusBar>
        {submitted
          ? `${hits.length} object(s) found in ${submittedLocation}`
          : "Ready — search the whole C: drive"}
      </StatusBar>
      {dialog}
    </Layout>
  );
}
