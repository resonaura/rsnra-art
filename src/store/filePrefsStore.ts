import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppId } from "../types/window";

// Global folder-view preferences (mirrors Win95's View ▸ Options ▸ View tab,
// plus the General tab). These are the same knobs the Folder Options dialog
// (src/apps/FolderOptions/FolderOptions.tsx) edits — every field here has a
// real, observable effect somewhere in the Desktop / My Computer explorer.
//
// `showHidden` controls whether files/folders with the Hidden attribute appear
// in the Explorer and on the Desktop; when shown they render semi-transparent.
//
// `openWithDefaults` mirrors the file-type association Windows remembers
// after you check "Always use this program to open this kind of file" in the
// Open With dialog — keyed by lowercase extension (no dot).

export type UnderlineMode = "browser" | "point";
export type BrowseFoldersMode = "same" | "own";

interface FilePrefsState {
  showHidden: boolean;
  setShowHidden: (v: boolean) => void;

  openWithDefaults: Record<string, AppId>;
  setOpenWithDefault: (extension: string, appId: AppId) => void;

  // General tab
  singleClickOpen: boolean;
  setSingleClickOpen: (v: boolean) => void;
  underlineMode: UnderlineMode;
  setUnderlineMode: (v: UnderlineMode) => void;
  browseFoldersMode: BrowseFoldersMode;
  setBrowseFoldersMode: (v: BrowseFoldersMode) => void;
  webContentInFolders: boolean;
  setWebContentInFolders: (v: boolean) => void;
  activeDesktopWebContent: boolean;
  setActiveDesktopWebContent: (v: boolean) => void;

  // View tab
  hideKnownExtensions: boolean;
  setHideKnownExtensions: (v: boolean) => void;
  hideProtectedSystemFiles: boolean;
  setHideProtectedSystemFiles: (v: boolean) => void;
  showMyDocumentsOnDesktop: boolean;
  setShowMyDocumentsOnDesktop: (v: boolean) => void;
  showPopupDescriptions: boolean;
  setShowPopupDescriptions: (v: boolean) => void;
  fullPathInTitleBar: boolean;
  setFullPathInTitleBar: (v: boolean) => void;
  fullPathInAddressBar: boolean;
  setFullPathInAddressBar: (v: boolean) => void;
  autoSearchNetworkFolders: boolean;
  setAutoSearchNetworkFolders: (v: boolean) => void;
  displayAllControlPanelOptions: boolean;
  setDisplayAllControlPanelOptions: (v: boolean) => void;
  launchFoldersInSeparateProcess: boolean;
  setLaunchFoldersInSeparateProcess: (v: boolean) => void;
  rememberFolderViewSettings: boolean;
  setRememberFolderViewSettings: (v: boolean) => void;

  // File Types tab
  /** Per-extension icon override (lowercase extension, no dot → icon path). */
  extensionIcons: Record<string, string>;
  setExtensionIcon: (extension: string, icon: string) => void;
  resetExtensionIcon: (extension: string) => void;
  /** User-registered extensions that aren't in the built-in EXT_ICONS table. */
  customFileTypes: Record<string, string>;
  addCustomFileType: (extension: string, typeLabel: string) => void;
  removeCustomFileType: (extension: string) => void;
}

export const useFilePrefsStore = create<FilePrefsState>()(
  persist(
    (set) => ({
      showHidden: false,
      setShowHidden: (showHidden) => set({ showHidden }),
      openWithDefaults: {},
      setOpenWithDefault: (extension, appId) =>
        set((s) => ({
          openWithDefaults: { ...s.openWithDefaults, [extension]: appId },
        })),

      singleClickOpen: false,
      setSingleClickOpen: (singleClickOpen) => set({ singleClickOpen }),
      underlineMode: "browser",
      setUnderlineMode: (underlineMode) => set({ underlineMode }),
      browseFoldersMode: "same",
      setBrowseFoldersMode: (browseFoldersMode) => set({ browseFoldersMode }),
      webContentInFolders: true,
      setWebContentInFolders: (webContentInFolders) => set({ webContentInFolders }),
      activeDesktopWebContent: false,
      setActiveDesktopWebContent: (activeDesktopWebContent) => set({ activeDesktopWebContent }),

      hideKnownExtensions: false,
      setHideKnownExtensions: (hideKnownExtensions) => set({ hideKnownExtensions }),
      hideProtectedSystemFiles: true,
      setHideProtectedSystemFiles: (hideProtectedSystemFiles) => set({ hideProtectedSystemFiles }),
      showMyDocumentsOnDesktop: true,
      setShowMyDocumentsOnDesktop: (showMyDocumentsOnDesktop) => set({ showMyDocumentsOnDesktop }),
      showPopupDescriptions: true,
      setShowPopupDescriptions: (showPopupDescriptions) => set({ showPopupDescriptions }),
      fullPathInTitleBar: false,
      setFullPathInTitleBar: (fullPathInTitleBar) => set({ fullPathInTitleBar }),
      fullPathInAddressBar: false,
      setFullPathInAddressBar: (fullPathInAddressBar) => set({ fullPathInAddressBar }),
      autoSearchNetworkFolders: true,
      setAutoSearchNetworkFolders: (autoSearchNetworkFolders) => set({ autoSearchNetworkFolders }),
      displayAllControlPanelOptions: false,
      setDisplayAllControlPanelOptions: (displayAllControlPanelOptions) => set({ displayAllControlPanelOptions }),
      launchFoldersInSeparateProcess: false,
      setLaunchFoldersInSeparateProcess: (launchFoldersInSeparateProcess) => set({ launchFoldersInSeparateProcess }),
      rememberFolderViewSettings: true,
      setRememberFolderViewSettings: (rememberFolderViewSettings) => set({ rememberFolderViewSettings }),

      extensionIcons: {},
      setExtensionIcon: (extension, icon) =>
        set((s) => ({ extensionIcons: { ...s.extensionIcons, [extension]: icon } })),
      resetExtensionIcon: (extension) =>
        set((s) => {
          const next = { ...s.extensionIcons };
          delete next[extension];
          return { extensionIcons: next };
        }),
      customFileTypes: {},
      addCustomFileType: (extension, typeLabel) =>
        set((s) => ({ customFileTypes: { ...s.customFileTypes, [extension]: typeLabel } })),
      removeCustomFileType: (extension) =>
        set((s) => {
          const next = { ...s.customFileTypes };
          delete next[extension];
          return { customFileTypes: next };
        }),
    }),
    {
      name: "rsnra95-fileprefs",
      version: 2,
      migrate: (persisted) => persisted as FilePrefsState,
    },
  ),
);
