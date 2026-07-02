import { useState } from "react";
import { Button, Checkbox, Frame, GroupBox, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { iconForNode } from "../../data/fileIcons";
import { contentByteSize } from "../../lib/vfsSize";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowData, useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 4px;
`;

const Body = styled(TabBody)`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const IconBox = styled(Frame)`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: bold;
`;

const Field = styled.div`
  display: flex;
  font-size: 12px;
  line-height: 1.6;
`;

const Key = styled.div`
  width: 110px;
  flex-shrink: 0;
  color: ${({ theme }) => theme.materialText};
`;
const Val = styled.div`
  flex: 1;
  word-break: break-all;
`;

const AttrRow = styled.div`
  display: flex;
  gap: 20px;
  padding-top: 4px;
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 8px 4px 4px;
`;

const SEP = "\\";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toUpperCase() : "";
}

function describeType(node: VfsNode): string {
  if (node.type === "dir") return "File Folder";
  if (node.appId) return "Application";
  const ext = extOf(node.name);
  if (!ext) return "File";
  if (["TXT", "LOG"].includes(ext)) return "Text Document";
  if (ext === "INI") return "Configuration Settings";
  if (ext === "HLP") return "Help File";
  if (["BMP", "PNG", "JPG", "JPEG", "GIF"].includes(ext)) return `${ext} Image`;
  if (ext === "EXE") return "Application";
  if (ext === "BAT") return "MS-DOS Batch File";
  if (ext === "DLL") return "Application extension";
  return `${ext} File`;
}

// 8.3 short name: keep the first 8 chars of the base and first 3 of the ext.
function shortName(name: string): string {
  if (name.length <= 12 && !name.includes(" ")) return name.toUpperCase();
  const i = name.lastIndexOf(".");
  const base = (i > 0 ? name.slice(0, i) : name).toUpperCase();
  const ext = i > 0 ? name.slice(i + 1).toUpperCase() : "";
  const b = base.replace(/[^A-Z0-9_]/g, "").slice(0, 6) + "~1";
  return ext ? `${b}.${ext.slice(0, 3)}` : b;
}

function fileSize(node: VfsNode): number {
  if (node.type === "file") return contentByteSize(node.content);
  let total = 0;
  const walk = (n: VfsNode) => {
    if (n.type === "file") total += contentByteSize(n.content);
    else n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return total;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}  ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function Properties({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const vfs = useVfsStore(
    useShallow((s) => ({ resolve: s.resolve, setAttributes: s.setAttributes })),
  );
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const path = (data.path as string) ?? "C:\\";
  const node = vfs.resolve(path);
  const [tab, setTab] = useState("General");
  // Local mirror of the attributes so checkboxes feel instant; persisted to
  // the VFS on each toggle. System items can't be changed.
  const [hidden, setHidden] = useState(!!node?.hidden);
  const [readonly, setReadonly] = useState(!!node?.readonly);
  const [archive, setArchive] = useState(node?.archive ?? true);

  const parent = path.includes(SEP)
    ? path.slice(0, path.lastIndexOf(SEP))
    : "C:";
  const parentDir = parent === "C:" ? "C:\\" : parent;

  if (!node) {
    return (
      <Layout>
        <div style={{ fontSize: 12, padding: 16 }}>
          The properties for this item are not available.
        </div>
        <BtnRow>
          <Button onClick={() => closeWindow(windowId)}>Close</Button>
        </BtnRow>
      </Layout>
    );
  }

  const name = node.name;
  const type = describeType(node);
  const size = fileSize(node);

  return (
    <Layout>
      <Tabs
        value={tab}
        onChange={(v: string) => setTab(v)}
        style={{ fontSize: 11, zoom: 0.8 }}
      >
        <Tab value="General">General</Tab>
        <Tab value="Version">Version</Tab>
      </Tabs>
      <Body style={{ height: "fit-content" }}>
        {tab === "General" ? (
          <>
            <Header style={{ zoom: 0.9 }}>
              <IconBox variant="field">
                <img src={iconForNode(node)} alt="" draggable={false} />
              </IconBox>
              <Title>{name}</Title>
            </Header>
            <GroupBox
              style={{ zoom: 0.8 }}
              label={`${type} (${type === "File Folder" ? "" : "General"})`}
            >
              <Field>
                <Key>Type:</Key>
                <Val>{type}</Val>
              </Field>
              {node.type === "file" && (
                <Field>
                  <Key>Opens with:</Key>
                  <Val>
                    {node.appId
                      ? "RSNRA.ART Application"
                      : extOf(name) === "TXT" || extOf(name) === "LOG"
                        ? "Notepad"
                        : ["BMP", "PNG", "JPG"].includes(extOf(name))
                          ? "Paint"
                          : "Unknown"}
                  </Val>
                </Field>
              )}
              <Field>
                <Key>Location:</Key>
                <Val>{parentDir}</Val>
              </Field>
              <Field>
                <Key>Size:</Key>
                <Val>
                  {node.type === "dir"
                    ? formatSize(size)
                    : `${formatSize(size)}  (${size} bytes)`}
                </Val>
              </Field>
              <Field>
                <Key>MS-DOS name:</Key>
                <Val>{shortName(name)}</Val>
              </Field>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Date">
              <Field>
                <Key>Created:</Key>
                <Val>{formatDate(node.created)}</Val>
              </Field>
              <Field>
                <Key>Modified:</Key>
                <Val>{formatDate(node.created)}</Val>
              </Field>
              <Field>
                <Key>Accessed:</Key>
                <Val>{formatDate(node.created)}</Val>
              </Field>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Attributes">
              <AttrRow style={{ zoom: 0.8 }}>
                <Checkbox
                  label="Read-only"
                  checked={readonly}
                  disabled={!!node.system}
                  onChange={() => {
                    const v = !readonly;
                    setReadonly(v);
                    vfs.setAttributes(path, { readonly: v });
                  }}
                />
                <Checkbox
                  label="Hidden"
                  checked={hidden}
                  disabled={!!node.system}
                  onChange={() => {
                    const v = !hidden;
                    setHidden(v);
                    vfs.setAttributes(path, { hidden: v });
                  }}
                />
                <Checkbox
                  label="Archive"
                  checked={archive}
                  disabled={!!node.system}
                  onChange={() => {
                    const v = !archive;
                    setArchive(v);
                    vfs.setAttributes(path, { archive: v });
                  }}
                />
              </AttrRow>
            </GroupBox>
          </>
        ) : (
          <GroupBox style={{ zoom: 0.8 }} label="Version information">
            <Field>
              <Key>File version:</Key>
              <Val>1.0</Val>
            </Field>
            <Field>
              <Key>Description:</Key>
              <Val>{type}</Val>
            </Field>
            <Field>
              <Key>Copyright:</Key>
              <Val>© RSNRA.ART</Val>
            </Field>
          </GroupBox>
        )}
        <BtnRow>
          <Button
            style={{ zoom: 0.8, width: "80px" }}
            onClick={() => closeWindow(windowId)}
          >
            OK
          </Button>
        </BtnRow>
      </Body>
    </Layout>
  );
}
