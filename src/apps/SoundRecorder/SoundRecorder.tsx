import { useEffect, useRef, useState } from "react";
import { Button, WindowContent } from "react95";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useFileDialog } from "../../components/FileDialog/FileDialog";
import { LegacyIframeApp } from "../../components/LegacyIframeApp";
import { SystemDialog } from "../../components/SystemDialog/SystemDialog";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useUnsavedStore } from "../../store/unsavedStore";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowData, useWindowStore } from "../../store/windowStore";

const WAV_FILTERS = [
  { label: "Wave Sound (*.wav)", extensions: ["wav"] },
  { label: "All Files (*.*)", extensions: [] },
];

const DEFAULT_DIR = "C:\\Windows\\Media";

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
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

const DialogBody = styled(WindowContent)`
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 0;
`;

const WarnIcon = styled.img`
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
  gap: 8px;
  padding: 0 14px 14px;
`;

export function SoundRecorder({ windowId }: { windowId: string }) {
  const data          = useWindowData(windowId);
  const vfs           = useVfsStore(
    useShallow((s) => ({ read: s.read, writeFile: s.writeFile })),
  );
  const updateTitle   = useWindowStore((s) => s.updateTitle);
  const requestClose  = useUnsavedStore((s) => s.requestClose);
  const { showFileDialog, dialog } = useFileDialog();

  const iframeRef          = useRef<HTMLIFrameElement>(null);
  const loadedInitialRef   = useRef(false);
  const [ready, setReady]  = useState(false);
  const [filePath, setFilePath] = useState<string | null>(
    (data.path as string) ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

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
    const win     = getWin();
    const content = vfs.read(path);
    if (!win || !content) return;
    const blob   = await fetch(content).then((r) => r.blob());
    const name   = basename(path);
    const asFile = new File([blob], name, { type: "audio/wav" });
    win.read_audio_data(asFile, (buffer) => {
      win.reset();
      win.file.original_blob = asFile;
      win.file.name          = name;
      win.file.setBuffer(buffer);
      win.saved = true;
      win.update();
      setFilePath(path);
      setDirty(false);
      updateTitle(windowId, `${name} - Sound Recorder`);
    });
  };

  // Opened from Explorer / Find / etc. with a specific VFS path.
  useEffect(() => {
    if (!ready || loadedInitialRef.current || !filePath) return;
    loadedInitialRef.current = true;
    loadPath(filePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── save / open helpers ───────────────────────────────────────────────────

  const saveToPath = async (path: string): Promise<boolean> => {
    const win = getWin();
    if (!win) return false;
    const blob    = await new Promise<Blob>((resolve) =>
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
      initialDir:      filePath ? dirOf(filePath) : DEFAULT_DIR,
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


  const confirmIfDirty = (run: () => void) => {
    if (!dirty) {
      run();
      return;
    }
    setPendingAction(() => run);
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
        mode:       "open",
        title:      "Open",
        initialDir: filePath ? dirOf(filePath) : DEFAULT_DIR,
        filters:    WAV_FILTERS,
      });
      if (!result) return;
      await loadPath(result);
    });

  // Register with the system unsaved-changes guard so closing the window
  // via X / File → Exit shows the standard "Save changes?" dialog.
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
        { label: "New",       action: handleNew,    disabled: !ready    },
        { label: "Open...",   action: handleOpen,   disabled: !ready    },
        { label: "Save",      action: handleSave,   disabled: !hasAudio },
        { label: "Save As...", action: handleSaveAs, disabled: !hasAudio },
        { label: "", divider: true },
        { label: "Exit",      action: () => requestClose(windowId) },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label:    "Delete Before Current Position",
          action:   callWin((win) => win.delete_before_current_position()),
          disabled: !ready || !getWin()?.can_delete_before_current_position(),
        },
        {
          label:    "Delete After Current Position",
          action:   callWin((win) => win.delete_after_current_position()),
          disabled: !ready || !getWin()?.can_delete_after_current_position(),
        },
      ],
    },
    {
      label: "Effects",
      items: [
        { label: "Increase Volume (by 25%)", action: callWin((win) => win.effects_increase_volume()), disabled: !ready },
        { label: "Decrease Volume",          action: callWin((win) => win.effects_decrease_volume()), disabled: !ready },
        { label: "", divider: true },
        { label: "Increase Speed (by 100%)", action: callWin((win) => win.effects_increase_speed()), disabled: !ready },
        { label: "Decrease Speed",           action: callWin((win) => win.effects_decrease_speed()), disabled: !ready },
        { label: "", divider: true },
        { label: "Add Echo",                 action: callWin((win) => win.effects_add_echo()),        disabled: !ready },
        { label: "Reverse",                  action: callWin((win) => win.effects_reverse()),         disabled: !ready },
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
      {/* System file dialog (Save As / Open) */}
      {dialog}

      {pendingAction && (
        <SystemDialog
          title="Save Changes"
          width={340}
          onClose={() => setPendingAction(null)}
          closable={false}
          zIndex={600000}
        >
          <WindowContent>
            <DialogBody>
              <WarnIcon
                src="/icons/w2k_warning.ico"
                alt="Warning"
                draggable={false}
              />
              <Message>
                Sound Recorder
                {"\n"}The file "{filePath ? basename(filePath) : "Sound.wav"}" has changed.
                {"\n\n"}Do you want to save the changes?
              </Message>
            </DialogBody>
          </WindowContent>
          <Footer>
            <Button
              style={{ width: "80px" }}
              primary
              onClick={async () => {
                const action = pendingAction;
                setPendingAction(null);
                if (action) {
                  const ok = await handleSave();
                  if (ok) {
                    action();
                  }
                }
              }}
            >
              Yes
            </Button>
            <Button
              style={{ width: "80px" }}
              onClick={() => {
                setDirty(false);
                const win = getWin();
                if (win) win.saved = true;
                pendingAction();
                setPendingAction(null);
              }}
            >
              No
            </Button>
            <Button style={{ width: "80px" }} onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
          </Footer>
        </SystemDialog>
      )}
    </Layout>
  );
}
