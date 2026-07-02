import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  position: fixed;
  z-index: 999999;
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.app-menu-bar-dropdown') || target.closest('.app-menu-bar-row')) {
        return;
      }
      setOpenMenu(null);
      setDropdownPos(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [openMenu]);

  const activeMenu = menus.find((m) => m.label === openMenu);

  return (
    <MenuBarRow className="app-menu-bar-row">
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: 'relative' }}>
          <MenuTopItem
            $open={openMenu === menu.label}
            onClick={(e) => {
              e.stopPropagation();
              if (openMenu === menu.label) {
                setOpenMenu(null);
                setDropdownPos(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                setOpenMenu(menu.label);
                setDropdownPos({ top: rect.bottom, left: rect.left });
              }
            }}
            onMouseEnter={(e) => {
              if (openMenu) {
                const rect = e.currentTarget.getBoundingClientRect();
                setOpenMenu(menu.label);
                setDropdownPos({ top: rect.bottom, left: rect.left });
              }
            }}
          >
            {menu.label}
          </MenuTopItem>
        </div>
      ))}

      {activeMenu && dropdownPos && createPortal(
        <Dropdown
          className="app-menu-bar-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {activeMenu.items.map((item, i) =>
            item.divider ? (
              <DropdownDivider key={i} />
            ) : (
              <DropdownItem
                key={item.label + i}
                $disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.action?.();
                  setOpenMenu(null);
                  setDropdownPos(null);
                }}
              >
                {item.label}
              </DropdownItem>
            )
          )}
        </Dropdown>,
        document.body
      )}
    </MenuBarRow>
  );
}
