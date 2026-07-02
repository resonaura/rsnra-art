import { useRef, useState } from "react";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { LegacyIframeApp } from "../../components/LegacyIframeApp";

// See src/apps/SoundRecorder/SoundRecorder.tsx for why this works: the
// vendored calculator (public/legacy/programs/calculator) declares these on
// `window` in a same-origin iframe, so we can call them directly instead of
// using its own (now-removed) internal menu bar.
interface CalculatorWindow extends Window {
  copyResult: () => void;
  pasteResult: () => void;
}

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

export function Calculator() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const getWin = () =>
    iframeRef.current?.contentWindow as unknown as CalculatorWindow | undefined;

  const menus = [
    {
      label: "Edit",
      items: [
        {
          label: "Copy",
          action: () => getWin()?.copyResult(),
          disabled: !ready,
        },
        {
          label: "Paste",
          action: () => getWin()?.pasteResult(),
          disabled: !ready,
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Standard", disabled: true },
        { label: "Scientific", disabled: true },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help Topics", disabled: true },
        { label: "", divider: true },
        {
          label: "About Calculator",
          action: () =>
            window.open("https://github.com/muzam1l/mcalculator"),
        },
      ],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <LegacyIframeApp
        ref={iframeRef}
        src="/legacy/programs/calculator/index.html"
        title="Calculator"
        onLoad={() => setReady(true)}
      />
    </Layout>
  );
}
