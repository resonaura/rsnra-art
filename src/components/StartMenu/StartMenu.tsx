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
  background: linear-gradient(180deg, #1a0b3d 0%, #4a1d7a 55%, #8a2f8f 100%);
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
  color: #f4f1ff;
  font-weight: bold;
  font-size: 19px;
  letter-spacing: 0.5px;
  padding: 10px 0;
`;

export function StartMenu() {
  const open = useWindowStore((s) => s.startMenuOpen);
  const setOpen = useWindowStore((s) => s.setStartMenuOpen);
  const ref = useRef<HTMLDivElement>(null);
  const tree = useStartMenuTree();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        const startButton = document.getElementById("start-button");
        if (startButton?.contains(target)) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <Positioned ref={ref} id="start-menu-root">
      <Banner>
        <BannerLabel>
          RSNRA<span style={{ fontWeight: "normal", fontSize: 13 }}>95</span>
        </BannerLabel>
      </Banner>
      <MenuTree nodes={tree} />
    </Positioned>
  );
}
