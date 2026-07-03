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
  SYSTEM_SCHEMES,
  getSchemeFiles,
  useCursorStore,
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



export function CursorPreview({
  file,
  style,
  className,
}: {
  file: string;
  style?: any;
  className?: string;
}) {
  const shadowEnabled = useCursorStore((s) => s.shadowEnabled);
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

          objectUrls = await Promise.all(
            parsed.frames.map(async (blob, idx) => {
              const frameBuf = await blob.arrayBuffer();
              const frameParsed = await parseCur(frameBuf, `${file}_frame_${idx}.cur`, shadowEnabled);
              return frameParsed.blobUrl;
            })
          );

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
          const parsed = await parseCur(buffer, file, shadowEnabled);
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
  }, [file, shadowEnabled]);

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
  const storeShadowEnabled = useCursorStore((s) => s.shadowEnabled);
  const setScheme = useCursorStore((s) => s.setScheme);
  const setRoleFile = useCursorStore((s) => s.setRoleFile);
  const setShadowEnabled = useCursorStore((s) => s.setShadowEnabled);
  const saveCustomScheme = useCursorStore((s) => s.saveCustomScheme);
  const deleteCustomScheme = useCursorStore((s) => s.deleteCustomScheme);
  const customSchemes = useCursorStore((s) => s.customSchemes);

  const [tab, setTab] = useState("Buttons");
  const [scheme, setLocalScheme] = useState<string>(storeScheme);
  const [files, setFiles] = useState<Record<CursorRoleId, string>>(storeFiles);
  const [selectedRole, setSelectedRole] = useState<CursorRoleId>("normal");
  const [rightHanded, setRightHanded] = useState(true);
  const [dblClick, setDblClick] = useState(50);
  const [pointerSpeed, setPointerSpeed] = useState(50);
  const [localShadowEnabled, setLocalShadowEnabled] = useState(storeShadowEnabled);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");

  const { showFileDialog, dialog: fileDialogEl } = useFileDialog();

  const apply = () => {
    setScheme(scheme);
    setShadowEnabled(localShadowEnabled);
    for (const role of CURSOR_ROLES) {
      setRoleFile(role.id, files[role.id]);
    }
  };

  const BUILTIN_SCHEMES = [
    { id: "none", label: "(None)" },
    { id: "3d-bronze", label: "3D-Bronze (system scheme)" },
    { id: "3d-white", label: "3D-White (system scheme)" },
    { id: "conductor", label: "Conductor (system scheme)" },
    { id: "dinosaur", label: "Dinosaur (system scheme)" },
    { id: "hands-1", label: "Hands 1 (system scheme)" },
    { id: "hands-2", label: "Hands 2 (system scheme)" },
    { id: "magnified", label: "Magnified (system scheme)" },
    { id: "old-fashioned", label: "Old Fashioned (system scheme)" },
    { id: "variations", label: "Variations (system scheme)" },
    { id: "windows-animated", label: "Windows Animated (system scheme)" },
    { id: "windows-black", label: "Windows Black (system scheme)" },
    { id: "windows-black-xl", label: "Windows Black (extra large) (system scheme)" },
    { id: "windows-black-l", label: "Windows Black (large) (system scheme)" },
    { id: "windows-default", label: "Windows Default (system scheme)" },
    { id: "windows-inverted-xl", label: "Windows Inverted (extra large) (system scheme)" },
    { id: "windows-inverted-l", label: "Windows Inverted (large) (system scheme)" },
    { id: "windows-inverted", label: "Windows Inverted (system scheme)" },
    { id: "windows-standard-xl", label: "Windows Standard (extra large) (system scheme)" },
    { id: "windows-standard-l", label: "Windows Standard (large) (system scheme)" },
    { id: "windows", label: "Windows Standard" },
  ];

  const selectOptions = [
    ...BUILTIN_SCHEMES.map((s) => ({ value: s.id, label: s.label })),
    ...Object.keys(customSchemes).map((name) => ({ value: name, label: name })),
  ];


  const isBuiltInScheme = (schemeId: string): boolean => {
    return !!SYSTEM_SCHEMES[schemeId] || schemeId === "none";
  };

  const currentSchemeLabel = selectOptions.find((o) => o.value === scheme)?.label || scheme;

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
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>Scheme</div>
                <Select
                  style={{ zoom: 0.8 }}
                  value={scheme}
                  options={selectOptions}
                  width="100%"
                  onChange={(opt) => {
                    const nextScheme = opt.value as string;
                    setLocalScheme(nextScheme);
                    const nextFiles = getSchemeFiles(nextScheme, customSchemes);
                    setFiles(nextFiles);
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 4, zoom: 0.8 }}>
                  <Button
                    onClick={() => {
                      setSaveName(currentSchemeLabel.replace(" (system scheme)", ""));
                      setShowSaveDialog(true);
                    }}
                  >
                    Save As...
                  </Button>
                  <Button
                    disabled={isBuiltInScheme(scheme)}
                    onClick={() => {
                      deleteCustomScheme(scheme);
                      setLocalScheme("windows");
                      setFiles(SYSTEM_SCHEMES.windows as Record<CursorRoleId, string>);
                    }}
                  >
                    Delete
                  </Button>
                </div>
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

            <div style={{ fontSize: 12, marginTop: 6 }}>Customize:</div>
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
                      files[r.id] === SYSTEM_SCHEMES.windows[r.id] && (
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, zoom: 0.8 }}>
              <Checkbox
                label="Enable pointer shadow"
                checked={localShadowEnabled}
                onChange={(e: any) => setLocalShadowEnabled(e.target.checked)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  disabled={files[selectedRole] === SYSTEM_SCHEMES.windows[selectedRole]}
                  onClick={() => {
                    const defFile = SYSTEM_SCHEMES.windows[selectedRole];
                    setFiles((f) => ({ ...f, [selectedRole]: defFile }));
                  }}
                  style={{ width: 100 }}
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
                  style={{ width: 100 }}
                >
                  Browse...
                </Button>
              </div>
            </div>

            {showSaveDialog && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 0, 0, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 30
              }}>
                <Window style={{ width: "300px" }}>
                  <WindowHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Save Scheme</span>
                    <Button onClick={() => setShowSaveDialog(false)} square size="sm">x</Button>
                  </WindowHeader>
                  <WindowContent style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: 12 }}>Save this cursor scheme as:</div>
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      style={{
                        padding: "4px",
                        fontSize: "12px",
                        border: "2px solid",
                        borderColor: "#848484 #dfdfdf #dfdfdf #848484",
                        background: "white",
                        color: "black"
                      }}
                      autoFocus
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <Button
                        disabled={!saveName.trim()}
                        onClick={() => {
                          const trimmed = saveName.trim();
                          saveCustomScheme(trimmed, files);
                          setLocalScheme(trimmed);
                          setShowSaveDialog(false);
                        }}
                        style={{ width: "60px" }}
                      >
                        OK
                      </Button>
                      <Button onClick={() => setShowSaveDialog(false)} style={{ width: "60px" }}>
                        Cancel
                      </Button>
                    </div>
                  </WindowContent>
                </Window>
              </div>
            )}

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
