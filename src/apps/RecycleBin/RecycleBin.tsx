import { useState } from "react";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { ContextMenu, CtxItem } from "../../components/ContextMenu";
import { ScrollArea } from "../../components/ScrollArea";
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
  const recycled = useVfsStore((s) => s.recycled);
  const emptyRecycleBin = useVfsStore((s) => s.emptyRecycleBin);
  const restoreFromRecycleBin = useVfsStore((s) => s.restoreFromRecycleBin);
  const deleteFromRecycleBin = useVfsStore((s) => s.deleteFromRecycleBin);

  const [selected, setSelected] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const isEmpty = recycled.length === 0;

  const menus = [
    {
      label: "File",
      items: [
        {
          label: "Empty Recycle Bin",
          disabled: isEmpty,
          action: () => {
            emptyRecycleBin();
            setSelected(null);
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
            recycled.forEach((r) => restoreFromRecycleBin(r.originalPath));
            setSelected(null);
          },
        },
        { label: "", divider: true },
        {
          label: "Select All",
          disabled: isEmpty,
          action: () =>
            setSelected(
              recycled.length
                ? recycled[recycled.length - 1].originalPath
                : null,
            ),
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
    setSelected(item.originalPath);
    setCtx({ x: e.clientX, y: e.clientY, item });
  };

  const closeCtx = () => setCtx(null);

  return (
    <Layout onClick={closeCtx}>
      <AppMenuBar menus={menus} />
      <Body>
        {isEmpty ? (
          <EmptyState>
            <img
              src="/icons/recycle-bin-empty.png"
              alt=""
              width={48}
              height={48}
              style={{ imageRendering: "pixelated" }}
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
                  key={item.originalPath}
                  $selected={selected === item.originalPath}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(item.originalPath);
                  }}
                  onDoubleClick={() => restoreFromRecycleBin(item.originalPath)}
                  onContextMenu={(e) => openCtx(e, item)}
                >
                  <Td>
                    <img
                      src={
                        item.node.type === "dir"
                          ? "/icons/folder.png"
                          : "/icons/file-txt.png"
                      }
                      alt=""
                      width={16}
                      height={16}
                      style={{
                        imageRendering: "pixelated",
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
      </StatusBar>

      {ctx && (
        <ContextMenu x={ctx.x} y={ctx.y} onClose={closeCtx}>
          <CtxItem
            onClick={() => {
              restoreFromRecycleBin(ctx.item.originalPath);
              closeCtx();
              setSelected(null);
            }}
          >
            Restore
          </CtxItem>
          <CtxItem
            onClick={() => {
              deleteFromRecycleBin(ctx.item.originalPath);
              closeCtx();
              setSelected(null);
            }}
          >
            Delete Permanently
          </CtxItem>
        </ContextMenu>
      )}
    </Layout>
  );
}
