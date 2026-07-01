import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from "react";
import styled, { css } from "styled-components";

// A Win95-styled slider, visually modeled on react95's <Slider> (sunken groove
// + raised 3D thumb) but self-contained. react95's Slider calls findDOMNode
// internally (removed in React 19 → "findDOMNode is not a function"), so we
// reimplement the same look with clean pointer/keyboard logic and no
// findDOMNode dependency. Drop-in for the horizontal volume case.

const Wrapper = styled.div<{ $disabled?: boolean }>`
  display: inline-block;
  position: relative;
  touch-action: none;
  pointer-events: ${({ $disabled }) => ($disabled ? "none" : "auto")};
`;

// Sunken groove: dark top-left, light bottom-right (a "field" well).
const Groove = styled.div`
  position: relative;
  height: 8px;
  width: 100%;
  background: ${({ theme }) => theme.canvas};
  border: 2px solid;
  border-left-color: ${({ theme }) => theme.borderDark};
  border-top-color: ${({ theme }) => theme.borderDark};
  border-right-color: ${({ theme }) => theme.borderLightest};
  border-bottom-color: ${({ theme }) => theme.borderLightest};
  box-shadow:
    inset 1px 1px 0 1px ${({ theme }) => theme.borderDarkest},
    inset -1px -1px 0 1px ${({ theme }) => theme.borderLight};
`;

// Raised thumb: light top-left, dark bottom-right (a "window" raised button),
// matching react95's createBorderStyles({ style: "window" }).
const Thumb = styled.span<{ $focused?: boolean; $disabled?: boolean }>`
  position: absolute;
  top: 50%;
  width: 18px;
  height: 32px;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-left-color: ${({ theme }) => theme.borderLight};
  border-top-color: ${({ theme }) => theme.borderLight};
  border-right-color: ${({ theme }) => theme.borderDarkest};
  border-bottom-color: ${({ theme }) => theme.borderDarkest};
  box-shadow:
    inset 1px 1px 0 1px ${({ theme }) => theme.borderLightest},
    inset -1px -1px 0 1px ${({ theme }) => theme.borderDark};
  ${({ $focused, theme }) =>
    $focused &&
    css`
      outline: 2px dotted ${theme.materialText};
      outline-offset: -2px;
    `}
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
`;

export interface Slider95Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  /** CSS width of the slider, e.g. "100%" or "180px". */
  size?: string | number;
  name?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function roundToStep(v: number, step: number, min: number): number {
  if (!step) return v;
  return Math.round((v - min) / step) * step + min;
}

export function Slider95({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  size = "100%",
  name,
}: Slider95Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);
  const [focused, setFocused] = useState(false);

  const pct = ((clamp(value, min, max) - min) / (max - min)) * 100;

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return clamp(roundToStep(min + ratio * (max - min), step, min), min, max);
    },
    [max, min, step, value],
  );

  const onPointerDown = (e: RPointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    draggingRef.current = true;
    thumbRef.current?.focus();
    setFocused(true);
    onChange?.(valueFromPointer(e.clientX));
  };

  useEffect(() => {
    if (disabled) return;
    const move = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      onChange?.(valueFromPointer(e.clientX));
    };
    const up = () => {
      draggingRef.current = false;
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
  }, [disabled, onChange, valueFromPointer]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    let next = value;
    const big = (max - min) / 10;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = value + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = value - step;
        break;
      case "PageUp":
        next = value + big;
        break;
      case "PageDown":
        next = value - big;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange?.(clamp(roundToStep(next, step, min), min, max));
  };

  return (
    <Wrapper
      $disabled={disabled}
      style={{ width: typeof size === "number" ? `${size}px` : size }}
      onPointerDown={onPointerDown}
    >
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <Groove ref={trackRef}>
        <Thumb
          ref={thumbRef}
          $focused={focused}
          $disabled={disabled}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          style={{ left: `${pct}%` }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
      </Groove>
    </Wrapper>
  );
}
