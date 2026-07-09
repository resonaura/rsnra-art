import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BIO_TEXT, LINKS } from "../data/content";
import { CURSORS_VFS_NODES } from "../data/cursorsVfs.generated";
import { DEFAULT_WALLPAPER_FILES } from "../data/wallpapers";
import { SCREENSAVERS } from "../screensavers";

// ─── Types ────────────────────────────────────────────────────────────────
export type VfsNodeType = "dir" | "file";

export interface VfsNode {
  name: string; // filesystem name (case-insensitive lookups, preserves case)
  type: VfsNodeType;
  children?: VfsNode[]; // dir
  content?: string; // text file
  appId?: string; // executable: launching this file opens the app
  system?: boolean; // system file — cannot be deleted/renamed
  hidden?: boolean;
  readonly?: boolean; // read-only — cannot be modified/deleted
  archive?: boolean; // archive bit (Win95)
  created: number;
}

export interface RecycledItem {
  node: VfsNode;
  originalPath: string;
  deletedAt: number;
}

export interface VfsState {
  root: VfsNode; // C:\
  cwd: string; // current working directory (absolute, e.g. "C:\\Windows")
  recycled: RecycledItem[];

  // lookups
  resolve: (path: string, base?: string) => VfsNode | null;
  resolvePath: (path: string, base?: string) => string | null; // normalized absolute
  list: (path: string) => VfsNode[] | null;
  read: (path: string) => string | null;
  exists: (path: string) => boolean;
  findExecutable: (name: string) => string | null; // search PATH dirs for an .exe

  // mutations
  mkdir: (path: string) => boolean;
  writeFile: (path: string, content: string) => boolean;
  remove: (path: string) => boolean;
  moveToRecycleBin: (path: string) => boolean;
  restoreFromRecycleBin: (originalPath: string) => boolean;
  deleteFromRecycleBin: (originalPath: string) => void;
  emptyRecycleBin: () => void;
  move: (src: string, destDir: string) => boolean;
  copy: (src: string, destDir: string) => boolean;
  // Copy/move `src` into directory `destDir`, auto-renaming on collision with
  // the Win95 "Copy of <name>" scheme. Returns the resulting node name, or
  // null on failure. Refuses to copy a folder into itself/a descendant.
  copyTo: (src: string, destDir: string) => string | null;
  moveTo: (src: string, destDir: string) => string | null;
  rename: (path: string, newName: string) => boolean;
  setCwd: (path: string) => boolean;
  // Toggle file/folder attributes (Hidden, Read-only, Archive). Refuses on
  // system items. Partial — only the provided fields are changed.
  setAttributes: (
    path: string,
    attrs: { hidden?: boolean; readonly?: boolean; archive?: boolean },
  ) => boolean;
  reorderChildren: (
    dirPath: string,
    name: string,
    targetIndex: number,
  ) => boolean;
}

// ─── Path helpers ──────────────────────────────────────────────────────────
const SEP = "\\";

// Normalize + resolve a (possibly relative) path against a base dir to an
// absolute "C:\..." string. Returns null if it escapes the filesystem.
function normalizePath(path: string, base = "C:\\"): string | null {
  let p = path.trim();
  if (!p) return null;
  // make absolute relative to base
  if (!/^[A-Za-z]:/.test(p)) {
    if (p.startsWith(SEP) || p.startsWith("/"))
      p = "C:" + (p.startsWith("/") ? SEP + p.slice(1) : p);
    else p = base.replace(/[\\/]+$/, "") + SEP + p;
  } else if (p.slice(0, 2).toUpperCase() !== "C:") {
    // The virtual filesystem only has a C: drive; A:/D: etc. are "not ready".
    return null;
  }
  const drive = p.slice(0, 2); // "C:"
  const parts = p
    .slice(2)
    .split(/[\\/]+/)
    .filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return drive + SEP + stack.join(SEP);
}

