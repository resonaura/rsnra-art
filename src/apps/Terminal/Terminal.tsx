import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useWindowStore } from "../../store/windowStore";
import { Shell } from "./shell";
import { TerminalScrollbar } from "./TerminalScrollbar";

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #000;
`;

const TermRow = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: #000;
`;

const TermContainer = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 4px;
  background: #000;
  overflow: hidden;

  .xterm {
    height: 100%;
    padding: 4px;
  }
  /* xterm.js 6.x draws its own overlay scrollbar (a ported VS Code
   * scrollable-element widget) inside .xterm-scrollable-element — it isn't
   * the browser's native scrollbar, so hiding a native one doesn't touch it.
   * We supply our own Win95 scrollbar via <TerminalScrollbar>, so hide
   * xterm's built-in one to avoid showing both. */
  .xterm-scrollable-element > .scrollbar {
    display: none !important;
  }
  /* .shadow.top/.left render unconditionally (not gated behind
   * .visible/.invisible like .scrollbar is) as a decorative inset shadow
   * meant to sit under xterm's own scrollbar — with that scrollbar hidden
   * it's just a stray sliver in the corner, so hide it too. */
  .xterm-scrollable-element > .shadow {
    display: none !important;
  }
  /* .xterm-viewport no longer does the actual scrolling in xterm 6.x (that
   * moved to .xterm-scrollable-element above), but xterm's base CSS still
   * sets its overflow-y to scroll, which reserves/draws a native browser
   * scrollbar track regardless of content overflow on non-overlay-scrollbar
   * setups (classic Windows/Linux scrollbars, or macOS set to "Always show
   * scroll bars"). Force it off so that empty track doesn't show through. */
  .xterm-viewport {
    overflow-y: hidden !important;
    scrollbar-width: none;
  }
  .xterm-viewport::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
