import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { ContextMenu, CtxItem } from "../../components/ContextMenu";
import { Icon } from "../../components/Icon/Icon";
import { ScrollArea } from "../../components/ScrollArea";
import { iconForNode } from "../../data/fileIcons";
import { playSound } from "../../lib/audio";
import { alertError, confirmDialog } from "../../lib/systemDialogs";
import { useDisplayStore } from "../../store/displayStore";
import { useVfsStore, type RecycledItem } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const Body = styled(ScrollArea)`
  flex: 1;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  margin: 4px 8px;
  font-size: 12px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  color: ${({ theme }) => theme.materialTextDisabled};
  text-align: center;
  padding: 16px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

const Th = styled.th`
  text-align: left;
  padding: 3px 8px;
  background: ${({ theme }) => theme.material};
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
  border-right: 1px solid ${({ theme }) => theme.borderDark};
  font-weight: normal;
  white-space: nowrap;
  position: sticky;
  top: 0;
`;

const Tr = styled.tr<{ $selected?: boolean }>`
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};
  cursor: default;
  &:hover {
    background: ${({ $selected, theme }) =>
      $selected ? theme.hoverBackground : "#e8e8e8"};
  }
`;

const Td = styled.td`
  padding: 3px 8px;
  border-right: 1px solid ${({ theme }) => theme.borderDark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const StatusBar = styled.div`
  flex-shrink: 0;
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid;
  border-color: ${({ theme }) => theme.borderDark}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDark};
  margin: 0 8px 6px;
`;

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortPath(p: string) {
  const parts = p.split("\\");
  parts.pop(); // remove filename
  return parts.join("\\") || "C:\\";
}

interface CtxState {
  x: number;
  y: number;
  item: RecycledItem;
}

export function RecycleBin({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const updateIcon = useWindowStore((s) => s.updateIcon);
  const isFocused = useWindowStore(
    (s) =>
      s.windows.find((window) => window.id === windowId)?.isFocused ?? false,
  );
  const desktopIcons = useDisplayStore((s) => s.desktopIcons);
  const recycled = useVfsStore((s) => s.recycled);
  const emptyRecycleBin = useVfsStore((s) => s.emptyRecycleBin);
  const restoreFromRecycleBin = useVfsStore((s) => s.restoreFromRecycleBin);
  const deleteFromRecycleBin = useVfsStore((s) => s.deleteFromRecycleBin);

  const [selected, setSelected] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const isEmpty = recycled.length === 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedItems = recycled.filter((item) => selectedSet.has(item.id));

  const restoreItem = async (item: RecycledItem) => {
    if (restoreFromRecycleBin(item.id)) return true;
    await alertError(
      "Error Restoring File",
      `Cannot restore '${item.node.name}'. A file with the same name already exists, or the original location is unavailable.`,
    );
    return false;
  };

  const restoreItems = async (items: RecycledItem[]) => {
    const failed: string[] = [];
    for (const item of items) {
      if (!(await restoreItem(item))) failed.push(item.id);
    }
    setSelected(failed);
  };

  const deleteItems = async (items: RecycledItem[]) => {
    if (!items.length) return;
    const label =
      items.length === 1
        ? `'${items[0].node.name}'`
        : `these ${items.length} items`;
    const result = await confirmDialog(
      items.length === 1
        ? "Confirm File Delete"
        : "Confirm Multiple File Delete",
      `Are you sure you want to permanently delete ${label}?`,
    );
    if (result !== "yes") return;
    items.forEach((item) => deleteFromRecycleBin(item.id));
    setSelected([]);
  };

  // Keep the open window/taskbar icon synchronized too; previously only the
  // desktop icon reacted to Recycle Bin state.
  useEffect(() => {
    updateIcon(
      windowId,
      isEmpty ? desktopIcons.recycleEmpty : desktopIcons.recycleFull,
    );
  }, [
    desktopIcons.recycleEmpty,
    desktopIcons.recycleFull,
    isEmpty,
    updateIcon,
    windowId,
  ]);

  const menus = [
    {
      label: "File",
      items: [
        {
          label: "Empty Recycle Bin",
          disabled: isEmpty,
          action: async () => {
            const result = await confirmDialog(
              "Confirm Multiple File Delete",
              "Are you sure you want to permanently delete all items in the Recycle Bin?",
            );
            if (result !== "yes") return;
            emptyRecycleBin();
            playSound("recycle");
            setSelected([]);
            setSelectionAnchor(null);
          },
        },
        { label: "", divider: true },
        { label: "Close", action: () => closeWindow(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Restore All",
          disabled: isEmpty,
          action: () => {
            void restoreItems(recycled);
          },
        },
        { label: "", divider: true },
        {
          label: "Select All",
          disabled: isEmpty,
          action: () => {
            setSelected(recycled.map((item) => item.id));
            setSelectionAnchor(recycled.at(-1)?.id ?? null);
          },
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Large Icons", disabled: true },
        { label: "Details", disabled: true },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About Recycle Bin", disabled: true }],
    },
  ];

  const openCtx = (e: React.MouseEvent, item: RecycledItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedSet.has(item.id)) {
      setSelected([item.id]);
      setSelectionAnchor(item.id);
    }
    setCtx({ x: e.clientX, y: e.clientY, item });
  };

  const closeCtx = () => setCtx(null);

  useEffect(() => {
    if (!isFocused) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "a") {
        event.preventDefault();
        setSelected(recycled.map((item) => item.id));
        setSelectionAnchor(recycled.at(-1)?.id ?? null);
      } else if (!mod && key === "delete" && selectedItems.length) {
        event.preventDefault();
        void deleteItems(selectedItems);
      } else if (!mod && key === "enter" && selectedItems.length) {
        event.preventDefault();
        void restoreItems(selectedItems);
      } else if (!mod && key === "escape") {
        setSelected([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, selected, recycled]);

  return (
    <Layout onClick={closeCtx}>
      <AppMenuBar menus={menus} />
      <Body
        onClick={() => {
          setSelected([]);
          setSelectionAnchor(null);
        }}
      >
        {isEmpty ? (
          <EmptyState>
            <Icon
              src={desktopIcons.recycleEmpty}
              size={48}
              style={{ width: 48, height: 48 }}
            />
            <p style={{ margin: 0 }}>The Recycle Bin is empty.</p>
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Original Location</Th>
                <Th>Date Deleted</Th>
                <Th>Type</Th>
              </tr>
            </thead>
            <tbody>
              {recycled.map((item) => (
                <Tr
                  key={item.id}
                  $selected={selectedSet.has(item.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      e.shiftKey &&
                      selectionAnchor &&
                      recycled.some((entry) => entry.id === selectionAnchor)
                    ) {
                      const anchor = recycled.findIndex(
                        (entry) => entry.id === selectionAnchor,
                      );
                      const index = recycled.findIndex(
                        (entry) => entry.id === item.id,
                      );
                      const start = Math.min(anchor, index);
                      const end = Math.max(anchor, index);
                      setSelected(
                        recycled
                          .slice(start, end + 1)
                          .map((entry) => entry.id),
                      );
                    } else if (e.ctrlKey || e.metaKey) {
                      setSelected((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      );
                      setSelectionAnchor(item.id);
                    } else {
                      setSelected([item.id]);
                      setSelectionAnchor(item.id);
                    }
                  }}
                  onDoubleClick={() => void restoreItems([item])}
                  onContextMenu={(e) => openCtx(e, item)}
                >
                  <Td>
                    <Icon
                      src={iconForNode(item.node)}
                      size={16}
                      style={{
                        width: 16,
                        height: 16,
                        verticalAlign: "middle",
                        marginRight: 6,
                      }}
                    />
                    {item.node.name}
                  </Td>
                  <Td title={shortPath(item.originalPath)}>
                    {shortPath(item.originalPath)}
                  </Td>
                  <Td>{formatDate(item.deletedAt)}</Td>
                  <Td>{item.node.type === "dir" ? "Folder" : "File"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Body>
      <StatusBar>
        {isEmpty ? "0 object(s)" : `${recycled.length} object(s)`}
        {selected.length ? `    ${selected.length} selected` : ""}
      </StatusBar>

      {ctx && (
        <ContextMenu x={ctx.x} y={ctx.y} onClose={closeCtx}>
          <CtxItem
            onClick={() => {
              void restoreItems(
                selectedSet.has(ctx.item.id) ? selectedItems : [ctx.item],
              );
              closeCtx();
            }}
          >
            Restore
          </CtxItem>
          <CtxItem
            onClick={() => {
              void deleteItems(
                selectedSet.has(ctx.item.id) ? selectedItems : [ctx.item],
              );
              closeCtx();
            }}
          >
            Delete Permanently
          </CtxItem>
        </ContextMenu>
      )}
    </Layout>
  );
}
