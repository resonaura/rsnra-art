import { forwardRef } from "react";
import styled from "styled-components";

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  height: 100%;
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
 * Hosts one of the classic Win98 programs vendored from 1j01/98
 * (public/legacy/programs/*) inside our own window chrome. Those pages are
 * built to run chromeless in an iframe under a host desktop — no porting
 * needed, just point an iframe at them.
 *
 * Forwards a ref to the underlying <iframe> for apps (e.g. Sound Recorder)
 * that need to reach into the vendored script's same-origin `contentWindow`
 * to bridge state (like VFS-backed save/open) into a custom host menu bar.
 */
export const LegacyIframeApp = forwardRef<
  HTMLIFrameElement,
  LegacyIframeAppProps
>(function LegacyIframeApp({ src, title, allow, onLoad }, ref) {
  return <Frame ref={ref} src={src} title={title} allow={allow} onLoad={onLoad} />;
});
