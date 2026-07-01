import { useState } from "react";
import {
  Button,
  Checkbox,
  Frame,
  GroupBox,
  Tab,
  TabBody,
  Tabs,
  Window,
} from "react95";
import styled from "styled-components";
import { iconForNode } from "../../data/fileIcons";
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
  if (node.type === "file") return new Blob([node.content ?? ""]).size;
  let total = 0;
  const walk = (n: VfsNode) => {
    if (n.type === "file") total += new Blob([n.content ?? ""]).size;
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
  const vfs = useVfsStore();
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const [tab, setTab] = useState("General");

  const path = (data.path as string) ?? "C:\\";
  const node = vfs.resolve(path);
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
      <Window>
        <Tabs
          value={tab}
          onChange={(v: string) => setTab(v)}
          style={{ fontSize: 11 }}
        >
          <Tab value="General">General</Tab>
          <Tab value="Version">Version</Tab>
        </Tabs>
        <Body>
          {tab === "General" ? (
            <>
              <Header>
                <IconBox variant="field">
                  <img src={iconForNode(node)} alt="" draggable={false} />
                </IconBox>
                <Title>{name}</Title>
              </Header>
              <GroupBox
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
                        ? "RSNRA 95 Application"
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
              <GroupBox label="Date">
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
              <GroupBox label="Attributes">
                <AttrRow>
                  <Checkbox
                    label="Read-only"
                    checked={!!node.system}
                    disabled
                  />
                  <Checkbox label="Hidden" checked={!!node.hidden} disabled />
                  <Checkbox label="Archive" checked disabled />
                </AttrRow>
              </GroupBox>
            </>
          ) : (
            <GroupBox label="Version information">
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
                <Val>© RSNRA 95</Val>
              </Field>
            </GroupBox>
          )}
          <BtnRow>
            <Button onClick={() => closeWindow(windowId)}>OK</Button>
          </BtnRow>
        </Body>
      </Window>
    </Layout>
  );
}
