import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button, Window, WindowHeader } from "react95";
import styled from "styled-components";
import { R95_SCALE } from "../../react95.conf";
import { CloseGlyph } from "../WindowManager/windowGlyphs";

const Backdrop = styled.div<{ $zIndex: number; $placement: "center" | "top-left" }>`
  position: fixed;
  inset: 0;
  z-index: ${({ $zIndex }) => $zIndex};
  display: flex;
  align-items: ${({ $placement }) => ($placement === "top-left" ? "flex-start" : "center")};
  justify-content: ${({ $placement }) => ($placement === "top-left" ? "flex-start" : "center")};
  padding: ${({ $placement }) => ($placement === "top-left" ? "16px" : "0")};
`;

// Sits outside the zoomed DialogWindow so drag deltas (raw screen pixels)
// can be applied 1:1 with no R95_SCALE compensation math.
const DragPositioner = styled.div`
  display: flex;
`;

const DialogWindow = styled(Window)`
  zoom: ${R95_SCALE};
`;

const StyledHeader = styled(WindowHeader)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: default;
  user-select: none;
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 2px;
  flex-shrink: 0;
`;

const HeaderButton = styled(Button)`
  padding: 0 !important;
  min-width: 0;
  width: 16px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: bold;
  color: ${({ theme }) => theme.materialText};
`;

export interface SystemDialogProps {
  title: string;
  width?: number;
  /** Called on Escape, backdrop click, and (if `closable`) the header close button. */
  onClose?: () => void;
  /**
   * Shows a header close (X) button. Leave this `false` for error/warning
   * dialogs the user must dismiss via an explicit button (OK/Yes/No/Cancel).
   */
  closable?: boolean;
  /** Shows a "?" context-help button in the header, next to the close button. */
  onHelp?: () => void;
  /** Alert/warning-style dialogs render above regular utility dialogs. */
  zIndex?: number;
  /** Starting offset from screen-center, in CSS px — lets a stack of several
   *  dialogs cascade instead of landing exactly on top of each other. */
  initialOffset?: { x: number; y: number };
  /** Where the dialog lands: screen center (default) or the top-left corner
   *  (Windows' monitor-settings confirmation lives there). */
  placement?: "center" | "top-left";
  children: ReactNode;
}

/** Active Display Properties ▸ Screen area zoom on <body>; drag deltas arrive
 *  in unzoomed viewport px but the dialog moves in zoomed coordinates. */
function bodyZoom(): number {
  const z = parseFloat(document.body.style.zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/**
 * Every dialog in the system renders through here: portaled straight to
 * `document.body` so it always lands at a fresh zoom:1 context regardless of
 * which app's (already-zoomed) DOM subtree it was invoked from, then applies
 * the one R95_SCALE zoom itself. That's what lets every call site drop the
 * old isInReact95 / manual zoom-compensation dance. Also draggable by its
 * title bar, like every other window in the system.
 */
export function SystemDialog({
  title,
  width = 400,
  onClose,
  closable = true,
  onHelp,
  zIndex = 500000,
  initialOffset,
  placement = "center",
  children,
}: SystemDialogProps) {
  const [offset, setOffset] = useState(initialOffset ?? { x: 0, y: 0 });
  const drag = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!drag.current) return;
      const z = bodyZoom();
      setOffset({
        x: drag.current.baseX + (e.clientX - drag.current.startX) / z,
        y: drag.current.baseY + (e.clientY - drag.current.startY) / z,
      });
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e: ReactMouseEvent) => {
    e.stopPropagation();
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  };

  return createPortal(
    <Backdrop $zIndex={zIndex} $placement={placement} onMouseDown={onClose}>
      <DragPositioner style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <DialogWindow
          shadow={false}
          style={{ width }}
          onMouseDown={(e: ReactMouseEvent) => e.stopPropagation()}
        >
          <StyledHeader active onMouseDown={startDrag}>
            <span>{title}</span>
            <HeaderButtons>
              {onHelp && (
                <HeaderButton onClick={onHelp} aria-label="Help">
                  ?
                </HeaderButton>
              )}
              {closable && onClose && (
                <HeaderButton onClick={onClose} aria-label="Close">
                  <CloseGlyph />
                </HeaderButton>
              )}
            </HeaderButtons>
          </StyledHeader>
          {children}
        </DialogWindow>
      </DragPositioner>
    </Backdrop>,
    document.body,
  );
}
