import { useState } from "react";
import { Button, WindowContent } from "react95";
import styled, { css } from "styled-components";
import { openApp } from "../../data/apps";
import { useFileDialog } from "../../components/FileDialog/FileDialog";
import { alertError, alertInfo } from "../../lib/systemDialogs";
import { useWindowStore } from "../../store/windowStore";
import type { AppId } from "../../types/window";
import { Icon } from "../Icon/Icon";
import { SystemDialog } from "../SystemDialog/SystemDialog";

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const sunken = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const IntroRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    margin-top: 2px;
  }
`;

const IntroText = styled.p`
  margin: 0;
  line-height: 1.4;
`;

const OpenRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
`;

const OpenLabel = styled.label`
  flex-shrink: 0;
  u {
    text-decoration: underline;
  }
`;

const ComboBox = styled.div`
  ${sunken}
  display: flex;
  align-items: stretch;
  flex: 1;
  height: 22px;
  background: #fff;
`;

const ComboInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  font-size: 12px;
  font-family: inherit;
  padding: 0 4px;
  background: transparent;
`;

const ComboArrow = styled.button`
  ${raised}
  width: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: default;
  background: ${({ theme }) => theme.material};
  &:active {
    ${sunken}
  }
`;

const ArrowGlyph = styled.span`
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid ${({ theme }) => theme.materialText};
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const RUN_MAP: Record<string, AppId> = {
  terminal: "terminal",
  notepad: "notepad",
  "my-computer": "my-computer",
  computer: "my-computer",
  music: "music",
  social: "social",
  contact: "contact",
  games: "games-folder",
  minesweeper: "minesweeper",
  snake: "snake",
  calc: "calculator",
  calculator: "calculator",
  sndrec32: "sound-recorder",
  "sound-recorder": "sound-recorder",
  sol: "solitaire",
  solitaire: "solitaire",
  pinball: "pinball",
  help: "help",
  control: "control-panel",
  "control-panel": "control-panel",
  "recycle-bin": "recycle-bin",
  bin: "recycle-bin",
  taskmgr: "task-manager",
  "task-manager": "task-manager",
  charmap: "charmap",
};

export function RunDialog() {
  const open = useWindowStore((s) => s.runDialogOpen);
  const setOpen = useWindowStore((s) => s.setRunDialogOpen);
  const [value, setValue] = useState("");
  const { showFileDialog, dialog } = useFileDialog();

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setValue("");
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const target = RUN_MAP[key];
    if (!target) {
      alertError(
        "Run",
        `Cannot find '${trimmed}'. Make sure you typed the name correctly, and then try again.`,
      );
      return;
    }
    openApp(target);
    close();
  };

  const browse = async () => {
    const picked = await showFileDialog({
      mode: "open",
      title: "Browse",
      initialDir: "C:\\",
    });
    if (picked) setValue(picked);
  };

  return (
    <SystemDialog
      title="Run"
      width={400}
      onClose={close}
      onHelp={() =>
        alertInfo(
          "Run",
          "Type the name of a program, folder, document, or Internet resource, and RSNRA.ART will open it for you.",
        )
      }
    >
      <WindowContent>
        <IntroRow>
          <Icon src="/icons/w2k_run.ico" size={32} isInReact95 />
          <IntroText>
            Type the name of a program, folder, document, or Internet
            resource, and RSNRA.ART will open it for you.
          </IntroText>
        </IntroRow>
        <OpenRow>
          <OpenLabel>
            <u>O</u>pen:
          </OpenLabel>
          <ComboBox>
            <ComboInput
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <ComboArrow type="button" tabIndex={-1} aria-label="Recent items">
              <ArrowGlyph />
            </ComboArrow>
          </ComboBox>
        </OpenRow>
        <Footer>
          <Button
            style={{ width: "75px" }}
            onClick={submit}
            primary
            disabled={!value.trim()}
          >
            OK
          </Button>
          <Button style={{ width: "75px" }} onClick={close}>
            Cancel
          </Button>
          <Button style={{ width: "75px" }} onClick={browse}>
            Browse...
          </Button>
        </Footer>
      </WindowContent>
      {dialog}
    </SystemDialog>
  );
}
