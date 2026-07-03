import { useEffect, useRef } from "react";
import styled from "styled-components";
import { TASKBAR_HEIGHT } from "../../constants";
import { useStartMenuTree } from "../../data/startMenu";
import { useWindowStore } from "../../store/windowStore";
import { MenuTree } from "./MenuTree";

const Positioned = styled.div`
  position: fixed;
  bottom: ${TASKBAR_HEIGHT}px;
  left: 3px;
  z-index: 100000;
  display: flex;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
  box-shadow: 2px 2px 0 1px rgba(0, 0, 0, 0.4);
  background: ${({ theme }) => theme.material};
`;

const Banner = styled.div`
  width: 34px;
  flex-shrink: 0;
  background: ${({ theme }) => {
    const bg = theme.headerBackground as string;
    if (bg.includes("gradient")) {
      return bg.replace("to right", "to bottom");
    }
    return `linear-gradient(180deg, color-mix(in srgb, ${bg} 55%, #000) 0%, ${bg} 60%, color-mix(in srgb, ${bg} 70%, #fff) 100%)`;
  }};
  position: relative;
  overflow: hidden;
`;

const BannerLabel = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
  color: ${({ theme }) => theme.headerText};
  font-weight: bold;
  font-size: 19px;
  letter-spacing: 0.5px;
  padding: 10px 0;
`;

/**
 * The actual content of the Start Menu — split into its own component so that
 * `useStartMenuTree` (which subscribes to VFS) is ONLY active when the menu is
 * open. When closed, this component is unmounted and no VFS subscriptions exist
 * for the menu tree, eliminating spurious re-renders.
 */
function StartMenuPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tree = useStartMenuTree();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        const startButton = document.getElementById("start-button");
        if (startButton?.contains(target)) return;
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <Positioned ref={ref} id="start-menu-root">
      <Banner>
        <BannerLabel>RSNRA</BannerLabel>
      </Banner>
      <MenuTree nodes={tree} />
    </Positioned>
  );
}

export function StartMenu() {
  const open = useWindowStore((s) => s.startMenuOpen);
  const setOpen = useWindowStore((s) => s.setStartMenuOpen);

  if (!open) return null;

  // StartMenuPanel is only mounted when open=true, so useStartMenuTree's
  // VFS subscription only exists while the menu is actually visible.
  return <StartMenuPanel onClose={() => setOpen(false)} />;
}