`;

const menus = [
  {
    label: "Edit",
    items: [
      { label: "Mark", disabled: true },
      { label: "Copy\tEnter", disabled: true },
      { label: "Paste", disabled: true },
      { label: "Scroll", disabled: true },
      { label: "", divider: true },
      { label: "Select All", disabled: true },
    ],
  },
  {
    label: "View",
    items: [
      { label: "Font...", disabled: true },
      { label: "", divider: true },
      { label: "Full Screen", disabled: true },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Help Topics", disabled: true },
      { label: "", divider: true },
      { label: 'Type "help" for commands', disabled: true },
    ],
  },
];

interface ScrollState {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

const INITIAL_SCROLL: ScrollState = {
  scrollTop: 0,
  scrollHeight: 0,
  clientHeight: 0,
};

export function TerminalApp({ windowId }: { windowId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellRef = useRef<Shell | null>(null);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const updateTitle = useWindowStore((s) => s.updateTitle);
  const isFocused = useWindowStore(
    (s) => s.windows.find((w) => w.id === windowId)?.isFocused ?? false,
  );
  const [scrollState, setScrollState] = useState<ScrollState>(INITIAL_SCROLL);
  const [bgColor, setBgColor] = useState("#000000");

  const syncScroll = useCallback(() => {
    const term = termRef.current;
    if (!term) return;
    const buf = term.buffer.active;
    setScrollState((prev) => {
      const next: ScrollState = {
        scrollTop: buf.viewportY,
        scrollHeight: buf.length,
        clientHeight: term.rows,
      };
      if (
        prev.scrollTop === next.scrollTop &&
        prev.scrollHeight === next.scrollHeight &&
        prev.clientHeight === next.clientHeight
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const handleScrollTo = useCallback((line: number) => {
    const term = termRef.current;
    if (!term) return;
    const max = Math.max(0, term.buffer.active.length - term.rows);
    term.scrollToLine(Math.min(Math.max(0, Math.round(line)), max));
  }, []);

  const handleStep = useCallback((deltaLines: number) => {
    termRef.current?.scrollLines(Math.round(deltaLines));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: '"VT323", monospace',
      fontSize: 16,
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: true,
      theme: {
        background: "transparent",
        foreground: "#c0c0c0", // Тот самый стандартный светло-серый текст DOS
        cursor: "#ffffff",
        selectionBackground: "#ffffff",

        // Стандартные (затемненные) цвета
        black: "#000000",
        red: "#800000",
        green: "#008000",
        yellow: "#808000", // Коричневый
        blue: "#00000080", // Ошибся в синтаксисе, ниже чистый: "#000080"
        magenta: "#800080",
        cyan: "#008080",
        white: "#c0c0c0", // Обычный белый — это светло-серый

        // Яркие (Bright) цвета — это и есть «чистые» цвета
        brightBlack: "#808080", // Темно-серый
        brightRed: "#ff0000",
        brightGreen: "#00ff00",
        brightYellow: "#ffff00", // Настоящий желтый
        brightBlue: "#0000ff",
        brightMagenta: "#ff00ff",
        brightCyan: "#00ffff",
        brightWhite: "#ffffff",
      },
      scrollback: 1000,
      convertEol: true,
      scrollSensitivity: 1,
      fastScrollSensitivity: 5,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    term.registerLinkProvider({
      provideLinks(y, callback) {
        const line = term.buffer.active.getLine(y - 1);
        if (!line) {
          callback(undefined);
          return;
        }
        const text = line.translateToString(true);
        const regex = /https?:\/\/[^\s"'()<>]+|www\.[^\s"'()<>]+/gi;
        const links: any[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
          const matchedText = match[0];
          const startX = match.index;
          const endX = startX + matchedText.length;
          links.push({
            text: matchedText,
            range: {
              start: { x: startX + 1, y },
              end: { x: endX, y },
            },
            activate(_e: any, text: string) {
              const url = text.toLowerCase().startsWith("www.") ? `https://${text}` : text;
              window.open(url, "_blank", "noopener,noreferrer");
            },
          });
        }
        callback(links);
      },
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const shell = new Shell(term, windowId, closeWindow, updateTitle, (bg) => {
      setBgColor(bg);
    });
    shellRef.current = shell;
    shell.start();

    // Refit when the container resizes — also handles the initial layout
    // where the container might not have its final dimensions yet.
    let fitTimer: ReturnType<typeof setTimeout> | null = null;
    const doFit = () => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        /* not ready */
      }
      syncScroll();
    };
    // Defer initial fits to catch late layout passes
    setTimeout(doFit, 50);
    setTimeout(doFit, 150);
    setTimeout(doFit, 300);
    setTimeout(doFit, 600);
    setTimeout(doFit, 1000);

    // The terminal is measured using the VT323 web font's cell metrics —
    // if that font is still loading at mount time, the initial fit() uses
    // fallback-font metrics and renders with the wrong cell size until
    // something (e.g. a manual resize) forces a refit. Refit once the font
    // has actually loaded to avoid that.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) doFit();
    });

    const disposables = [
      term.onScroll(syncScroll),
      term.onWriteParsed(syncScroll),
    ];

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize events to avoid spamming fit()
      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(doFit, 16);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      if (fitTimer) clearTimeout(fitTimer);
      resizeObserver.disconnect();
      disposables.forEach((d) => d.dispose());
      shell.destroy();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      shellRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus and refit terminal when window gains focus
  useEffect(() => {
    if (isFocused && termRef.current) {
      termRef.current.focus();
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }
  }, [isFocused]);

  return (
    <Root style={{ background: bgColor }}>
      <AppMenuBar menus={menus} />
      <TermRow style={{ background: bgColor }}>
        <TermContainer
          ref={containerRef}
          onMouseDown={() => termRef.current?.focus()}
          style={{ background: bgColor }}
        />
        <TerminalScrollbar
          scrollTop={scrollState.scrollTop}
          scrollHeight={scrollState.scrollHeight}
          clientHeight={scrollState.clientHeight}
          onScrollTo={handleScrollTo}
          onStep={handleStep}
        />
      </TermRow>
    </Root>
  );
}
