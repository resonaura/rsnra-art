import { useEffect, useRef, useState } from "react";
import { Button } from "react95";
import styled, { css } from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useFileDialog } from "../../components/FileDialog/FileDialog";
import { LegacyIframeApp } from "../../components/LegacyIframeApp";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useUnsavedStore } from "../../store/unsavedStore";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowData, useWindowStore } from "../../store/windowStore";

const WAV_FILTERS = [
  { label: "Wave Sound (*.wav)", extensions: ["wav"] },
  { label: "All Files (*.*)", extensions: [] },
];

const DEFAULT_DIR = "C:\\My Documents\\";

// The vendored recorder (public/legacy/programs/sound-recorder) declares
// these with `var`/`function` at the top level of same-origin scripts, which
// makes them plain properties of its iframe's `contentWindow`. This is the
// minimal slice we reach in to bridge Save/Open into our own VFS instead of
// its native browser-download / OS-file-picker behavior.
interface RecorderFile {
  length: number;
  name: string;
  original_blob?: Blob;
  setBuffer: (buffer: AudioBuffer) => void;
}
interface RecorderWindow extends Window {
  file: RecorderFile;
  saved: boolean;
  reset: () => void;
  update: () => void;
  read_audio_data: (blob: Blob, callback: (buffer: AudioBuffer) => void) => void;
  get_wav_file: (file: RecorderFile, callback: (blob: Blob) => void) => void;
  effects_increase_volume: () => void;
  effects_decrease_volume: () => void;
  effects_increase_speed: () => void;
  effects_decrease_speed: () => void;
  effects_add_echo: () => void;
  effects_reverse: () => void;
  can_delete_before_current_position: () => boolean;
  can_delete_after_current_position: () => boolean;
  delete_before_current_position: () => void;
  delete_after_current_position: () => void;
}

function basename(path: string): string {
  return path.split("\\").pop() ?? "Sound.wav";
}

