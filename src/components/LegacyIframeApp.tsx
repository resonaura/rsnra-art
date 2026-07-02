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
}

/**
 * Hosts one of the classic Win98 programs vendored from 1j01/98
 * (public/legacy/programs/*) inside our own window chrome. Those pages are
 * built to run chromeless in an iframe under a host desktop — no porting
 * needed, just point an iframe at them.
 */
export function LegacyIframeApp({ src, title, allow }: LegacyIframeAppProps) {
  return <Frame src={src} title={title} allow={allow} />;
}
