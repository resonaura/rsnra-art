import { useEffect, useMemo, useState } from "react";
import { getCachedIconUrl, resolveIconUrl } from "../../lib/iconCache";
import { R95_SCALE_COMPENSATION } from "../../react95.conf";

interface IconProps {
  src: string;
  size?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  title?: string;
  isInReact95?: boolean;
}

// Drop-in replacement for <img src="/icons/name.ico" /> that renders the
// real .ico decoded, in-browser, at the frame closest to `size` — see
// src/lib/iconCache.ts. The legacy flat PNG is only ever shown if the .ico
// genuinely doesn't exist; while a real .ico is being fetched/decoded this
// renders nothing (briefly, and only the first time an icon+size is seen —
// resolved icons are cached) rather than guessing with the PNG.
export function Icon({
  src,
  size = 32,
  alt = "",
  className,
  style,
  draggable = false,
  title,
  isInReact95 = false,
}: IconProps) {
  const [resolved, setResolved] = useState(() => getCachedIconUrl(src, size));

  useEffect(() => {
    let active = true;
    const cached = getCachedIconUrl(src, size);
    setResolved(cached);
    if (cached) return;
    resolveIconUrl(src, size).then((url) => {
      if (active) setResolved(url);
    });
    return () => {
      active = false;
    };
  }, [src, size]);

  const renderSize = useMemo(
    () => (isInReact95 ? size * R95_SCALE_COMPENSATION : size),
    [isInReact95, size],
  );

  if (!resolved) {
    return (
      <span
        className={className}
        style={{
          display: "inline-block",
          width: renderSize,
          height: renderSize,
          ...style,
        }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      title={title}
      draggable={draggable}
      className={className}
      style={{
        imageRendering: "pixelated",
        width: renderSize,
        height: renderSize,
        ...style,
      }}
    />
  );
}
