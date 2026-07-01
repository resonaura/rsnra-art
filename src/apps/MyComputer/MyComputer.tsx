import { useState, type ReactNode } from "react";
import { Button, Frame, Separator, Toolbar } from "react95";
import styled, { css } from "styled-components";
import { APPS, openApp } from "../../data/apps";
import { iconForNode } from "../../data/fileIcons";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

const MY_COMPUTER = "My Computer";

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const MenuBarRow = styled.div`
  position: relative;
  display: flex;
  height: 22px;
  flex-shrink: 0;
  font-size: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
`;
const MenuTopItem = styled.button<{ $open: boolean }>`
  background: ${({ $open, theme }) =>
    $open ? theme.hoverBackground : "transparent"};
  color: ${({ $open, theme }) =>
    $open ? theme.headerText : theme.materialText};
  border: none;
  padding: 2px 8px;
  font-size: 12px;
  cursor: default;
`;
const Dropdown = styled.div`
  position: absolute;
  top: 22px;
  z-index: 50;
  ${raised}
  background: ${({ theme }) => theme.material};
  min-width: 180px;
  padding: 2px;
  box-shadow: 2px 2px 0 0 rgba(0, 0, 0, 0.4);
`;
const DropdownItem = styled.div<{ $disabled?: boolean }>`
  padding: 4px 10px;
  font-size: 12px;
  white-space: pre;
  color: ${({ $disabled, theme }) =>
    $disabled ? theme.materialTextDisabled : theme.materialText};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? "none" : theme.hoverBackground};
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.materialTextDisabled : theme.headerText};
  }
`;
const DropdownDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;

interface MenuItemDef {
  label: string;
  action?: () => void;
  disabled?: boolean;
  divider?: boolean;
}
interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

const Layout = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: ${({ theme }) => theme.material};
`;

const NavToolbar = styled(Toolbar)`
  flex-shrink: 0;
  padding: 4px 6px;
  gap: 6px;
`;

const NavBtn = styled(Button)`
  width: 28px;
  height: 26px;
  min-width: 28px;
  padding: 0;
  font-size: 15px;
`;

const AddressRow = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 6px;
`;

const AddressField = styled(Frame)`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  min-height: 22px;
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const IconGrid = styled.div`
  flex: 1;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  margin: 0 8px 8px;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
  overflow: auto;
`;

const IconItem = styled.button<{ $selected?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  padding: 6px 2px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  border: 1px dotted ${({ $selected }) => ($selected ? "white" : "transparent")};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};
  cursor: default;
  font-family: inherit;
  font-size: 11px;
  text-align: center;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
  &:focus {
    outline: none;
  }
`;

const RenameInput = styled.input`
  width: 80px;
  font-size: 11px;
  text-align: center;
  padding: 0 2px;
`;

const StatusBarEl = styled(Frame)`
  flex-shrink: 0;
  margin: 0 8px 6px;
  padding: 3px 8px;
  font-size: 11px;
`;

const CtxMenu = styled(Frame)`
  position: fixed;
  z-index: 9999;
  min-width: 150px;
  padding: 2px;
  background: ${({ theme }) => theme.material};
`;

const CtxItem = styled.button<{ $disabled?: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 18px;
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  color: ${({ $disabled, theme }) =>
    $disabled ? theme.materialTextDisabled : theme.materialText};
  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? "transparent" : theme.hoverBackground};
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.materialTextDisabled : theme.headerText};
  }
