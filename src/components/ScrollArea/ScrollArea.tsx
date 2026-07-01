/**
 * ScrollArea — a fully TSX-rendered Windows 95 style scrollbar.
 *
 * Instead of styling native scrollbars via CSS pseudo-elements
 * (::-webkit-scrollbar), this component hides the native scrollbar
 * and renders custom track + thumb + arrow buttons as real DOM
 * elements that drive the viewport's scrollTop/scrollLeft.
 *
 * Variants are selected via the `orientation` prop:
 *   "both"       – vertical + horizontal (default)
 *   "vertical"   – vertical only
 *   "horizontal" – horizontal only
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styled, { css } from "styled-components";

// ── constants ────────────────────────────────────────────────────────────────

export const SB_SIZE = 16; // scrollbar width / height (px)
export const MIN_THUMB = 16; // minimum thumb size (px)
const LINE_STEP = 16; // pixels scrolled per arrow-button click
export const PAGE_FACTOR = 0.9; // fraction of viewport per track-page click
const REPEAT_DELAY = 400; // ms before auto-repeat kicks in
const REPEAT_INTERVAL = 60; // ms between repeated scrolls

/**
 * 1×1 checkerboard pattern used on the scrollbar track — identical to the
 * pattern previously defined in main.css.
 */
const TRACK_BG =
  'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgLTAuNSAyIDIiIHNoYXBlLXJlbmRlcmluZz0iY3Jpc3BFZGdlcyI+CjxtZXRhZGF0YT5NYWRlIHdpdGggUGl4ZWxzIHRvIFN2ZyBodHRwczovL2NvZGVwZW4uaW8vc2hzaGF3L3Blbi9YYnh2Tmo8L21ldGFkYXRhPgo8cGF0aCBzdHJva2U9IiNjMGMwYzAiIGQ9Ik0wIDBoMU0xIDFoMSIgLz4KPC9zdmc+")';

// ── arrow glyphs (pixel-art SVGs, same paths as the old CSS data-URIs) ───────

export function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
      <path
        stroke="#000"
        strokeWidth="1"
        d="M7 5h1M6 6h3M5 7h5M4 8h7"
        fill="none"
      />
    </svg>
  );
}
export function ArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
      <path
        stroke="#000"
        strokeWidth="1"
        d="M4 5h7M5 6h5M6 7h3M7 8h1"
        fill="none"
      />
    </svg>
  );
}
function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
      <path
        stroke="#000"
        strokeWidth="1"
        d="M8 3h1M7 4h2M6 5h3M5 6h4M6 7h3M7 8h2M8 9h1"
        fill="none"
      />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
      <path
        stroke="#000"
        strokeWidth="1"
        d="M6 3h1M6 4h2M6 5h3M6 6h4M6 7h3M6 8h2M6 9h1"
        fill="none"
      />
    </svg>
  );
}

// ── styled parts ─────────────────────────────────────────────────────────────

/**
 * Raised 3D border — the classic Win95 button / thumb look.
 */
export const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
  box-shadow:
    inset 1px 1px ${({ theme }) => theme.borderLight},
    inset -1px -1px ${({ theme }) => theme.borderDark};
`;

/**
 * Sunken 3D border — used while a button is being pressed.
 */
const sunken = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  box-shadow: inset 1px 1px ${({ theme }) => theme.borderDark};
`;

const Root = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`;

/** The actual scroll viewport — native scrollbar is hidden via CSS. */
const Viewport = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: scroll;
  display: flex;
  flex-direction: column;
  /* Hide native scrollbar in every engine without reserving space */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE / Edge */
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
`;

const MainRow = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

export const ScrollBtn = styled.button<{ $active?: boolean }>`
  ${raised}
  background: ${({ theme }) => theme.material};
  width: ${SB_SIZE}px;
  height: ${SB_SIZE}px;
  padding: 0;
  margin: 0;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  outline: none;

  ${({ $active }) => $active && sunken}

  &:active {
    ${sunken}
  }

  svg {
    pointer-events: none;
    flex-shrink: 0;
  }
`;

