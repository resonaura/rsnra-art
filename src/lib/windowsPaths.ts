/** Default paths for the single-user Windows 2000 installation in this VFS. */
export const SYSTEM_ROOT_PATH = "C:\\WINNT";
export const SYSTEM32_PATH = `${SYSTEM_ROOT_PATH}\\System32`;
export const DOCUMENTS_AND_SETTINGS_PATH = "C:\\Documents and Settings";
export const USER_PROFILE_PATH = `${DOCUMENTS_AND_SETTINGS_PATH}\\Administrator`;
export const ALL_USERS_PROFILE_PATH = `${DOCUMENTS_AND_SETTINGS_PATH}\\All Users`;
export const USER_DOCUMENTS_PATH = `${USER_PROFILE_PATH}\\My Documents`;
export const USER_PICTURES_PATH = `${USER_PROFILE_PATH}\\My Pictures`;
export const USER_DESKTOP_PATH = `${USER_PROFILE_PATH}\\Desktop`;
export const USER_APPLICATION_DATA_PATH = `${USER_PROFILE_PATH}\\Application Data`;
export const USER_COOKIES_PATH = `${USER_PROFILE_PATH}\\Cookies`;
export const USER_FAVORITES_PATH = `${USER_PROFILE_PATH}\\Favorites`;
export const USER_HISTORY_PATH = `${USER_PROFILE_PATH}\\Local Settings\\History`;
export const USER_RECENT_PATH = `${USER_PROFILE_PATH}\\Recent`;
export const USER_SEND_TO_PATH = `${USER_PROFILE_PATH}\\SendTo`;
export const USER_START_MENU_PATH = `${USER_PROFILE_PATH}\\Start Menu`;
export const ALL_USERS_START_MENU_PATH = `${ALL_USERS_PROFILE_PATH}\\Start Menu`;
export const QUICK_LAUNCH_PATH = `${USER_APPLICATION_DATA_PATH}\\Microsoft\\Internet Explorer\\Quick Launch`;

// The stock Windows 2000 command search path, followed by this desktop's
// installed-app locations. Keep every consumer (VFS, SET, and PATH) aligned.
export const SYSTEM_PATH_DIRECTORIES = [
  SYSTEM32_PATH,
  SYSTEM_ROOT_PATH,
  `${SYSTEM32_PATH}\\Wbem`,
  "C:\\Program Files\\RSNRA",
  "C:\\Program Files\\Accessories",
] as const;
export const DEFAULT_SYSTEM_PATH = SYSTEM_PATH_DIRECTORIES.join(";");

export const DEFAULT_WINDOWS_ENVIRONMENT: Record<string, string> = {
  ALLUSERSPROFILE: ALL_USERS_PROFILE_PATH,
  APPDATA: USER_APPLICATION_DATA_PATH,
  CommonProgramFiles: "C:\\Program Files\\Common Files",
  ComSpec: `${SYSTEM32_PATH}\\cmd.exe`,
  COMPUTERNAME: "RSNRA-2000",
  HOMEDRIVE: "C:",
  HOMEPATH: "\\Documents and Settings\\Administrator",
  NUMBER_OF_PROCESSORS: "1",
  OS: "Windows_NT",
  PATH: DEFAULT_SYSTEM_PATH,
  PATHEXT: ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH",
  PROCESSOR_ARCHITECTURE: "x86",
  ProgramFiles: "C:\\Program Files",
  PROMPT: "$P$G",
  SystemDrive: "C:",
  SystemRoot: SYSTEM_ROOT_PATH,
  TEMP: `${USER_PROFILE_PATH}\\Local Settings\\Temp`,
  TMP: `${USER_PROFILE_PATH}\\Local Settings\\Temp`,
  USERDOMAIN: "WORKGROUP",
  USERNAME: "Administrator",
  USERPROFILE: USER_PROFILE_PATH,
  windir: SYSTEM_ROOT_PATH,
};

const LEGACY_PATH_ALIASES: ReadonlyArray<[string, string]> = [
  ["C:\\Windows\\Start Menu", ALL_USERS_START_MENU_PATH],
  ["C:\\WINNT\\Start Menu", ALL_USERS_START_MENU_PATH],
  ["C:\\Windows\\Desktop", USER_DESKTOP_PATH],
  ["C:\\WINNT\\Desktop", USER_DESKTOP_PATH],
  ["C:\\Windows\\Cookies", USER_COOKIES_PATH],
  ["C:\\WINNT\\Cookies", USER_COOKIES_PATH],
  ["C:\\Windows\\Favorites", USER_FAVORITES_PATH],
  ["C:\\WINNT\\Favorites", USER_FAVORITES_PATH],
  ["C:\\Windows\\History", USER_HISTORY_PATH],
  ["C:\\WINNT\\History", USER_HISTORY_PATH],
  ["C:\\Windows\\Recent", USER_RECENT_PATH],
  ["C:\\WINNT\\Recent", USER_RECENT_PATH],
  ["C:\\Windows\\SendTo", USER_SEND_TO_PATH],
  ["C:\\WINNT\\SendTo", USER_SEND_TO_PATH],
  ["C:\\Windows\\Application Data", USER_APPLICATION_DATA_PATH],
  ["C:\\WINNT\\Application Data", USER_APPLICATION_DATA_PATH],
  ["C:\\Windows\\Profiles", DOCUMENTS_AND_SETTINGS_PATH],
  ["C:\\WINNT\\Profiles", DOCUMENTS_AND_SETTINGS_PATH],
  ["C:\\Windows\\Spool", `${SYSTEM32_PATH}\\Spool`],
  ["C:\\WINNT\\Spool", `${SYSTEM32_PATH}\\Spool`],
  ["C:\\Windows\\System", SYSTEM32_PATH],
  ["C:\\WINNT\\System", SYSTEM32_PATH],
  ["C:\\Windows\\Command", SYSTEM32_PATH],
  ["C:\\WINNT\\Command", SYSTEM32_PATH],
  ["C:\\My Documents", USER_DOCUMENTS_PATH],
  ["C:\\My Pictures", USER_PICTURES_PATH],
  ["C:\\Windows", SYSTEM_ROOT_PATH],
];

const SYSTEM_EXECUTABLES = new Set([
  "notepad.exe", "mspaint.exe", "explorer.exe", "control.exe", "winmine.exe",
  "sol.exe", "freecell.exe", "mshearts.exe", "pinball.exe", "command.com",
  "cmd.exe", "calc.exe", "sndrec32.exe", "taskmgr.exe", "charmap.exe",
  "regedit.exe", "write.exe", "ping.exe", "ipconfig.exe", "rundll32.exe",
  "winlogon.exe",
]);

/**
 * Resolve familiar 9x-era locations to their Windows 2000 canonical folders.
 * Old typed paths and shortcuts keep working, but the visible tree stays
 * faithful to the NT 5.0 layout.
 */
export function canonicalizeLegacyPath(path: string): string {
  let normalized = path.replace(/\//g, "\\");
  for (const [from, to] of LEGACY_PATH_ALIASES) {
    if (
      normalized.toLowerCase() === from.toLowerCase() ||
      normalized.toLowerCase().startsWith(`${from.toLowerCase()}\\`)
    ) {
      normalized = to + normalized.slice(from.length);
      break;
    }
  }

  const directSystemFile = normalized.match(/^C:\\WINNT\\([^\\]+)$/i)?.[1];
  if (directSystemFile && SYSTEM_EXECUTABLES.has(directSystemFile.toLowerCase())) {
    normalized = `${SYSTEM32_PATH}\\${directSystemFile}`;
  }
  return normalized;
}
