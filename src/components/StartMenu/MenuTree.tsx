import type { MouseEvent } from 'react';
import styled from 'styled-components';
import { TASKBAR_HEIGHT } from '../../constants';
import { Icon } from '../Icon/Icon';
import type { MenuNode } from '../../data/startMenu';

const List = styled.ul<{ $nested?: boolean }>`
  list-style: none;
  margin: 0;
  padding: 3px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderLightest};
  box-shadow: 1px 1px 0 1px rgba(0, 0, 0, 0.3);
  width: 196px;
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

const Row = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  font-size: 13px;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  color: ${({ $disabled, theme }) => ($disabled ? theme.materialTextDisabled : theme.materialText)};
  white-space: nowrap;

  .icon-wrap {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  img {
    width: 22px;
    height: 22px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  .chevron {
    margin-left: auto;
    font-size: 10px;
  }

  ${ItemWrap}:hover > & {
    background: ${({ $disabled, theme }) => ($disabled ? 'none' : theme.hoverBackground)};
    color: ${({ $disabled, theme }) => ($disabled ? theme.materialTextDisabled : theme.headerText)};
  }
`;

interface MenuTreeProps {
  nodes: MenuNode[];
  nested?: boolean;
}

/**
 * Submenus open aligned to the top of their parent item; when a long submenu
 * would extend below the taskbar it is shifted up just enough to stay above it
 * (and never above the viewport top), like the real Win95 start menu.
 */
function clampSubmenu(e: MouseEvent<HTMLLIElement>) {
  const sub = e.currentTarget.querySelector<HTMLUListElement>(':scope > ul');
  if (!sub) return;
  sub.style.top = '';
  sub.style.display = 'block';
  const itemTop = e.currentTarget.getBoundingClientRect().top;
  const subHeight = sub.offsetHeight;
  sub.style.display = '';
  const limit = window.innerHeight - TASKBAR_HEIGHT - 2;
  let top = itemTop - 5;
  if (top + subHeight > limit) top = limit - subHeight;
  if (top < 2) top = 2;
  sub.style.top = `${top - itemTop}px`;
}

export function MenuTree({ nodes, nested }: MenuTreeProps) {
  return (
    <List $nested={nested}>
      {nodes.map((node) => {
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
              onClick={() => {
                if (node.disabled) return;
                if (!node.children) node.action?.();
              }}
            >
              {node.icon && (
                <span className="icon-wrap">
                  <Icon
                    src={node.icon}
                    size={22}
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
            {node.children && <MenuTree nodes={node.children} nested />}
          </ItemWrap>
        );
      })}
    </List>
  );
}
