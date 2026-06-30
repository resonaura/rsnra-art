import styled from 'styled-components';
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

const Row = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  font-size: 13px;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  color: ${({ $disabled, theme }) => ($disabled ? theme.materialTextDisabled : theme.materialText)};
  white-space: nowrap;

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
      {nodes.map((node) => (
        <ItemWrap key={node.id}>
          <Row
            $disabled={node.disabled}
            onClick={() => {
              if (node.disabled) return;
              if (!node.children) node.action?.();
            }}
          >
            {node.icon && <img src={node.icon} alt="" draggable={false} />}
            <span>{node.label}</span>
            {node.children && <span className="chevron">▶</span>}
          </Row>
          {node.children && <MenuTree nodes={node.children} nested />}
        </ItemWrap>
      ))}
    </List>
  );
}
