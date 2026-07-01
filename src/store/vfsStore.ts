import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BIO_TEXT, LINKS } from "../data/content";

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
  rename: (path: string, newName: string) => boolean;
  setCwd: (path: string) => boolean;
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
      exe("sol.exe", ""),
      exe("freecell.exe", ""),
      exe("mshearts.exe", ""),
      exe("command.com", "terminal"),
      exe("calc.exe", ""),
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
      dir("System", [...systemDlls, ...fonts], true),
      commandDir,
      dir("Desktop", [
        file("My Computer.lnk", { content: JSON.stringify({ type: "app", target: "my-computer", icon: "/icons/computer.png" }), system: true }),
        file("RSNRA Music.lnk", { content: JSON.stringify({ type: "url", target: LINKS.music, icon: "/icons/music-cd.png", shortcut: true }), system: false }),
        file("TikTok.lnk", { content: JSON.stringify({ type: "url", target: LINKS.tiktok, icon: "/icons/globe.png", shortcut: true }), system: false }),
        file("Instagram.lnk", { content: JSON.stringify({ type: "url", target: LINKS.instagram, icon: "/icons/globe-map.png", shortcut: true }), system: false }),
        file("Contact.lnk", { content: JSON.stringify({ type: "app", target: "contact", icon: "/icons/contact-card.png" }), system: false }),
        file("Games.lnk", { content: JSON.stringify({ type: "app", target: "games-folder", icon: "/icons/joystick.png" }), system: false }),
      ], true),
      dir("Temp", [], true),
      dir("Help", [file("windows.hlp", { system: true })], true),
      dir("Cursors", [], true),
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
        `Welcome to RSNRA 95.

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
          txt("rsnra.ini", "[RSNRA]\nband=RESONAURA\nversion=95\nyear=1996\n", false),
          txt(
            "changelog.txt",
            `RSNRA 95 — Changelog
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
      dir("Plus!", [
        txt("readme.txt", "Microsoft Plus! for Windows 95\nNot included in this version.\n", true),
      ], true),
      dir("Accessories", [
        exe("mspaint.exe", "paint"),
        exe("notepad.exe", "notepad"),
        exe("terminal.exe", "terminal"),
      ], true),
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
        const parentPath = "C:" + SEP + parts.slice(0, -1).join(SEP);
        const parent =
          parts.length === 1 ? get().root : findNode(get().root, parentPath);
        if (!parent || parent.type !== "dir" || !parent.children) return false;
        parent.children.push(dir(name, [], false));
        set({ root: { ...get().root } });
        return true;
      },

      writeFile: (path, content) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const existing = findNode(get().root, abs);
        if (existing && existing.type === "file") {
          existing.content = content;
          set({ root: { ...get().root } });
          return true;
        }
        if (existing) return false; // a dir already there
        const parts = splitAbs(abs);
        const name = parts[parts.length - 1];
        const parentPath = "C:" + SEP + parts.slice(0, -1).join(SEP);
        const parent =
          parts.length === 1 ? get().root : findNode(get().root, parentPath);
        if (!parent || parent.type !== "dir" || !parent.children) return false;
        parent.children.push(file(name, { content, system: false }));
        set({ root: { ...get().root } });
        return true;
      },

      remove: (path) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (!ref || ref.node.system) return false;
        ref.parent.children = ref.parent.children!.filter(
          (c) => c !== ref.node,
        );
        set({ root: { ...get().root } });
        return true;
      },

      moveToRecycleBin: (path) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (!ref || ref.node.system) return false;
        ref.parent.children = ref.parent.children!.filter(
          (c) => c !== ref.node,
        );
        const item: RecycledItem = {
          node: ref.node,
          originalPath: abs,
          deletedAt: Date.now(),
        };
        set({ root: { ...get().root }, recycled: [...get().recycled, item] });
        return true;
      },

      restoreFromRecycleBin: (originalPath) => {
        const item = get().recycled.find((r) => r.originalPath === originalPath);
        if (!item) return false;
        const parts = splitAbs(item.originalPath);
        if (parts.length === 0) return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        let parent = findNode(get().root, parentPath);
        if (!parent || parent.type !== "dir" || !parent.children) {
          // fallback: restore to My Documents
          parent = findNode(get().root, "C:\\My Documents");
          if (!parent || parent.type !== "dir" || !parent.children) return false;
        }
        if (
          parent.children.some(
            (c) => c.name.toLowerCase() === item.node.name.toLowerCase(),
          )
        )
          return false;
        parent.children.push(item.node);
        set({
          root: { ...get().root },
          recycled: get().recycled.filter((r) => r !== item),
        });
        return true;
      },

      deleteFromRecycleBin: (originalPath) => {
        set({ recycled: get().recycled.filter((r) => r.originalPath !== originalPath) });
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
        if (!ref || ref.node.system) return false;
        if (
          dest.children.some(
            (c) => c.name.toLowerCase() === ref.node.name.toLowerCase(),
          )
        )
          return false;
        ref.parent.children = ref.parent.children!.filter(
          (c) => c !== ref.node,
        );
        dest.children.push(ref.node);
        set({ root: { ...get().root } });
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
        if (
          dest.children.some(
            (c) => c.name.toLowerCase() === node.name.toLowerCase(),
          )
        )
          return false;
        dest.children.push(JSON.parse(JSON.stringify(node)));
        set({ root: { ...get().root } });
        return true;
      },

      rename: (path, newName) => {
        const abs = normalizePath(path, get().cwd);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (!ref || ref.node.system) return false;
        if (
          ref.parent.children!.some(
            (c) =>
              c.name.toLowerCase() === newName.toLowerCase() && c !== ref.node,
          )
        )
          return false;
        ref.node.name = newName;
        set({ root: { ...get().root } });
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
    }),
    {
      name: "rsnra95-vfs",
      version: 3,
      migrate: () => ({ root: buildInitialTree(), cwd: "C:\\My Documents", recycled: [] }),
    },
  ),
);
