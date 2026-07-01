import { memo } from "react";
import { Rnd } from "react-rnd";
import { Button, Window, WindowHeader } from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";
import { TASKBAR_HEIGHT } from "../../constants";
import { APPS } from "../../data/apps";
import { useWindowStore } from "../../store/windowStore";
import type { WindowInstance } from "../../types/window";
import {
  CloseGlyph,
  MaximizeGlyph,
  MinimizeGlyph,
  RestoreGlyph,
} from "./windowGlyphs";

const StyledHeader = styled(WindowHeader)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: default;
  user-select: none;
  touch-action: none;
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 8px;
`;

const GlyphButton = styled(Button)`
  zoom: 0.8;
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.materialText};
`;

const Body = styled(ScrollArea)`
  height: 100%;
  width: 100%;
`;

interface AppWindowProps {
  win: WindowInstance;
}

export const AppWindow = memo(function AppWindow({ win }: AppWindowProps) {
  const updateBounds = useWindowStore((s) => s.updateBounds);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const closeWindow = useWindowStore((s) => s.closeWindow);

  const def = APPS[win.appId];
  const AppComponent = def.component;

  const maxWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const maxHeight =
    (typeof window !== "undefined" ? window.innerHeight : 800) - TASKBAR_HEIGHT;

  const bounds = win.isMaximized
    ? { x: 0, y: 0, width: maxWidth, height: maxHeight }
    : win.bounds;

  return (
    <Rnd
      style={{ zIndex: win.zIndex, position: "absolute" }}
      size={{ width: bounds.width, height: bounds.height }}
      position={{ x: bounds.x, y: bounds.y }}
      minWidth={def.minWidth ?? 280}
      minHeight={def.minHeight ?? 180}
      bounds="window"
      disableDragging={win.isMaximized}
      enableResizing={
        !win.isMaximized && win.resizable
          ? {
              bottom: true,
              right: true,
              bottomRight: true,
              left: true,
              top: false,
              topLeft: false,
              topRight: false,
              bottomLeft: true,
            }
          : false
      }
      dragHandleClassName="window-drag-handle"
      onMouseDown={() => focusWindow(win.id)}
      onDragStop={(_e, d) => updateBounds(win.id, { x: d.x, y: d.y })}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        updateBounds(win.id, {
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
          x: pos.x,
          y: pos.y,
        });
      }}
    >
      <Window
        shadow
        resizable={false}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <StyledHeader
          active={win.isFocused}
          className="window-drag-handle"
          onDoubleClick={() =>
            def.resizable !== false && toggleMaximize(win.id)
          }
          style={{
            height: "30px",
          }}
        >
          <HeaderTitle style={{ fontSize: "12px" }}>
            <img src={win.icon} alt="" draggable={false} />
            <span>{win.title}</span>
          </HeaderTitle>
          <HeaderButtons>
            <GlyphButton
              onClick={(e) => {
                e.stopPropagation();
                minimizeWindow(win.id);
              }}
              aria-label="Minimize"
            >
              <MinimizeGlyph />
            </GlyphButton>
            {def.resizable !== false && (
              <GlyphButton
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMaximize(win.id);
                }}
                aria-label="Maximize"
              >
                {win.isMaximized ? <RestoreGlyph /> : <MaximizeGlyph />}
              </GlyphButton>
            )}
            <GlyphButton
              onClick={(e) => {
                e.stopPropagation();
                closeWindow(win.id);
              }}
              aria-label="Close"
            >
              <CloseGlyph />
            </GlyphButton>
          </HeaderButtons>
        </StyledHeader>
        <Body
          contentStyle={{
            padding: def.noPadding ? 0 : 12,
            display: "flex",
            flexDirection: "column",
          }}
          onMouseDown={() => focusWindow(win.id)}
        >
          <AppComponent windowId={win.id} />
        </Body>
      </Window>
    </Rnd>
  );
});