export const Track = styled.div`
  flex: 1;
  background-image: ${TRACK_BG};
  background-size: 2px;
  background-repeat: repeat;
  position: relative;
  overflow: hidden;
`;

export const Thumb = styled.div`
  ${raised}
  background: ${({ theme }) => theme.material};
  position: absolute;
  cursor: default;
  touch-action: none;
`;

const Corner = styled.div`
  width: ${SB_SIZE}px;
  height: ${SB_SIZE}px;
  flex-shrink: 0;
  background: ${({ theme }) => theme.material};
`;

const BottomRow = styled.div`
  display: flex;
  height: ${SB_SIZE}px;
  flex-shrink: 0;
`;

export const VerticalBar = styled.div`
  width: ${SB_SIZE}px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
`;

const HorizontalBar = styled.div`
  display: flex;
  flex: 1;
`;

/** Content wrapper — fills the viewport (flex: 1 1 auto) and prevents children
 * from shrinking (flex-shrink: 0). This gives a definite height so that
 * `height: 100%` on children resolves to the viewport height, while still
 * allowing content to overflow and trigger viewport scrolling.
 *
 * `flex-basis: auto` ensures the wrapper takes its natural size when the root
 * has `height: auto` (e.g. `max-height` cases like CloseProgramDialog). */
const Content = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  & > * {
    flex-shrink: 0;
  }
