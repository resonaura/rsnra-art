import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  GroupBox,
  Radio,
  Tab,
  TabBody,
  Tabs,
  TextInput,
} from "react95";
import styled from "styled-components";
import { Icon } from "../../components/Icon/Icon";
import { IconPickerDialog } from "../../components/IconPickerDialog/IconPickerDialog";
import { OpenWithDialog } from "../../components/OpenWithDialog/OpenWithDialog";
import { ScrollArea } from "../../components/ScrollArea";
import {
  KNOWN_EXTENSIONS,
  extIcon,
  iconPickerPool,
  typeLabelForExtension,
} from "../../data/fileIcons";
import { candidatesFor, getPreferredApp } from "../../data/fileOpen";
import { R95_SCALE } from "../../react95.conf";
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
`;



const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
`;

const RestoreRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const OptionsList = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
`;

const SettingRow = styled.div<{ $indent?: 0 | 1 | 2 }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: ${({ $indent }) => ($indent ? `${$indent * 20}px` : "0")};
`;

const TreeHeader = styled.div<{ $indent?: 0 | 1 }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: ${({ $indent }) => ($indent ? `${$indent * 20}px` : "0")};
  margin-bottom: 5px;
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

const TypeRow = styled.button<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 2px 4px;
  text-align: left;
  border: none;
  cursor: default;
  font-family: inherit;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};

  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
`;

const TypeExt = styled.span`
  width: 56px;
  flex-shrink: 0;
  font-weight: bold;
