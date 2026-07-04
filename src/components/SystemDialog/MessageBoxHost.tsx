import { Button, WindowContent } from "react95";
import styled from "styled-components";
import { useDialogStore, type MessageBoxDescriptor } from "../../store/dialogStore";
import { Icon } from "../Icon/Icon";
import { SystemDialog } from "./SystemDialog";

const Body = styled(WindowContent)`
  display: flex;
  gap: 25px;
  align-items: flex-start;
  padding: 0;
`;

const BoxIcon = styled(Icon)`
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

function ButtonRow({ box }: { box: MessageBoxDescriptor }) {
  switch (box.buttons) {
    case "ok":
      return (
        <Button
          style={{ width: "80px" }}
          primary
          autoFocus
          onClick={() => box.resolve("ok")}
        >
          OK
        </Button>
      );
    case "okcancel":
      return (
        <>
          <Button
            style={{ width: "80px" }}
            primary
            autoFocus
            onClick={() => box.resolve("ok")}
          >
            OK
          </Button>
          <Button style={{ width: "80px" }} onClick={() => box.resolve("cancel")}>
            Cancel
          </Button>
        </>
      );
    case "yesno":
      return (
        <>
          <Button
            style={{ width: "80px" }}
            primary
            autoFocus
            onClick={() => box.resolve("yes")}
          >
            Yes
          </Button>
          <Button style={{ width: "80px" }} onClick={() => box.resolve("no")}>
            No
          </Button>
        </>
      );
    case "yesnocancel":
      return (
        <>
          <Button
            style={{ width: "80px" }}
            primary
            autoFocus
            onClick={() => box.resolve("yes")}
          >
            Yes
          </Button>
          <Button style={{ width: "80px" }} onClick={() => box.resolve("no")}>
            No
          </Button>
          <Button style={{ width: "80px" }} onClick={() => box.resolve("cancel")}>
            Cancel
          </Button>
        </>
      );
  }
}

/**
 * Renders every pending alert/confirm/etc. box pushed through
 * src/lib/systemDialogs.ts. Mount once near the app root — see App.tsx.
 */
export function MessageBoxHost() {
  const boxes = useDialogStore((s) => s.boxes);

  return (
    <>
      {boxes.map((box, i) => (
        <SystemDialog
          key={box.id}
          title={box.title}
          width={480}
          closable={false}
          zIndex={600000 + i}
          initialOffset={{ x: i * 24, y: i * 24 }}
        >
          <WindowContent>
            <Body>
              <BoxIcon isInReact95 src={box.icon} alt="" draggable={false} />
              <Message>{box.message}</Message>
            </Body>
          </WindowContent>
          <Footer>
            <ButtonRow box={box} />
          </Footer>
        </SystemDialog>
      ))}
    </>
  );
}
