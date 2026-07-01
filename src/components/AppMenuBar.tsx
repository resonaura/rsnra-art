import { useState } from 'react';
import styled, { css } from 'styled-components';

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

export const MenuBarRow = styled.div`
  position: relative;
  display: flex;
  height: 22px;
  flex-shrink: 0;
  font-size: 12px;
  background: ${({ theme }) => theme.material};
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
`;

const MenuTopItem = styled.button<{ $open: boolean }>`
  background: ${({ $open, theme }) =>
    $open ? theme.hoverBackground : 'transparent'};
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
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? 'none' : theme.hoverBackground};
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

export interface MenuItemDef {
  label: string;
  action?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

export function AppMenuBar({ menus }: { menus: MenuDef[] }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <MenuBarRow
      onMouseLeave={() => setOpenMenu(null)}
      onClick={(e) => e.stopPropagation()}
    >
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: 'relative' }}>
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
                    key={item.label + i}
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
}