`;

const NewTypeForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

// Mirrors the store's own defaults (see filePrefsStore.ts) — used by "Restore
// Defaults", which only resets the dialog's staged values until Apply/OK.
const DEFAULTS = {
  showHidden: false,
  singleClickOpen: false,
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
  const [activeDesktopWebContent, setActiveDesktopWebContent] = useState(
    store.activeDesktopWebContent,
  );
  const [webContentInFolders, setWebContentInFolders] = useState(
    store.webContentInFolders,
  );
  const [browseFoldersMode, setBrowseFoldersMode] = useState(
    store.browseFoldersMode,
  );
  const [singleClickOpen, setSingleClickOpen] = useState(store.singleClickOpen);
  const [underlineMode, setUnderlineMode] = useState(store.underlineMode);

  const [autoSearchNetworkFolders, setAutoSearchNetworkFolders] = useState(
    store.autoSearchNetworkFolders,
  );
  const [displayAllControlPanelOptions, setDisplayAllControlPanelOptions] =
    useState(store.displayAllControlPanelOptions);
  const [fullPathInAddressBar, setFullPathInAddressBar] = useState(
    store.fullPathInAddressBar,
  );
  const [fullPathInTitleBar, setFullPathInTitleBar] = useState(
    store.fullPathInTitleBar,
  );
  const [hideKnownExtensions, setHideKnownExtensions] = useState(
    store.hideKnownExtensions,
  );
  const [hideProtectedSystemFiles, setHideProtectedSystemFiles] = useState(
    store.hideProtectedSystemFiles,
  );
  const [launchFoldersInSeparateProcess, setLaunchFoldersInSeparateProcess] =
    useState(store.launchFoldersInSeparateProcess);
  const [rememberFolderViewSettings, setRememberFolderViewSettings] = useState(
    store.rememberFolderViewSettings,
  );
  const [showMyDocumentsOnDesktop, setShowMyDocumentsOnDesktop] = useState(
    store.showMyDocumentsOnDesktop,
  );
  const [showPopupDescriptions, setShowPopupDescriptions] = useState(
    store.showPopupDescriptions,
  );

  // File Types tab — reads/writes the store directly (no Apply/OK staging;
  // matches how the real dialog commits type-registry edits immediately).
  const allExtensions = useMemo(() => {
    const set = new Set<string>([
      ...KNOWN_EXTENSIONS,
      ...Object.keys(store.customFileTypes),
    ]);
    return Array.from(set).sort();
  }, [store.customFileTypes]);
  const [selectedExt, setSelectedExt] = useState<string | null>(
    allExtensions[0] ?? null,
  );
  const [showOpenWith, setShowOpenWith] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [newExt, setNewExt] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const typeLabel = (ext: string) =>
    store.customFileTypes[ext] ?? typeLabelForExtension(ext);
  const typeIcon = (ext: string) =>
    store.extensionIcons[ext] ?? extIcon(`file.${ext}`);
  const opener = selectedExt
    ? (getPreferredApp(`file.${selectedExt}`) ??
      candidatesFor(`file.${selectedExt}`)[0])
    : null;
  const isCustomExt = selectedExt
    ? selectedExt in store.customFileTypes
    : false;

  const addNewType = () => {
    const ext = newExt.trim().toLowerCase().replace(/^\./, "");
    if (!ext || !newLabel.trim()) return;
    store.addCustomFileType(ext, newLabel.trim());
    setSelectedExt(ext);
    setNewExt("");
    setNewLabel("");
    setShowNewType(false);
  };

  const deleteSelectedType = () => {
    if (!selectedExt || !isCustomExt) return;
    store.removeCustomFileType(selectedExt);
    store.resetExtensionIcon(selectedExt);
    setSelectedExt(allExtensions.find((e) => e !== selectedExt) ?? null);
  };

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
    <Layout style={{ zoom: R95_SCALE }}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="general">General</Tab>
        <Tab value="view">View</Tab>
        <Tab value="filetypes">File Types</Tab>
      </Tabs>
      <TabBody>
        {activeTab === "general" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <GroupBox label="Active Desktop">
              <IconRow>
                <Icon
                  src={`/icons/shell32.dll/${activeDesktopWebContent ? "049" : "050"}.ico`}
                  size={32}
                  isInReact95
                />
                <RadioColumn>
                  <Radio
                    name="desktop"
                    value="web"
                    checked={activeDesktopWebContent}
                    onChange={() => setActiveDesktopWebContent(true)}
                    label="Enable Web content on my desktop"
                  />
                  <Radio
                    name="desktop"
                    value="classic"
                    checked={!activeDesktopWebContent}
                    onChange={() => setActiveDesktopWebContent(false)}
                    label="Use Windows classic desktop"
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <GroupBox label="Web View">
              <IconRow>
                <Icon
                  src={`/icons/shell32.dll/${webContentInFolders ? "051" : "052"}.ico`}
                  size={32}
                  isInReact95
                />
                <RadioColumn>
                  <Radio
                    name="webview"
                    value="web"
                    checked={webContentInFolders}
                    onChange={() => setWebContentInFolders(true)}
                    label="Enable Web content in folders"
                  />
                  <Radio
                    name="webview"
                    value="classic"
                    checked={!webContentInFolders}
                    onChange={() => setWebContentInFolders(false)}
                    label="Use Windows classic folders"
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <GroupBox label="Browse Folders">
              <IconRow>
                <Icon
                  src={`/icons/shell32.dll/${browseFoldersMode === "same" ? "053" : "054"}.ico`}
                  size={32}
                  isInReact95
                />
                <RadioColumn>
                  <Radio
                    name="browse"
                    value="same"
                    checked={browseFoldersMode === "same"}
                    onChange={() => setBrowseFoldersMode("same")}
                    label="Open each folder in the same window"
                  />
                  <Radio
                    name="browse"
                    value="own"
                    checked={browseFoldersMode === "own"}
                    onChange={() => setBrowseFoldersMode("own")}
                    label="Open each folder in its own window"
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <GroupBox label="Click items as follows">
              <IconRow>
                <Icon
                  src={`/icons/shell32.dll/${singleClickOpen ? "055" : "056"}.ico`}
                  size={32}
                  isInReact95
                />
                <RadioColumn>
                  <Radio
                    name="click"
                    value="single"
                    checked={singleClickOpen}
                    onChange={() => setSingleClickOpen(true)}
                    label="Single-click to open an item (point to select)"
                  />
                  <RadioColumn style={{ paddingLeft: 20 }}>
                    <Radio
                      name="underline"
                      value="browser"
                      checked={underlineMode === "browser"}
                      onChange={() => setUnderlineMode("browser")}
                      disabled={!singleClickOpen}
                      label="Underline icon titles consistent with my browser"
                    />
                    <Radio
                      name="underline"
                      value="point"
                      checked={underlineMode === "point"}
                      onChange={() => setUnderlineMode("point")}
                      disabled={!singleClickOpen}
                      label="Underline icon titles only when I point at them"
                    />
                  </RadioColumn>
                  <Radio
                    name="click"
                    value="double"
                    checked={!singleClickOpen}
                    onChange={() => setSingleClickOpen(false)}
                    label="Double-click to open an item (single-click to select)"
                  />
                </RadioColumn>
              </IconRow>
            </GroupBox>
            <RestoreRow>
              <Button onClick={restoreDefaults}>Restore Defaults</Button>
            </RestoreRow>
          </div>
        )}

        {activeTab === "view" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
              minHeight: 0,
            }}
          >
            <GroupBox label="Folder views">
              <div style={{ display: "flex", gap: 6 }}>
                <Button>Like Current Folder</Button>
                <Button>Reset All Folders</Button>
              </div>
            </GroupBox>
            <div>Advanced settings:</div>
            <OptionsList
              isInReact95
              orientation="vertical"
              contentStyle={{ padding: 6, gap: 4 }}
              style={{ maxHeight: 480 }}
            >
              <TreeHeader>
                <Icon
                  src="/icons/w98_directory_closed.ico"
                  size={16}
                  isInReact95
                />
                Files and Folders
              </TreeHeader>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={autoSearchNetworkFolders}
                  onChange={(e: any) =>
                    setAutoSearchNetworkFolders(e.target.checked)
                  }
                  label="Automatically search for network folders and printers"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={displayAllControlPanelOptions}
                  onChange={(e: any) =>
                    setDisplayAllControlPanelOptions(e.target.checked)
                  }
                  label="Display all Control Panel options and all folder contents"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={fullPathInAddressBar}
                  onChange={(e: any) =>
                    setFullPathInAddressBar(e.target.checked)
                  }
                  label="Display the full path in the address bar"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={fullPathInTitleBar}
                  onChange={(e: any) => setFullPathInTitleBar(e.target.checked)}
                  label="Display the full path in title bar"
                />
              </SettingRow>

              <TreeHeader $indent={1} style={{ marginTop: 5 }}>
                <Icon
                  src="/icons/w98_directory_closed.ico"
                  size={16}
                  isInReact95
                />
                Hidden files and folders
              </TreeHeader>
              <SettingRow $indent={2}>
                <Radio
                  name="hiddenfiles"
                  value="no"
                  checked={!showHidden}
                  onChange={() => setShowHidden(false)}
                  label="Do not show hidden files and folders"
                />
              </SettingRow>
              <SettingRow $indent={2}>
                <Radio
                  name="hiddenfiles"
                  value="yes"
                  checked={showHidden}
                  onChange={() => setShowHidden(true)}
                  label="Show hidden files and folders"
                />
              </SettingRow>

              <SettingRow $indent={1}>
                <Checkbox
                  checked={hideKnownExtensions}
                  onChange={(e: any) =>
                    setHideKnownExtensions(e.target.checked)
                  }
                  label="Hide file extensions for known file types"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={hideProtectedSystemFiles}
                  onChange={(e: any) =>
                    setHideProtectedSystemFiles(e.target.checked)
                  }
                  label="Hide protected operating system files (Recommended)"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={launchFoldersInSeparateProcess}
                  onChange={(e: any) =>
                    setLaunchFoldersInSeparateProcess(e.target.checked)
                  }
                  label="Launch folder windows in a separate process"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={rememberFolderViewSettings}
                  onChange={(e: any) =>
                    setRememberFolderViewSettings(e.target.checked)
                  }
                  label="Remember each folder's view settings"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={showMyDocumentsOnDesktop}
                  onChange={(e: any) =>
                    setShowMyDocumentsOnDesktop(e.target.checked)
                  }
                  label="Show My Documents on the Desktop"
                />
              </SettingRow>
              <SettingRow $indent={1}>
                <Checkbox
                  checked={showPopupDescriptions}
                  onChange={(e: any) =>
                    setShowPopupDescriptions(e.target.checked)
                  }
                  label="Show pop-up description for folder and desktop items"
                />
              </SettingRow>
            </OptionsList>
            <RestoreRow>
              <Button onClick={restoreDefaults}>Restore Defaults</Button>
            </RestoreRow>
          </div>
        )}

        {activeTab === "filetypes" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
              minHeight: 0,
            }}
          >
            <div>Registered file types:</div>
            <OptionsList
              isInReact95
              orientation="vertical"
              contentStyle={{ padding: 2 }}
              style={{ maxHeight: "430px" }}
            >
              {allExtensions.map((ext) => (
                <TypeRow
                  key={ext}
                  $selected={selectedExt === ext}
                  onClick={() => setSelectedExt(ext)}
                >
                  <Icon src={typeIcon(ext)} size={16} isInReact95 />
                  <TypeExt>{ext.toUpperCase()}</TypeExt>
                  <span>{typeLabel(ext)}</span>
                </TypeRow>
              ))}
            </OptionsList>

            {showNewType ? (
              <NewTypeForm>
                <label>
                  Extension:
                  <TextInput
                    value={newExt}
                    onChange={(e: any) => setNewExt(e.target.value)}
                    placeholder="e.g. xyz"
                    style={{ marginTop: 2 }}
                    fullWidth
                  />
                </label>
                <label>
                  Description of type:
                  <TextInput
                    value={newLabel}
                    onChange={(e: any) => setNewLabel(e.target.value)}
                    placeholder="e.g. XYZ Document"
                    style={{ marginTop: 2 }}
                    fullWidth
                  />
                </label>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <Button
                    onClick={addNewType}
                    disabled={!newExt.trim() || !newLabel.trim()}
                  >
                    OK
                  </Button>
                  <Button onClick={() => setShowNewType(false)}>Cancel</Button>
                </div>
              </NewTypeForm>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  onClick={() => setShowNewType(true)}
                  style={{ flex: 1 }}
                >
                  New...
                </Button>
                <Button
                  onClick={deleteSelectedType}
                  disabled={!isCustomExt}
                  style={{ flex: 1 }}
                >
                  Delete
                </Button>
              </div>
            )}

            {selectedExt && opener && (
              <GroupBox label={`Details for '${selectedExt}' extension`}>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span>Opens with:</span>
                    <Icon src={opener.icon} size={16} isInReact95 />
                    <span style={{ flex: 1 }}>{opener.label}</span>
                    <Button onClick={() => setShowOpenWith(true)}>
                      Change...
                    </Button>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ flex: 1 }}>
                      Files with extension '{selectedExt}' are of type '
                      {typeLabel(selectedExt)}'.
                    </span>
                    <Button onClick={() => setShowIconPicker(true)}>
                      Change Icon...
                    </Button>
                  </div>
                </div>
              </GroupBox>
            )}

            {showOpenWith && selectedExt && (
              <OpenWithDialog
                fileName={`file.${selectedExt}`}
                associateOnly
                onClose={() => setShowOpenWith(false)}
              />
            )}
            {showIconPicker && selectedExt && (
              <IconPickerDialog
                title={`Choose an icon for '.${selectedExt}' files:`}
                icons={Array.from(
                  new Set([typeIcon(selectedExt), ...iconPickerPool()]),
                )}
                current={typeIcon(selectedExt)}
                onPick={(icon) => store.setExtensionIcon(selectedExt, icon)}
                onClose={() => setShowIconPicker(false)}
              />
            )}
          </div>
        )}
      </TabBody>
      <ButtonRow>
        <Button onClick={handleOk} style={{ width: 70 }}>
          OK
        </Button>
        <Button onClick={() => closeWindow(windowId)} style={{ width: 70 }}>
          Cancel
        </Button>
        <Button onClick={handleApply} style={{ width: 70 }}>
          Apply
        </Button>
      </ButtonRow>
    </Layout>
  );
}
