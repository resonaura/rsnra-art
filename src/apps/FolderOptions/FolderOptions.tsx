import { useState } from "react";
import { Button, Checkbox, GroupBox, Radio, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { Icon } from "../../components/Icon/Icon";
import { ScrollArea } from "../../components/ScrollArea";
import {
  useFilePrefsStore,
  type BrowseFoldersMode,
  type UnderlineMode,
} from "../../store/filePrefsStore";
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
  overflow-y: auto;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  zoom: 0.8;
`;

const RestoreRow = styled.div`
  display: flex;
  justify-content: flex-end;
  zoom: 0.8;
`;

const OptionsList = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
  zoom: 0.8;
`;

const SettingRow = styled.div<{ $indent?: 0 | 1 | 2 }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: ${({ $indent }) => ($indent ? `${$indent * 20}px` : "0")};
  font-size: 11px;
`;

const TreeHeader = styled.div<{ $indent?: 0 | 1 }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: ${({ $indent }) => ($indent ? `${$indent * 20}px` : "0")};
  font-size: 11px;
`;

const IconRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const RadioColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
`;

const CtxDivider = styled.div`
  height: 1px;
  margin: 3px 2px;
  background: ${({ theme }) => theme.borderDark};
  border-bottom: 1px solid ${({ theme }) => theme.borderLightest};
`;

// Mirrors the store's own defaults (see filePrefsStore.ts) — used by "Restore
// Defaults", which only resets the dialog's staged values until Apply/OK.
const DEFAULTS = {
  showHidden: false,
  singleClickOpen: true,
  underlineMode: "browser" as UnderlineMode,
  browseFoldersMode: "same" as BrowseFoldersMode,
  webContentInFolders: true,
  activeDesktopWebContent: false,
  hideKnownExtensions: false,
  hideProtectedSystemFiles: true,
  showMyDocumentsOnDesktop: true,
  showPopupDescriptions: true,
  fullPathInTitleBar: false,
  fullPathInAddressBar: false,
  autoSearchNetworkFolders: true,
  displayAllControlPanelOptions: false,
  launchFoldersInSeparateProcess: false,
  rememberFolderViewSettings: true,
};

export function FolderOptions({ windowId }: { windowId: string }) {
  const store = useFilePrefsStore();
  const closeWindow = useWindowStore((s) => s.closeWindow);

  const [activeTab, setActiveTab] = useState("general");

  // Every field is staged locally and only committed to the persisted store
  // on Apply/OK — Cancel discards, exactly like the real Windows dialog.
  const [showHidden, setShowHidden] = useState(store.showHidden);
  const [activeDesktopWebContent, setActiveDesktopWebContent] = useState(store.activeDesktopWebContent);
  const [webContentInFolders, setWebContentInFolders] = useState(store.webContentInFolders);
  const [browseFoldersMode, setBrowseFoldersMode] = useState(store.browseFoldersMode);
  const [singleClickOpen, setSingleClickOpen] = useState(store.singleClickOpen);
  const [underlineMode, setUnderlineMode] = useState(store.underlineMode);

  const [autoSearchNetworkFolders, setAutoSearchNetworkFolders] = useState(store.autoSearchNetworkFolders);
  const [displayAllControlPanelOptions, setDisplayAllControlPanelOptions] = useState(store.displayAllControlPanelOptions);
  const [fullPathInAddressBar, setFullPathInAddressBar] = useState(store.fullPathInAddressBar);
  const [fullPathInTitleBar, setFullPathInTitleBar] = useState(store.fullPathInTitleBar);
  const [hideKnownExtensions, setHideKnownExtensions] = useState(store.hideKnownExtensions);
  const [hideProtectedSystemFiles, setHideProtectedSystemFiles] = useState(store.hideProtectedSystemFiles);
  const [launchFoldersInSeparateProcess, setLaunchFoldersInSeparateProcess] = useState(store.launchFoldersInSeparateProcess);
  const [rememberFolderViewSettings, setRememberFolderViewSettings] = useState(store.rememberFolderViewSettings);
  const [showMyDocumentsOnDesktop, setShowMyDocumentsOnDesktop] = useState(store.showMyDocumentsOnDesktop);
  const [showPopupDescriptions, setShowPopupDescriptions] = useState(store.showPopupDescriptions);

  const restoreDefaults = () => {
    setShowHidden(DEFAULTS.showHidden);
    setActiveDesktopWebContent(DEFAULTS.activeDesktopWebContent);
    setWebContentInFolders(DEFAULTS.webContentInFolders);
    setBrowseFoldersMode(DEFAULTS.browseFoldersMode);
    setSingleClickOpen(DEFAULTS.singleClickOpen);
    setUnderlineMode(DEFAULTS.underlineMode);
    setAutoSearchNetworkFolders(DEFAULTS.autoSearchNetworkFolders);
    setDisplayAllControlPanelOptions(DEFAULTS.displayAllControlPanelOptions);
    setFullPathInAddressBar(DEFAULTS.fullPathInAddressBar);
    setFullPathInTitleBar(DEFAULTS.fullPathInTitleBar);
    setHideKnownExtensions(DEFAULTS.hideKnownExtensions);
    setHideProtectedSystemFiles(DEFAULTS.hideProtectedSystemFiles);
    setLaunchFoldersInSeparateProcess(DEFAULTS.launchFoldersInSeparateProcess);
    setRememberFolderViewSettings(DEFAULTS.rememberFolderViewSettings);
    setShowMyDocumentsOnDesktop(DEFAULTS.showMyDocumentsOnDesktop);
    setShowPopupDescriptions(DEFAULTS.showPopupDescriptions);
  };

  const handleApply = () => {
    store.setShowHidden(showHidden);
    store.setActiveDesktopWebContent(activeDesktopWebContent);
    store.setWebContentInFolders(webContentInFolders);
    store.setBrowseFoldersMode(browseFoldersMode);
    store.setSingleClickOpen(singleClickOpen);
    store.setUnderlineMode(underlineMode);
    store.setAutoSearchNetworkFolders(autoSearchNetworkFolders);
    store.setDisplayAllControlPanelOptions(displayAllControlPanelOptions);
    store.setFullPathInAddressBar(fullPathInAddressBar);
    store.setFullPathInTitleBar(fullPathInTitleBar);
    store.setHideKnownExtensions(hideKnownExtensions);
    store.setHideProtectedSystemFiles(hideProtectedSystemFiles);
    store.setLaunchFoldersInSeparateProcess(launchFoldersInSeparateProcess);
    store.setRememberFolderViewSettings(rememberFolderViewSettings);
    store.setShowMyDocumentsOnDesktop(showMyDocumentsOnDesktop);
    store.setShowPopupDescriptions(showPopupDescriptions);
  };

  const handleOk = () => {
    handleApply();
    closeWindow(windowId);
  };

  return (
    <Layout>
      <Tabs value={activeTab} onChange={setActiveTab} style={{ fontSize: 11, zoom: 0.8 }}>
        <Tab value="general">General</Tab>
        <Tab value="view">View</Tab>
        <Tab value="filetypes">File Types</Tab>
      </Tabs>
      <Content>
        {activeTab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11 }}>
            <GroupBox style={{ zoom: 0.8 }} label="Active Desktop">
              <IconRow>
                <Icon src="/icons/w98_monitor_windows.ico" size={32} style={{ width: 32, height: 32 }} />
                <RadioColumn>
                  <Radio
                    name="desktop"
                    value="web"
                    checked={activeDesktopWebContent}
                    onChange={() => setActiveDesktopWebContent(true)}
                    label="Enable Web content on my desktop"
                    style={{ fontSize: 11 }}
                  />
                  <Radio
                    name="desktop"
                    value="classic"
                    checked={!activeDesktopWebContent}
                    onChange={() => setActiveDesktopWebContent(false)}
                    label="Use Windows classic desktop"
                    style={{ fontSize: 11 }}
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Web View">
              <IconRow>
                <Icon src="/icons/w98_shell_window3.ico" size={32} style={{ width: 32, height: 32 }} />
                <RadioColumn>
                  <Radio
                    name="webview"
                    value="web"
                    checked={webContentInFolders}
                    onChange={() => setWebContentInFolders(true)}
                    label="Enable Web content in folders"
                    style={{ fontSize: 11 }}
                  />
                  <Radio
                    name="webview"
                    value="classic"
                    checked={!webContentInFolders}
                    onChange={() => setWebContentInFolders(false)}
                    label="Use Windows classic folders"
                    style={{ fontSize: 11 }}
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Browse Folders">
              <IconRow>
                <Icon src="/icons/w98_shell_window5.ico" size={32} style={{ width: 32, height: 32 }} />
                <RadioColumn>
                  <Radio
                    name="browse"
                    value="same"
                    checked={browseFoldersMode === "same"}
                    onChange={() => setBrowseFoldersMode("same")}
                    label="Open each folder in the same window"
                    style={{ fontSize: 11 }}
                  />
                  <Radio
                    name="browse"
                    value="own"
                    checked={browseFoldersMode === "own"}
                    onChange={() => setBrowseFoldersMode("own")}
                    label="Open each folder in its own window"
                    style={{ fontSize: 11 }}
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <GroupBox style={{ zoom: 0.8 }} label="Click items as follows">
              <IconRow>
                <Icon
                  src="/icons/w98_accessibility_key_pointer.ico"
                  size={32}
                  style={{ width: 32, height: 32 }}
                />
                <RadioColumn>
                  <Radio
                    name="click"
                    value="single"
                    checked={singleClickOpen}
                    onChange={() => setSingleClickOpen(true)}
                    label="Single-click to open an item (point to select)"
                    style={{ fontSize: 11 }}
                  />
                  <RadioColumn style={{ paddingLeft: 20 }}>
                    <Radio
                      name="underline"
                      value="browser"
                      checked={underlineMode === "browser"}
                      onChange={() => setUnderlineMode("browser")}
                      disabled={!singleClickOpen}
                      label="Underline icon titles consistent with my browser"
                      style={{ fontSize: 11 }}
                    />
                    <Radio
                      name="underline"
                      value="point"
                      checked={underlineMode === "point"}
                      onChange={() => setUnderlineMode("point")}
                      disabled={!singleClickOpen}
                      label="Underline icon titles only when I point at them"
                      style={{ fontSize: 11 }}
                    />
                  </RadioColumn>
                  <Radio
                    name="click"
                    value="double"
                    checked={!singleClickOpen}
                    onChange={() => setSingleClickOpen(false)}
                    label="Double-click to open an item (single-click to select)"
                    style={{ fontSize: 11 }}
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <RestoreRow>
              <Button onClick={restoreDefaults} style={{ fontSize: 11 }}>Restore Defaults</Button>
            </RestoreRow>
          </div>
        )}

        {activeTab === "view" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
            <GroupBox style={{ zoom: 0.8 }} label="Folder views">
              <div style={{ display: "flex", gap: 6 }}>
                <Button style={{ fontSize: 11, flex: 1 }}>Like Current Folder</Button>
                <Button style={{ fontSize: 11, flex: 1 }}>Reset All Folders</Button>
              </div>
            </GroupBox>
            <div style={{ fontSize: 11 }}>Advanced settings:</div>
            <OptionsList orientation="vertical" contentStyle={{ padding: 6, gap: 4 }}>
              <TreeHeader>
                <Icon src="/icons/w98_directory_closed.ico" size={16} style={{ width: 16, height: 16 }} />
                Files and Folders
              </TreeHeader>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={autoSearchNetworkFolders}
                  onChange={(e: any) => setAutoSearchNetworkFolders(e.target.checked)}
                  label="Automatically search for network folders and printers"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={displayAllControlPanelOptions}
                  onChange={(e: any) => setDisplayAllControlPanelOptions(e.target.checked)}
                  label="Display all Control Panel options and all folder contents"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={fullPathInAddressBar}
                  onChange={(e: any) => setFullPathInAddressBar(e.target.checked)}
                  label="Display the full path in the address bar"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={fullPathInTitleBar}
                  onChange={(e: any) => setFullPathInTitleBar(e.target.checked)}
                  label="Display the full path in title bar"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>

              <TreeHeader $indent={1}>
                <Icon src="/icons/w98_directory_closed.ico" size={16} style={{ width: 16, height: 16 }} />
                Hidden files and folders
              </TreeHeader>
              <SettingRow $indent={2}>
                <Radio
                  name="hiddenfiles"
                  value="no"
                  checked={!showHidden}
                  onChange={() => setShowHidden(false)}
                  label="Do not show hidden files and folders"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={2}>
                <Radio
                  name="hiddenfiles"
                  value="yes"
                  checked={showHidden}
                  onChange={() => setShowHidden(true)}
                  label="Show hidden files and folders"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>

              <SettingRow $indent={1}>
                <Checkbox
                  checked={hideKnownExtensions}
                  onChange={(e: any) => setHideKnownExtensions(e.target.checked)}
                  label="Hide file extensions for known file types"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={hideProtectedSystemFiles}
                  onChange={(e: any) => setHideProtectedSystemFiles(e.target.checked)}
                  label="Hide protected operating system files (Recommended)"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={launchFoldersInSeparateProcess}
                  onChange={(e: any) => setLaunchFoldersInSeparateProcess(e.target.checked)}
                  label="Launch folder windows in a separate process"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={rememberFolderViewSettings}
                  onChange={(e: any) => setRememberFolderViewSettings(e.target.checked)}
                  label="Remember each folder's view settings"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={showMyDocumentsOnDesktop}
                  onChange={(e: any) => setShowMyDocumentsOnDesktop(e.target.checked)}
                  label="Show My Documents on the Desktop"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={showPopupDescriptions}
                  onChange={(e: any) => setShowPopupDescriptions(e.target.checked)}
                  label="Show pop-up description for folder and desktop items"
                  style={{ fontSize: 11 }}
                />
              </SettingRow>
            </OptionsList>
            <RestoreRow>
              <Button onClick={restoreDefaults} style={{ fontSize: 11 }}>Restore Defaults</Button>
            </RestoreRow>
          </div>
        )}

        {activeTab === "filetypes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, fontSize: 11 }}>
            <div>Registered file types:</div>
            <OptionsList orientation="vertical" contentStyle={{ padding: 6, gap: 4 }}>
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
