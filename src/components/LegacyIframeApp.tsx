import { forwardRef, useCallback, useEffect, useRef } from "react";
import styled, { useTheme } from "styled-components";
import type { Theme } from "react95/dist/themes/types";

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  display: block;
`;

interface LegacyIframeAppProps {
  src: string;
  title: string;
  allow?: string;
  onLoad?: () => void;
}

/**
 * Maps a react95 Theme to the CSS custom properties expected by the
 * vendored os-gui / windows-98.css stylesheet used by the legacy apps.
 * Injecting these into the iframe's document root makes the legacy UI
 * follow whatever theme the parent shell has selected.
 */
function buildThemeVars(theme: Theme): Record<string, string> {
  return {
    "--ButtonFace":            theme.material,
    "--ButtonLight":           theme.borderLight,
    "--ButtonHilight":         theme.borderLightest,
    "--ButtonShadow":          theme.borderDark,
    "--ButtonDkShadow":        theme.borderDarkest,
    "--ButtonText":            theme.materialText,
    "--GrayText":              theme.materialTextDisabled,
    "--ActiveTitle":           theme.headerBackground,
    "--TitleText":             theme.headerText,
    "--InactiveTitle":         theme.headerNotActiveBackground,
    "--InactiveTitleText":     theme.headerNotActiveText,
    "--Hilight":               theme.hoverBackground,
    "--HilightText":           theme.materialTextInvert,
    "--Window":                theme.canvas,
    "--WindowText":            theme.canvasText,
    "--Background":            theme.desktopBackground,
    "--AppWorkspace":          theme.materialDark,
    "--Menu":                  theme.material,
    "--MenuText":              theme.materialText,
    "--Scrollbar":             theme.material,
    "--InfoWindow":            theme.tooltip,
    "--InfoText":              theme.canvasText,
    "--GradientActiveTitle":   theme.headerBackground,
    "--GradientInactiveTitle": theme.headerNotActiveBackground,
    "--ActiveBorder":          theme.borderLight,
    "--InactiveBorder":        theme.borderLight,
    "--WindowFrame":           theme.borderDarkest,
  };
}

function applyThemeToIframe(iframe: HTMLIFrameElement, theme: Theme): void {
  try {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    for (const [prop, value] of Object.entries(buildThemeVars(theme))) {
      root.style.setProperty(prop, value);
    }
  } catch {
    // cross-origin frame — silently skip
  }
}

/**
 * Hosts one of the classic Win98 programs vendored from 1j01/98
 * (public/legacy/programs/*) inside our own window chrome.
 *
 * Theme bridge: after load and on every re-render (including theme switches),
 * we push the current react95 Theme into the iframe as os-gui CSS custom
 * properties so the legacy UI follows the host shell's colour scheme.
 *
 * Forwards a ref to the underlying <iframe> for apps (e.g. Sound Recorder)
 * that need to reach into the vendored script's same-origin `contentWindow`.
 */
export const LegacyIframeApp = forwardRef<
  HTMLIFrameElement,
  LegacyIframeAppProps
>(function LegacyIframeApp({ src, title, allow, onLoad }, forwardedRef) {
  const theme = useTheme() as Theme;

  // Internal ref so we can push theme updates even when forwardedRef is null.
  const innerRef = useRef<HTMLIFrameElement | null>(null);

  // Merge forwarded + inner refs.
  const setRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  // Re-apply theme whenever it changes (covers live theme switching).
  useEffect(() => {
    if (innerRef.current) applyThemeToIframe(innerRef.current, theme);
  });

  const handleLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    applyThemeToIframe(e.currentTarget, theme);
    onLoad?.();
  };

  return (
    <Frame
      ref={setRef}
      src={src}
      title={title}
      allow={allow}
      onLoad={handleLoad}
    />
  );
});