function splitAbs(absPath: string): string[] {
  // "C:\Windows\System" -> ["Windows","System"]
  return absPath
    .slice(3)
    .split(/[\\/]+/)
    .filter(Boolean);
}

// ─── Tree helpers (pure) ───────────────────────────────────────────────────
function findNode(root: VfsNode, absPath: string): VfsNode | null {
  const parts = splitAbs(absPath);
  let cur: VfsNode = root;
  for (const part of parts) {
    if (cur.type !== "dir" || !cur.children) return null;
    const next = cur.children.find(
      (c) => c.name.toLowerCase() === part.toLowerCase(),
    );
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function findParent(
  root: VfsNode,
  absPath: string,
): { parent: VfsNode; node: VfsNode; name: string } | null {
  const parts = splitAbs(absPath);
  if (parts.length === 0) return null;
  const name = parts[parts.length - 1];
  const parent =
    parts.length === 1
      ? root
      : findNode(root, "C:" + SEP + parts.slice(0, -1).join(SEP));
  if (!parent || parent.type !== "dir" || !parent.children) return null;
  const node = parent.children.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (!node) return null;
  return { parent, node, name };
}

// Deep-clone a node (and any children) with fresh `created` timestamps so a
// pasted copy doesn't share identity/timestamps with the original.
function cloneNode(node: VfsNode): VfsNode {
  const created = now();
  if (node.type === "file") {
    return { ...node, created };
  }
  return {
    ...node,
    created,
    children: (node.children ?? []).map(cloneNode),
  };
}

// Is `maybeAncestor` the same path as `path`, or a parent directory of it?
// Used to stop a folder being copied/moved into itself or one of its descendants.
function isAncestorOrSelf(maybeAncestor: string, path: string): boolean {
  const a = maybeAncestor.toLowerCase().replace(/[\\/]+$/, "");
  const b = path.toLowerCase().replace(/[\\/]+$/, "");
  if (a === b) return true;
  return b.startsWith(a + SEP);
}

// Generate a non-colliding name inside `parent` based on `name`, using the
// classic Win95 "Copy of <name>", "Copy (2) of <name>", ... scheme.
function uniqueCopyName(parent: VfsNode, name: string): string {
  const taken = new Set(
    (parent.children ?? []).map((c) => c.name.toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  let candidate: string;
  do {
    candidate = n === 2 ? `Copy of ${name}` : `Copy (${n}) of ${base}${ext}`;
    n++;
  } while (taken.has(candidate.toLowerCase()));
  return candidate;
}

// ─── Immutable path-copy helpers ──────────────────────────────────────────────
// Rather than mutating VFS nodes in place, every mutation creates new node
// objects along the path from root to the changed node (structural sharing).
// Unchanged siblings keep their existing object references, which lets React
// selectors that subscribe to a specific node detect real changes via ===.

type NodeUpdater = (node: VfsNode) => VfsNode | null;

/**
 * Walk `absPath` inside `root`, apply `updater` to the target node, and return
 * a new root where every ancestor of the target is a fresh object (so
 * reference-equality checks on any ancestor will see the change).
 *
 * Returns null if the path doesn't exist or `updater` returns null (abort).
 */
function updateNode(
  root: VfsNode,
  absPath: string,
  updater: NodeUpdater,
): VfsNode | null {
  const parts = splitAbs(absPath);

  function walk(cur: VfsNode, depth: number): VfsNode | null {
    if (depth === parts.length) {
      // We're at the target node — apply the updater.
      return updater(cur);
    }
    if (cur.type !== "dir" || !cur.children) return null;
    const part = parts[depth];
    const idx = cur.children.findIndex(
      (c) => c.name.toLowerCase() === part.toLowerCase(),
    );
    if (idx === -1) return null;
    const newChild = walk(cur.children[idx], depth + 1);
    if (newChild === null) return null;
    const newChildren = [...cur.children];
    newChildren[idx] = newChild;
    return { ...cur, children: newChildren };
  }

  return walk(root, 0);
}

/**
 * Insert `newNode` into the directory at `parentAbsPath`, returning a new root.
 * Returns null if the parent doesn't exist or is not a directory.
 */
function insertNode(
  root: VfsNode,
  parentAbsPath: string,
  newNode: VfsNode,
): VfsNode | null {
  // parentAbsPath === "C:\\" means insert directly into root's children
  if (parentAbsPath.replace(/\\+$/, "").toUpperCase() === "C:") {
    return { ...root, children: [...(root.children ?? []), newNode] };
  }
  return updateNode(root, parentAbsPath, (parent) => {
    if (parent.type !== "dir") return null;
    return { ...parent, children: [...(parent.children ?? []), newNode] };
  });
}

/**
 * Remove the node at `absPath` from its parent, returning a new root.
 */
function removeNode(root: VfsNode, absPath: string): VfsNode | null {
  const parts = splitAbs(absPath);
  if (parts.length === 0) return null;
  const name = parts[parts.length - 1];
  const parentParts = parts.slice(0, -1);
  const parentAbs =
    parentParts.length === 0 ? "C:\\" : "C:" + SEP + parentParts.join(SEP);

  if (parentParts.length === 0) {
    return {
      ...root,
      children: (root.children ?? []).filter(
        (c) => c.name.toLowerCase() !== name.toLowerCase(),
      ),
    };
  }
  return updateNode(root, parentAbs, (parent) => {
    if (parent.type !== "dir") return null;
    return {
      ...parent,
      children: (parent.children ?? []).filter(
        (c) => c.name.toLowerCase() !== name.toLowerCase(),
      ),
    };
  });
}

let _id = 0;
const now = () => Date.now() + _id++;
const dir = (
  name: string,
  children: VfsNode[] = [],
  system = true,
): VfsNode => ({
  name,
  type: "dir",
  children,
  system,
  created: now(),
});
const file = (name: string, opts: Partial<VfsNode> = {}): VfsNode => ({
  name,
  type: "file",
  content: "",
  system: false,
  archive: true, // Win95 sets the archive bit on new/changed files
  created: now(),
  ...opts,
});
const exe = (name: string, appId: string): VfsNode => ({
  name,
  type: "file",
  appId,
  system: true,
  created: now(),
});
const txt = (name: string, content: string, system = false): VfsNode => ({
  name,
  type: "file",
  content,
  system,
  created: now(),
});

// ─── Canonical Windows 95 filesystem ───────────────────────────────────────
function buildInitialTree(): VfsNode {
  const systemDlls = [
    "kernel32.dll",
    "user32.dll",
    "gdi32.dll",
    "advapi32.dll",
    "comdlg32.dll",
    "shell32.dll",
    "ole32.dll",
    "winmm.dll",
    "msimg32.dll",
    "version.dll",
    "crtdll.dll",
    "msvcrt.dll",
    "ws2_32.dll",
    "ddraw.dll",
    "dplayx.dll",
  ].map((n) => file(n, { system: true, hidden: false }));

  const fonts = [
    "vgaoem.fon",
    "vga850.fon",
    "modern.fon",
    "roman.fon",
    "script.fon",
    "serife.fon",
    "sserife.fon",
    "smalle.fon",
    "coure.fon",
  ].map((n) => file(n, { system: true }));

  const commandDir = dir("Command", [
    exe("edit.com", "notepad"),
    exe("xcopy.exe", ""),
    file("format.com", { system: true }),
  ]);

  const windows = dir(
    "Windows",
    [
      exe("notepad.exe", "notepad"),
      exe("mspaint.exe", "paint"),
      exe("explorer.exe", "my-computer"),
      exe("control.exe", "control-panel"),
      exe("winmine.exe", "minesweeper"),
      exe("sol.exe", "solitaire"),
      exe("freecell.exe", ""),
      exe("mshearts.exe", ""),
      exe("pinball.exe", "pinball"),
      exe("command.com", "terminal"),
      exe("calc.exe", "calculator"),
      exe("sndrec32.exe", "sound-recorder"),
      exe("taskmgr.exe", "task-manager"),
      exe("charmap.exe", "charmap"),
      exe("regedit.exe", ""),
      exe("write.exe", ""),
      exe("ping.exe", ""),
      exe("ipconfig.exe", ""),
      exe("rundll32.exe", ""),
      file("win.ini", { content: "[windows]\nload=\nrun=\n", system: true }),
      file("system.ini", {
        content: "[boot]\nshell=Explorer.exe\n",
        system: true,
      }),
      file("winlogon.txt", { content: "", system: true, hidden: true }),
      dir(
        "System",
        [
          ...systemDlls,
          ...fonts,
          // Screen savers — opening a .scr runs it (see data/fileOpen.ts).
          ...SCREENSAVERS.map((s) => file(s.file, { system: true })),
        ],
        true,
      ),
      commandDir,
      dir(
        "Desktop",
        [
          file("My Computer.lnk", {
            content: JSON.stringify({
              type: "app",
              target: "my-computer",
              icon: "/icons/explorer.exe/000.ico",
            }),
            system: true,
          }),
          file("RSNRA Music.lnk", {
            content: JSON.stringify({
              type: "url",
              target: LINKS.music,
              icon: "/icons/shell32.dll/088.ico",
              shortcut: true,
            }),
            system: false,
          }),
          file("TikTok.lnk", {
            content: JSON.stringify({
              type: "url",
              target: LINKS.tiktok,
              icon: "/icons/tiktok.exe/000.ico",
              shortcut: true,
            }),
            system: false,
          }),
          file("Instagram.lnk", {
            content: JSON.stringify({
              type: "url",
              target: LINKS.instagram,
              icon: "/icons/instagram.exe/000.ico",
              shortcut: true,
            }),
            system: false,
          }),
          file("Contact.lnk", {
            content: JSON.stringify({
              type: "app",
              target: "contact",
              icon: "/icons/shell32.dll/047.ico",
              shortcut: true,
            }),
            system: false,
          }),
          file("Games.lnk", {
            content: JSON.stringify({
              type: "app",
              target: "games-folder",
              icon: "/icons/games.exe/000.ico",
            }),
            system: false,
          }),
        ],
        true,
      ),
      dir("Temp", [], true),
      dir(
        "Application Data",
        [
          dir(
            "Microsoft",
            [
              dir(
                "Internet Explorer",
                [
                  dir(
                    "Quick Launch",
                    [
                      file("Show Desktop.lnk", {
                        content: JSON.stringify({
                          type: "url",
                          target: "show-desktop",
                          icon: "/icons/explorer.exe/003.ico",
                          title: "Show Desktop",
                        }),
                        system: true,
                      }),
                      file("Command Prompt.lnk", {
                        content: JSON.stringify({
                          type: "app",
                          target: "terminal",
                          icon: "/icons/cmd.exe/000.ico",
                          title: "Command Prompt",
                        }),
                        system: false,
                      }),
                      file("Notepad.lnk", {
                        content: JSON.stringify({
                          type: "app",
                          target: "notepad",
                          icon: "/icons/notepad.exe/000.ico",
                          title: "Notepad",
                        }),
                        system: false,
                      }),
                    ],
                    false,
                  ),
                ],
                true,
              ),
            ],
            true,
          ),
        ],
        true,
      ),
      dir("Help", [file("windows.hlp", { system: true })], true),
      dir("Cursors", CURSORS_VFS_NODES, true),
      // Default wallpapers — real .bmp files, browsable and pickable from
      // Display Properties ▸ Background, at the authentic Windows Me location.
      dir(
        "Web",
        [
          dir(
            "Wallpaper",
            DEFAULT_WALLPAPER_FILES.map((n) => file(n, { system: true })),
            true,
          ),
        ],
        true,
      ),
      // System sounds — the real Windows Me/95 .wav files, browsable at
      // C:\Windows\Media just like in real Windows.
      dir(
        "Media",
        [
          file("chimes.wav", { system: true }),
          file("chord.wav", { system: true }),
          file("ding.wav", { system: true }),
          file("logoff.wav", { system: true }),
          file("notify.wav", { system: true }),
          file("recycle.wav", { system: true }),
          file("start.wav", { system: true }),
          file("tada.wav", { system: true }),
        ],
        true,
      ),
      // C:\Windows\Start Menu — mirrors the real Win95 Start Menu structure.
      // Programs\ contains .lnk shortcuts that the Start Menu reads dynamically.
      dir(
        "Start Menu",
        [
          dir(
            "Programs",
            [
              dir(
                "Accessories",
                [
                  file("Command Prompt.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "terminal",
                      icon: "/icons/cmd.exe/000.ico",
                      title: "Command Prompt",
                    }),
                    system: true,
                  }),
                  file("Notepad.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "notepad",
                      icon: "/icons/notepad.exe/000.ico",
                      title: "bio.txt - Notepad",
                      data: { docId: "bio" },
                    }),
                    system: true,
                  }),
                  file("Paint.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "paint",
                      icon: "/icons/mspaint.exe/000.ico",
                    }),
                    system: true,
                  }),
                  file("Calculator.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "calculator",
                      icon: "/icons/calc.exe/000.ico",
                    }),
                    system: true,
                  }),
                  file("Sound Recorder.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "sound-recorder",
                      icon: "/icons/sndrec32.exe/000.ico",
                    }),
                    system: true,
                  }),
                  file("Character Map.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "charmap",
                      icon: "/icons/charmap.exe/000.ico",
                    }),
                    system: true,
                  }),
                ],
                true,
              ),
              dir(
                "Games",
                [
                  file("Minesweeper.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "minesweeper",
                      icon: "/icons/winmine.exe/000.ico",
                    }),
                    system: true,
                  }),
                  file("RSNRA Snake.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "snake",
                      icon: "/icons/games.exe/000.ico",
                    }),
                    system: true,
                  }),
                  file("Solitaire.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "solitaire",
                      icon: "/icons/sol.exe/000.ico",
                    }),
                    system: true,
                  }),
                  file("3D Pinball.lnk", {
                    content: JSON.stringify({
                      type: "app",
                      target: "pinball",
                      icon: "/icons/pinball.png",
                    }),
                    system: true,
                  }),
                ],
                true,
              ),

              file("Winamp.lnk", {
                content: JSON.stringify({
                  type: "app",
                  target: "winamp",
                  icon: "/icons/winamp.exe/000.ico",
                }),
                system: true,
              }),
            ],
            true,
          ),
        ],
        true,
      ),
    ],
    true,
  );

  const myDocuments = dir(
    "My Documents",
    [
      txt("bio.txt", BIO_TEXT, true),
      txt(
        "press-kit.txt",
        `RSNRA — Press Kit.txt
=====================================

RESONAURA is an alternative rock band from Vancouver, BC.

For interview requests, press photos, or stage plots, reach out
via the Contact app or email booking@rsnra.band.

Quick facts:
  Genre        Alternative Rock
  Based in     Vancouver, BC
  Listen       rsnra.link/resonaura
  TikTok       @resonaura
  Instagram    @resonaura
`,
        true,
      ),
      txt(
        "readme.txt",
        `Welcome to RSNRA.ART.

This is your My Documents folder. Try these in the terminal:
  cd \\My Documents
  dir
  type bio.txt

Open apps from anywhere:
  notepad      (or: C:\\Windows\\notepad.exe)
  mspaint
  winmine
  snake        minesweeper

File system tips:
  mkdir <name>    create a folder
  del <file>      delete a file
  copy <src> <dst> copy a file
  tree            show directory tree
`,
        false,
      ),
      txt(
        "setlist.txt",
        `RESONAURA — Setlist (current)
================================

01. Signal & Noise
02. Phosphene
03. Glass Teeth
04. Low Earth Orbit
05. Harbour Lights
06. Static Mind
07. Resonance
08. [encore] All At Once

Approx. runtime: 50 min
`,
        false,
      ),
    ],
    false,
  );

  const myPictures = dir(
    "My Pictures",
    [
      file("artwork.png", {
        content:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      }),
      txt(
        "readme.txt",
        `Save images from Paint here using:
  File > Save As PNG...
  e.g.: C:\\My Pictures\\artwork.png

Images saved here can be opened by
double-clicking them in My Computer.
`,
        false,
      ),
    ],
    false,
  );

  const programFiles = dir(
    "Program Files",
    [
      dir(
        "RSNRA",
        [
          exe("snake.exe", "snake"),
          exe("music.exe", "music"),
          exe("social.exe", "social"),
          exe("contact.exe", "contact"),
          exe("minesweeper.exe", "minesweeper"),
          txt(
            "rsnra.ini",
            "[RSNRA]\nband=RESONAURA\nversion=95\nyear=1996\n",
            false,
          ),
          txt(
            "changelog.txt",
            `RSNRA.ART — Changelog
====================

v4.95.1996
  + Added Snake game
  + Added MS-DOS Prompt
  + Added Paint with full drawing tools
  + My Computer with virtual filesystem
  + Control Panel wallpaper selector
  + Minesweeper
  * Fixed font rendering on 640x480 displays
`,
            false,
          ),
        ],
        false,
      ),
      dir("Internet Explorer", [exe("iexplore.exe", "")], true),
      dir(
        "Plus!",
        [
          txt(
            "readme.txt",
            "Microsoft Plus! for Windows 95\nNot included in this version.\n",
            true,
          ),
        ],
        true,
      ),
      dir(
        "Accessories",
        [
          exe("mspaint.exe", "paint"),
          exe("notepad.exe", "notepad"),
          exe("terminal.exe", "terminal"),
        ],
        true,
      ),
      dir(
        "Winamp",
        [
          exe("winamp.exe", "winamp"),
          txt("winamp.ini", "[Winamp]\nversion=2.95\n", false),
        ],
        false,
      ),
    ],
    true,
  );

  const recycled = dir("Recycled", [], true);

  return dir(
    "C:\\",
    [windows, myDocuments, myPictures, programFiles, recycled],
    true,
  );
}

