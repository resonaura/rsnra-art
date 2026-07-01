import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  MIN_THUMB,
  PAGE_FACTOR,
  SB_SIZE,
  ScrollBtn,
  Thumb,
  Track,
  VerticalBar,
  useRepeatScroll,
} from "../../components/ScrollArea";

/**
 * A Win95-style vertical scrollbar for the xterm.js terminal.
 *
 * xterm manages its own scroll position internally (line-based, not pixel
 * DOM scrolling), so this can't reuse <ScrollArea> as-is — instead it's a
 * controlled scrollbar: the caller supplies the current line position
 * (scrollTop), total buffer length (scrollHeight) and visible rows
 * (clientHeight), all in "line" units, and receives step/absolute scroll
 * requests to forward to `term.scrollLines` / `term.scrollToLine`.
 */
export interface TerminalScrollbarProps {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  onScrollTo: (line: number) => void;
  onStep: (deltaLines: number) => void;
}

export function TerminalScrollbar({
  scrollTop,
  scrollHeight,
  clientHeight,
  onScrollTo,
  onStep,
}: TerminalScrollbarProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [trackPx, setTrackPx] = useState(0);
  const repeat = useRepeatScroll();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackPx(el.clientHeight));
    ro.observe(el);
    setTrackPx(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const scrollRange = Math.max(0, scrollHeight - clientHeight);
  const vTrack = Math.max(0, trackPx - 2 * SB_SIZE);
  const vThumb =
    scrollRange > 0
      ? Math.max(MIN_THUMB, (clientHeight / scrollHeight) * vTrack)
      : vTrack;
  const vThumbTop =
    scrollRange > 0 ? (scrollTop / scrollRange) * (vTrack - vThumb) : 0;

  const dragRef = useRef<{ startY: number; startScroll: number } | null>(
    null,
  );

  const onThumbPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (scrollRange <= 0) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startScroll: scrollTop };
    },
    [scrollRange, scrollTop],
  );

  const onThumbPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const pixelDelta = e.clientY - dragRef.current.startY;
      const trackRange = vTrack - vThumb;
      if (trackRange <= 0) return;
      const delta = pixelDelta * (scrollRange / trackRange);
      onScrollTo(Math.round(dragRef.current.startScroll + delta));
    },
    [vTrack, vThumb, scrollRange, onScrollTo],
  );

  const onThumbPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [],
  );

  const onTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return; // clicked the thumb, not the track
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const thumbCenter = vThumbTop + vThumb / 2;
      const page = Math.max(1, Math.round(clientHeight * PAGE_FACTOR));
      const fn = clickY < thumbCenter ? () => onStep(-page) : () => onStep(page);
      repeat.begin(fn);
    },
    [vThumbTop, vThumb, clientHeight, onStep, repeat],
  );

  const onUpPress = useCallback(
    () => repeat.begin(() => onStep(-1)),
    [repeat, onStep],
  );
  const onDownPress = useCallback(
    () => repeat.begin(() => onStep(1)),
    [repeat, onStep],
  );

  // Always render the same <VerticalBar> as the ResizeObserver's target —
  // swapping it out for a plain <div> (or vice versa) when scrollRange
  // crosses zero would leave the one-time observer watching a now-detached
  // node, freezing trackPx (and therefore the thumb size/position) forever.
  const visible = scrollRange > 0;

  return (
    <VerticalBar ref={wrapRef} style={visible ? undefined : { width: 0 }}>
      {visible && (
        <>
          <ScrollBtn
            onPointerDown={onUpPress}
            onPointerUp={repeat.end}
            onPointerLeave={repeat.end}
          >
            <ArrowUp />
          </ScrollBtn>
          <Track
            onPointerDown={onTrackPointerDown}
            onPointerUp={repeat.end}
            onPointerLeave={repeat.end}
          >
            <Thumb
              style={{ height: vThumb, top: vThumbTop, left: 0, right: 0 }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
            />
          </Track>
          <ScrollBtn
            onPointerDown={onDownPress}
            onPointerUp={repeat.end}
            onPointerLeave={repeat.end}
          >
            <ArrowDown />
          </ScrollBtn>
        </>
      )}
    </VerticalBar>
  );
}