function dirOf(path: string): string {
  return path.split("\\").slice(0, -1).join("\\") + "\\";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const raised = css`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 500000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
`;

const DialogBox = styled.div`
  ${raised}
  background: ${({ theme }) => theme.material};
  width: 300px;
`;

const DialogHeader = styled.div`
  background: ${({ theme }) => theme.headerBackground};
  color: ${({ theme }) => theme.headerText};
  padding: 4px 8px;
  font-weight: bold;
  font-size: 13px;
`;

const DialogBody = styled.div`
  padding: 14px;
  font-size: 12px;
`;

const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 14px 14px;
`;

export function SoundRecorder({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const vfs = useVfsStore(
    useShallow((s) => ({ read: s.read, writeFile: s.writeFile })),
  );
  const updateTitle = useWindowStore((s) => s.updateTitle);
  const requestClose = useUnsavedStore((s) => s.requestClose);
  const { showFileDialog, dialog } = useFileDialog();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedInitialRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(
    (data.path as string) ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<(() => void) | null>(
    null,
  );

  const getWin = () =>
    iframeRef.current?.contentWindow as unknown as RecorderWindow | undefined;

  // The recorder tracks its own dirty flag (`saved`) internally as it
  // records/edits/applies effects — poll it rather than trying to hook every
  // mutation point in the vendored engine.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const win = getWin();
      if (win) setDirty(win.saved === false);
    }, 400);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const loadPath = async (path: string) => {
    const win = getWin();
    const content = vfs.read(path);
    if (!win || !content) return;
    const blob = await fetch(content).then((r) => r.blob());
    const name = basename(path);
    const asFile = new File([blob], name, { type: "audio/wav" });
    win.read_audio_data(asFile, (buffer) => {
      win.reset();
      win.file.original_blob = asFile;
      win.file.name = name;
      win.file.setBuffer(buffer);
      win.saved = true;
      win.update();
      setFilePath(path);
      setDirty(false);
      updateTitle(windowId, `${name} - Sound Recorder`);
    });
  };

  // Opened from Explorer/Find/etc. with a specific VFS path.
  useEffect(() => {
    if (!ready || loadedInitialRef.current || !filePath) return;
    loadedInitialRef.current = true;
    loadPath(filePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const confirmIfDirty = (run: () => void) => {
    if (dirty) setConfirmDiscard(() => run);
    else run();
  };

  const handleNew = () =>
    confirmIfDirty(() => {
      const win = getWin();
      if (!win) return;
      win.reset();
      win.saved = true;
      setFilePath(null);
      setDirty(false);
      updateTitle(windowId, "Sound Recorder");
    });

  const handleOpen = () =>
    confirmIfDirty(async () => {
      const result = await showFileDialog({
        mode: "open",
        title: "Open",
        initialDir: filePath ? dirOf(filePath) : DEFAULT_DIR,
        filters: WAV_FILTERS,
      });
      if (!result) return;
      await loadPath(result);
    });

  const saveToPath = async (path: string): Promise<boolean> => {
    const win = getWin();
    if (!win) return false;
    const blob = await new Promise<Blob>((resolve) =>
      win.get_wav_file(win.file, resolve),
    );
    const dataUrl = await blobToDataUrl(blob);
    vfs.writeFile(path, dataUrl);
    win.saved = true;
    setFilePath(path);
    setDirty(false);
    updateTitle(windowId, `${basename(path)} - Sound Recorder`);
    return true;
  };

  const handleSaveAs = async (): Promise<boolean> => {
    const win = getWin();
    if (!win || !win.file.length) return false;
    const result = await showFileDialog({
      mode: "save",
      title: "Save As",
      initialDir: filePath ? dirOf(filePath) : DEFAULT_DIR,
      initialFileName: filePath ? basename(filePath) : win.file.name || "Sound.wav",
      filters: WAV_FILTERS,
    });
    if (!result) return false;
    return saveToPath(result);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!filePath) return handleSaveAs();
    return saveToPath(filePath);
  };

  useUnsavedChanges(windowId, {
    isDirty: dirty,
    save: () => handleSave(),
    name: filePath ? basename(filePath) : "Sound.wav",
  });

  const callWin = (fn: (win: RecorderWindow) => void) => () => {
    const win = getWin();
    if (win) fn(win);
  };

  const hasAudio = ready && !!getWin()?.file.length;

  const menus = [
    {
      label: "File",
      items: [
        { label: "New", action: handleNew, disabled: !ready },
        { label: "Open...", action: handleOpen, disabled: !ready },
        { label: "Save", action: handleSave, disabled: !hasAudio },
        { label: "Save As...", action: handleSaveAs, disabled: !hasAudio },
        { label: "", divider: true },
        { label: "Exit", action: () => requestClose(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Delete Before Current Position",
          action: callWin((win) => win.delete_before_current_position()),
          disabled: !ready || !getWin()?.can_delete_before_current_position(),
        },
        {
          label: "Delete After Current Position",
          action: callWin((win) => win.delete_after_current_position()),
          disabled: !ready || !getWin()?.can_delete_after_current_position(),
        },
      ],
    },
    {
      label: "Effects",
      items: [
        {
          label: "Increase Volume (by 25%)",
          action: callWin((win) => win.effects_increase_volume()),
          disabled: !ready,
        },
        {
          label: "Decrease Volume",
          action: callWin((win) => win.effects_decrease_volume()),
          disabled: !ready,
        },
        { label: "", divider: true },
        {
          label: "Increase Speed (by 100%)",
          action: callWin((win) => win.effects_increase_speed()),
          disabled: !ready,
        },
        {
          label: "Decrease Speed",
          action: callWin((win) => win.effects_decrease_speed()),
          disabled: !ready,
        },
        { label: "", divider: true },
        {
          label: "Add Echo",
          action: callWin((win) => win.effects_add_echo()),
          disabled: !ready,
        },
        {
          label: "Reverse",
          action: callWin((win) => win.effects_reverse()),
          disabled: !ready,
        },
      ],
    },
    {
      label: "Help",
      items: [{ label: "About Sound Recorder", disabled: true }],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <LegacyIframeApp
        ref={iframeRef}
        src="/legacy/programs/sound-recorder/index.html"
        title="Sound Recorder"
        allow="microphone"
        onLoad={() => setReady(true)}
      />
      {dialog}
      {confirmDiscard && (
        <Overlay onMouseDown={() => setConfirmDiscard(null)}>
          <DialogBox onMouseDown={(e) => e.stopPropagation()}>
            <DialogHeader>Sound Recorder</DialogHeader>
            <DialogBody>
              This sound has changed. Discard unsaved changes?
            </DialogBody>
            <DialogFooter>
              <Button
                onClick={() => {
                  const run = confirmDiscard;
                  setConfirmDiscard(null);
                  run();
                }}
              >
                Discard
              </Button>
              <Button onClick={() => setConfirmDiscard(null)}>Cancel</Button>
            </DialogFooter>
          </DialogBox>
        </Overlay>
      )}
    </Layout>
  );
}