// Directories searched when resolving a bare command name (PATH).
const PATH_DIRS = [
  "C:\\Windows",
  "C:\\Windows\\Command",
  "C:\\Program Files\\RSNRA",
  "C:\\Program Files\\Accessories",
];

// ─── Store ─────────────────────────────────────────────────────────────────
export const useVfsStore = create<VfsState>()(
  persist(
    (set, get) => ({
      root: buildInitialTree(),
      cwd: "C:\\My Documents",
      recycled: [],

      resolvePath: (path, base) => normalizePath(path, base ?? get().cwd),

      resolve: (path, base) => {
        const abs = normalizePath(path, base ?? get().cwd);
        if (!abs) return null;
        return findNode(get().root, abs);
      },

      exists: (path) => !!get().resolve(path),

      list: (path) => {
        const node = get().resolve(path);
        if (!node || node.type !== "dir") return null;
        return [...(node.children ?? [])];
      },

      read: (path) => {
        const node = get().resolve(path);
        if (!node || node.type !== "file") return null;
        return node.content ?? "";
      },

      findExecutable: (name) => {
        const lower = name.toLowerCase();
        const withExe =
          lower.endsWith(".exe") || lower.endsWith(".com")
            ? lower
            : lower + ".exe";
        for (const d of PATH_DIRS) {
          const list = get().list(d);
          const hit = list?.find(
            (c) => c.name.toLowerCase() === withExe && c.appId,
          );
          if (hit) return d + SEP + hit.name;
        }
        return null;
      },

      mkdir: (path) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        if (findNode(get().root, abs)) return false;
        const parts = splitAbs(abs);
        const name = parts[parts.length - 1];
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        const newRoot = insertNode(
          get().root,
          parentPath,
          dir(name, [], false),
        );
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      writeFile: (path, content) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const existing = findNode(get().root, abs);
        if (existing && existing.type === "file") {
          if (existing.system || existing.readonly) return false;
          // Replace file node immutably
          const newRoot = updateNode(get().root, abs, (node) => ({
            ...node,
            content,
            archive: true,
          }));
          if (!newRoot) return false;
          set({ root: newRoot });
          return true;
        }
        if (existing) return false; // a dir already there
        const parts = splitAbs(abs);
        const name = parts[parts.length - 1];
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        const newRoot = insertNode(
          get().root,
          parentPath,
          file(name, { content, system: false }),
        );
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      remove: (path) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (!ref || ref.node.system || ref.node.readonly) return false;
        const newRoot = removeNode(get().root, abs);
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      moveToRecycleBin: (path) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (!ref || ref.node.system || ref.node.readonly) return false;
        const newRoot = removeNode(get().root, abs);
        if (!newRoot) return false;
        const item: RecycledItem = {
          node: ref.node,
          originalPath: abs,
          deletedAt: Date.now(),
        };
        set({ root: newRoot, recycled: [...get().recycled, item] });
        return true;
      },

      restoreFromRecycleBin: (originalPath) => {
        const item = get().recycled.find(
          (r) => r.originalPath === originalPath,
        );
        if (!item) return false;
        const parts = splitAbs(item.originalPath);
        if (parts.length === 0) return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);

        // Check collision at restore path
        const parentNode =
          findNode(get().root, parentPath) ??
          findNode(get().root, "C:\\My Documents");
        if (!parentNode || parentNode.type !== "dir") return false;
        if (
          (parentNode.children ?? []).some(
            (c) => c.name.toLowerCase() === item.node.name.toLowerCase(),
          )
        )
          return false;

        const targetParent =
          findNode(get().root, parentPath) !== null
            ? parentPath
            : "C:\\My Documents";
        const newRoot = insertNode(get().root, targetParent, item.node);
        if (!newRoot) return false;
        set({
          root: newRoot,
          recycled: get().recycled.filter((r) => r !== item),
        });
        return true;
      },

      deleteFromRecycleBin: (originalPath) => {
        set({
          recycled: get().recycled.filter(
            (r) => r.originalPath !== originalPath,
          ),
        });
      },

      emptyRecycleBin: () => {
        set({ recycled: [] });
      },

      move: (src, destDir) => {
        const srcAbs = normalizePath(src, get().cwd);
        const destAbs = normalizePath(destDir, get().cwd);
        if (!srcAbs || !destAbs) return false;
        const dest = findNode(get().root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return false;
        const ref = findParent(get().root, srcAbs);
        if (!ref || ref.node.system || ref.node.readonly) return false;
        if (
          dest.children.some(
            (c) => c.name.toLowerCase() === ref.node.name.toLowerCase(),
          )
        )
          return false;
        // Remove from source then insert at dest
        let newRoot = removeNode(get().root, srcAbs);
        if (!newRoot) return false;
        newRoot = insertNode(newRoot, destAbs, ref.node);
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      copy: (src, destDir) => {
        const srcAbs = normalizePath(src, get().cwd);
        const destAbs = normalizePath(destDir, get().cwd);
        if (!srcAbs || !destAbs) return false;
        const dest = findNode(get().root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return false;
        const node = findNode(get().root, srcAbs);
        if (!node) return false;
        if (node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return false;
        if (
          dest.children.some(
            (c) => c.name.toLowerCase() === node.name.toLowerCase(),
          )
        )
          return false;
        const newRoot = insertNode(get().root, destAbs, cloneNode(node));
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      copyTo: (src, destDir) => {
        const srcAbs = normalizePath(src, get().cwd);
        const destAbs = normalizePath(destDir, get().cwd);
        if (!srcAbs || !destAbs) return null;
        const dest = findNode(get().root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return null;
        const node = findNode(get().root, srcAbs);
        if (!node) return null;
        if (node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return null;
        const newName = uniqueCopyName(dest, node.name);
        const clone = cloneNode(node);
        clone.name = newName;
        const newRoot = insertNode(get().root, destAbs, clone);
        if (!newRoot) return null;
        set({ root: newRoot });
        return newName;
      },

      moveTo: (src, destDir) => {
        const srcAbs = normalizePath(src, get().cwd);
        const destAbs = normalizePath(destDir, get().cwd);
        if (!srcAbs || !destAbs) return null;
        const dest = findNode(get().root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return null;
        const ref = findParent(get().root, srcAbs);
        if (!ref || ref.node.system || ref.node.readonly) return null;
        if (ref.node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return null;
        // No-op if dropped back into its own parent.
        const srcParts = splitAbs(srcAbs);
        const srcParentAbs =
          srcParts.length <= 1
            ? "C:\\"
            : "C:" + SEP + srcParts.slice(0, -1).join(SEP);
        if (srcParentAbs.toLowerCase() === destAbs.toLowerCase()) {
          return ref.node.name;
        }
        const newName = uniqueCopyName(dest, ref.node.name);
        const movedNode = { ...ref.node, name: newName };
        let newRoot = removeNode(get().root, srcAbs);
        if (!newRoot) return null;
        newRoot = insertNode(newRoot, destAbs, movedNode);
        if (!newRoot) return null;
        set({ root: newRoot });
        return newName;
      },

      rename: (path, newName) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (!ref || ref.node.system || ref.node.readonly) return false;
        if (
          ref.parent.children!.some(
            (c) =>
              c.name.toLowerCase() === newName.toLowerCase() && c !== ref.node,
          )
        )
          return false;
        const newRoot = updateNode(get().root, abs, (node) => ({
          ...node,
          name: newName,
        }));
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      setCwd: (path) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const node = findNode(get().root, abs);
        if (!node || node.type !== "dir") return false;
        set({ cwd: abs });
        return true;
      },

      setAttributes: (path, attrs) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const node = findNode(get().root, abs);
        if (!node || node.system) return false;
        const newRoot = updateNode(get().root, abs, (n) => ({
          ...n,
          ...("hidden" in attrs && { hidden: attrs.hidden }),
          ...("readonly" in attrs && { readonly: attrs.readonly }),
          ...("archive" in attrs && { archive: attrs.archive }),
        }));
        if (!newRoot) return false;
        set({ root: newRoot });
        return true;
      },

      reorderChildren: (dirPath, name, targetIndex) => {
        const abs = normalizePath(dirPath, get().cwd);
        if (!abs) return false;
        let success = false;
        const newRoot = updateNode(get().root, abs, (parent) => {
          if (parent.type !== "dir" || !parent.children) return null;
          const idx = parent.children.findIndex(
            (c) => c.name.toLowerCase() === name.toLowerCase(),
          );
          if (idx === -1) return null;
          const child = parent.children[idx];
          const rest = parent.children.filter((_, i) => i !== idx);
          const target = Math.max(0, Math.min(targetIndex, rest.length));
          const newChildren = [
            ...rest.slice(0, target),
            child,
            ...rest.slice(target),
          ];
          success = true;
          return { ...parent, children: newChildren };
        });
        if (newRoot && success) {
          set({ root: newRoot });
          return true;
        }
        return false;
      },
    }),
    {
      name: "rsnra95-vfs",
      version: 9,
      migrate: () => ({
        root: buildInitialTree(),
        cwd: "C:\\My Documents",
        recycled: [],
      }),
    },
  ),
);
