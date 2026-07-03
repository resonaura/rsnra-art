import { useEffect } from "react";
import { Button, Window, WindowContent, WindowHeader } from "react95";
import styled from "styled-components";
import { playSound } from "../../lib/audio";
import { useAlertStore } from "../../store/alertStore";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 600000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
`;

const Dialog = styled(Window)`
  width: 340px;
`;

const Body = styled(WindowContent)`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 0;
`;

const AlertIcon = styled.img`
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  flex-shrink: 0;
`;

const Message = styled.div`
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-line;
  padding-top: 4px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: center;
  padding: 0 14px 14px;
`;

// Generic Win98 message box (Ctrl+Alt+Del-adjacent chrome: error icon, single
// OK button). Driven entirely by useAlertStore — call
// useAlertStore.getState().show(title, message) from anywhere to pop it up.
export function AlertDialog() {
  const open = useAlertStore((s) => s.open);
  const title = useAlertStore((s) => s.title);
  const message = useAlertStore((s) => s.message);
  const icon = useAlertStore((s) => s.icon);
  const close = useAlertStore((s) => s.close);

  useEffect(() => {
    if (open) playSound("error");
  }, [open]);

  if (!open) return null;

  return (
    <Overlay onMouseDown={close}>
      <Dialog onMouseDown={(e) => e.stopPropagation()} shadow={false}>
        <WindowHeader
          active
          className="window-drag-handle"
          style={{ display: "flex", alignItems: "center", zoom: 0.8 }}
        >
          <span>{title}</span>
        </WindowHeader>
        <WindowContent>
          <Body>
            <AlertIcon src={icon} alt="Error" draggable={false} />
            <Message>{message}</Message>
          </Body>
        </WindowContent>
        <Footer style={{ zoom: 0.8 }}>
          <Button style={{ width: "80px" }} primary onClick={close} autoFocus>
            OK
          </Button>
        </Footer>
      </Dialog>
    </Overlay>
  );
}
