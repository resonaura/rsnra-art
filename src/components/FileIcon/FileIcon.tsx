import { useEffect, useRef, useState } from "react";
import { iconForNode } from "../../data/fileIcons";
import { parseAni } from "../../lib/aniParser";
import { parseCur } from "../../lib/curParser";
import { type VfsNode } from "../../store/vfsStore";
import { useCursorStore } from "../../store/cursorStore";
import { Icon } from "../Icon/Icon";

export function isCursorFile(node: VfsNode): boolean {
  if (node.type !== "file") return false;
  const lower = node.name.toLowerCase();
  return lower.endsWith(".cur") || lower.endsWith(".ani");
}

interface FileIconProps {
  node: VfsNode;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function FileIcon({ node, size = 32, style, className }: FileIconProps) {
  const shadowEnabled = useCursorStore((s) => s.shadowEnabled);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isCursorFile(node)) {
      setFrameUrl(null);
      return;
    }

    const isDataUri = node.content && node.content.startsWith("data:");
    const filename = node.name.toLowerCase();
    let active = true;

    const run = async () => {
      try {
        let buf: ArrayBuffer;
        if (isDataUri) {
          const res = await fetch(node.content!);
          buf = await res.arrayBuffer();
        } else {
          const res = await fetch(`/cursors/${node.name}`);
          if (!res.ok) return;
          buf = await res.arrayBuffer();
        }
        if (!active) return;

        if (filename.endsWith(".ani")) {
          const parsed = await parseAni(buf);
          if (!active) return;
          const urls = await Promise.all(
            parsed.frames.map(async (b, idx) => {
              const frameBuf = await b.arrayBuffer();
              const frameParsed = await parseCur(frameBuf, `${node.name}_frame_${idx}.cur`, shadowEnabled);
              return frameParsed.blobUrl;
            })
          );
          let step = 0;
          let timerId: any;
          const tick = () => {
            if (!active) return;
            const fi = parsed.seq ? parsed.seq[step] : step;
            if (fi >= 0 && fi < urls.length) setFrameUrl(urls[fi]);
            const dur = parsed.rate[step] || 100;
            step = (step + 1) % (parsed.seq ? parsed.seq.length : urls.length);
            timerId = setTimeout(tick, dur);
          };
          tick();
          cleanupRef.current = () => {
            active = false;
            clearTimeout(timerId);
            urls.forEach((u) => {
              if (u.startsWith("blob:")) URL.revokeObjectURL(u);
            });
          };
        } else if (filename.endsWith(".cur")) {
          const parsed = await parseCur(buf, node.name, shadowEnabled);
          if (!active) return;
          setFrameUrl(parsed.blobUrl);
          cleanupRef.current = () => {
            active = false;
            if (parsed.blobUrl.startsWith("blob:")) URL.revokeObjectURL(parsed.blobUrl);
          };
        }
      } catch (e) {
        console.error("FileIcon cursor preview error:", e);
      }
    };

    run();
    return () => {
      active = false;
      cleanupRef.current?.();
    };
  }, [node, shadowEnabled]);

  const defaultIcon = (node as any).icon || iconForNode(node);

  if (!isCursorFile(node) || !frameUrl) {
    return (
      <Icon
        src={defaultIcon}
        size={size}
        draggable={false}
        style={style}
        className={className}
      />
    );
  }

  return (
    <img
      src={frameUrl}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated", objectFit: "contain", ...style }}
      className={className}
    />
  );
}
