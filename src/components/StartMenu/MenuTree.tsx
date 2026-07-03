import styled from 'styled-components';
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

export function MenuTree({ nodes, nested }: MenuTreeProps) {
  return (
    <List $nested={nested}>
      {nodes.map((node) => {
        // Render a separator divider
        if (node.separator) {
          return <Divider key={node.id} role="separator" />;
        }

        return (
          <ItemWrap key={node.id}>
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
