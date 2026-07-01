import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

const Menu = styled.div<{ $visible: boolean }>`
  position: fixed;
  z-index: 999999;
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
  padding: 2px;
  min-width: 160px;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.4);
  font-size: 12px;
`;

export const CtxItem = styled.button<{ $disabled?: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 20px;
  font-size: 12px;
  background: transparent;
  border: 0;
  white-space: nowrap;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  color: ${({ $disabled, theme }) =>
    $disabled ? theme.materialTextDisabled : theme.materialText};
  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? 'transparent' : theme.hoverBackground};
    color: ${({ $disabled, theme }) =>
      $disabled ? theme.materialTextDisabled : theme.headerText};
  }
`;

export const CtxDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [visible, setVisible] = useState(false);

  // After first render we know the actual size — flip if it overflows the viewport
  useLayoutEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      left: x + width > vw ? Math.max(0, x - width) : x,
      top: y + height > vh ? Math.max(0, y - height) : y,
    });
    setVisible(true);
  }, [x, y]);

  // Close on any mousedown outside the menu (capture phase so it fires first)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  // Render into document.body via portal so that CSS transform on ancestor
  // Rnd containers doesn't break position: fixed positioning
  return createPortal(
    <Menu
      ref={ref}
      $visible={visible}
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </Menu>,
    document.body,
  );
}
