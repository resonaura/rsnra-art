import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BIO_TEXT, LINKS } from "../data/content";
import { CURSORS_VFS_NODES } from "../data/cursorsVfs.generated";
import { DEFAULT_WALLPAPER_FILES } from "../data/wallpapers";
import {
  contentByteSize,
  VFS_DISK_CAPACITY,
  vfsAllocatedByteSize,
  vfsNodeAllocatedByteSize,
} from "../lib/vfsSize";
import {
  isRecycleBinBypassed,
  recycleBinMaximumBytes,
} from "../lib/recycleBin";
import {
  DEFAULT_SYSTEM_PATH,
  USER_DOCUMENTS_PATH,
  USER_RECENT_PATH,
  USER_PICTURES_PATH,
  USER_SEND_TO_PATH,
  canonicalizeLegacyPath,
} from "../lib/windowsPaths";
import { SCREENSAVERS } from "../screensavers";

// ─── Types ────────────────────────────────────────────────────────────────
export type VfsNodeType = "dir" | "file";

export interface VfsNode {
  name: string; // filesystem name (case-insensitive lookups, preserves case)
  shortName?: string; // stable FAT/VFAT 8.3 alias stored with the directory entry
  type: VfsNodeType;
  children?: VfsNode[]; // dir
  content?: string; // text file
  appId?: string; // executable: launching this file opens the app
  system?: boolean; // DOS System attribute (controls protected-file visibility)
  protected?: boolean; // immutable OS-owned object (separate from attributes)
  hidden?: boolean;
  readonly?: boolean; // file Read-only attribute; Explorer folder UI applies it to child files
  archive?: boolean; // archive bit (Win95)
  created: number;
  modified?: number;
  accessed?: number;
}

export interface RecycledItem {
  id: string;
  storageName: string;
  recordNumber: number;
  originalName: string;
  originalPath: string;
  deletedAt: number;
  attributes: Pick<
    VfsNode,
    "hidden" | "system" | "protected" | "readonly" | "archive" | "shortName"
  >;
}

interface LegacyRecycledItem {
  id?: string;
  node: VfsNode;
  originalPath: string;
  deletedAt: number;
}

export interface VfsState {
  root: VfsNode; // C:\
  cwd: string; // current working directory (absolute, e.g. "C:\\WINNT")
  recycled: RecycledItem[];
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undo: () => boolean;
  redo: () => boolean;
  /** Group several synchronous filesystem operations into one undo step. */
  transaction: (label: string, action: () => void) => void;

  // lookups
  resolve: (path: string, base?: string) => VfsNode | null;
  resolvePath: (path: string, base?: string) => string | null; // normalized absolute
  getShortName: (path: string) => string | null;
  list: (path: string) => VfsNode[] | null;
  read: (path: string) => string | null;
  /** Add a file shortcut to this profile's Start-menu Documents list. */
  recordRecentDocument: (path: string) => boolean;
  /** Clear only the Shell-managed document shortcuts in the profile's Recent folder. */
  clearRecentDocuments: () => void;
  exists: (path: string) => boolean;
  findExecutable: (name: string, searchPath?: string) => string | null;
  // Searches the active command-shell PATH for an executable.
  diskUsage: () => { total: number; used: number; free: number };

  // mutations
  mkdir: (path: string) => boolean;
  /** Create a directory tree atomically; allowExisting permits an existing leaf. */
  mkdirs: (path: string, options?: { allowExisting?: boolean }) => boolean;
  writeFile: (path: string, content: string) => boolean;
  remove: (path: string, options?: { allowReadOnly?: boolean }) => boolean;
  moveToRecycleBin: (
    path: string,
    options?: { allowReadOnly?: boolean },
  ) => boolean;
  restoreFromRecycleBin: (itemId: string) => boolean;
  deleteFromRecycleBin: (itemId: string) => void;
  emptyRecycleBin: () => void;
  move: (src: string, destDir: string) => boolean;
  copy: (src: string, destDir: string) => boolean;
  // Copy/move to an exact destination path (including a new name). These are
  // atomic: a failed validation never leaves a half-written destination.
  copyAs: (src: string, destPath: string) => boolean;
  moveAs: (src: string, destPath: string) => boolean;
  // Copy/move `src` into directory `destDir`, auto-renaming on collision with
  // the Win95 "Copy of <name>" scheme. Returns the resulting node name, or
  // null on failure. Refuses to copy a folder into itself/a descendant.
  copyTo: (src: string, destDir: string) => string | null;
  moveTo: (src: string, destDir: string) => string | null;
  rename: (path: string, newName: string) => boolean;
  setCwd: (path: string) => boolean;
  // Toggle DOS file/folder attributes. Refuses on immutable OS-owned objects;
  // that protection is separate from the DOS System attribute. Partial update.
  setAttributes: (
    path: string,
    attrs: {
      hidden?: boolean;
      readonly?: boolean;
      archive?: boolean;
      system?: boolean;
    },
  ) => boolean;
  /** Folder Properties' Read-only control affects files directly in that folder. */
  setFolderFilesReadOnly: (path: string, readonly: boolean) => boolean;
  reorderChildren: (
    dirPath: string,
    name: string,
    targetIndex: number,
  ) => boolean;
}

// ─── Path helpers ──────────────────────────────────────────────────────────
const SEP = "\\";
// Win32 shell/file APIs in Windows 2000 use MAX_PATH (260 characters
// including the terminating NUL) unless the caller opts into an extended path.
const WINDOWS_MAX_PATH = 260;
const DISK_CAPACITY = VFS_DISK_CAPACITY; // period-correct 2 GB FAT volume
const RECYCLED_PATH = "C:\\Recycled";
const RECYCLED_INDEX_PATH = `${RECYCLED_PATH}\\INFO2`;
const INFO2_HEADER_SIZE = 20;
const INFO2_RECORD_SIZE = 800;
const INFO2_VERSION = 5;