`;

// ── repeat-scroll hook ───────────────────────────────────────────────────────

/**
 * Provides press-and-hold auto-repeat for the arrow buttons.
 * Calls `fn` once immediately, then repeats after a short delay.
 */
export function useRepeatScroll() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const begin = useCallback((fn: () => void) => {
    fn();
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(fn, REPEAT_INTERVAL);
    }, REPEAT_DELAY);
  }, []);

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => end, [end]);

  return { begin, end };
}

// ── types ────────────────────────────────────────────────────────────────────

export type ScrollOrientation = "both" | "vertical" | "horizontal";

export interface ScrollAreaProps {
  /** Which scrollbars to render. Defaults to "both". */
  orientation?: ScrollOrientation;
  /** className applied to the root container (borders, background, sizing…). */
  className?: string;
  /** Inline style for the root container. */
  style?: CSSProperties;
  /** className for the inner content wrapper (padding, display, flex…). */
  contentClassName?: string;
  /** Inline style for the inner content wrapper. */
  contentStyle?: CSSProperties;
  /** Forwarded to the root container. */
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  /** Forwarded to the root container. */
  onClick?: MouseEventHandler<HTMLDivElement>;
  /** Forwarded to the root container. */
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  /** Forwarded to the root container. */
  onDragOver?: DragEventHandler<HTMLDivElement>;
  /** Forwarded to the root container. */
  onDrop?: DragEventHandler<HTMLDivElement>;
  children: ReactNode;
}

// ── component ────────────────────────────────────────────────────────────────

interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
}

const INITIAL_STATE: ScrollState = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollHeight: 0,
  scrollWidth: 0,
  clientHeight: 0,
  clientWidth: 0,
};

export function ScrollArea({
  orientation = "both",
  className,
  style,
  contentClassName,
  contentStyle,
  onMouseDown,
  onClick,
  onContextMenu,
  onDragOver,
  onDrop,
  children,
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ScrollState>(INITIAL_STATE);

  const repeat = useRepeatScroll();

  // ── sync helpers ───────────────────────────────────────────────────────────

  /** Read all scroll dimensions from the viewport element. */
  const sync = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    setState((prev) => {
      const next = {
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        scrollHeight: el.scrollHeight,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        clientWidth: el.clientWidth,
      };
      // Skip state update if nothing changed — avoids needless re-renders.
      if (
        prev.scrollTop === next.scrollTop &&
        prev.scrollLeft === next.scrollLeft &&
        prev.scrollHeight === next.scrollHeight &&
        prev.scrollWidth === next.scrollWidth &&
        prev.clientHeight === next.clientHeight &&
        prev.clientWidth === next.clientWidth
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  // Update on scroll
  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    setState((s) => {
      if (s.scrollTop === el.scrollTop && s.scrollLeft === el.scrollLeft)
        return s;
      return { ...s, scrollTop: el.scrollTop, scrollLeft: el.scrollLeft };
    });
  }, []);

  // Observe size changes on viewport + content
  useEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const ro = new ResizeObserver(() => sync());
    ro.observe(vp);
    ro.observe(ct);
    sync();
    return () => ro.disconnect();
  }, [sync]);

  // Re-sync when children change (new content may change scroll dimensions)
  useEffect(() => {
    sync();
  });

  // ── derived values ─────────────────────────────────────────────────────────

  const allowVertical = orientation !== "horizontal";
  const allowHorizontal = orientation !== "vertical";

  const showVertical =
    allowVertical && state.scrollHeight > state.clientHeight + 1;
  const showHorizontal =
    allowHorizontal && state.scrollWidth > state.clientWidth + 1;

  // Track inner sizes (between the two arrow buttons)
  const vTrack = Math.max(0, state.clientHeight - 2 * SB_SIZE);
  const hTrack = Math.max(0, state.clientWidth - 2 * SB_SIZE);

  // Vertical thumb
  const vScrollRange = state.scrollHeight - state.clientHeight;
  const vThumb =
    vScrollRange > 0
      ? Math.max(MIN_THUMB, (state.clientHeight / state.scrollHeight) * vTrack)
      : vTrack;
  const vThumbTop =
    vScrollRange > 0 ? (state.scrollTop / vScrollRange) * (vTrack - vThumb) : 0;

  // Horizontal thumb
  const hScrollRange = state.scrollWidth - state.clientWidth;
  const hThumb =
    hScrollRange > 0
      ? Math.max(MIN_THUMB, (state.clientWidth / state.scrollWidth) * hTrack)
      : hTrack;
  const hThumbLeft =
    hScrollRange > 0
      ? (state.scrollLeft / hScrollRange) * (hTrack - hThumb)
      : 0;

  // ── scroll actions ─────────────────────────────────────────────────────────

  const scrollBy = useCallback((dx: number, dy: number) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollBy(dx, dy);
  }, []);

  // ── thumb drag (vertical) ──────────────────────────────────────────────────

  const vDragRef = useRef<{ startY: number; startScroll: number } | null>(null);

  const onVThumbPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = viewportRef.current;
      if (!el || vScrollRange <= 0) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      vDragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    },
    [vScrollRange],
  );

  const onVThumbPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!vDragRef.current) return;
      const el = viewportRef.current;
      if (!el) return;
      const pixelDelta = e.clientY - vDragRef.current.startY;
      const trackRange = vTrack - vThumb;
      if (trackRange <= 0) return;
      const scrollDelta = pixelDelta * (vScrollRange / trackRange);
      el.scrollTop = vDragRef.current.startScroll + scrollDelta;
    },
    [vTrack, vThumb, vScrollRange],
  );

  const onVThumbPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (vDragRef.current) vDragRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [],
  );

  // ── thumb drag (horizontal) ────────────────────────────────────────────────

  const hDragRef = useRef<{ startX: number; startScroll: number } | null>(null);

  const onHThumbPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = viewportRef.current;
      if (!el || hScrollRange <= 0) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      hDragRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
    },
    [hScrollRange],
  );

  const onHThumbPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!hDragRef.current) return;
      const el = viewportRef.current;
      if (!el) return;
      const pixelDelta = e.clientX - hDragRef.current.startX;
      const trackRange = hTrack - hThumb;
      if (trackRange <= 0) return;
      const scrollDelta = pixelDelta * (hScrollRange / trackRange);
      el.scrollLeft = hDragRef.current.startScroll + scrollDelta;
    },
    [hTrack, hThumb, hScrollRange],
  );

  const onHThumbPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (hDragRef.current) hDragRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [],
  );

  // ── track click (page up / down) ───────────────────────────────────────────

  const onVTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return; // clicked on thumb, not track
      const el = viewportRef.current;
      if (!el) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const thumbCenter = vThumbTop + vThumb / 2;
      const page = state.clientHeight * PAGE_FACTOR;
      const fn =
        clickY < thumbCenter
          ? () => scrollBy(0, -page)
          : () => scrollBy(0, page);
      repeat.begin(fn);
    },
    [vThumbTop, vThumb, state.clientHeight, scrollBy, repeat],
  );

  const onHTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const el = viewportRef.current;
      if (!el) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const thumbCenter = hThumbLeft + hThumb / 2;
      const page = state.clientWidth * PAGE_FACTOR;
      const fn =
        clickX < thumbCenter
          ? () => scrollBy(-page, 0)
          : () => scrollBy(page, 0);
      repeat.begin(fn);
    },
    [hThumbLeft, hThumb, state.clientWidth, scrollBy, repeat],
  );

  // ── arrow buttons ──────────────────────────────────────────────────────────

  const onUpPress = useCallback(
    () => repeat.begin(() => scrollBy(0, -LINE_STEP)),
    [repeat, scrollBy],
  );
  const onDownPress = useCallback(
    () => repeat.begin(() => scrollBy(0, LINE_STEP)),
    [repeat, scrollBy],
  );
  const onLeftPress = useCallback(
    () => repeat.begin(() => scrollBy(-LINE_STEP, 0)),
    [repeat, scrollBy],
  );
  const onRightPress = useCallback(
    () => repeat.begin(() => scrollBy(LINE_STEP, 0)),
    [repeat, scrollBy],
  );

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Root
      className={className}
      style={style}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <MainRow>
        <Viewport ref={viewportRef} onScroll={handleScroll}>
          <Content
            ref={contentRef}
            className={contentClassName}
            style={contentStyle}
          >
            {children}
          </Content>
        </Viewport>
        {showVertical && (
          <VerticalBar>
            <ScrollBtn
              onPointerDown={onUpPress}
              onPointerUp={repeat.end}
              onPointerLeave={repeat.end}
            >
              <ArrowUp />
            </ScrollBtn>
            <Track
              onPointerDown={onVTrackPointerDown}
              onPointerUp={repeat.end}
              onPointerLeave={repeat.end}
            >
              <Thumb
                style={{ height: vThumb, top: vThumbTop, left: 0, right: 0 }}
                onPointerDown={onVThumbPointerDown}
                onPointerMove={onVThumbPointerMove}
                onPointerUp={onVThumbPointerUp}
              />
            </Track>
            <ScrollBtn
              onPointerDown={onDownPress}
              onPointerUp={repeat.end}
              onPointerLeave={repeat.end}
            >
              <ArrowDown />
            </ScrollBtn>
          </VerticalBar>
        )}
      </MainRow>
      {showHorizontal && (
        <BottomRow>
          <HorizontalBar>
            <ScrollBtn
              onPointerDown={onLeftPress}
              onPointerUp={repeat.end}
              onPointerLeave={repeat.end}
            >
              <ArrowLeft />
            </ScrollBtn>
            <Track
              onPointerDown={onHTrackPointerDown}
              onPointerUp={repeat.end}
              onPointerLeave={repeat.end}
            >
              <Thumb
                style={{ width: hThumb, left: hThumbLeft, top: 0, bottom: 0 }}
                onPointerDown={onHThumbPointerDown}
                onPointerMove={onHThumbPointerMove}
                onPointerUp={onHThumbPointerUp}
              />
            </Track>
            <ScrollBtn
              onPointerDown={onRightPress}
              onPointerUp={repeat.end}
              onPointerLeave={repeat.end}
            >
              <ArrowRight />
            </ScrollBtn>
          </HorizontalBar>
          {showVertical && <Corner />}
        </BottomRow>
      )}
    </Root>
  );
}
