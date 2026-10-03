import type { MouseEvent } from "react";
import { useState } from "react";
import styled from "styled-components";
import { TASKBAR_HEIGHT } from "../../constants";
import type { MenuNode } from "../../data/startMenu";
import type { TaskbarPreferences } from "../../store/taskbarPrefsStore";
import { Icon } from "../Icon/Icon";

const List = styled.ul<{ $nested?: boolean; $small?: boolean }>`
  list-style: none;
  margin: 0;
  padding: 3px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
  box-shadow: 1px 1px 0 1px rgba(0, 0, 0, 0.3);
  width: ${({ $small }) => ($small ? 188 : 196)}px;
  font-family: var(--rsnra-font-menu-family, inherit);
  ${({ $nested }) =>
    $nested &&
    `
    position: absolute;
    top: -5px;
    left: calc(100% - 3px);
    display: none;
    z-index: 10;
  `}
`;

const ItemWrap = styled.li`
  position: relative;
  &:hover > ${List} {
    display: block;
  }
`;

const Divider = styled.li`
  height: 0;
  margin: 3px 4px;
  border-top: 1px solid ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
  list-style: none;
`;

const Row = styled.div<{ $disabled?: boolean; $small?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: ${({ $small }) => ($small ? "3px 6px" : "6px 8px")};
  font-size: var(--rsnra-font-menu-size, 13px);
  font-weight: var(--rsnra-font-menu-weight, normal);
  font-style: var(--rsnra-font-menu-style, normal);
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  color: ${({ $disabled, theme }) =>
    $disabled ? theme.materialTextDisabled : theme.materialText};
  white-space: nowrap;

  .icon-wrap {
    width: ${({ $small }) => ($small ? 16 : 22)}px;
    height: ${({ $small }) => ($small ? 16 : 22)}px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  img {
    width: ${({ $small }) => ($small ? 16 : 22)}px;
    height: ${({ $small }) => ($small ? 16 : 22)}px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  .chevron {
    margin-left: auto;
    font-size: 10px;
  }

  ${ItemWrap}:hover > & {
    background: ${({ $disabled, theme }) =>
      $disabled ? "none" : theme.hoverBackground};
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.materialTextDisabled : theme.headerText};
  }
`;

interface MenuTreeProps {
  nodes: MenuNode[];
  nested?: boolean;
  smallIcons?: boolean;
  personalizedMenus?: boolean;
  menuUse?: TaskbarPreferences["menuUse"];
  onItemUsed?: (id: string) => void;
}

/**
 * Submenus open aligned to the top of their parent item; when a long submenu
 * would extend below the taskbar it is shifted up just enough to stay above it
 * (and never above the viewport top), like the real Win95 start menu.
 */
function clampSubmenu(e: MouseEvent<HTMLLIElement>) {
  const sub = e.currentTarget.querySelector<HTMLUListElement>(":scope > ul");
  if (!sub) return;
  sub.style.top = "";
  sub.style.display = "block";
  const itemTop = e.currentTarget.getBoundingClientRect().top;
  const subHeight = sub.offsetHeight;
  sub.style.display = "";
  const limit = window.innerHeight - TASKBAR_HEIGHT - 2;
  let top = itemTop - 5;
  if (top + subHeight > limit) top = limit - subHeight;
  if (top < 2) top = 2;
  sub.style.top = `${top - itemTop}px`;
}

export function MenuTree({
  nodes,
  nested,
  smallIcons,
  personalizedMenus,
  menuUse,
  onItemUsed,
}: MenuTreeProps) {
  const [showAll, setShowAll] = useState(false);
  const sortedNodes = personalizedMenus && nested
    ? nodes
        .map((node, index) => ({ node, index, usage: menuUse?.[node.id] }))
        .sort((left, right) => {
          const countDifference =
            (right.usage?.count ?? 0) - (left.usage?.count ?? 0);
          if (countDifference !== 0) return countDifference;
          const timeDifference =
            (right.usage?.lastUsed ?? 0) - (left.usage?.lastUsed ?? 0);
          return timeDifference || left.index - right.index;
        })
        .map(({ node }) => node)
    : nodes;
  const collapsed = !!personalizedMenus && !!nested && sortedNodes.length > 6;
  const visibleNodes = collapsed && !showAll ? sortedNodes.slice(0, 6) : sortedNodes;

  return (
    <List $nested={nested} $small={smallIcons}>
      {visibleNodes.map((node) => {
        // Render a separator divider
        if (node.separator) {
          return <Divider key={node.id} role="separator" />;
        }

        return (
          <ItemWrap
            key={node.id}
            onMouseEnter={node.children ? clampSubmenu : undefined}
          >
            <Row
              $disabled={node.disabled}
              $small={smallIcons}
              onClick={() => {
                if (node.disabled) return;
                if (!node.children) {
                  onItemUsed?.(node.id);
                  node.action?.();
                }
              }}
            >
              {node.icon && (
                <span className="icon-wrap">
                  <Icon
                    src={node.icon}
                    size={smallIcons ? 16 : 24}
                    style={
                      node.iconScale
                        ? { transform: `scale(${node.iconScale})` }
                        : undefined
                    }
                  />
                </span>
              )}
              <span>{node.label}</span>
              {node.children && <span className="chevron">▶</span>}
            </Row>
            {node.children && (
              <MenuTree
                nodes={node.children}
                nested
                smallIcons={smallIcons}
                personalizedMenus={personalizedMenus}
                menuUse={menuUse}
                onItemUsed={onItemUsed}
              />
            )}
          </ItemWrap>
        );
      })}
      {collapsed && (
        <li>
          <Row
            $small={smallIcons}
            role="button"
            aria-label={showAll ? "Show frequently used items" : "Show all items"}
            title={showAll ? "Show frequently used items" : "Show all items"}
            onClick={() => setShowAll((value) => !value)}
          >
            <span className="icon-wrap" aria-hidden="true">»</span>
            <span>{showAll ? "Show fewer items" : "Show all items"}</span>
          </Row>
        </li>
      )}
    </List>
  );
}