// Normalize + resolve a (possibly relative) path against a base dir to an
// absolute "C:\..." string. Returns null if it escapes the filesystem.
function normalizePath(path: string, base = "C:\\"): string | null {
  const p = path.trim();
  if (!p) return null;

  const drivePath = p.match(/^([A-Za-z]:)(.*)$/);
  let drive = "C:";
  let parts: string[];
  if (drivePath) {
    if (drivePath[1].toUpperCase() !== "C:") {
      // The virtual filesystem only has a C: drive; A:/D: etc. are "not ready".
      return null;
    }
    drive = "C:";
    const remainder = drivePath[2].replace(/\//g, SEP);
    if (remainder.startsWith(SEP)) {
      // C:\foo is rooted; C:foo is relative to the current directory on C:.
      parts = remainder.split(/[\\/]+/).filter(Boolean);
    } else {
      const baseParts = base
        .replace(/\//g, SEP)
        .replace(/^C:/i, "")
        .split(/[\\/]+/)
        .filter(Boolean);
      parts = [
        ...baseParts,
        ...remainder.split(/[\\/]+/).filter(Boolean),
      ];
    }
  } else if (p.startsWith(SEP) || p.startsWith("/")) {
    // A root-relative path such as \WINNT starts at C:\, not at the cwd.
    parts = p
      .replace(/\//g, SEP)
      .replace(/^\\+/, "")
      .split(/[\\/]+/)
      .filter(Boolean);
  } else {
    const baseParts = base
      .replace(/\//g, SEP)
      .replace(/^C:/i, "")
      .split(/[\\/]+/)
      .filter(Boolean);
    parts = [...baseParts, ...p.replace(/\//g, SEP).split(/[\\/]+/).filter(Boolean)];
  }

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

// FAT/VFAT long names still reject the DOS device names and these characters.
// Explorer also strips trailing spaces/dots, so accepting them here would make
// nodes that cannot subsequently be addressed by their displayed name.
function isValidWindowsName(name: string): boolean {
  if (!name || name === "." || name === ".." || name.length > 255)
    return false;
  if (/[<>:"/\\|?*]/.test(name)) return false;
  if ([...name].some((character) => character.charCodeAt(0) < 32)) return false;
  if (/[ .]$/.test(name)) return false;
  const stem = name.split(".")[0].toUpperCase();
  return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem);
}

const FAT_SHORT_NAME_CHARS = /^[A-Z0-9_$%'@^_`{}~!#&()-]+$/;

function splitFileName(name: string): { base: string; extension: string } {
  const dot = name.lastIndexOf(".");
  return dot > 0
    ? { base: name.slice(0, dot), extension: name.slice(dot + 1) }
    : { base: name, extension: "" };
}

function directShortName(name: string): string | null {
  const { base, extension } = splitFileName(name);
  const upperBase = base.toUpperCase();
  const upperExtension = extension.toUpperCase();
  if (
    upperBase.length < 1 ||
    upperBase.length > 8 ||
    upperExtension.length > 3 ||
    !FAT_SHORT_NAME_CHARS.test(upperBase) ||
    (upperExtension && !FAT_SHORT_NAME_CHARS.test(upperExtension))
  )
    return null;
  return upperExtension ? `${upperBase}.${upperExtension}` : upperBase;
}

/**
 * Build the per-directory VFAT aliases. Existing 8.3-compatible names reserve
 * their aliases first, then long names receive the first available `~n` name.
 */
function shortNamesForChildren(children: VfsNode[]): Map<string, string> {
  const aliases = new Map<string, string>();
  const used = new Set<string>();
  const longNames: VfsNode[] = [];

  // Real 8.3 names always win over aliases generated for long names.
  for (const child of children) {
    const alias = directShortName(child.name);
    if (alias) {
      aliases.set(child.name.toLowerCase(), alias);
      used.add(alias.toLowerCase());
    }
  }

  // Preserve aliases already assigned to existing directory entries.
  for (const child of children) {
    if (directShortName(child.name)) continue;
    const storedAlias = child.shortName && directShortName(child.shortName);
    if (storedAlias && !used.has(storedAlias.toLowerCase())) {
      aliases.set(child.name.toLowerCase(), storedAlias);
      used.add(storedAlias.toLowerCase());
    } else {
      longNames.push(child);
    }
  }

  // This is needed only for old/unmigrated nodes. Stable creation order keeps
  // aliases deterministic until the next filesystem migration stores them.
  longNames.sort(
    (left, right) =>
      left.created - right.created || left.name.localeCompare(right.name),
  );
  for (const child of longNames) {
    const alias = generateShortAlias(child.name, used);
    aliases.set(child.name.toLowerCase(), alias);
    used.add(alias.toLowerCase());
  }

  return aliases;
}

function generateShortAlias(name: string, used: Set<string>): string {
  const direct = directShortName(name);
  if (direct) return direct;
  const { base, extension } = splitFileName(name);
  const clean = (part: string) =>
    part
      .toUpperCase()
      .replace(/[^A-Z0-9_$%'@^_`{}~!#&()-]/g, "");
  const aliasBase = clean(base) || "FILE";
  const aliasExtension = clean(extension).slice(0, 3);
  for (let ordinal = 1; ordinal < 1_000_000; ordinal++) {
    const suffix = `~${ordinal}`;
    const prefix = aliasBase.slice(0, Math.max(1, 8 - suffix.length));
    const baseAlias = `${prefix}${suffix}`;
    const alias = aliasExtension
      ? `${baseAlias}.${aliasExtension}`
      : baseAlias;
    if (!used.has(alias.toLowerCase())) return alias;
  }
  return "FILE~1";
}

function shortNameForNewChild(parent: VfsNode, node: VfsNode): string {
  const newChild = { ...node, shortName: undefined };
  const aliases = shortNamesForChildren([
    ...(parent.children ?? []),
    newChild,
  ]);
  return aliases.get(node.name.toLowerCase()) ?? generateShortAlias(node.name, new Set());
}

function recycledNodePath(item: Pick<RecycledItem, "storageName">): string {
  return `${RECYCLED_PATH}\\${item.storageName}`;
}

function findRecycledNode(
  root: VfsNode,
  item: Pick<RecycledItem, "storageName">,
): VfsNode | null {
  return findNode(root, recycledNodePath(item));
}

function nextRecycleStorageName(
  root: VfsNode,
  node: VfsNode,
): { recordNumber: number; storageName: string } {
  const dot = node.type === "file" ? node.name.lastIndexOf(".") : -1;
  const extension = dot > 0 ? `.${node.name.slice(dot + 1, dot + 4)}` : "";
  for (
    let recordNumber = nextInfo2RecordNumber(root);
    recordNumber < 1_000_000;
    recordNumber++
  ) {
    const name = `Dc${recordNumber}${extension}`;
    if (!findNode(root, `${RECYCLED_PATH}\\${name}`)) {
      return { recordNumber, storageName: name };
    }
  }
  const recordNumber = Math.floor(Date.now() / 1000);
  return { recordNumber, storageName: `Dc${recordNumber}${extension}` };
}

function emptyInfo2(): Uint8Array {
  const bytes = new Uint8Array(INFO2_HEADER_SIZE);
  const header = new DataView(bytes.buffer);
  header.setUint32(0, INFO2_VERSION, true);
  header.setUint32(8, 1, true);
  header.setUint32(12, INFO2_RECORD_SIZE, true);
  return bytes;
}

function readInfo2(root: VfsNode): Uint8Array | null {
  const node = findNode(root, RECYCLED_INDEX_PATH);
  const match = node?.type === "file"
    ? node.content?.match(/^data:application\/octet-stream;base64,([\s\S]*)$/)
    : null;
  if (!match) return null;
  try {
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (
      bytes.length < INFO2_HEADER_SIZE ||
      new DataView(bytes.buffer).getUint32(0, true) !== INFO2_VERSION ||
      new DataView(bytes.buffer).getUint32(12, true) !== INFO2_RECORD_SIZE
    ) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

function nextInfo2RecordNumber(root: VfsNode): number {
  const bytes = readInfo2(root);
  if (!bytes) return 1;
  return Math.max(1, new DataView(bytes.buffer).getUint32(8, true));
}

function info2DataUrl(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:application/octet-stream;base64,${btoa(binary)}`;
}

function writeInfo2(root: VfsNode, bytes: Uint8Array): VfsNode | null {
  const content = info2DataUrl(bytes);
  const updated = updateNode(root, RECYCLED_INDEX_PATH, (node) => {
    if (node.type !== "file") return null;
    return {
      ...node,
      content,
      modified: fatWriteTime(now()),
      accessed: fatAccessDate(now()),
      archive: true,
    };
  });
  if (updated) return updated;
  return insertNode(
    root,
    RECYCLED_PATH,
    file("INFO2", { content, hidden: true, system: true }),
  );
}

function writeAnsiPath(bytes: Uint8Array, offset: number, path: string): void {
  const specialCharacters = new Map<number, number>([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
    [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
    [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
    [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
    [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
    [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
  ]);
  let cursor = offset;
  for (const character of path.slice(0, 259)) {
    const codePoint = character.codePointAt(0) ?? 0x3f;
    const cp1252 = specialCharacters.get(codePoint);
    bytes[cursor++] = cp1252 ?? (codePoint <= 0xff ? codePoint : 0x3f);
  }
}

function writeInfo2Record(
  bytes: Uint8Array,
  item: RecycledItem,
  storedNode: VfsNode,
): void {
  const recordOffset =
    INFO2_HEADER_SIZE + (item.recordNumber - 1) * INFO2_RECORD_SIZE;
  const view = new DataView(bytes.buffer);
  writeAnsiPath(bytes, recordOffset, item.originalPath);
  view.setUint32(recordOffset + 260, item.recordNumber, true);
  view.setUint32(recordOffset + 264, 2, true);
  const filetime =
    (BigInt(Math.round(item.deletedAt)) + 11644473600000n) * 10000n;
  view.setBigUint64(recordOffset + 268, filetime, true);
  view.setUint32(
    recordOffset + 276,
    Math.min(0xffffffff, vfsNodeAllocatedByteSize(storedNode)),
    true,
  );
  const path = item.originalPath.slice(0, 259);
  for (let index = 0; index < path.length; index++) {
    view.setUint16(recordOffset + 280 + index * 2, path.charCodeAt(index), true);
  }
}

function updateInfo2Header(
  bytes: Uint8Array,
  items: RecycledItem[],
  root: VfsNode,
): void {
  const view = new DataView(bytes.buffer);
  view.setUint32(0, INFO2_VERSION, true);
  view.setUint32(4, (bytes.length - INFO2_HEADER_SIZE) / INFO2_RECORD_SIZE, true);
  view.setUint32(8, Math.max(1, nextInfo2RecordNumber(root)), true);
  view.setUint32(12, INFO2_RECORD_SIZE, true);
  view.setUint32(
    16,
    Math.min(0xffffffff, recycledAllocatedUsage(root, items)),
    true,
  );
}

function appendInfo2Record(
  root: VfsNode,
  item: RecycledItem,
  items: RecycledItem[],
): VfsNode | null {
  const previous = readInfo2(root) ?? emptyInfo2();
  const requiredLength =
    INFO2_HEADER_SIZE + item.recordNumber * INFO2_RECORD_SIZE;
  const bytes = new Uint8Array(Math.max(previous.length, requiredLength));
  bytes.set(previous);
  const storedNode = findRecycledNode(root, item);
  if (!storedNode) return null;
  writeInfo2Record(bytes, item, storedNode);
  updateInfo2Header(bytes, items, root);
  // The header points to the next unused record, not the most recent one.
  new DataView(bytes.buffer).setUint32(8, item.recordNumber + 1, true);
  return writeInfo2(root, bytes);
}

function removeInfo2Record(
  root: VfsNode,
  item: RecycledItem,
  remaining: RecycledItem[],
): VfsNode {
  const previous = readInfo2(root);
  if (!previous) return root;
  const recordOffset =
    INFO2_HEADER_SIZE + (item.recordNumber - 1) * INFO2_RECORD_SIZE;
  if (recordOffset + INFO2_RECORD_SIZE > previous.length) return root;
  const bytes = previous.slice();
  bytes[recordOffset] = 0;
  bytes[recordOffset + 280] = 0;
  bytes[recordOffset + 281] = 0;
  updateInfo2Header(bytes, remaining, root);
  return writeInfo2(root, bytes) ?? root;
}

function recycledAllocatedUsage(root: VfsNode, items: RecycledItem[]): number {
  return items.reduce((total, item) => {
    const node = findRecycledNode(root, item);
    return total + (node ? vfsNodeAllocatedByteSize(node) : 0);
  }, 0);
}

function recycledNodeForStorage(node: VfsNode, storageName: string): VfsNode {
  return {
    ...node,
    name: storageName,
    shortName: undefined,
    hidden: true,
    system: true,
    protected: true,
  };
}

function assignShortNamesToTree(node: VfsNode): VfsNode {
  if (node.type !== "dir") return node;
  const children = node.children ?? [];
  const aliases = shortNamesForChildren(children);
  return {
    ...node,
    children: children.map((child) => {
      const namedChild = {
        ...child,
        shortName:
          aliases.get(child.name.toLowerCase()) ??
          directShortName(child.name) ??
          generateShortAlias(child.name, new Set()),
      };
      return child.type === "dir"
        ? assignShortNamesToTree(namedChild)
        : namedChild;
    }),
  };
}

function normalizeFatTimestamps(node: VfsNode): VfsNode {
  const created = fatCreationTime(node.created);
  const modified = fatWriteTime(node.modified ?? node.created);
  const accessed = fatAccessDate(node.accessed ?? node.created);
  if (node.type === "file") {
    return { ...node, created, modified, accessed };
  }
  return {
    ...node,
    created,
    modified,
    accessed,
    children: (node.children ?? []).map(normalizeFatTimestamps),
  };
}

function findChildByLongOrShortName(
  parent: VfsNode,
  name: string,
): VfsNode | null {
  const children = parent.children ?? [];
  const exact = children.find(
    (child) => child.name.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return exact;
  const wantedAlias = name.toUpperCase();
  const aliases = shortNamesForChildren(children);
  return (
    children.find(
      (child) =>
        aliases.get(child.name.toLowerCase())?.toUpperCase() === wantedAlias,
    ) ?? null
  );
}

function canonicalizeExistingPath(root: VfsNode, absPath: string): string {
  const parts = splitAbs(absPath);
  const canonicalParts: string[] = [];
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const child = findChildByLongOrShortName(current, part);
    if (!child) {
      canonicalParts.push(...parts.slice(index));
      break;
    }
    canonicalParts.push(child.name);
    current = child;
  }
  return `C:${SEP}${canonicalParts.join(SEP)}`;
}

function splitAbs(absPath: string): string[] {
  // "C:\Windows\System" -> ["Windows","System"]
  return absPath
    .slice(3)
    .split(/[\\/]+/)
    .filter(Boolean);
}

function childPath(parentPath: string, name: string): string {
  return `${parentPath.replace(/[\\/]+$/, "")}\\${name}`;
}

// ─── Tree helpers (pure) ───────────────────────────────────────────────────
function findNode(root: VfsNode, absPath: string): VfsNode | null {
  const parts = splitAbs(absPath);
  let cur: VfsNode = root;
  for (const part of parts) {
    if (cur.type !== "dir" || !cur.children) return null;
    const next = findChildByLongOrShortName(cur, part);
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
  const node = findChildByLongOrShortName(parent, name);
  if (!node) return null;
  return { parent, node, name };
}

// Deep-clone a node (and any children) with fresh `created` timestamps so a
// pasted copy doesn't share identity/timestamps with the original.
function cloneNode(node: VfsNode): VfsNode {
  const timestamps = fileSystemTimestamps();
  if (node.type === "file") {
    return {
      ...node,
      // `protected` represents ownership by this installed Windows image,
      // not a DOS attribute. A user copy of an OS file must remain editable.
      protected: false,
      ...timestamps,
      // Explorer creates a new file on copy but keeps the source file's
      // last-write time; directory timestamps, by contrast, describe the
      // newly-created destination tree.
      modified: fatWriteTime(node.modified ?? timestamps.modified),
    };
  }
  return {
    ...node,
    protected: false,
    ...timestamps,
    children: (node.children ?? []).map(cloneNode),
  };
}

function withReadAccessDate(node: VfsNode, accessed: number): VfsNode {
  const children =
    node.type === "dir"
      ? (node.children ?? []).map((child) =>
          withReadAccessDate(child, accessed),
        )
      : undefined;
  const childrenChanged =
    !!children && children.some((child, index) => child !== node.children?.[index]);
  if (node.accessed === accessed && !childrenChanged) return node;
  return {
    ...node,
    accessed,
    ...(children && { children }),
  };
}

function updateReadAccessDate(
  root: VfsNode,
  absPath: string,
  accessed: number,
): VfsNode {
  const source = findNode(root, absPath);
  if (!source) return root;
  const accessedSource = withReadAccessDate(source, accessed);
  if (accessedSource === source) return root;
  return updateNode(root, absPath, () => accessedSource) ?? root;
}

// Is `maybeAncestor` the same path as `path`, or a parent directory of it?
// Used to stop a folder being copied/moved into itself or one of its descendants.
function isAncestorOrSelf(maybeAncestor: string, path: string): boolean {
  const a = maybeAncestor.toLowerCase().replace(/[\\/]+$/, "");
  const b = path.toLowerCase().replace(/[\\/]+$/, "");
  if (a === b) return true;
  return b.startsWith(a + SEP);
}

/** The DOS Read-only attribute is enforced for files, not directories. */
export function isReadOnlyFile(
  node: Pick<VfsNode, "type" | "readonly">,
): boolean {
  return node.type === "file" && !!node.readonly;
}

/** A directory cannot carry immutable Windows-owned objects through an edit. */
export function containsProtectedNode(node: VfsNode): boolean {
  return (
    !!node.protected ||
    (node.type === "dir" &&
      (node.children ?? []).some(containsProtectedNode))
  );
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
  const extension = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (true) {
    const prefix = n === 2 ? "Copy of " : `Copy (${n}) of `;
    // Keep generated components within VFAT's 255-character limit. If an
    // unusually long extension consumes the available space, trim it only as
    // much as needed to retain at least one character from the base name.
    const extensionBudget = Math.max(0, 254 - prefix.length);
    const safeExtension = extension.slice(0, extensionBudget);
    const baseBudget = Math.max(1, 255 - prefix.length - safeExtension.length);
    const candidate = `${prefix}${base.slice(0, baseBudget)}${safeExtension}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
    n++;
  }
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
    const child = findChildByLongOrShortName(cur, part);
    const idx = child ? cur.children.indexOf(child) : -1;
    if (idx === -1) return null;
    const newChild = walk(cur.children[idx], depth + 1);
    if (newChild === null) return null;
    const previousChild = cur.children[idx];
    if (newChild.name !== previousChild.name) {
      newChild.shortName = shortNameForNewChild(
        { ...cur, children: cur.children.filter((_, i) => i !== idx) },
        newChild,
      );
    }
    const newChildren = [...cur.children];
    newChildren[idx] = newChild;
    return {
      ...cur,
      ...(newChild.name !== previousChild.name && {
        modified: fatWriteTime(now()),
      }),
      children: newChildren,
    };
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
    if (findChildByLongOrShortName(root, newNode.name)) return null;
    const namedNode = {
      ...newNode,
      shortName: shortNameForNewChild(root, newNode),
    };
    return {
      ...root,
      modified: fatWriteTime(now()),
      children: [...(root.children ?? []), namedNode],
    };
  }
  return updateNode(root, parentAbsPath, (parent) => {
    if (parent.type !== "dir") return null;
    if (findChildByLongOrShortName(parent, newNode.name)) return null;
    const namedNode = {
      ...newNode,
      shortName: shortNameForNewChild(parent, newNode),
    };
    return {
      ...parent,
      modified: fatWriteTime(now()),
      children: [...(parent.children ?? []), namedNode],
    };
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
    const target = findChildByLongOrShortName(root, name);
    if (!target) return null;
    return {
      ...root,
      modified: fatWriteTime(now()),
      children: (root.children ?? []).filter((child) => child !== target),
    };
  }
  return updateNode(root, parentAbs, (parent) => {
    if (parent.type !== "dir") return null;
    const target = findChildByLongOrShortName(parent, name);
    if (!target) return null;
    return {
      ...parent,
      modified: fatWriteTime(now()),
      children: (parent.children ?? []).filter((child) => child !== target),
    };
  });
}

let _id = 0;
const now = () => Date.now() + _id++;
const fatCreationTime = (time: number) => Math.floor(time / 10) * 10;
const fatWriteTime = (time: number) => Math.floor(time / 2000) * 2000;
const fatAccessDate = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
const fileSystemTimestamps = (time = now()) => ({
  created: fatCreationTime(time),
  modified: fatWriteTime(time),
  accessed: fatAccessDate(time),
});
const timestamps = () => fileSystemTimestamps();
const dir = (
  name: string,
  children: VfsNode[] = [],
  system = true,
): VfsNode => ({
  name,
  type: "dir",
  children,
  system,
  protected: system,
  ...timestamps(),
});
const file = (name: string, opts: Partial<VfsNode> = {}): VfsNode => {
  const node: VfsNode = {
    name,
    type: "file",
    content: "",
    system: false,
    archive: true, // Win95 sets the archive bit on new/changed files
    ...timestamps(),
    ...opts,
  };
  node.protected = opts.protected ?? !!opts.system;
  return node;
};

function defaultSendToEntries(): VfsNode[] {
  return [
    file("3½ Floppy (A:).lnk", {
      content: JSON.stringify({
        type: "file",
        target: "A:\\",
        title: "3½ Floppy (A:)",
        icon: "/icons/shell32.dll/102.ico",
      }),
      system: true,
      protected: false,
    }),
    file("Desktop (create shortcut).DeskLink", {
      hidden: true,
      system: true,
      protected: false,
    }),
    file("Mail Recipient.MAPIMail", {
      hidden: true,
      system: true,
      protected: false,
    }),
    file("My Documents.lnk", {
      content: JSON.stringify({
        type: "file",
        target: USER_DOCUMENTS_PATH,
        title: "My Documents",
        icon: "/icons/shell32.dll/003.ico",
      }),
      system: true,
      protected: false,
    }),
  ];
}

function addMissingSendToEntries(root: VfsNode): VfsNode {
  let nextRoot = root;
  const folder = findNode(nextRoot, USER_SEND_TO_PATH);
  if (!folder || folder.type !== "dir") return nextRoot;

  for (const entry of defaultSendToEntries()) {
    if (findNode(nextRoot, `${USER_SEND_TO_PATH}\\${entry.name}`)) continue;
    nextRoot = insertNode(nextRoot, USER_SEND_TO_PATH, entry) ?? nextRoot;
  }
  return nextRoot;
}
const exe = (name: string, appId: string): VfsNode => ({
  name,
  type: "file",
  appId,
  system: true,
  protected: true,
  ...timestamps(),
});
const txt = (name: string, content: string, system = false): VfsNode => ({
  name,
  type: "file",
  content,
  system,
  protected: system,
  ...timestamps(),
});

function recentDocumentTarget(node: VfsNode): string | null {
  if (node.type !== "file" || !node.name.toLowerCase().endsWith(".lnk")) {
    return null;
  }
  try {
    const shortcut: unknown = JSON.parse(node.content ?? "");
    if (
      shortcut &&
      typeof shortcut === "object" &&
      "type" in shortcut &&
      shortcut.type === "file" &&
      "target" in shortcut &&
      typeof shortcut.target === "string"
    ) {
      return shortcut.target;
    }
  } catch {
    // A hand-created or malformed .lnk is not a Shell-managed Recent entry.
  }
  return null;
}

// ─── Canonical Windows 2000 filesystem ────────────────────────────────────
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

  const systemPrograms = [
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
      exe("cmd.exe", "terminal"),
      exe("calc.exe", "calculator"),
      exe("sndrec32.exe", "sound-recorder"),
      exe("taskmgr.exe", "task-manager"),
      exe("charmap.exe", "charmap"),
      exe("regedit.exe", ""),
      exe("write.exe", ""),
      exe("ping.exe", ""),
      exe("ipconfig.exe", ""),
      exe("rundll32.exe", ""),
      exe("winlogon.exe", ""),
    ];

  let windows = dir(
    "WINNT",
    [
      file("win.ini", { content: "[windows]\nload=\nrun=\n", system: true }),
      file("system.ini", {
        content: "[boot]\nshell=Explorer.exe\n",
        system: true,
      }),
      dir(
        "System32",
        [
          ...systemDlls,
          ...systemPrograms,
          ...(commandDir.children ?? []),
          dir("Spool", [dir("Printers", [], true)], true),
          dir(
            "Config",
            ["DEFAULT", "SAM", "SECURITY", "SOFTWARE", "SYSTEM"].map((name) =>
              file(name, { system: true, hidden: true, readonly: true }),
            ),
            true,
          ),
          dir(
            "drivers",
            [
              ...["acpi.sys", "disk.sys", "ndis.sys", "tcpip.sys"].map((name) =>
                file(name, { system: true, hidden: false, readonly: true }),
              ),
              dir(
                "etc",
                ["hosts", "lmhosts.sam", "networks", "protocol", "services"].map((name) =>
                  file(name, { system: true, readonly: true }),
                ),
                true,
              ),
            ],
            true,
          ),
          dir("Wbem", [], true),
          // Screen savers — opening a .scr runs it (see data/fileOpen.ts).
          ...SCREENSAVERS.map((s) => file(s.file, { system: true })),
        ],
        true,
      ),
      // Fonts is a shell folder in Windows 2000, not merely another group of
      // files under System32. Keeping it in the VFS makes Control Panel and
      // Explorer agree on where installed fonts live.
      dir("Fonts", fonts, true),
      dir(
        "Inf",
        [
          file("layout.inf", { system: true, readonly: true }),
          file("machine.inf", { system: true, readonly: true }),
          file("net.inf", { system: true, readonly: true }),
          file("shell.inf", { system: true, readonly: true }),
        ],
        true,
      ),
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
      dir("Cookies", [], true),
      dir("Favorites", [], true),
      dir("History", [], true),
      dir("Recent", [], true),
      dir("SendTo", defaultSendToEntries(), true),
      dir("Spool", [dir("Printers", [], true)], true),
      dir("Profiles", [dir("Default User", [], true)], true),
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
      // Default wallpapers — .bmp files at Windows 2000's Web/Wallpaper path,
      // browsable and pickable from Display Properties ▸ Background.
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
      // System sounds, browsable at the Windows 2000 system-root Media path.
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
      // All Users\Start Menu is the shared Windows 2000 Start Menu. Programs\
      // contains .lnk shortcuts that the shell reads dynamically.
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
                      icon: "/icons/pinball.exe/000.ico",
                    }),
                    system: true,
                  }),
                ],
                true,
              ),

              dir("StartUp", [], true),

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

  const takeWindowsFolder = (name: string): VfsNode | undefined => {
    const children = windows.children ?? [];
    const found = children.find((node) => node.name.toLowerCase() === name.toLowerCase());
    if (found) {
      windows = { ...windows, children: children.filter((node) => node !== found) };
    }
    return found;
  };
  const personalFolder = (
    node: VfsNode | undefined,
    name: string,
    system = false,
  ): VfsNode => node
    ? { ...node, name, system, protected: system }
    : dir(name, [], system);

  // Windows 2000 keeps per-user shell data under Documents and Settings.
  const userDesktop = personalFolder(takeWindowsFolder("Desktop"), "Desktop");
  const userApplicationData = personalFolder(
    takeWindowsFolder("Application Data"),
    "Application Data",
  );
  const userCookies = personalFolder(takeWindowsFolder("Cookies"), "Cookies");
  const userFavorites = personalFolder(takeWindowsFolder("Favorites"), "Favorites");
  const userHistory = personalFolder(takeWindowsFolder("History"), "History");
  const userRecent = personalFolder(takeWindowsFolder("Recent"), "Recent");
  const userSendTo = personalFolder(takeWindowsFolder("SendTo"), "SendTo");
  const commonStartMenu = personalFolder(
    takeWindowsFolder("Start Menu"),
    "Start Menu",
    true,
  );
  takeWindowsFolder("Profiles");
  takeWindowsFolder("Spool");

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
  notepad      (or: C:\\WINNT\\System32\\notepad.exe)
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
  e.g.: ${USER_PICTURES_PATH}\\artwork.png

Images saved here can be opened by
double-clicking them in My Computer.
`,
        false,
      ),
    ],
    false,
  );

  const userProfile = dir(
    "Administrator",
    [
      userApplicationData,
      userCookies,
      userDesktop,
      userFavorites,
      dir(
        "Local Settings",
        [
          dir("Application Data", [], false),
          dir("Temp", [], false),
          userHistory,
          dir("Temporary Internet Files", [], false),
        ],
        false,
      ),
      myDocuments,
      myPictures,
      dir("NetHood", [], false),
      dir("PrintHood", [], false),
      userRecent,
      userSendTo,
      dir("Start Menu", [dir("Programs", [], false), dir("StartUp", [], false)], false),
      dir("Templates", [], false),
      file("NTUSER.DAT", { system: true, hidden: true, readonly: true }),
    ],
    false,
  );
  const allUsersProfile = dir(
    "All Users",
    [
      dir("Application Data", [], true),
      dir("Desktop", [], true),
      dir("Favorites", [], true),
      commonStartMenu,
      dir("Templates", [], true),
    ],
    true,
  );
  const defaultUserProfile = dir(
    "Default User",
    [
      dir("Application Data", [], true),
      dir("Desktop", [], true),
      dir("Favorites", [], true),
      dir("My Documents", [], true),
      dir("NetHood", [], true),
      dir("Start Menu", [dir("Programs", [], true), dir("StartUp", [], true)], true),
      dir("Templates", [], true),
      file("NTUSER.DAT", { system: true, hidden: true, readonly: true }),
    ],
    true,
  );
  const documentsAndSettings = dir(
    "Documents and Settings",
    [allUsersProfile, defaultUserProfile, userProfile],
    true,
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
            "[RSNRA]\nband=RESONAURA\nversion=2000\nyear=2000\n",
            false,
          ),
          txt(
            "changelog.txt",
            `RSNRA.ART — Changelog
====================

v4.2000
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
            "Microsoft Plus! for Windows 2000\nNot included in this version.\n",
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
      dir("Common Files", [dir("Microsoft Shared", [], true)], true),
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

  const recycled = dir(
    "Recycled",
    [
      file("Desktop.ini", {
        content:
          "[.ShellClassInfo]\r\nCLSID={645FF040-5081-101B-9F08-00AA002F954E}\r\n",
        hidden: true,
        system: true,
        readonly: true,
      }),
    ],
    true,
  );
  recycled.hidden = true;

  return dir(
    "C:\\",
    [
      file("boot.ini", {
        content: "[boot loader]\ntimeout=30\ndefault=multi(0)disk(0)rdisk(0)partition(1)\\WINNT\n[operating systems]\n",
        system: true,
      }),
      file("NTDETECT.COM", {
        system: true,
        hidden: true,
        readonly: true,
      }),
      file("NTLDR", { system: true, hidden: true, readonly: true }),
      file("pagefile.sys", { system: true, hidden: true, readonly: true }),
      windows,
      documentsAndSettings,
      programFiles,
      recycled,
    ],
    true,
  );
}

/**
 * Upgrade the immutable operating-system portion of an existing virtual disk
 * while preserving every user-created file and directory. This lets the VFS
 * evolve like an installed OS rather than requiring a destructive reset.
 */
function mergeCanonicalTree(
  canonical: VfsNode,
  persisted: VfsNode | undefined,
): VfsNode {
  if (!persisted || canonical.type !== "dir" || persisted.type !== "dir") {
    return persisted && !canonical.system ? persisted : canonical;
  }

  const oldChildren = persisted.children ?? [];
  const canonicalNames = new Set(
    (canonical.children ?? []).map((child) => child.name.toLowerCase()),
  );
  const children = (canonical.children ?? []).map((child) => {
    const old = oldChildren.find(
      (candidate) => candidate.name.toLowerCase() === child.name.toLowerCase(),
    );
    if (child.type === "dir" && old?.type === "dir") {
      return mergeCanonicalTree(child, old);
    }
    return old && !child.system ? old : child;
  });

  // Never discard user additions (including additions made inside a system
  // folder such as Desktop or My Documents).
  children.push(
    ...oldChildren.filter(
      (child) => !canonicalNames.has(child.name.toLowerCase()),
    ),
  );
  return { ...canonical, children };
}

function takeChild(
  parent: VfsNode,
  name: string,
): { parent: VfsNode; child: VfsNode | undefined } {
  const children = parent.children ?? [];
  const child = children.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  return {
    parent: child
      ? { ...parent, children: children.filter((entry) => entry !== child) }
      : parent,
    child,
  };
}

function putChild(parent: VfsNode, child: VfsNode): VfsNode {
  const children = parent.children ?? [];
  const existing = children.findIndex(
    (entry) => entry.name.toLowerCase() === child.name.toLowerCase(),
  );
  if (existing < 0) return { ...parent, children: [...children, child] };
  const current = children[existing];
  const merged = current.type === "dir" && child.type === "dir"
    ? mergeCanonicalTree(current, child)
    : current;
  return {
    ...parent,
    children: children.map((entry, index) => index === existing ? merged : entry),
  };
}

function ensureFolder(parent: VfsNode, name: string, system = false): VfsNode {
  const found = (parent.children ?? []).find(
    (entry) => entry.name.toLowerCase() === name.toLowerCase(),
  );
  if (found?.type === "dir") return found;
  return dir(name, [], system);
}

function refreshLegacyBranding(node: VfsNode): VfsNode {
  if (node.type === "file") {
    if (typeof node.content !== "string") return node;
    const content = node.content
      .replace("version=95\nyear=1996", "version=2000\nyear=2000")
      .replace("v4.95.1996", "v4.2000")
      .replace("Microsoft Plus! for Windows 95", "Microsoft Plus! for Windows 2000");
    return content === node.content
      ? node
      : { ...node, content, modified: fatWriteTime(now()) };
  }
  const children = node.children ?? [];
  const nextChildren = children.map(refreshLegacyBranding);
  if (nextChildren.every((child, index) => child === children[index])) return node;
  return { ...node, children: nextChildren, modified: fatWriteTime(now()) };
}

/** Rebase the previous 9x-shaped virtual disk onto Windows 2000 locations. */
function relocateLegacyFilesystem(root: VfsNode | undefined): VfsNode {
  if (!root || root.type !== "dir") return buildInitialTree();

  let nextRoot: VfsNode = { ...root, children: [...(root.children ?? [])] };
  let winnt = (nextRoot.children ?? []).find(
    (entry) => entry.name.toLowerCase() === "winnt",
  );
  const legacyWindows = (nextRoot.children ?? []).find(
    (entry) => entry.name.toLowerCase() === "windows",
  );
  nextRoot = {
    ...nextRoot,
    children: (nextRoot.children ?? []).filter(
      (entry) => entry !== legacyWindows && entry !== winnt,
    ),
  };
  if (!winnt && legacyWindows) {
    winnt = { ...legacyWindows, name: "WINNT" };
  } else if (winnt && legacyWindows && winnt.type === "dir" && legacyWindows.type === "dir") {
    winnt = mergeCanonicalTree(winnt, legacyWindows);
  }
  winnt ??= dir("WINNT", [], true);
  if (winnt.type !== "dir") winnt = dir("WINNT", [], true);

  let winntChildren: VfsNode = { ...winnt, children: [...(winnt.children ?? [])] };
  const removed: Record<string, VfsNode | undefined> = {};
  for (const name of [
    "System32", "System", "Command", "Spool", "Desktop", "Application Data",
    "Cookies", "Favorites", "History", "Recent", "SendTo",
    "Start Menu", "Profiles",
  ]) {
    const taken = takeChild(winntChildren, name);
    winntChildren = taken.parent;
    removed[name.toLowerCase()] = taken.child;
  }

  const originalChildren = winntChildren.children ?? [];
  const systemPrograms = originalChildren.filter(
    (entry) => entry.type === "file" && /\.(?:exe|com|dll|scr|cpl|ocx|sys)$/i.test(entry.name),
  );
  winntChildren = {
    ...winntChildren,
    children: originalChildren.filter((entry) => !systemPrograms.includes(entry)),
  };
  let system32: VfsNode = removed.system32?.type === "dir"
    ? removed.system32
    : dir("System32", [], true);
  for (const source of [removed.system, removed.command, removed.spool]) {
    if (source?.type === "dir") {
      for (const child of source.children ?? []) system32 = putChild(system32, child);
    }
  }
  for (const child of systemPrograms) system32 = putChild(system32, child);
  system32 = { ...system32, name: "System32", system: true, protected: true };
  winntChildren = putChild(winntChildren, system32);

  let documentsAndSettings: VfsNode | undefined = (nextRoot.children ?? []).find(
    (entry) => entry.name.toLowerCase() === "documents and settings",
  );
  nextRoot = {
    ...nextRoot,
    children: (nextRoot.children ?? []).filter(
      (entry) => entry.name.toLowerCase() !== "documents and settings",
    ),
  };
  documentsAndSettings ??= dir("Documents and Settings", [], true);
  if (documentsAndSettings.type !== "dir") {
    documentsAndSettings = dir("Documents and Settings", [], true);
  }
  let profiles: VfsNode = { ...documentsAndSettings, children: [...(documentsAndSettings.children ?? [])] };
  // Remove the old profile before re-inserting its normalized copy. Merging
  // into the stale profile would preserve an obsolete root-level History
  // folder as though it were a canonical child.
  const oldAdministrator = takeChild(profiles, "Administrator");
  profiles = oldAdministrator.parent;
  let user: VfsNode = oldAdministrator.child?.type === "dir"
    ? oldAdministrator.child
    : ensureFolder(profiles, "Administrator");
  let allUsers: VfsNode = ensureFolder(profiles, "All Users", true);
  let defaultUser: VfsNode = ensureFolder(profiles, "Default User", true);
  const oldDocs = takeChild(nextRoot, "My Documents");
  nextRoot = oldDocs.parent;
  const oldPictures = takeChild(nextRoot, "My Pictures");
  nextRoot = oldPictures.parent;
  const userDocuments = oldDocs.child ?? (user.children ?? []).find(
    (entry) => entry.name.toLowerCase() === "my documents",
  );
  const userPictures = oldPictures.child ?? (user.children ?? []).find(
    (entry) => entry.name.toLowerCase() === "my pictures",
  );
  if (userDocuments) user = putChild(user, { ...userDocuments, name: "My Documents", system: false, protected: false });
  if (userPictures) user = putChild(user, { ...userPictures, name: "My Pictures", system: false, protected: false });

  // In some already-migrated disks History ended up beside the other profile
  // folders. Windows 2000 keeps it under Local Settings; merge rather than
  // replace if both locations have accumulated entries.
  const directHistory = takeChild(user, "History");
  user = directHistory.parent;
  if (directHistory.child && directHistory.child.type !== "dir") {
    user = putChild(user, directHistory.child);
  }

  for (const name of [
    "Desktop", "Application Data", "Cookies", "Favorites", "NetHood",
    "PrintHood", "Recent", "SendTo", "Templates",
  ]) {
    const node = removed[name.toLowerCase()];
    if (node) user = putChild(user, { ...node, system: false, protected: false });
  }
  const localSettings = ensureFolder(user, "Local Settings");
  let localChildren: VfsNode = localSettings;
  const existingLocalHistory = (localSettings.children ?? []).find(
    (entry) => entry.name.toLowerCase() === "history",
  );
  const historyNodes = [removed.history, directHistory.child, existingLocalHistory]
    .filter((node): node is VfsNode => node?.type === "dir")
    .map((node) => ({ ...node, name: "History", system: false, protected: false }));
  let mergedHistory: VfsNode | undefined;
  for (const history of historyNodes) {
    mergedHistory = mergedHistory
      ? mergeCanonicalTree(mergedHistory, history)
      : history;
  }
  if (mergedHistory) localChildren = putChild(localChildren, mergedHistory);
  if (removed.history?.type === "file") {
    localChildren = putChild(localChildren, { ...removed.history, name: "History" });
  }
  localChildren = putChild(localChildren, ensureFolder(localChildren, "Application Data"));
  localChildren = putChild(localChildren, ensureFolder(localChildren, "Temporary Internet Files"));
  user = putChild(user, localChildren);
  user = putChild(user, ensureFolder(user, "Start Menu"));

  if (removed["start menu"]) {
    allUsers = putChild(allUsers, { ...removed["start menu"], name: "Start Menu", system: true, protected: true });
  }
  if (removed.profiles?.type === "dir") {
    for (const previousProfile of removed.profiles.children ?? []) {
      if (previousProfile.name.toLowerCase() === "default user") {
        defaultUser = putChild(defaultUser, previousProfile);
      } else {
        profiles = putChild(profiles, previousProfile);
      }
    }
  }

  profiles = putChild(profiles, user);
  profiles = putChild(profiles, allUsers);
  profiles = putChild(profiles, defaultUser);
  nextRoot = putChild(nextRoot, winntChildren);
  nextRoot = putChild(nextRoot, { ...profiles, name: "Documents and Settings", system: true, protected: true });

  // The old root contained DOS boot files that do not belong to an NT 5.0
  // installation. Keep all other user-added root objects intact.
  const obsoleteBootFiles = new Set(["autoexec.bat", "config.sys", "command.com", "io.sys", "msdos.sys", "bootlog.txt"]);
  return refreshLegacyBranding({
    ...nextRoot,
    children: (nextRoot.children ?? []).filter(
      (entry) => !obsoleteBootFiles.has(entry.name.toLowerCase()),
    ),
  });
}

// ─── Store ─────────────────────────────────────────────────────────────────
export const useVfsStore = create<VfsState>()(
  persist(
    (set, get) => {
      type FsSnapshot = {
        root: VfsNode;
        recycled: RecycledItem[];
        label: string;
      };
      const undoStack: FsSnapshot[] = [];
      const redoStack: FsSnapshot[] = [];
      const maxHistory = 50;
      let transactionDepth = 0;
      let transactionStart: FsSnapshot | null = null;
      let transactionLabel = "File operation";

      const pushHistory = (stack: FsSnapshot[], snapshot: FsSnapshot) => {
        stack.push(snapshot);
        if (stack.length > maxHistory) stack.shift();
      };
      const updateHistoryFlags = () =>
        set({
          canUndo: undoStack.length > 0,
          canRedo: redoStack.length > 0,
          undoDescription: undoStack.at(-1)?.label ?? null,
          redoDescription: redoStack.at(-1)?.label ?? null,
        });
      const allocatedUsage = (root: VfsNode) =>
        vfsNodeAllocatedByteSize(root, true);
      const fitsOnDisk = (root: VfsNode) =>
        allocatedUsage(root) <= DISK_CAPACITY;
      const commitFilesystemChange = (
        next: Partial<VfsState>,
        label: string,
      ) => {
        const current = get();
        if (transactionDepth > 0) {
          transactionStart ??= {
            root: current.root,
            recycled: current.recycled,
            label: transactionLabel,
          };
          set(next);
          return;
        }
        pushHistory(undoStack, {
          root: current.root,
          recycled: current.recycled,
          label,
        });
        redoStack.length = 0;
        set({
          ...next,
          canUndo: true,
          canRedo: false,
          undoDescription: label,
          redoDescription: null,
        });
      };
      const resolveInputPath = (path: string, base = get().cwd) => {
        const normalized = normalizePath(path, base);
        if (!normalized || normalized.length >= WINDOWS_MAX_PATH) return null;
        return canonicalizeExistingPath(
          get().root,
          canonicalizeLegacyPath(normalized),
        );
      };

      return ({
      root: assignShortNamesToTree(buildInitialTree()),
      cwd: USER_DOCUMENTS_PATH,
      recycled: [],
      canUndo: false,
      canRedo: false,
      undoDescription: null,
      redoDescription: null,

      undo: () => {
        const previous = undoStack.pop();
        if (!previous) return false;
        const current = get();
        pushHistory(redoStack, {
          root: current.root,
          recycled: current.recycled,
          label: previous.label,
        });
        set({
          root: previous.root,
          recycled: previous.recycled,
          canUndo: undoStack.length > 0,
          canRedo: true,
          undoDescription: undoStack.at(-1)?.label ?? null,
          redoDescription: previous.label,
        });
        return true;
      },

      redo: () => {
        const next = redoStack.pop();
        if (!next) return false;
        const current = get();
        pushHistory(undoStack, {
          root: current.root,
          recycled: current.recycled,
          label: next.label,
        });
        set({
          root: next.root,
          recycled: next.recycled,
          canUndo: true,
          canRedo: redoStack.length > 0,
          undoDescription: next.label,
          redoDescription: redoStack.at(-1)?.label ?? null,
        });
        return true;
      },

      transaction: (label, action) => {
        const isOuterTransaction = transactionDepth === 0;
        if (isOuterTransaction) {
          transactionStart = null;
          transactionLabel = label;
        }
        transactionDepth++;
        try {
          action();
        } finally {
          transactionDepth--;
          if (isOuterTransaction) {
            const before = transactionStart;
            transactionStart = null;
            if (
              before &&
              (get().root !== before.root || get().recycled !== before.recycled)
            ) {
              pushHistory(undoStack, before);
              redoStack.length = 0;
              updateHistoryFlags();
            }
          }
        }
      },

      resolvePath: (path, base) =>
        resolveInputPath(path, base ?? get().cwd),

      resolve: (path, base) => {
        const abs = resolveInputPath(path, base ?? get().cwd);
        if (!abs) return null;
        return findNode(get().root, abs);
      },

      getShortName: (path) => {
        const abs = resolveInputPath(path);
        if (!abs) return null;
        const node = findNode(get().root, abs);
        if (!node) return null;
        const ref = findParent(get().root, abs);
        if (!ref) return node.name.toUpperCase();
        return (
          node.shortName ??
          shortNamesForChildren(ref.parent.children ?? []).get(
            node.name.toLowerCase(),
          ) ??
          node.name.toUpperCase()
        );
      },

      exists: (path) => !!get().resolve(path),

      list: (path) => {
        const node = get().resolve(path);
        if (!node || node.type !== "dir") return null;
        return [...(node.children ?? [])];
      },

      read: (path) => {
        const abs = resolveInputPath(path);
        if (!abs) return null;
        const node = findNode(get().root, abs);
        if (!node || node.type !== "file") return null;
        // FAT stores only the access date. Avoid persisting/re-rendering the
        // entire virtual tree when a file is read repeatedly on that date.
        const accessed = fatAccessDate(now());
        if (node.accessed !== accessed) {
          const newRoot = updateNode(get().root, abs, (current) => ({
            ...current,
            accessed,
          }));
          if (newRoot) set({ root: newRoot });
        }
        return node.content ?? "";
      },

      recordRecentDocument: (path) => {
        const root = get().root;
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const target = findNode(root, abs);
        if (!target || target.type !== "file" || target.appId) {
          return false;
        }
        const extension = target.name.split(".").pop()?.toLowerCase() ?? "";
        if (["lnk", "exe", "com", "bat", "cmd", "scr"].includes(extension)) {
          return false;
        }

        const recentPath = resolveInputPath(USER_RECENT_PATH, "C:\\");
        const recent = recentPath ? findNode(root, recentPath) : null;
        if (!recentPath || !recent || recent.type !== "dir") return false;

        const existingChildren = recent.children ?? [];
        const managed = existingChildren.filter(
          (child) => !child.protected && recentDocumentTarget(child) !== null,
        );
        const unrelated = existingChildren.filter((child) => !managed.includes(child));
        const targetKey = abs.toLowerCase();
        const sameTarget = managed.filter((child) =>
          (resolveInputPath(recentDocumentTarget(child)!, "C:\\") ??
            recentDocumentTarget(child)!)
            .toLowerCase() === targetKey,
        );
        const reusableName = sameTarget[0]?.name;
        const remainingRecent = managed
          .filter((child) => !sameTarget.includes(child))
          .sort((left, right) =>
            (right.modified ?? right.created) - (left.modified ?? left.created),
          );

        const takenNames = new Set(
          [...unrelated, ...remainingRecent].map((child) =>
            child.name.toLowerCase(),
          ),
        );
        const maxBaseLength = 251; // Leave room for the .lnk suffix.
        const fileName = target.name.slice(0, maxBaseLength);
        const dot = target.name.lastIndexOf(".");
        const stem = dot > 0 ? target.name.slice(0, dot) : target.name;
        const extensionWithDot = dot > 0 ? target.name.slice(dot) : "";
        let shortcutName =
          reusableName && !takenNames.has(reusableName.toLowerCase())
            ? reusableName
            : `${fileName}.lnk`;
        let ordinal = 2;
        while (
          takenNames.has(shortcutName.toLowerCase()) ||
          !isValidWindowsName(shortcutName)
        ) {
          const suffix = ` (${ordinal++})`;
          const availableStemLength = Math.max(
            1,
            250 - suffix.length - extensionWithDot.length,
          );
          shortcutName = `${stem.slice(0, availableStemLength)}${suffix}${extensionWithDot}.lnk`;
        }

        const shortcut = file(shortcutName, {
          content: JSON.stringify({
            type: "file",
            target: abs,
            title: target.name,
            shortcut: true,
          }),
        });

        let rootWithoutDuplicate = root;
        for (const child of sameTarget) {
          rootWithoutDuplicate =
            removeNode(rootWithoutDuplicate, `${recentPath}\\${child.name}`) ??
            rootWithoutDuplicate;
        }
        const nextRoot = insertNode(rootWithoutDuplicate, recentPath, shortcut);
        if (!nextRoot || !fitsOnDisk(nextRoot)) return false;

        const recentAfterInsert = findNode(nextRoot, recentPath);
        if (!recentAfterInsert || recentAfterInsert.type !== "dir") return false;
        const recentByName = new Map(
          (recentAfterInsert.children ?? []).map((child) => [
            child.name.toLowerCase(),
            child,
          ]),
        );
        const orderedRecent = [shortcutName, ...remainingRecent.map((child) => child.name)]
          .map((name) => recentByName.get(name.toLowerCase()))
          .filter((child): child is VfsNode => !!child);
        const orderedNames = new Set(orderedRecent.map((child) => child.name.toLowerCase()));
        const orderedChildren = [
          ...orderedRecent,
          ...(recentAfterInsert.children ?? []).filter(
            (child) => !orderedNames.has(child.name.toLowerCase()),
          ),
        ];
        const updatedRoot = updateNode(nextRoot, recentPath, (directory) => ({
          ...directory,
          modified: fatWriteTime(now()),
          children: orderedChildren,
        }));
        if (!updatedRoot || !fitsOnDisk(updatedRoot)) return false;
        set({ root: updatedRoot });
        return true;
      },

      clearRecentDocuments: () => {
        const root = get().root;
        const recentPath = resolveInputPath(USER_RECENT_PATH, "C:\\");
        if (!recentPath) return;
        const recent = findNode(root, recentPath);
        if (!recent || recent.type !== "dir") return;
        const children = recent.children ?? [];
        // Windows 2000's Clear command emptied the Recent folder itself, not
        // just entries that the Documents menu happened to recognize. These
        // are profile-local Recent entries (normally shortcuts); their target
        // documents live elsewhere and are never touched by this operation.
        const remaining = children.filter((child) => child.protected);
        if (remaining.length === children.length) return;
        const updatedRoot = updateNode(root, recentPath, (directory) => ({
          ...directory,
          modified: fatWriteTime(now()),
          children: remaining,
        }));
        if (updatedRoot) set({ root: updatedRoot });
      },

      findExecutable: (name, searchPath = DEFAULT_SYSTEM_PATH) => {
        const lower = name.toLowerCase();
        const withExe =
          lower.endsWith(".exe") || lower.endsWith(".com")
            ? lower
            : lower + ".exe";
        const directories = searchPath
          .split(";")
          .map((entry) => entry.trim().replace(/^"(.*)"$/, "$1"))
          .filter(Boolean);
        for (const directory of directories) {
          const resolvedDirectory = resolveInputPath(directory, "C:\\");
          if (!resolvedDirectory) continue;
          const list = get().list(resolvedDirectory);
          const hit = list?.find(
            (c) => c.name.toLowerCase() === withExe && c.appId,
          );
          if (hit) return resolvedDirectory + SEP + hit.name;
        }
        return null;
      },

      diskUsage: () => {
        // Recycled files still occupy clusters on C: until the bin is emptied.
        const used = allocatedUsage(get().root);
        return {
          total: DISK_CAPACITY,
          used,
          free: Math.max(0, DISK_CAPACITY - used),
        };
      },

      mkdir: (path) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        if (findNode(get().root, abs)) return false;
        const parts = splitAbs(abs);
        const name = parts[parts.length - 1];
        if (!isValidWindowsName(name)) return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        const newRoot = insertNode(
          get().root,
          parentPath,
          dir(name, [], false),
        );
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        commitFilesystemChange({ root: newRoot }, "Create folder");
        return true;
      },

      mkdirs: (path, options) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const parts = splitAbs(abs);
        if (!parts.length) return options?.allowExisting ?? false;

        const originalRoot = get().root;
        let nextRoot = originalRoot;
        const completedParts: string[] = [];
        for (const [index, part] of parts.entries()) {
          completedParts.push(part);
          const targetPath = `C:${SEP}${completedParts.join(SEP)}`;
          const existing = findNode(nextRoot, targetPath);
          if (existing) {
            if (
              existing.type !== "dir" ||
              (index === parts.length - 1 && !options?.allowExisting)
            )
              return false;
            continue;
          }
          if (!isValidWindowsName(part)) return false;

          const parentParts = completedParts.slice(0, -1);
          const parentPath = parentParts.length
            ? `C:${SEP}${parentParts.join(SEP)}`
            : "C:\\";
          const updatedRoot = insertNode(
            nextRoot,
            parentPath,
            dir(part, [], false),
          );
          if (!updatedRoot || !fitsOnDisk(updatedRoot)) return false;
          nextRoot = updatedRoot;
        }

        if (nextRoot === originalRoot) return options?.allowExisting ?? false;
        commitFilesystemChange({ root: nextRoot }, "Create folder tree");
        return true;
      },

      writeFile: (path, content) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const existing = findNode(get().root, abs);
        if (existing && existing.type === "file") {
          if (existing.protected || isReadOnlyFile(existing)) return false;
          const nextAllocated = vfsAllocatedByteSize(contentByteSize(content));
          const currentAllocated = vfsNodeAllocatedByteSize(existing);
          if (
            nextAllocated > currentAllocated &&
            nextAllocated - currentAllocated > get().diskUsage().free
          )
            return false;
          // Replace file node immutably
          const newRoot = updateNode(get().root, abs, (node) => ({
            ...node,
            content,
            archive: true,
            modified: fatWriteTime(now()),
            accessed: fatAccessDate(now()),
          }));
          if (!newRoot || !fitsOnDisk(newRoot)) return false;
          commitFilesystemChange({ root: newRoot }, "Edit file");
          return true;
        }
        if (existing) return false; // a dir already there
        const parts = splitAbs(abs);
        const name = parts[parts.length - 1];
        if (!isValidWindowsName(name)) return false;
        if (
          vfsAllocatedByteSize(contentByteSize(content)) >
          get().diskUsage().free
        )
          return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        const newRoot = insertNode(
          get().root,
          parentPath,
          file(name, { content, system: false }),
        );
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        commitFilesystemChange({ root: newRoot }, "Create file");
        return true;
      },

      remove: (path, options) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (
          !ref ||
          containsProtectedNode(ref.node) ||
          (isReadOnlyFile(ref.node) && !options?.allowReadOnly)
        )
          return false;
        const newRoot = removeNode(get().root, abs);
        if (!newRoot) return false;
        commitFilesystemChange({ root: newRoot }, "Permanently delete");
        return true;
      },

      moveToRecycleBin: (path, options) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const ref = findParent(get().root, abs);
        if (
          !ref ||
          containsProtectedNode(ref.node) ||
          (isReadOnlyFile(ref.node) && !options?.allowReadOnly)
        )
          return false;
        let newRoot = removeNode(get().root, abs);
        if (!newRoot) return false;
        const maximumSize = recycleBinMaximumBytes();
        if (isRecycleBinBypassed(ref.node)) {
          commitFilesystemChange({ root: newRoot }, "Permanently delete");
          return true;
        }
        const { recordNumber, storageName } = nextRecycleStorageName(
          newRoot,
          ref.node,
        );
        const item: RecycledItem = {
          id: `recycled-${Date.now()}-${_id++}`,
          storageName,
          recordNumber,
          originalName: ref.node.name,
          originalPath: abs,
          deletedAt: Date.now(),
          attributes: {
            hidden: ref.node.hidden,
            system: ref.node.system,
            protected: ref.node.protected,
            readonly: ref.node.readonly,
            archive: ref.node.archive,
            shortName: ref.node.shortName,
          },
        };
        newRoot = insertNode(
          newRoot,
          RECYCLED_PATH,
          recycledNodeForStorage(ref.node, storageName),
        );
        if (!newRoot) return false;
        const recycled = [...get().recycled, item].sort(
          (left, right) => left.deletedAt - right.deletedAt,
        );
        const indexedRoot = appendInfo2Record(newRoot, item, recycled);
        if (!indexedRoot) return false;
        newRoot = indexedRoot;
        let recycledBytes = recycledAllocatedUsage(newRoot, recycled);
        while (recycledBytes > maximumSize && recycled.length > 0) {
          const oldest = recycled.shift();
          if (oldest) {
            const oldestNode = findRecycledNode(newRoot, oldest);
            recycledBytes -= oldestNode
              ? vfsNodeAllocatedByteSize(oldestNode)
              : 0;
            const withoutOldest = removeNode(
              newRoot,
              recycledNodePath(oldest),
            );
            if (!withoutOldest) return false;
            newRoot = removeInfo2Record(withoutOldest, oldest, recycled);
          }
        }
        if (!fitsOnDisk(newRoot)) return false;
        commitFilesystemChange(
          { root: newRoot, recycled },
          "Delete to Recycle Bin",
        );
        return true;
      },

      restoreFromRecycleBin: (itemId) => {
        const item = get().recycled.find(
          (r) => r.id === itemId,
        );
        if (!item) return false;
        const currentRoot = get().root;
        const storedNode = findRecycledNode(currentRoot, item);
        if (!storedNode) return false;
        const parts = splitAbs(item.originalPath);
        if (parts.length === 0) return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);

        // Check collision at restore path
        const parentNode =
          findNode(currentRoot, parentPath) ??
          findNode(currentRoot, USER_DOCUMENTS_PATH);
        if (!parentNode || parentNode.type !== "dir") return false;
        if (findChildByLongOrShortName(parentNode, item.originalName)) return false;

        const targetParent =
          findNode(currentRoot, parentPath) !== null
            ? parentPath
            : USER_DOCUMENTS_PATH;
        let newRoot = removeNode(currentRoot, recycledNodePath(item));
        if (!newRoot) return false;
        const restoredNode: VfsNode = {
          ...storedNode,
          ...item.attributes,
          name: item.originalName,
        };
        newRoot = insertNode(newRoot, targetParent, restoredNode);
        const recycled = get().recycled.filter((r) => r !== item);
        if (!newRoot) return false;
        const withoutRecord = removeInfo2Record(newRoot, item, recycled);
        if (!fitsOnDisk(withoutRecord)) return false;
        commitFilesystemChange(
          {
            root: withoutRecord,
            recycled,
          },
          "Restore from Recycle Bin",
        );
        return true;
      },

      deleteFromRecycleBin: (itemId) => {
        const recycled = get().recycled;
        const item = recycled.find((entry) => entry.id === itemId);
        if (!item) return;
        let root = removeNode(get().root, recycledNodePath(item));
        if (!root) root = get().root;
        const remaining = recycled.filter((entry) => entry.id !== itemId);
        root = removeInfo2Record(root, item, remaining);
        commitFilesystemChange(
          { root, recycled: remaining },
          "Delete permanently",
        );
      },

      emptyRecycleBin: () => {
        if (!get().recycled.length) return;
        let root = get().root;
        for (const item of get().recycled) {
          root = removeNode(root, recycledNodePath(item)) ?? root;
        }
        root = removeNode(root, RECYCLED_INDEX_PATH) ?? root;
        commitFilesystemChange(
          { root, recycled: [] },
          "Empty Recycle Bin",
        );
      },

      move: (src, destDir) => {
        const srcAbs = resolveInputPath(src);
        const destAbs = resolveInputPath(destDir);
        if (!srcAbs || !destAbs) return false;
        const destinationInputPath = normalizePath(destDir, get().cwd);
        if (!destinationInputPath) return false;
        const dest = findNode(get().root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return false;
        const ref = findParent(get().root, srcAbs);
        if (
          !ref ||
          containsProtectedNode(ref.node) ||
          isReadOnlyFile(ref.node)
        )
          return false;
        if (
          childPath(destinationInputPath, ref.node.name).length >=
          WINDOWS_MAX_PATH
        )
          return false;
        if (findChildByLongOrShortName(dest, ref.node.name)) return false;
        // Remove from source then insert at dest
        let newRoot = removeNode(get().root, srcAbs);
        if (!newRoot) return false;
        newRoot = insertNode(newRoot, destAbs, ref.node);
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        commitFilesystemChange({ root: newRoot }, "Move");
        return true;
      },

      copy: (src, destDir) => {
        const srcAbs = resolveInputPath(src);
        const destAbs = resolveInputPath(destDir);
        if (!srcAbs || !destAbs) return false;
        const destinationInputPath = normalizePath(destDir, get().cwd);
        if (!destinationInputPath) return false;
        const root = get().root;
        const dest = findNode(root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return false;
        const node = findNode(root, srcAbs);
        if (!node) return false;
        if (vfsNodeAllocatedByteSize(node) > get().diskUsage().free)
          return false;
        if (node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return false;
        if (
          childPath(destinationInputPath, node.name).length >=
          WINDOWS_MAX_PATH
        )
          return false;
        if (findChildByLongOrShortName(dest, node.name)) return false;
        const sourceAccessRoot = updateReadAccessDate(
          root,
          srcAbs,
          fatAccessDate(now()),
        );
        const source = findNode(sourceAccessRoot, srcAbs);
        if (!source) return false;
        const newRoot = insertNode(
          sourceAccessRoot,
          destAbs,
          cloneNode(source),
        );
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        if (sourceAccessRoot !== root) set({ root: sourceAccessRoot });
        commitFilesystemChange({ root: newRoot }, "Copy");
        return true;
      },

      copyAs: (src, destPath) => {
        const srcAbs = resolveInputPath(src);
        const destAbs = resolveInputPath(destPath);
        const root = get().root;
        if (!srcAbs || !destAbs || findNode(root, destAbs)) return false;
        const node = findNode(root, srcAbs);
        if (
          !node ||
          vfsNodeAllocatedByteSize(node) > get().diskUsage().free
        )
          return false;
        if (node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return false;
        const parts = splitAbs(destAbs);
        const name = parts.at(-1);
        if (!name || !isValidWindowsName(name)) return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        const parent = findNode(get().root, parentPath);
        if (!parent || parent.type !== "dir") return false;
        const sourceAccessRoot = updateReadAccessDate(
          root,
          srcAbs,
          fatAccessDate(now()),
        );
        const source = findNode(sourceAccessRoot, srcAbs);
        if (!source) return false;
        const clone = cloneNode(source);
        clone.name = name;
        const newRoot = insertNode(sourceAccessRoot, parentPath, clone);
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        if (sourceAccessRoot !== root) set({ root: sourceAccessRoot });
        commitFilesystemChange({ root: newRoot }, "Copy");
        return true;
      },

      moveAs: (src, destPath) => {
        const srcAbs = resolveInputPath(src);
        const destAbs = resolveInputPath(destPath);
        if (!srcAbs || !destAbs) return false;
        if (srcAbs.toLowerCase() === destAbs.toLowerCase()) return true;
        if (findNode(get().root, destAbs)) return false;
        const ref = findParent(get().root, srcAbs);
        if (
          !ref ||
          containsProtectedNode(ref.node) ||
          isReadOnlyFile(ref.node)
        )
          return false;
        if (ref.node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return false;
        const parts = splitAbs(destAbs);
        const name = parts.at(-1);
        if (!name || !isValidWindowsName(name)) return false;
        const parentPath =
          parts.length === 1
            ? "C:\\"
            : "C:" + SEP + parts.slice(0, -1).join(SEP);
        const parent = findNode(get().root, parentPath);
        if (!parent || parent.type !== "dir") return false;
        const movedNode = { ...ref.node, name };
        let newRoot = removeNode(get().root, srcAbs);
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        newRoot = insertNode(newRoot, parentPath, movedNode);
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        commitFilesystemChange({ root: newRoot }, "Move");
        return true;
      },

      copyTo: (src, destDir) => {
        const srcAbs = resolveInputPath(src);
        const destAbs = resolveInputPath(destDir);
        if (!srcAbs || !destAbs) return null;
        const destinationInputPath = normalizePath(destDir, get().cwd);
        if (!destinationInputPath) return null;
        const root = get().root;
        const dest = findNode(root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return null;
        const node = findNode(root, srcAbs);
        if (!node) return null;
        if (vfsNodeAllocatedByteSize(node) > get().diskUsage().free)
          return null;
        if (node.type === "dir" && isAncestorOrSelf(srcAbs, destAbs))
          return null;
        const newName = uniqueCopyName(dest, node.name);
        if (
          childPath(destinationInputPath, newName).length >= WINDOWS_MAX_PATH
        )
          return null;
        const sourceAccessRoot = updateReadAccessDate(
          root,
          srcAbs,
          fatAccessDate(now()),
        );
        const source = findNode(sourceAccessRoot, srcAbs);
        if (!source) return null;
        const clone = cloneNode(source);
        clone.name = newName;
        const newRoot = insertNode(sourceAccessRoot, destAbs, clone);
        if (!newRoot || !fitsOnDisk(newRoot)) return null;
        if (sourceAccessRoot !== root) set({ root: sourceAccessRoot });
        commitFilesystemChange({ root: newRoot }, "Copy");
        return newName;
      },

      moveTo: (src, destDir) => {
        const srcAbs = resolveInputPath(src);
        const destAbs = resolveInputPath(destDir);
        if (!srcAbs || !destAbs) return null;
        const dest = findNode(get().root, destAbs);
        if (!dest || dest.type !== "dir" || !dest.children) return null;
        const ref = findParent(get().root, srcAbs);
        if (
          !ref ||
          containsProtectedNode(ref.node) ||
          isReadOnlyFile(ref.node)
        )
          return null;
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
        const destinationInputPath = normalizePath(destDir, get().cwd);
        if (
          !destinationInputPath ||
          childPath(destinationInputPath, newName).length >= WINDOWS_MAX_PATH
        )
          return null;
        const movedNode = { ...ref.node, name: newName };
        let newRoot = removeNode(get().root, srcAbs);
        if (!newRoot || !fitsOnDisk(newRoot)) return null;
        newRoot = insertNode(newRoot, destAbs, movedNode);
        if (!newRoot || !fitsOnDisk(newRoot)) return null;
        commitFilesystemChange({ root: newRoot }, "Move");
        return newName;
      },

      rename: (path, newName) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        if (!isValidWindowsName(newName)) return false;
        const ref = findParent(get().root, abs);
        if (
          !ref ||
          containsProtectedNode(ref.node) ||
          isReadOnlyFile(ref.node)
        )
          return false;
        const siblings = {
          ...ref.parent,
          children: ref.parent.children!.filter((child) => child !== ref.node),
        };
        if (findChildByLongOrShortName(siblings, newName)) return false;
        const newRoot = updateNode(get().root, abs, (node) => ({
          ...node,
          name: newName,
        }));
        if (!newRoot || !fitsOnDisk(newRoot)) return false;
        commitFilesystemChange({ root: newRoot }, "Rename");
        return true;
      },

      setCwd: (path) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const node = findNode(get().root, abs);
        if (!node || node.type !== "dir") return false;
        set({ cwd: abs });
        return true;
      },

      setAttributes: (path, attrs) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        const node = findNode(get().root, abs);
        if (!node || node.protected) return false;
        const newRoot = updateNode(get().root, abs, (n) => ({
          ...n,
          ...("hidden" in attrs && { hidden: attrs.hidden }),
          ...("readonly" in attrs && { readonly: attrs.readonly }),
          ...("archive" in attrs && { archive: attrs.archive }),
          ...("system" in attrs && { system: attrs.system }),
        }));
        if (!newRoot) return false;
        commitFilesystemChange({ root: newRoot }, "Change attributes");
        return true;
      },

      setFolderFilesReadOnly: (path, readonly) => {
        const abs = resolveInputPath(path);
        if (!abs) return false;
        let changed = false;
        const newRoot = updateNode(get().root, abs, (node) => {
          if (node.type !== "dir") return null;
          const children = (node.children ?? []).map((child) => {
            if (
              child.type !== "file" ||
              child.protected ||
              !!child.readonly === readonly
            ) {
              return child;
            }
            changed = true;
            return { ...child, readonly };
          });
          return changed ? { ...node, children } : node;
        });
        if (!newRoot) return false;
        if (changed) {
          commitFilesystemChange(
            { root: newRoot },
            readonly
              ? "Make folder files read-only"
              : "Clear Read-only from folder files",
          );
        }
        return true;
      },

      reorderChildren: (dirPath, name, targetIndex) => {
        const abs = resolveInputPath(dirPath);
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
          return {
            ...parent,
            modified: fatWriteTime(now()),
            children: newChildren,
          };
        });
        if (newRoot && success) {
          commitFilesystemChange({ root: newRoot }, "Arrange icons");
          return true;
        }
        return false;
      },
      });
    },
    {
      name: "rsnra95-vfs",
      version: 21,
      partialize: (state) => ({
        root: state.root,
        cwd: state.cwd,
        recycled: state.recycled,
      }),
      migrate: (persisted, version) => {
        const old = persisted as Partial<VfsState> | undefined;
        let root = assignShortNamesToTree(
          normalizeFatTimestamps(
            mergeCanonicalTree(
              buildInitialTree(),
              relocateLegacyFilesystem(old?.root),
            ),
          ),
        );
        const recycled: RecycledItem[] = [];
        const persistedRecycleItems = (old?.recycled ?? []) as unknown as Array<
          LegacyRecycledItem | RecycledItem
        >;
        if (version === 18) {
          // v18 was an intermediate development schema with virtual payloads
          // already in C:\Recycled but a text INFO2 placeholder. Keep those
          // files and rebuild the historical binary index from its metadata.
          root = removeNode(root, RECYCLED_INDEX_PATH) ?? root;
          for (const [index, oldItem] of persistedRecycleItems.entries()) {
            const item = oldItem as RecycledItem;
            const storedNode = findRecycledNode(root, item);
            if (!storedNode) {
              throw new Error(
                `Could not migrate recycled item '${item.originalName}' from ${RECYCLED_PATH}`,
              );
            }
            const migrated: RecycledItem = {
              ...item,
              recordNumber: index + 1,
              originalPath: canonicalizeExistingPath(
                root,
                canonicalizeLegacyPath(item.originalPath),
              ),
            };
            recycled.push(migrated);
            const indexedRoot = appendInfo2Record(root, migrated, recycled);
            if (!indexedRoot) {
              throw new Error(
                `Could not migrate INFO2 record for '${item.originalName}'`,
              );
            }
            root = indexedRoot;
          }
        } else if (version >= 19) {
          // v19 stores RecycledItem metadata alongside the files already
          // moved into C:\\Recycled. Preserve both as-is; treating these as
          // the older detached-node format would discard valid bin entries.
          recycled.push(...(persistedRecycleItems as RecycledItem[]));
        } else {
          for (const [index, legacyItem] of persistedRecycleItems.entries()) {
            const oldItem = legacyItem as LegacyRecycledItem;
            const originalNode = normalizeFatTimestamps(oldItem.node);
            const { recordNumber, storageName } = nextRecycleStorageName(
              root,
              originalNode,
            );
            const storedNode = recycledNodeForStorage(
              originalNode,
              storageName,
            );
            const withStoredNode = insertNode(root, RECYCLED_PATH, storedNode);
            if (!withStoredNode) {
              throw new Error(
                `Could not migrate recycled item '${originalNode.name}' to ${RECYCLED_PATH}`,
              );
            }
            root = withStoredNode;
            const item: RecycledItem = {
              id:
                oldItem.id ??
                `recycled-migrated-${oldItem.deletedAt ?? Date.now()}-${index}`,
              storageName,
              recordNumber,
              originalName: originalNode.name,
              originalPath: canonicalizeExistingPath(
                root,
                canonicalizeLegacyPath(oldItem.originalPath),
              ),
              deletedAt: oldItem.deletedAt ?? Date.now(),
              attributes: {
                hidden: originalNode.hidden,
                system: originalNode.system,
                protected: originalNode.protected,
                readonly: originalNode.readonly,
                archive: originalNode.archive,
                shortName: originalNode.shortName,
              },
            };
            recycled.push(item);
            const indexedRoot = appendInfo2Record(root, item, recycled);
            if (!indexedRoot) {
              throw new Error(
                `Could not migrate INFO2 record for '${originalNode.name}'`,
              );
            }
            root = indexedRoot;
          }
        }
        if (version < 21) root = addMissingSendToEntries(root);
        return {
          root,
          cwd: canonicalizeExistingPath(
            root,
            canonicalizeLegacyPath(old?.cwd ?? USER_DOCUMENTS_PATH),
          ),
          recycled,
        };
      },
    },
  ),
);
