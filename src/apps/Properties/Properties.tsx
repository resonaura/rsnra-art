import { useEffect, useState } from "react";
import { Button, Checkbox, Frame, GroupBox, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { OpenWithDialog } from "../../components/OpenWithDialog/OpenWithDialog";
import { getDefaultOpener } from "../../data/fileOpen";
import { iconForNode } from "../../data/fileIcons";
import { Icon } from "../../components/Icon/Icon";
import {
  vfsNodeAllocatedByteSize,
  vfsNodeByteSize,
} from "../../lib/vfsSize";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import {
  isReadOnlyFile,
  useVfsStore,
  type VfsNode,
} from "../../store/vfsStore";
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
  flex-wrap: wrap;
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

function readOnlyPropertyState(node: VfsNode | null | undefined): {
  checked: boolean;
  indeterminate: boolean;
} {
  if (!node) return { checked: false, indeterminate: false };
  if (node.type === "file") {
    return { checked: isReadOnlyFile(node), indeterminate: false };
  }
  const files = (node.children ?? []).filter(
    (child) => child.type === "file" && !child.protected,
  );
  const readonlyCount = files.filter(isReadOnlyFile).length;
  return {
    checked: files.length > 0 && readonlyCount === files.length,
    indeterminate: readonlyCount > 0 && readonlyCount < files.length,
  };
}

function fileSize(node: VfsNode): number {
  return vfsNodeByteSize(node);
}

function countContents(node: VfsNode): { files: number; folders: number } {
  let files = 0;
  let folders = 0;
  const walk = (current: VfsNode) => {
    if (current.type === "file") {
      files++;
      return;
    }
    folders++;
    current.children?.forEach(walk);
  };
  node.children?.forEach(walk);
  return { files, folders };
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
    useShallow((s) => ({
      root: s.root,
      resolve: s.resolve,
      getShortName: s.getShortName,
      setAttributes: s.setAttributes,
      setFolderFilesReadOnly: s.setFolderFilesReadOnly,
    })),
  );
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const openWithDefaults = useFilePrefsStore((s) => s.openWithDefaults);
  const path = (data.path as string) ?? "C:\\";
  const node = vfs.resolve(path);
  const [tab, setTab] = useState("General");
  const [showOpenWith, setShowOpenWith] = useState(false);
  // Local mirror of the attributes so checkboxes feel instant; persisted to
  // the VFS on each toggle. System items can't be changed.
  const [hidden, setHidden] = useState(!!node?.hidden);
  const [readOnlyState, setReadOnlyState] = useState(readOnlyPropertyState(node));
  const [archive, setArchive] = useState(node?.archive ?? true);
  const [system, setSystem] = useState(!!node?.system);

  useEffect(() => {
    if (!node) return;
    setHidden(!!node.hidden);
    setReadOnlyState(readOnlyPropertyState(node));
    setArchive(node.archive ?? true);
    setSystem(!!node.system);
  }, [node]);

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
  const dosName = vfs.getShortName(path) ?? name.toUpperCase();
  const type = describeType(node);
  const size = fileSize(node);
  const isVolumeRoot =
    node.type === "dir" && path.replace(/[\\/]+$/, "").toUpperCase() === "C:";
  const sizeOnDisk = vfsNodeAllocatedByteSize(node, isVolumeRoot);
  const contents = node.type === "dir" ? countContents(node) : null;
  const hasVersionInfo =
    node.type === "file" &&
    (node.appId !== undefined || ["EXE", "DLL", "CPL"].includes(extOf(name)));
  const hasAssociation =
    node.type === "file" &&
    !node.appId &&
    !["LNK", "EXE", "COM", "BAT", "CMD", "SCR", "DLL", "CPL"].includes(
      extOf(name),
    );
  const extensionKey = name.split(".").pop()?.toLowerCase() ?? "";
  // This subscription makes the displayed opener update immediately after
  // Change... saves the per-user file-type association.
  const opener = hasAssociation
    ? getDefaultOpener(name, openWithDefaults[extensionKey])
    : null;
  const canChangeReadOnly =
    node.type === "file"
      ? !node.protected
      : (node.children ?? []).some(
          (child) => child.type === "file" && !child.protected,
        );

  return (
    <Layout>
      <Tabs
        value={tab}
        onChange={(v: string) => setTab(v)}
        style={{ fontSize: 11, zoom: 0.8 }}
      >
        <Tab value="General">General</Tab>
        {hasVersionInfo && <Tab value="Version">Version</Tab>}
      </Tabs>
      <Body style={{ height: "fit-content" }}>
        {tab === "General" ? (
          <>
            <Header style={{ zoom: 0.9 }}>
              <IconBox variant="field">
                <Icon src={iconForNode(node)} size={32} />
              </IconBox>
              <Title>{name}</Title>
            </Header>
            <GroupBox
              style={{ zoom: 0.8 }}
              label="General"
            >
              <Field>
                <Key>Type:</Key>
                <Val>{type}</Val>
              </Field>
              {opener && (
                <Field>
                  <Key>Opens with:</Key>
                  <Val style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon src={opener.icon} size={16} isInReact95 />
                    <span style={{ flex: 1 }}>{opener.label}</span>
                    <Button onClick={() => setShowOpenWith(true)}>
                      Change...
                    </Button>
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
                <Key>Size on disk:</Key>
                <Val>
                  {formatSize(sizeOnDisk)}  ({sizeOnDisk} bytes)
                </Val>
              </Field>
              {contents && (
                <Field>
                  <Key>Contains:</Key>
                  <Val>
                    {contents.files} Files, {contents.folders} Folders
                  </Val>
                </Field>
              )}
              <Field>
                <Key>MS-DOS name:</Key>
                <Val>{dosName}</Val>
              </Field>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Date">
              <Field>
                <Key>Created:</Key>
                <Val>{formatDate(node.created)}</Val>
              </Field>
              <Field>
                <Key>Modified:</Key>
                <Val>{formatDate(node.modified ?? node.created)}</Val>
              </Field>
              <Field>
                <Key>Accessed:</Key>
                <Val>{formatDate(node.accessed ?? node.created)}</Val>
              </Field>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Attributes">
              <AttrRow style={{ zoom: 0.8 }}>
                <Checkbox
                  label={
                    node.type === "dir"
                      ? "Read-only (Only applies to files in folder)"
                      : "Read-only"
                  }
                  checked={readOnlyState.checked}
                  indeterminate={readOnlyState.indeterminate}
                  disabled={!canChangeReadOnly}
                  onChange={() => {
                    const v = !readOnlyState.checked;
                    const changed =
                      node.type === "dir"
                        ? vfs.setFolderFilesReadOnly(path, v)
                        : vfs.setAttributes(path, { readonly: v });
                    if (changed) {
                      setReadOnlyState({ checked: v, indeterminate: false });
                    }
                  }}
                />
                <Checkbox
                  label="Hidden"
                  checked={hidden}
                  disabled={!!node.protected}
                  onChange={() => {
                    const v = !hidden;
                    setHidden(v);
                    vfs.setAttributes(path, { hidden: v });
                  }}
                />
                {node.type === "file" && (
                  <>
                    <Checkbox
                      label="Archive"
                      checked={archive}
                      disabled={!!node.protected}
                      onChange={() => {
                        const v = !archive;
                        setArchive(v);
                        vfs.setAttributes(path, { archive: v });
                      }}
                    />
                    <Checkbox
                      label="System"
                      checked={system}
                      disabled={!!node.protected}
                      onChange={() => {
                        const v = !system;
                        setSystem(v);
                        vfs.setAttributes(path, { system: v });
                      }}
                    />
                  </>
                )}
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
      {showOpenWith && (
        <OpenWithDialog
          fileName={name}
          filePath={path}
          associateOnly
          onClose={() => setShowOpenWith(false)}
        />
      )}
    </Layout>
  );
}
