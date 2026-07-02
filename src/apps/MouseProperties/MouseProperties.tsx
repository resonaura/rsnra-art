import { useState } from "react";
import { Button, Checkbox, GroupBox, Radio, Select, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";
import { Slider95 } from "../../components/Slider95/Slider95";
import {
  CURSOR_GALLERY,
  CURSOR_ROLES,
  type CursorRoleId,
  cursorPreviewUrl,
} from "../../data/cursors";
import { useCursorStore, type CursorSchemeId } from "../../store/cursorStore";
import { useWindowStore } from "../../store/windowStore";

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
  background: ${({ theme, $active }) => ($active ? theme.hoverBackground : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.headerText : "black")};

  img {
    width: 24px;
    height: 24px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const PreviewBox = styled.div`
  width: 88px;
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

const BrowseOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
`;

const BrowsePanel = styled(GroupBox)`
  width: 92%;
  height: 82%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.material};
`;

const Gallery = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const GalleryItem = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 60px;
  padding: 4px 2px;
  border: 1px dotted transparent;
  background: ${({ theme, $active }) => ($active ? theme.hoverBackground : "transparent")};
  cursor: pointer;
  font-size: 10px;

  img {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
  }
`;

const SCHEMES: { id: CursorSchemeId; label: string }[] = [
  { id: "none", label: "(None)" },
  { id: "windows", label: "Windows Standard" },
];

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
  const [browsing, setBrowsing] = useState(false);
  const [rightHanded, setRightHanded] = useState(true);
  const [dblClick, setDblClick] = useState(50);
  const [pointerSpeed, setPointerSpeed] = useState(50);

  const apply = () => {
    setScheme(scheme);
    for (const role of CURSOR_ROLES) {
      setRoleFile(role.id, files[role.id]);
    }
  };

  const selected = CURSOR_ROLES.find((r) => r.id === selectedRole)!;

  return (
    <Layout>
      <Tabs value={tab} onChange={(v: string) => setTab(v)} style={{ fontSize: 11 }}>
        <Tab value="Buttons">Buttons</Tab>
        <Tab value="Pointers">Pointers</Tab>
        <Tab value="Pointer Options">Pointer Options</Tab>
      </Tabs>
      <Body>
        {tab === "Buttons" && (
          <>
            <GroupBox label="Button configuration">
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
            <GroupBox label="Double-click speed">
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                Slow
                <Slider95
                  value={dblClick}
                  onChange={setDblClick}
                  size="100%"
                />
                Fast
              </div>
            </GroupBox>
            <GroupBox label="ClickLock">
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
                  value={scheme}
                  options={SCHEMES.map((s) => ({ label: s.label, value: s.id }))}
                  width="100%"
                  onChange={(opt) => setLocalScheme(opt.value)}
                />
              </div>
              <PreviewBox>
                {scheme !== "none" && (
                  <img src={cursorPreviewUrl(files[selectedRole])} alt="" draggable={false} />
                )}
              </PreviewBox>
            </SchemeRow>

            <div style={{ fontSize: 12 }}>Customize:</div>
            <List
              contentStyle={{ display: "flex", flexDirection: "column" }}
            >
              {CURSOR_ROLES.map((r) => (
                <Row
                  key={r.id}
                  $active={r.id === selectedRole}
                  onClick={() => setSelectedRole(r.id)}
                >
                  <span>{r.label}</span>
                  {scheme !== "none" && (
                    <img src={cursorPreviewUrl(files[r.id])} alt="" draggable={false} />
                  )}
                </Row>
              ))}
            </List>

            <PointersHead>
              <Button
                disabled={scheme === "none"}
                onClick={() => resetRoleFile(selectedRole)}
                style={{ flex: 1 }}
              >
                Use Default
              </Button>
              <Button
                disabled={scheme === "none"}
                onClick={() => setBrowsing(true)}
                style={{ flex: 1 }}
              >
                Browse...
              </Button>
            </PointersHead>

            {browsing && (
              <BrowseOverlay>
                <BrowsePanel label={`Browse — ${selected.label}`}>
                  <Gallery
                    contentStyle={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      padding: 6,
                      alignContent: "flex-start",
                    }}
                  >
                    {CURSOR_GALLERY.map((file) => (
                      <GalleryItem
                        key={file}
                        $active={files[selectedRole] === file}
                        title={file}
                        onClick={() => {
                          setFiles((f) => ({ ...f, [selectedRole]: file }));
                          setBrowsing(false);
                        }}
                      >
                        <img src={cursorPreviewUrl(file)} alt="" draggable={false} />
                        <span>{file.replace(/\.CUR$/i, "")}</span>
                      </GalleryItem>
                    ))}
                  </Gallery>
                  <BtnRow>
                    <Button onClick={() => setBrowsing(false)}>Cancel</Button>
                  </BtnRow>
                </BrowsePanel>
              </BrowseOverlay>
            )}
          </>
        )}

        {tab === "Pointer Options" && (
          <>
            <GroupBox label="Pointer speed">
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                Slow
                <Slider95 value={pointerSpeed} onChange={setPointerSpeed} size="100%" />
                Fast
              </div>
              <Button disabled style={{ fontSize: 11 }}>
                Accelerate...
              </Button>
            </GroupBox>
            <GroupBox label="SnapTo">
              <Checkbox
                label="Automatically move pointer to the default button in a dialog box."
                disabled
              />
            </GroupBox>
            <GroupBox label="Visibility">
              <Checkbox label="Show pointer trails" disabled />
              <Checkbox label="Hide pointer while typing" disabled style={{ marginTop: 4 }} />
              <Checkbox
                label="Show location of pointer when you press the CTRL key"
                disabled
                style={{ marginTop: 4 }}
              />
            </GroupBox>
          </>
        )}

        <BtnRow>
          <Button
            onClick={() => {
              apply();
              closeWindow(windowId);
            }}
          >
            OK
          </Button>
          <Button onClick={() => closeWindow(windowId)}>Cancel</Button>
          <Button onClick={apply}>Apply</Button>
        </BtnRow>
      </Body>
    </Layout>
  );
}