`;

const CtxDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;
void CtxDivider;

interface Drive {
  label: string;
  icon: string;
  target: string;
  kind: "drive" | "app";
  appId?: string;
  notReady?: boolean;
}
const DRIVES: Drive[] = [
  {
    label: "3½ Floppy (A:)",
    icon: "/icons/floppy.png",
    target: "A:\\",
    kind: "drive",
    notReady: true,
  },
  {
    label: "Local Disk (C:)",
    icon: "/icons/disk-drive.png",
    target: "C:\\",
    kind: "drive",
  },
  {
    label: "Audio CD (D:)",
    icon: "/icons/music-cd.png",
    target: "D:\\",
    kind: "drive",
    notReady: true,
  },
  {
    label: "Control Panel",
    icon: "/icons/control-panel.png",
    target: "",
    kind: "app",
    appId: "control-panel",
  },
  { label: "Printers", icon: "/icons/printers.png", target: "", kind: "app" },
  {
    label: "Dial-Up Networking",
    icon: "/icons/folder-open.png",
    target: "",
    kind: "app",
  },
];

interface CtxState {
  x: number;
  y: number;
  node: VfsNode | null; // null = background
}

export function MyComputer({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const vfs = useVfsStore();
  const [path, setPath] = useState<string>(MY_COMPUTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const isRoot = path === MY_COMPUTER;
  const isDriveRoot = /^([A-Za-z]):\\$/.test(path);
  const driveNotReady = /^[AD]:\\$/.test(path);
  const entries: VfsNode[] =
    isRoot || driveNotReady ? [] : (vfs.list(path) ?? []);
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const refresh = () => setPath((p) => p); // no-op; VFS mutations re-render via root swap
  void refresh;

  const enter = (d: Drive) => {
    if (d.kind === "app") {
      if (d.appId) openApp(d.appId as never);
      return;
    }
    setPath(d.target);
    setSelected(null);
  };

  const openNode = (node: VfsNode) => {
    const abs = vfs.resolvePath(node.name, path);
    if (!abs) return;
    if (node.type === "dir") {
      setPath(abs);
      setSelected(null);
    } else if (node.appId && APPS[node.appId as keyof typeof APPS]) {
      const id = node.appId as keyof typeof APPS;
      if (id === "notepad")
        openApp("notepad", {
          title: `${node.name} - Notepad`,
          data: { path: abs },
        });
      else openApp(id);
    } else if (node.name.toLowerCase().endsWith(".txt")) {
      openApp("notepad", {
        title: `${node.name} - Notepad`,
        data: { path: abs },
      });
    } else if (
      node.name.toLowerCase().endsWith(".png") ||
      node.name.toLowerCase().endsWith(".bmp")
    ) {
      openApp("paint", { title: `${node.name} - Paint`, data: { path: abs } });
    }
  };

  const goUp = () => {
    if (isRoot) return;
    if (isDriveRoot) {
      setPath(MY_COMPUTER);
      setSelected(null);
      return;
    }
    const up = vfs.resolvePath("..", path);
    if (up) {
      setPath(up);
      setSelected(null);
    }
  };

  // ── mutations ──────────────────────────────────────────────────────────
  const newFolder = () => {
    if (isRoot || driveNotReady) return;
    let name = "New Folder";
    let i = 1;
    while (vfs.exists(vfs.resolvePath(name, path)!))
      name = `New Folder (${++i})`;
    vfs.mkdir(vfs.resolvePath(name, path)!);
    refresh();
    setSelected(name);
  };

  const newTextFile = () => {
    if (isRoot || driveNotReady) return;
    let name = "New Text Document.txt";
    let i = 1;
    while (vfs.exists(vfs.resolvePath(name, path)!))
      name = `New Text Document (${++i}).txt`;
    const abs = vfs.resolvePath(name, path)!;
    vfs.writeFile(abs, "");
    refresh();
    setSelected(name);
    openApp("notepad", { title: `${name} - Notepad`, data: { path: abs } });
  };

  const deleteNode = (node: VfsNode) => {
    const abs = vfs.resolvePath(node.name, path);
    if (abs && vfs.remove(abs)) {
      refresh();
      setSelected(null);
    }
  };

  const commitRename = () => {
    if (renaming && renameVal.trim()) {
      const abs = vfs.resolvePath(renaming, path);
      if (abs) vfs.rename(abs, renameVal.trim());
    }
    setRenaming(null);
    refresh();
  };

  const objectCount = isRoot ? DRIVES.length : sorted.length;

  // ── context menu ───────────────────────────────────────────────────────
  const openCtx = (e: React.MouseEvent, node: VfsNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (node) setSelected(node.name);
    setCtx({ x: e.clientX, y: e.clientY, node });
  };

  const closeCtx = () => setCtx(null);

  const runCtx = (action: () => void) => {
    closeCtx();
    action();
  };

  const ctxItems: { label: string; action: () => void; disabled?: boolean }[] =
    ctx?.node
      ? [
          { label: "Open", action: () => openNode(ctx.node!) },
          {
            label: "Rename",
            action: () => {
              setRenaming(ctx.node!.name);
              setRenameVal(ctx.node!.name);
            },
          },
          { label: "Delete", action: () => deleteNode(ctx.node!) },
        ]
      : [
          {
            label: "New Folder",
            action: newFolder,
            disabled: isRoot || driveNotReady,
          },
          {
            label: "New Text Document",
            action: newTextFile,
            disabled: isRoot || driveNotReady,
          },
        ];

  const selectedNode = sorted.find((n) => n.name === selected) ?? null;

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        {
          label: "New Folder",
          action: newFolder,
          disabled: isRoot || driveNotReady,
        },
        {
          label: "New Text Document",
          action: newTextFile,
          disabled: isRoot || driveNotReady,
        },
        { label: "", divider: true },
        {
          label: "Open",
          action: () => selectedNode && openNode(selectedNode),
          disabled: !selectedNode,
        },
        {
          label: "Delete",
          action: () => selectedNode && deleteNode(selectedNode),
          disabled: !selectedNode,
        },
        {
          label: "Rename",
          action: () => {
            if (selectedNode) {
              setRenaming(selectedNode.name);
              setRenameVal(selectedNode.name);
            }
          },
          disabled: !selectedNode,
        },
        { label: "", divider: true },
        { label: "Close", action: () => closeWindow(windowId) },
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
        { label: "", divider: true },
        {
          label: "Select All",
          action: () =>
            setSelected(sorted.length ? sorted[sorted.length - 1].name : null),
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Large Icons", disabled: true },
        { label: "Small Icons", disabled: true },
        { label: "List", disabled: true },
        { label: "Details", disabled: true },
        { label: "", divider: true },
        { label: "Refresh", action: refresh },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About RSNRA 95", disabled: true }],
    },
  ];

  const menuRow = (
    <MenuBarRow
      onMouseLeave={() => setOpenMenu(null)}
      onClick={(e) => e.stopPropagation()}
    >
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: "relative" }}>
          <MenuTopItem
            $open={openMenu === menu.label}
            onClick={() =>
              setOpenMenu((m) => (m === menu.label ? null : menu.label))
            }
            onMouseEnter={() => setOpenMenu((m) => (m ? menu.label : m))}
          >
            {menu.label}
          </MenuTopItem>
          {openMenu === menu.label && (
            <Dropdown>
              {menu.items.map((item, i) =>
                item.divider ? (
                  <DropdownDivider key={i} />
                ) : (
                  <DropdownItem
                    key={item.label}
                    $disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      item.action?.();
                      setOpenMenu(null);
                    }}
                  >
                    {item.label}
                  </DropdownItem>
                ),
              )}
            </Dropdown>
          )}
        </div>
      ))}
    </MenuBarRow>
  );

  const renderIcon = (node: VfsNode): ReactNode => (
    <IconItem
      key={node.name}
      $selected={selected === node.name}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(node.name);
      }}
      onDoubleClick={() => openNode(node)}
      onContextMenu={(e) => openCtx(e, node)}
    >
      <img src={iconForNode(node)} alt="" draggable={false} />
      {renaming === node.name ? (
        <RenameInput
          autoFocus
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(null);
          }}
        />
      ) : (
        node.name
      )}
    </IconItem>
  );

  return (
    <Layout
      onClick={() => {
        closeCtx();
        setOpenMenu(null);
      }}
    >
      {menuRow}
      <Separator />
      <NavToolbar>
        <NavBtn onClick={goUp} disabled={isRoot} title="Up one level">
          ↑
        </NavBtn>
      </NavToolbar>
      <AddressRow>
        <span style={{ fontSize: 12 }}>Address</span>
        <AddressField variant="field">{path}</AddressField>
      </AddressRow>

      <IconGrid
        onContextMenu={(e) => openCtx(e, null)}
        onClick={() => {
          setSelected(null);
          setOpenMenu(null);
        }}
      >
        {isRoot
          ? DRIVES.map((d) => (
              <IconItem
                key={d.label}
                $selected={selected === d.label}
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(d.label);
                }}
                onDoubleClick={() => enter(d)}
                onContextMenu={(e) => openCtx(e, null)}
              >
                <img src={d.icon} alt="" draggable={false} />
                {d.label}
              </IconItem>
            ))
          : sorted.map(renderIcon)}
        {!isRoot && sorted.length === 0 && (
          <div style={{ fontSize: 12, padding: 16, color: "#888" }}>
            {driveNotReady
              ? "The device is not ready."
              : "This folder is empty."}
          </div>
        )}
      </IconGrid>

      <StatusBarEl variant="status">
        {objectCount} object(s){selected ? `    ${selected}` : ""}
      </StatusBarEl>

      {ctx && (
        <CtxMenu
          variant="field"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxItems.map((it, i) => (
            <CtxItem
              key={i}
              $disabled={it.disabled}
              disabled={it.disabled}
              onClick={() => !it.disabled && runCtx(it.action)}
            >
              {it.label}
            </CtxItem>
          ))}
        </CtxMenu>
      )}
    </Layout>
  );
}
