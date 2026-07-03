import { useMemo, useState } from "react";
import { Button, Separator, TextField } from "react95";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { AppMenuBar } from "../../components/AppMenuBar";
import { Icon } from "../../components/Icon/Icon";
import { ScrollArea } from "../../components/ScrollArea";
import { openApp } from "../../data/apps";
import { iconForNode } from "../../data/fileIcons";
import { getPreferredApp } from "../../data/fileOpen";
import { contentByteSize } from "../../lib/vfsSize";
import { openVfsAudio, openWebamp } from "../../lib/webamp";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Field = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
`;

const Label = styled.label`
  font-size: 12px;
  white-space: nowrap;
`;

const ResultHead = styled.div`
  display: flex;
  font-size: 11px;
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
  font-size: 12px;
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
  font-size: 11px;
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
function search(root: VfsNode, pattern: string): Hit[] {
  const rx = new RegExp(
    "^" +
      pattern
        .trim()
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
          path === "C:\\" ? `C:\\${c.name}` : `${path}\\${c.name}`;
        if (rx.test(c.name)) {
          out.push({ path: childPath, folder: path, node: c });
        }
        walk(c, childPath);
      }
    }
  };
  walk(root, "C:\\");
  return out;
}

function describeSize(node: VfsNode): string {
  if (node.type === "dir") return "";
  const bytes = contentByteSize(node.content);
  if (bytes < 1024) return `${bytes} bytes`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function openHit(hit: Hit): void {
  const n = hit.node;
  if (n.type === "file") {
    const preferred = getPreferredApp(n.name);
    if (preferred) {
      preferred.open(hit.path, n.name);
      return;
    }
  }
  if (n.type === "dir") {
    openApp("my-computer");
    return;
  }
  if (n.appId) {
    if (n.appId === "winamp") {
      void openWebamp();
    } else {
      openApp(n.appId as never);
    }
    return;
  }
  const lower = n.name.toLowerCase();
  if (
    lower.endsWith(".wav") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".mid") ||
    lower.endsWith(".midi") ||
    lower.endsWith(".rmi") ||
    lower.endsWith(".ogg")
  ) {
    void openVfsAudio(hit.path).then((played) => {
      if (!played && lower.endsWith(".wav")) {
        openApp("sound-recorder", {
          title: `${n.name} - Sound Recorder`,
          data: { path: hit.path },
        });
      }
    });
    return;
  }
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".log") ||
    lower.endsWith(".ini")
  ) {
    openApp("notepad", {
      title: `${n.name} - Notepad`,
      data: { path: hit.path },
    });
  } else if (lower.endsWith(".png") || lower.endsWith(".bmp")) {
    openApp("paint", { title: `${n.name} - Paint`, data: { path: hit.path } });
  }
}

export function Find({ windowId }: { windowId: string }) {
  const vfs = useVfsStore(useShallow((s) => ({ root: s.root })));
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const hits = useMemo(
    () => (submitted ? search(vfs.root, submitted) : []),
    [vfs.root, submitted],
  );

  const menus = [
    {
      label: "File",
      items: [{ label: "Close", action: () => closeWindow(windowId) }],
    },
    {
      label: "Edit",
      items: [{ label: "Select All", disabled: true }],
    },
    {
      label: "View",
      items: [{ label: "Details", disabled: true }],
    },
    {
      label: "Options",
      items: [{ label: "Save Results", disabled: true }],
    },
    {
      label: "Help",
      items: [{ label: "About Find", disabled: true }],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <Field>
        <Label>Named:</Label>
        <TextField
          style={{ zoom: 0.8, flex: 1 }}
          value={query}
          placeholder="* bio *"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSubmitted(query);
              setSelected(null);
            }
          }}
        />
        <Button
          style={{ zoom: 0.8 }}
          onClick={() => {
            setSubmitted(query);
            setSelected(null);
          }}
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
                fontSize: 12,
                color: "#888",
                textAlign: "center",
              }}
            >
              {submitted
                ? `No files found matching "${submitted}".`
                : "Enter all or part of the file name, then click Find Now."}
            </div>
          ) : (
            hits.map((h) => (
              <Row
                key={h.path}
                $selected={selected === h.path}
                onClick={() => setSelected(h.path)}
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
          ? `${hits.length} object(s) found`
          : "Ready — search the whole C: drive"}
      </StatusBar>
    </Layout>
  );
}
