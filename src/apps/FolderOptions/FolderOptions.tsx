import { useState } from "react";
import { Button, Checkbox, GroupBox, Radio, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { useFilePrefsStore } from "../../store/filePrefsStore";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  gap: 8px;
`;

const Content = styled(TabBody)`
  padding: 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${({ theme }) => theme.material};
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
`;

const OptionsList = styled.div`
  flex: 1;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
  padding: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SettingRow = styled.div<{ $indent?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: ${({ $indent }) => ($indent ? "20px" : "0")};
  font-size: 11px;
`;

const CtxDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;

export function FolderOptions({ windowId }: { windowId: string }) {
  const showHidden = useFilePrefsStore((s) => s.showHidden);
  const setShowHidden = useFilePrefsStore((s) => s.setShowHidden);
  const closeWindow = useWindowStore((s) => s.closeWindow);

  const [activeTab, setActiveTab] = useState("general");
  const [localShowHidden, setLocalShowHidden] = useState(showHidden);

  // General tab states (mocked/pure visual since they don't affect logic, or can be interactive)
  const [activeDesktop, setActiveDesktop] = useState("classic");
  const [webView, setWebView] = useState("classic");
  const [browseFolders, setBrowseFolders] = useState("same");
  const [clickMode, setClickMode] = useState("double");

  // View tab states (mocked except hidden files)
  const [netFolders, setNetFolders] = useState(true);
  const [allCp, setAllCp] = useState(false);
  const [fullPathAddr, setFullPathAddr] = useState(false);
  const [fullPathTitle, setFullPathTitle] = useState(false);
  const [hideExt, setHideExt] = useState(true);
  const [hideSystem, setHideSystem] = useState(true);
  const [separateProc, setSeparateProc] = useState(false);
  const [rememberSettings, setRememberSettings] = useState(true);
  const [showDocsDesktop, setShowDocsDesktop] = useState(true);
  const [showPopupDesc, setShowPopupDesc] = useState(true);

  const handleApply = () => {
    setShowHidden(localShowHidden);
  };

  const handleOk = () => {
    handleApply();
    closeWindow(windowId);
  };

  return (
    <Layout>
      <Tabs value={activeTab} onChange={setActiveTab} style={{ fontSize: 11 }}>
        <Tab value="general">General</Tab>
        <Tab value="view">View</Tab>
        <Tab value="filetypes">File Types</Tab>
      </Tabs>
      <Content>
        {activeTab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11 }}>
            <GroupBox label="Active Desktop">
              <Radio
                name="desktop"
                value="web"
                checked={activeDesktop === "web"}
                onChange={() => setActiveDesktop("web")}
                label="Enable Web content on my desktop"
                style={{ fontSize: 11 }}
              />
              <Radio
                name="desktop"
                value="classic"
                checked={activeDesktop === "classic"}
                onChange={() => setActiveDesktop("classic")}
                label="Use Windows classic desktop"
                style={{ fontSize: 11 }}
              />
            </GroupBox>
            <GroupBox label="Web View">
              <Radio
                name="webview"
                value="web"
                checked={webView === "web"}
                onChange={() => setWebView("web")}
                label="Enable Web content in folders"
                style={{ fontSize: 11 }}
              />
              <Radio
                name="webview"
                value="classic"
                checked={webView === "classic"}
                onChange={() => setWebView("classic")}
                label="Use Windows classic folders"
                style={{ fontSize: 11 }}
              />
            </GroupBox>
            <GroupBox label="Browse Folders">
              <Radio
                name="browse"
                value="same"
                checked={browseFolders === "same"}
                onChange={() => setBrowseFolders("same")}
                label="Open each folder in the same window"
                style={{ fontSize: 11 }}
              />
              <Radio
                name="browse"
                value="own"
                checked={browseFolders === "own"}
                onChange={() => setBrowseFolders("own")}
                label="Open each folder in its own window"
                style={{ fontSize: 11 }}
              />
            </GroupBox>
            <GroupBox label="Click items as follows">
              <Radio
                name="click"
                value="single"
                checked={clickMode === "single"}
                onChange={() => setClickMode("single")}
                label="Single-click to open an item (point to select)"
                style={{ fontSize: 11 }}
              />
              <Radio
                name="click"
                value="double"
                checked={clickMode === "double"}
                onChange={() => setClickMode("double")}
                label="Double-click to open an item (single-click to select)"
                style={{ fontSize: 11 }}
              />
            </GroupBox>
          </div>
        )}

        {activeTab === "view" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
            <GroupBox label="Folder views">
              <div style={{ display: "flex", gap: 6 }}>
                <Button style={{ fontSize: 11, flex: 1 }}>Like Current Folder</Button>
                <Button style={{ fontSize: 11, flex: 1 }}>Reset All Folders</Button>
              </div>
            </GroupBox>
            <div style={{ fontSize: 11 }}>Advanced settings:</div>
            <OptionsList>
              <SettingRow>
                <Checkbox
                  checked={netFolders}
                  onChange={(e: any) => setNetFolders(e.target.checked)}
                  label="Automatically search for network folders and printers"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={allCp}
                  onChange={(e: any) => setAllCp(e.target.checked)}
                  label="Display all Control Panel options and all folder contents"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={fullPathAddr}
                  onChange={(e: any) => setFullPathAddr(e.target.checked)}
                  label="Display the full path in the address bar"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={fullPathTitle}
                  onChange={(e: any) => setFullPathTitle(e.target.checked)}
                  label="Display the full path in title bar"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              
              {/* Hidden files radio group */}
              <div style={{ paddingLeft: 4, fontWeight: "bold", fontSize: 11 }}>Hidden files and folders:</div>
              <SettingRow $indent>
                <Radio
                  name="hiddenfiles"
                  value="no"
                  checked={!localShowHidden}
                  onChange={() => setLocalShowHidden(false)}
                  label="Do not show hidden files and folders"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent>
                <Radio
                  name="hiddenfiles"
                  value="yes"
                  checked={localShowHidden}
                  onChange={() => setLocalShowHidden(true)}
                  label="Show hidden files and folders"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>

              <SettingRow>
                <Checkbox
                  checked={hideExt}
                  onChange={(e: any) => setHideExt(e.target.checked)}
                  label="Hide file extensions for known file types"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={hideSystem}
                  onChange={(e: any) => setHideSystem(e.target.checked)}
                  label="Hide protected operating system files (Recommended)"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={separateProc}
                  onChange={(e: any) => setSeparateProc(e.target.checked)}
                  label="Launch folder windows in a separate process"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={rememberSettings}
                  onChange={(e: any) => setRememberSettings(e.target.checked)}
                  label="Remember each folder's view settings"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={showDocsDesktop}
                  onChange={(e: any) => setShowDocsDesktop(e.target.checked)}
                  label="Show My Documents on the Desktop"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow>
                <Checkbox
                  checked={showPopupDesc}
                  onChange={(e: any) => setShowPopupDesc(e.target.checked)}
                  label="Show pop-up description for folder and desktop items"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
            </OptionsList>
          </div>
        )}

        {activeTab === "filetypes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, fontSize: 11 }}>
            <div>Registered file types:</div>
            <OptionsList>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>Extension</span>
                <span>File Type</span>
              </div>
              <CtxDivider style={{ margin: "2px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>TXT</span>
                <span>Text Document</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>BMP</span>
                <span>Bitmap Image</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PNG</span>
                <span>Portable Network Graphic</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>LNK</span>
                <span>Shortcut</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>WAV</span>
                <span>Wave Sound</span>
              </div>
            </OptionsList>
          </div>
        )}
      </Content>
      <ButtonRow>
        <Button onClick={handleOk} style={{ width: 70, fontSize: 11 }}>OK</Button>
        <Button onClick={() => closeWindow(windowId)} style={{ width: 70, fontSize: 11 }}>Cancel</Button>
        <Button onClick={handleApply} style={{ width: 70, fontSize: 11 }}>Apply</Button>
      </ButtonRow>
    </Layout>
  );
}
