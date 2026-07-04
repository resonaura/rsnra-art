import { useState } from "react";
import { Button, Checkbox, WindowContent } from "react95";
import styled from "styled-components";
import { candidatesFor, type OpenWithApp } from "../../data/fileOpen";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { Icon } from "../Icon/Icon";
import { SystemDialog } from "../SystemDialog/SystemDialog";

const Prompt = styled.p`
  margin: 0 0 10px;
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px;
  max-height: 200px;
  margin-bottom: 20px;
  overflow-y: auto;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const IconItem = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 76px;
  padding: 6px 2px;
  text-align: center;
  border: 1px dotted transparent;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};
  cursor: pointer;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
`;

const RememberRow = styled.div`
  margin: 10px 0;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

export interface OpenWithDialogProps {
  fileName: string;
  filePath?: string;
  onClose: () => void;
  /**
   * When true, OK just persists the extension → app association (Folder
   * Options ▸ File Types ▸ Change…) instead of opening a live file. No
   * "remember" checkbox is needed since associating *is* the point.
   */
  associateOnly?: boolean;
}

/** Windows ME-style "Open With" picker for right-click ▸ Open With. */
export function OpenWithDialog({
  fileName,
  filePath,
  onClose,
  associateOnly,
}: OpenWithDialogProps) {
  const candidates = candidatesFor(fileName);
  const [selected, setSelected] = useState<OpenWithApp | null>(
    candidates[0] ?? null,
  );
  const [remember, setRemember] = useState(false);
  const setOpenWithDefault = useFilePrefsStore((s) => s.setOpenWithDefault);

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  const confirm = () => {
    if (!selected) return;
    if (associateOnly) {
      setOpenWithDefault(ext, selected.appId);
      onClose();
      return;
    }
    if (remember) {
      setOpenWithDefault(ext, selected.appId);
    }
    selected.open(filePath!, fileName);
    onClose();
  };

  return (
    <SystemDialog title="Open With" width={400} onClose={onClose}>
      <WindowContent>
        <Prompt>
          {associateOnly
            ? `Choose the program you want Windows to use to open '.${ext}' files:`
            : `Click the program you want to use to open '${fileName}':`}
        </Prompt>
        <Grid>
          {candidates.map((app) => (
            <IconItem
              key={app.appId}
              $selected={selected?.appId === app.appId}
              onClick={() => setSelected(app)}
              onDoubleClick={confirm}
            >
              <Icon src={app.icon} size={32} isInReact95 />
              <span>{app.label}</span>
            </IconItem>
          ))}
        </Grid>
        {!associateOnly && (
          <RememberRow>
            <Checkbox
              label="Always use this program to open this type of file"
              checked={remember}
              onChange={() => setRemember((r) => !r)}
            />
          </RememberRow>
        )}
        <Footer>
          <Button
            primary
            disabled={!selected}
            onClick={confirm}
            style={{ width: 75 }}
          >
            OK
          </Button>
          <Button onClick={onClose} style={{ width: 75 }}>
            Cancel
          </Button>
        </Footer>
      </WindowContent>
    </SystemDialog>
  );
}
