import { useEffect } from "react";
import { Button, WindowContent } from "react95";
import styled from "styled-components";
import { playSound } from "../lib/audio";
import { useUnsavedStore } from "../store/unsavedStore";
import { useWindowStore } from "../store/windowStore";
import { Icon } from "./Icon/Icon";
import { SystemDialog } from "./SystemDialog/SystemDialog";

const Body = styled(WindowContent)`
  display: flex;
  gap: 25px;
  align-items: flex-start;
  padding: 0;
`;

const WarnIcon = styled(Icon)`
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  flex-shrink: 0;
`;

const Message = styled.div`
  line-height: 1.5;
  white-space: pre-line;
  padding-top: 4px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 0 14px 14px;
`;

// The Win95 "Save changes?" prompt. Shown when a window with an unsaved guard
// is closed. Yes → save (and close if saved); No → close without saving;
// Cancel → keep the window open.
export function UnsavedChangesDialog() {
  const confirmClose = useUnsavedStore((s) => s.confirmClose);
  const guards = useUnsavedStore((s) => s.guards);
  const confirmSave = useUnsavedStore((s) => s.confirmSave);
  const confirmDiscard = useUnsavedStore((s) => s.confirmDiscard);
  const confirmCancel = useUnsavedStore((s) => s.confirmCancel);
  const windows = useWindowStore((s) => s.windows);

  // Play the Win95 "Question" sound when the save-changes prompt appears.
  useEffect(() => {
    if (confirmClose) playSound("question");
  }, [confirmClose]);

  if (!confirmClose) return null;
  const guard = guards[confirmClose];
  const win = windows.find((w) => w.id === confirmClose);
  const appTitle = win?.title ?? "Untitled";
  const name = guard?.name() ?? "Untitled";

  // Win95 wording differs slightly between apps ("text in <file>" vs "picture
  // in <file>"); we keep a single clear phrasing.
  const message = `${appTitle}\nThe ${name === "Untitled" ? "document" : "file"} "${name}" has changed.\n\nDo you want to save the changes?`;

  return (
    <SystemDialog
      title="Save Changes"
      width={400}
      onClose={confirmCancel}
      closable={false}
      zIndex={600000}
    >
      <WindowContent>
        <Body>
          <WarnIcon
            src="/icons/explorer.exe/008.ico"
            alt="Warning"
            isInReact95
            draggable={false}
          />
          <Message>{message}</Message>
        </Body>
      </WindowContent>
      <Footer>
        <Button
          style={{ width: "80px" }}
          primary
          onClick={() => void confirmSave()}
        >
          Yes
        </Button>
        <Button style={{ width: "80px" }} onClick={confirmDiscard}>
          No
        </Button>
        <Button style={{ width: "80px" }} onClick={confirmCancel}>
          Cancel
        </Button>
      </Footer>
    </SystemDialog>
  );
}
