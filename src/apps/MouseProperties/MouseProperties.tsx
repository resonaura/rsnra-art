import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  GroupBox,
  Radio,
  Select,
  Tab,
  TabBody,
  Tabs,
} from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";
import { Slider95 } from "../../components/Slider95/Slider95";
import {
  CURSOR_ROLES,
  type CursorRoleId,
} from "../../data/cursors";
import { parseAni } from "../../lib/aniParser";
import { parseCur } from "../../lib/curParser";
import {
  SCHEME_FILES,
  useCursorStore,
  type CursorSchemeId,
} from "../../store/cursorStore";
import { useWindowStore } from "../../store/windowStore";
import { useFileDialog } from "../../components/FileDialog/FileDialog";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Body = styled(TabBody)`
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow: hidden;
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 4px;
  flex-shrink: 0;
`;

const SchemeRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
`;

const List = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const Row = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  padding: 3px 8px;
  border: none;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  background: ${({ theme, $active }) =>
    $active ? theme.hoverBackground : "transparent"};
  color: ${({ theme, $active }) => ($active ? theme.headerText : "black")};

  img {
    width: 24px;
    height: 24px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const PreviewBox = styled.div`
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
`;

const PointersHead = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;


const SCHEMES: { id: CursorSchemeId; label: string }[] = [
  { id: "none", label: "(None)" },
  { id: "windows", label: "Windows Standard" },
  { id: "3d-gold", label: "3D Gold" },
  { id: "3d-silver", label: "3D Silver" },
  { id: "3d-white", label: "3D White" },
];

export function CursorPreview({
  file,
  style,
  className,
}: {
  file: string;
  style?: any;
  className?: string;
}) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    let active = true;
    let timerId: any = null;
    let objectUrls: string[] = [];

    const loadAndAnimate = async () => {
      try {
        const res = await fetch(`/cursors/${file}`);
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        if (!active) return;

        if (file.endsWith(".ani") || file.endsWith(".ANI")) {
          const parsed = await parseAni(buffer);
          if (!active) return;

          objectUrls = parsed.frames.map((blob) => URL.createObjectURL(blob));

          let step = 0;
          const tick = () => {
            if (!active) return;
            const frameIdx = parsed.seq ? parsed.seq[step] : step;
            if (frameIdx >= 0 && frameIdx < objectUrls.length) {
              setFrameUrl(objectUrls[frameIdx]);
            }
            const duration = parsed.rate[step] || 100;
            step =
              (step + 1) % (parsed.seq ? parsed.seq.length : objectUrls.length);
            timerId = setTimeout(tick, duration);
          };

          tick();
        } else {
          const parsed = await parseCur(buffer, file);
          if (!active) return;
          setFrameUrl(parsed.blobUrl);
          objectUrls.push(parsed.blobUrl);
        }
      } catch (e) {
        console.error("Error loading preview:", e);
      }
    };

    loadAndAnimate();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
      objectUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [file]);

  if (!frameUrl)
    return (
      <div style={{ width: 32, height: 32, ...style }} className={className} />
    );

  return (
    <img
      src={frameUrl}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated", objectFit: "contain", ...style }}
      className={className}
    />
  );
}

export function MouseProperties({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const storeScheme = useCursorStore((s) => s.schemeId);
  const storeFiles = useCursorStore((s) => s.files);
  const setScheme = useCursorStore((s) => s.setScheme);
  const setRoleFile = useCursorStore((s) => s.setRoleFile);
  const resetRoleFile = useCursorStore((s) => s.resetRoleFile);

  const [tab, setTab] = useState("Buttons");
  const [scheme, setLocalScheme] = useState<CursorSchemeId>(storeScheme);
  const [files, setFiles] = useState<Record<CursorRoleId, string>>(storeFiles);
  const [selectedRole, setSelectedRole] = useState<CursorRoleId>("normal");
  const [rightHanded, setRightHanded] = useState(true);
  const [dblClick, setDblClick] = useState(50);
  const [pointerSpeed, setPointerSpeed] = useState(50);

  const { showFileDialog, dialog: fileDialogEl } = useFileDialog();

  const apply = () => {
    setScheme(scheme);
    for (const role of CURSOR_ROLES) {
      setRoleFile(role.id, files[role.id]);
    }
  };

  const selected = CURSOR_ROLES.find((r) => r.id === selectedRole)!;

  return (
    <Layout>
      <Tabs
        value={tab}
        onChange={(v: string) => setTab(v)}
        style={{ fontSize: 11, zoom: 0.8 }}
      >
        <Tab value="Buttons">Buttons</Tab>
        <Tab value="Pointers">Pointers</Tab>
        <Tab value="Pointer Options">Pointer Options</Tab>
      </Tabs>
      <Body>
        {tab === "Buttons" && (
          <>
            <GroupBox
              style={{ zoom: 0.8, display: "flex", gap: "20px" }}
              label="Button configuration"
            >
              <Radio
                label="Right-handed"
                checked={rightHanded}
                onChange={() => setRightHanded(true)}
              />
              <Radio
                label="Left-handed"
                checked={!rightHanded}
                onChange={() => setRightHanded(false)}
                style={{ marginTop: 4 }}
              />
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Double-click speed">
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                Slow
                <Slider95 value={dblClick} onChange={setDblClick} size="100%" />
                Fast
              </div>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="ClickLock">
              <Checkbox label="Turn on ClickLock" disabled />
            </GroupBox>
          </>
        )}

        {tab === "Pointers" && (
          <>
            <SchemeRow>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>Scheme</div>
                <Select
                  style={{ zoom: 0.8 }}
                  value={scheme}
                  options={SCHEMES.map((s) => ({
                    label: s.label,
                    value: s.id,
                  }))}
                  width="100%"
                  onChange={(opt) => {
                    const nextScheme = opt.value as CursorSchemeId;
                    setLocalScheme(nextScheme);
                    if (nextScheme !== "none") {
                      setFiles(SCHEME_FILES[nextScheme]);
                    }
                  }}
                />
              </div>
              <PreviewBox>
                {scheme !== "none" && (
                  <CursorPreview
                    file={files[selectedRole]}
                    style={{ width: 32, height: 32 }}
                  />
                )}
              </PreviewBox>
            </SchemeRow>

            <div style={{ fontSize: 12 }}>Customize:</div>
            <List contentStyle={{ display: "flex", flexDirection: "column" }}>
              {CURSOR_ROLES.map((r) => (
                <Row
                  key={r.id}
                  $active={r.id === selectedRole}
                  onClick={() => setSelectedRole(r.id)}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        fontWeight: r.id === selectedRole ? "bold" : "normal",
                      }}
                    >
                      {r.label}
                    </span>
                    {scheme !== "none" &&
                      files[r.id] === SCHEME_FILES.windows[r.id] && (
                        <span style={{ color: "#888", fontSize: 10 }}>
                          (Default)
                        </span>
                      )}
                  </div>
                  {scheme !== "none" && (
                    <CursorPreview
                      file={files[r.id]}
                      style={{ width: 24, height: 24 }}
                    />
                  )}
                </Row>
              ))}
            </List>

            <PointersHead style={{ zoom: 0.8 }}>
              <Button
                disabled={scheme === "none"}
                onClick={() => {
                  const s = scheme === "none" ? "windows" : scheme;
                  const defFile = SCHEME_FILES[s][selectedRole];
                  setFiles((f) => ({ ...f, [selectedRole]: defFile }));
                }}
                style={{ flex: 1 }}
              >
                Use Default
              </Button>
              <Button
                disabled={scheme === "none"}
                onClick={async () => {
                  const path = await showFileDialog({
                    mode: "open",
                    title: "Browse",
                    initialDir: "C:\\Windows\\Cursors",
                    filters: [
                      { label: "Cursor Files (*.cur;*.ani)", extensions: ["cur", "ani", "CUR", "ANI"] },
                      { label: "All Files (*.*)", extensions: [] },
                    ],
                  });
                  if (path) {
                    const filename = path.split("\\").pop()!;
                    setFiles((f) => ({ ...f, [selectedRole]: filename }));
                  }
                }}
                style={{ flex: 1 }}
              >
                Browse...
              </Button>
            </PointersHead>

            {fileDialogEl}
          </>
        )}

        {tab === "Pointer Options" && (
          <>
            <GroupBox style={{ zoom: 0.8 }} label="Pointer speed">
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                Slow
                <Slider95
                  value={pointerSpeed}
                  onChange={setPointerSpeed}
                  size="100%"
                />
                Fast
              </div>
              <Button disabled style={{ fontSize: 11 }}>
                Accelerate...
              </Button>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="SnapTo">
              <Checkbox
                label="Automatically move pointer to the default button in a dialog box."
                disabled
              />
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Visibility">
              <Checkbox label="Show pointer trails" disabled />
              <Checkbox
                label="Hide pointer while typing"
                disabled
                style={{ marginTop: 4 }}
              />
              <Checkbox
                label="Show location of pointer when you press the CTRL key"
                disabled
                style={{ marginTop: 4 }}
              />
            </GroupBox>
          </>
        )}

        <BtnRow style={{ zoom: 0.8, marginTop: "auto" }}>
          <Button
            onClick={() => {
              apply();
              closeWindow(windowId);
            }}
            style={{ width: "80px" }}
          >
            OK
          </Button>
          <Button
            style={{ width: "80px" }}
            onClick={() => closeWindow(windowId)}
          >
            Cancel
          </Button>
          <Button style={{ width: "80px" }} onClick={apply}>
            Apply
          </Button>
        </BtnRow>
      </Body>
    </Layout>
  );
}
