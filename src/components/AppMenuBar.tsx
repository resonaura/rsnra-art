import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MenuList, MenuListItem, Separator } from "react95";
import styled from "styled-components";
import { R95_SCALE, R95_SCALE_COMPENSATION } from "../react95.conf";

export const MenuBarRow = styled.div`
  position: relative;
  display: flex;
  height: 22px;
  flex-shrink: 0;
  font-family: var(--rsnra-font-menu-family, inherit);
  font-size: var(--rsnra-font-menu-size, 12px);
  font-weight: var(--rsnra-font-menu-weight, normal);
  font-style: var(--rsnra-font-menu-style, normal);
  background: ${({ theme }) => theme.material};
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
`;

const MenuTopItem = styled.button<{ $open: boolean }>`
  background: ${({ $open, theme }) =>
    $open ? theme.hoverBackground : "transparent"};
  color: ${({ $open, theme }) =>
    $open ? theme.headerText : theme.materialText};
  border: none;
  padding: 2px 8px;
  font-family: inherit;
  font-size: inherit;
  cursor: default;
`;

const StyledMenuList = styled(MenuList)`
  padding: 6px 4px;
  font-family: var(--rsnra-font-menu-family, inherit);
`;

const ItemContent = styled.span`
  display: flex;
  align-items: center;
  width: 100%;
`;

const ItemGutter = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  align-self: stretch;
`;

const RadioDot = styled.span`
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
`;

const CheckMark = styled.svg`
  display: block;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
`;

export interface MenuItemDef {
  label: string;
  action?: () => void;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
  radio?: boolean;
}

export interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

export function AppMenuBar({
  menus,
  isInReact95,
}: {
  menus: MenuDef[];
  isInReact95?: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(".app-menu-bar-dropdown") ||
        target.closest(".app-menu-bar-row")
      ) {
        return;
      }
      setOpenMenu(null);
      setDropdownPos(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [openMenu]);

  const activeMenu = menus.find((m) => m.label === openMenu);

  return (
    <MenuBarRow
      className="app-menu-bar-row"
      style={{ zoom: isInReact95 ? R95_SCALE_COMPENSATION : 1 }}
    >
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: "relative" }}>
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

      {activeMenu &&
        dropdownPos &&
        createPortal(
          <StyledMenuList
            className="app-menu-bar-dropdown"
            style={{
              position: "fixed",
              zIndex: 999999,
              top: dropdownPos.top * R95_SCALE_COMPENSATION,
              left: dropdownPos.left * R95_SCALE_COMPENSATION,
              zoom: R95_SCALE,
            }}
          >
            {activeMenu.items.map((item, i) =>
              item.divider ? (
                <Separator key={i} />
              ) : (
                <MenuListItem
                  key={item.label + i}
                  size="sm"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.disabled) return;
                    item.action?.();
                    setOpenMenu(null);
                    setDropdownPos(null);
                  }}
                >
                  <ItemContent>
                    <ItemGutter>
                      {item.checked &&
                        (item.radio ? (
                          <RadioDot />
                        ) : (
                          <CheckMark viewBox="0 0 12 12" aria-hidden>
                            <path
                              d="M2 6.5 L5 9.5 L10 3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </CheckMark>
                        ))}
                    </ItemGutter>
                    {item.label}
                  </ItemContent>
                </MenuListItem>
              ),
            )}
          </StyledMenuList>,
          document.body,
        )}
    </MenuBarRow>
  );
}
