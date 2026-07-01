import { openApp } from "../../data/apps";
import {
  BAND_LOCATION,
  BAND_NAME,
  CONTACT_EMAIL,
  LINKS,
} from "../../data/content";
import { useVfsStore, type VfsNode, type VfsState } from "../../store/vfsStore";

// ─── Types ────────────────────────────────────────────────────────────────
export type LineKind = "echo" | "output" | "error";

export interface CmdContext {
  vfs: VfsState;
  print: (lines: string[], kind?: LineKind) => void;
  clear: () => void;
  closeWindow: (id: string) => void;
  windowId: string;
  enterNano: (path: string) => void;
  vars: Record<string, string>;
  setVar: (name: string, value: string) => void;
  setTitle: (title: string) => void;
  setPromptStr: (p: string) => void;
  promptStr: string;
  errorLevel: number;
  setErrorLevel: (n: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Convert a glob pattern (* and ?) to a match test against a filename. */
function matchWildcard(pattern: string, name: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regex}$`, "i").test(name);
}

/** Expand wildcards against a directory's children. */
function expandWildcards(pattern: string, entries: VfsNode[]): VfsNode[] {
  // If no wildcard chars, just do a case-insensitive name match.
  if (!/[*?]/.test(pattern)) {
    return entries.filter(
      (e) => e.name.toLowerCase() === pattern.toLowerCase(),
    );
  }
  return entries.filter((e) => matchWildcard(pattern, e.name));
}

interface Redirection {
  cmd: string;
  redirect?: { file: string; append: boolean };
}

/** Parse `command > file` or `command >> file` from a line. */
function parseRedirection(line: string): Redirection {
  // Match >> or > with a filename (quoted or unquoted)
  const m = line.match(/^(.+?)\s*(>>)\s*"?([^\s"]+)"?\s*$/);
  if (m) return { cmd: m[1].trim(), redirect: { file: m[3], append: true } };
  const m2 = line.match(/^(.+?)\s*(>)\s*"?([^\s"]+)"?\s*$/);
  if (m2)
    return { cmd: m2[1].trim(), redirect: { file: m2[3], append: false } };
  return { cmd: line };
}

/** Expand %var% and !var! references in a line. */
export function expandVars(
  line: string,
  vars: Record<string, string>,
  vfs: VfsState,
): string {
  // Built-in dynamic variables
  const dynamic: Record<string, string> = {
    cd: vfs.cwd,
    CD: vfs.cwd,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    random: String(Math.floor(Math.random() * 32768)),
    errorlevel: String(vars.__errorlevel ?? "0"),
    path: "C:\\Windows;C:\\Windows\\Command;C:\\Program Files\\RSNRA",
    prompt: vars.__prompt ?? "$P$G",
    username: "RSNRA",
    computername: "RSNRA95",
    os: "Windows_95",
    systemroot: "C:\\Windows",
    temp: "C:\\Windows\\Temp",
    tmp: "C:\\Windows\\Temp",
    ...vars,
  };
  return line
    .replace(/%(\w+)%/g, (_, name: string) => dynamic[name] ?? "")
    .replace(/!(\w+)!/g, (_, name: string) => dynamic[name] ?? "");
}

/** Format a date like MS-DOS dir listing. */
function dirStamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours() % 12 || 12).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${mm}/${dd}/${yy}  ${hh}:${mi} ${ampm}`;
}

/** Get file size for dir listing. */
function fileSize(node: VfsNode): number {
  if (node.type === "dir") return 0;
  return (node.content?.length ?? 0) || (node.appId ? 32768 : 0);
}

// ─── Command handlers ─────────────────────────────────────────────────────
// Each handler receives (args, ctx, raw, cmdName).

function cmdHelp(args: string[], ctx: CmdContext) {
  if (args[0]) {
    const name = args[0].toLowerCase();
    const h = HELP_TOPICS[name];
    if (h) {
      ctx.print(h);
    } else {
      ctx.print([`No help available for "${args[0]}".`], "error");
    }
    return;
  }
  ctx.print(buildHelpText());
}

function cmdDir(args: string[], ctx: CmdContext) {
  const flags = args.filter((a) => a.startsWith("/"));
  const nonFlag = args.filter((a) => !a.startsWith("/"));
  const target = nonFlag[0] || ctx.vfs.cwd;
  const abs = ctx.vfs.resolvePath(target);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!abs || !node) {
    ctx.print(["The system cannot find the path specified."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  if (node.type !== "dir") {
    ctx.print(["Not a directory."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  let entries = node.children ?? [];
  // /a or /ah — show hidden files (we show them all anyway, but respect the flag)
  if (!flags.some((f) => /^\/a/i.test(f))) {
    entries = entries.filter((e) => !e.hidden);
  }
  const bare = flags.some((f) => /^\/b/i.test(f));
  const wide = flags.some((f) => /^\/w/i.test(f));
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (bare) {
    ctx.print(sorted.map((e) => e.name));
    return;
  }

  if (wide) {
    ctx.print([` Directory of ${abs}`, ""]);
    const names: string[] = [];
    for (const e of sorted) {
      names.push(e.type === "dir" ? `[${e.name}]` : e.name);
    }
    // 5 columns
    for (let i = 0; i < names.length; i += 5) {
      ctx.print([
        names
          .slice(i, i + 5)
          .map((n) => n.padEnd(20))
          .join(""),
      ]);
    }
    ctx.print([
      `      ${sorted.filter((e) => e.type === "file").length} file(s)`,
      `      ${sorted.filter((e) => e.type === "dir").length} dir(s)`,
    ]);
    return;
  }

  // Standard DOS dir format
  const lines: string[] = [];
  lines.push(` Directory of ${abs}`);
  lines.push("");
  let fileCount = 0;
  let dirCount = 0;
  let totalBytes = 0;
  for (const e of sorted) {
    const stamp = dirStamp(new Date(e.created));
    if (e.type === "dir") {
      dirCount++;
      lines.push(`${stamp}    <DIR>          ${e.name}`);
    } else {
      fileCount++;
      const size = fileSize(e);
      totalBytes += size;
      lines.push(`${stamp}    ${String(size).padStart(14)} ${e.name}`);
    }
  }
  lines.push("");
  lines.push(
    `      ${fileCount} file(s)    ${totalBytes.toLocaleString()} bytes`,
  );
  lines.push(`      ${dirCount} dir(s)`);
  ctx.print(lines);
}

function cmdLs(args: string[], ctx: CmdContext) {
  const flags = args.filter((a) => a.startsWith("-"));
  const nonFlag = args.filter((a) => !a.startsWith("-"));
  const target = nonFlag[0] || ctx.vfs.cwd;
  const abs = ctx.vfs.resolvePath(target);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!abs || !node) {
    ctx.print([`ls: ${target}: No such file or directory`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  if (node.type !== "dir") {
    ctx.print([node.name]);
    return;
  }
  let entries = node.children ?? [];
  const showAll = flags.some((f) => /a/i.test(f));
  if (!showAll) entries = entries.filter((e) => !e.hidden);
  const longFmt = flags.some((f) => /l/i.test(f));
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (longFmt) {
    const lines: string[] = [`total ${sorted.length}`, ""];
    for (const e of sorted) {
      const perm = e.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--";
      const size = String(fileSize(e)).padStart(8);
      const stamp = new Date(e.created).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const suffix = e.type === "dir" ? "/" : "";
      lines.push(
        `${perm}  1 rsnra  rsnra  ${size} ${stamp} ${e.name}${suffix}`,
      );
    }
    ctx.print(lines);
  } else {
    const names = sorted.map((e) => (e.type === "dir" ? `${e.name}/` : e.name));
    // Print in columns
    const cols = 4;
    for (let i = 0; i < names.length; i += cols) {
      ctx.print([
        names
          .slice(i, i + cols)
          .map((n) => n.padEnd(20))
          .join("  "),
      ]);
    }
  }
}

function cmdCd(args: string[], ctx: CmdContext) {
  if (!args[0] || args[0] === ".") {
    ctx.print([ctx.vfs.cwd]);
    return;
  }
  // Handle cd without args or cd ~
  if (args[0] === "~") {
    ctx.vfs.setCwd("C:\\My Documents");
    return;
  }
  const abs = ctx.vfs.resolvePath(args[0]);
  if (!abs || !ctx.vfs.setCwd(abs)) {
    ctx.print(["The system cannot find the path specified."], "error");
    ctx.setErrorLevel(1);
  }
}

function cmdPwd(_args: string[], ctx: CmdContext) {
  ctx.print([ctx.vfs.cwd.replace(/\\/g, "/")]);
}

function cmdType(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  if (!args.length) {
    ctx.print(["The syntax of the command is incorrect."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const showNum = cmdName === "cat" && args.includes("-n");
  const files = args.filter((a) => !a.startsWith("-"));
  for (const f of files) {
    const abs = ctx.vfs.resolvePath(f);
    const node = abs ? ctx.vfs.resolve(abs) : null;
    if (!node) {
      const msg =
        cmdName === "cat"
          ? `cat: ${f}: No such file or directory`
          : `The system cannot find the file specified.`;
      ctx.print([msg], "error");
      ctx.setErrorLevel(1);
      continue;
    }
    if (node.type === "dir") {
      const msg =
        cmdName === "cat" ? `cat: ${f}: Is a directory` : `Access is denied.`;
      ctx.print([msg], "error");
      ctx.setErrorLevel(1);
      continue;
    }
    const lines = (node.content ?? "").split("\n");
    if (showNum) {
      ctx.print(lines.map((l, i) => `    ${String(i + 1).padStart(4)}  ${l}`));
    } else {
      ctx.print(lines);
    }
  }
}

function cmdMkdir(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  if (!args.length) {
    const msg =
      cmdName === "mkdir"
        ? "mkdir: missing operand"
        : "The syntax of the command is incorrect.";
    ctx.print([msg], "error");
    ctx.setErrorLevel(1);
    return;
  }
  // Support mkdir -p (create parent dirs)
  let paths = args;
  if (args[0] === "-p") paths = args.slice(1);
  for (const p of paths) {
    if (!ctx.vfs.mkdir(p)) {
      const exists = ctx.vfs.resolvePath(p);
      if (exists && ctx.vfs.resolve(exists)) {
        ctx.print(
          [
            cmdName === "mkdir"
              ? `mkdir: cannot create directory '${p}': File exists`
              : `Directory already exists or path not found.`,
          ],
          "error",
        );
      } else {
        ctx.print([`The system cannot find the path.`], "error");
      }
      ctx.setErrorLevel(1);
    }
  }
}

function cmdRmdir(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  const force =
    args.includes("-f") || args.includes("/s") || args.includes("/q");
  const recursive =
    args.includes("-r") || args.includes("-rf") || args.includes("/s");
  const targets = args.filter((a) => !a.startsWith("-") && !a.startsWith("/"));
  if (!targets.length) {
    ctx.print(["The syntax of the command is incorrect."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  for (const t of targets) {
    const abs = ctx.vfs.resolvePath(t);
    const node = abs ? ctx.vfs.resolve(abs) : null;
    if (!node) {
      const msg =
        cmdName === "rm"
          ? `rm: cannot remove '${t}': No such file or directory`
          : `The system cannot find the directory specified.`;
      if (!force) ctx.print([msg], "error");
      ctx.setErrorLevel(1);
      continue;
    }
    if (node.type === "file") {
      // rm can also delete files
      if (cmdName === "rm" || cmdName === "del" || cmdName === "erase") {
        if (!ctx.vfs.remove(t)) {
          if (!force) ctx.print(["Access is denied — system file."], "error");
          ctx.setErrorLevel(1);
        }
      } else {
        ctx.print(["Not a directory."], "error");
        ctx.setErrorLevel(1);
      }
      continue;
    }
    // It's a directory
    if (node.children && node.children.length > 0 && !recursive) {
      const msg =
        cmdName === "rm"
          ? `rm: cannot remove '${t}': Directory not empty`
          : `The directory is not empty.`;
      ctx.print([msg], "error");
      ctx.setErrorLevel(1);
      continue;
    }
    if (recursive && node.children) {
      // Recursively delete all children
      for (const child of [...node.children].reverse()) {
        ctx.vfs.remove(abs + "\\" + child.name);
      }
    }
    if (!ctx.vfs.remove(t)) {
      if (!force) ctx.print(["Access is denied — system directory."], "error");
      ctx.setErrorLevel(1);
    }
  }
}

function cmdDel(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  const force = args.includes("-f") || args.includes("/q");
  const targets = args.filter((a) => !a.startsWith("-") && !a.startsWith("/"));
  if (!targets.length) {
    ctx.print(["The syntax of the command is incorrect."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  for (const t of targets) {
    // Wildcard support
    if (/[*?]/.test(t)) {
      const lastSep = Math.max(t.lastIndexOf("\\"), t.lastIndexOf("/"));
      const dir = lastSep >= 0 ? t.slice(0, lastSep) : ctx.vfs.cwd;
      const pattern = lastSep >= 0 ? t.slice(lastSep + 1) : t;
      const abs = ctx.vfs.resolvePath(dir);
      const node = abs ? ctx.vfs.resolve(abs) : null;
      if (!node || node.type !== "dir") {
        if (!force)
          ctx.print(["The system cannot find the path specified."], "error");
        ctx.setErrorLevel(1);
        continue;
      }
      const matches = expandWildcards(pattern, node.children ?? []);
      for (const m of matches) {
        if (m.type === "file" && !m.system) {
          ctx.vfs.remove(abs + "\\" + m.name);
        }
      }
      continue;
    }
    const abs = ctx.vfs.resolvePath(t);
    const node = abs ? ctx.vfs.resolve(abs) : null;
    if (!node) {
      const msg =
        cmdName === "rm"
          ? `rm: cannot remove '${t}': No such file or directory`
          : `Could not find ${t}.`;
      if (!force) ctx.print([msg], "error");
      ctx.setErrorLevel(1);
    } else if (node.type === "dir") {
      const msg =
        cmdName === "rm"
          ? `rm: cannot remove '${t}': Is a directory`
          : `Access is denied.`;
      ctx.print([msg], "error");
      ctx.setErrorLevel(1);
    } else if (!ctx.vfs.remove(t)) {
      if (!force) ctx.print(["Access is denied — system file."], "error");
      ctx.setErrorLevel(1);
    } else {
      // success — silent unless verbose
    }
  }
}

function cmdCopy(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  const targets = args.filter((a) => !a.startsWith("-") && !a.startsWith("/"));
  const [src, dst] = targets;
  if (!src || !dst) {
    ctx.print(["The syntax of the command is incorrect."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const srcAbs = ctx.vfs.resolvePath(src);
  const srcNode = srcAbs ? ctx.vfs.resolve(srcAbs) : null;
  if (!srcNode || srcNode.type !== "file") {
    const msg =
      cmdName === "cp"
        ? `cp: ${src}: No such file or directory`
        : `The system cannot find the file specified.`;
    ctx.print([msg], "error");
    ctx.setErrorLevel(1);
    return;
  }
  // Check if dst is a directory
  const dstAbs = ctx.vfs.resolvePath(dst);
  const dstNode = dstAbs ? ctx.vfs.resolve(dstAbs) : null;
  if (dstNode && dstNode.type === "dir") {
    // Copy into directory, keep same filename
    if (ctx.vfs.copy(src, dst)) {
      ctx.print(["        1 file(s) copied."]);
    } else {
      ctx.print(
        ["The system cannot find the file specified, or it already exists."],
        "error",
      );
      ctx.setErrorLevel(1);
    }
  } else {
    // Copy to a new file path
    const content = ctx.vfs.read(src) ?? "";
    if (ctx.vfs.writeFile(dst, content)) {
      ctx.print(["        1 file(s) copied."]);
    } else {
      ctx.print(["The system cannot find the path."], "error");
      ctx.setErrorLevel(1);
    }
  }
}

function cmdMove(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  const targets = args.filter((a) => !a.startsWith("-") && !a.startsWith("/"));
  const [src, dst] = targets;
  if (!src || !dst) {
    ctx.print(["The syntax of the command is incorrect."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const dstAbs = ctx.vfs.resolvePath(dst);
  const dstNode = dstAbs ? ctx.vfs.resolve(dstAbs) : null;
  if (dstNode && dstNode.type === "dir") {
    if (ctx.vfs.move(src, dst)) {
      ctx.print(["        1 file(s) moved."]);
    } else {
      ctx.print(
        ["The system cannot find the file specified, or it already exists."],
        "error",
      );
      ctx.setErrorLevel(1);
    }
  } else {
    // It's a rename — move to a new path
    const srcAbs = ctx.vfs.resolvePath(src);
    const srcNode = srcAbs ? ctx.vfs.resolve(srcAbs) : null;
    if (!srcNode) {
      const msg =
        cmdName === "mv"
          ? `mv: ${src}: No such file or directory`
          : `The system cannot find the file specified.`;
      ctx.print([msg], "error");
      ctx.setErrorLevel(1);
      return;
    }
    // Read content, write to new path, delete old
    const content = srcNode.content ?? "";
    if (srcNode.type === "dir") {
      if (ctx.vfs.move(src, dst)) {
        ctx.print(["        1 dir(s) moved."]);
      } else {
        ctx.print(["Failed to move directory."], "error");
        ctx.setErrorLevel(1);
      }
    } else {
      if (ctx.vfs.writeFile(dst, content) && ctx.vfs.remove(src)) {
        ctx.print(["        1 file(s) moved."]);
      } else {
        ctx.print(["The system cannot find the path."], "error");
        ctx.setErrorLevel(1);
      }
    }
  }
}

function cmdRen(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  const targets = args.filter((a) => !a.startsWith("-"));
  const [target, newName] = targets;
  if (!target || !newName) {
    ctx.print(["The syntax of the command is incorrect."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  if (ctx.vfs.rename(target, newName)) {
    if (cmdName === "mv") {
      // mv is quiet on success
    } else {
      ctx.print([`Renamed to ${newName}.`]);
    }
  } else {
    const msg =
      cmdName === "mv"
        ? `mv: cannot move '${target}' to '${newName}': No such file or directory`
        : `The system cannot find the file, or the name is in use.`;
    ctx.print([msg], "error");
    ctx.setErrorLevel(1);
  }
}

function cmdTouch(args: string[], ctx: CmdContext) {
  if (!args.length) {
    ctx.print(["touch: missing file operand"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  for (const f of args) {
    const abs = ctx.vfs.resolvePath(f);
    if (!abs) {
      ctx.print([`touch: cannot touch '${f}': Invalid path`], "error");
      ctx.setErrorLevel(1);
      continue;
    }
    const existing = abs ? ctx.vfs.resolve(abs) : null;
    if (existing) {
      // File exists — "update timestamp" (no-op in VFS, just succeed)
      continue;
    }
    if (!ctx.vfs.writeFile(f, "")) {
      ctx.print([`touch: cannot touch '${f}': No such directory`], "error");
      ctx.setErrorLevel(1);
    }
  }
}

function cmdTree(args: string[], ctx: CmdContext) {
  const target = args[0] || ctx.vfs.cwd;
  const abs = ctx.vfs.resolvePath(target);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!abs || !node || node.type !== "dir") {
    ctx.print(["The system cannot find the path specified."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  ctx.print([abs, ...formatTree(node, "", true, node.name)]);
}

function cmdEcho(args: string[], ctx: CmdContext, raw: string) {
  // Extract text after "echo "
  const idx = raw.search(/\becho\b\s*/i);
  const text = idx >= 0 ? raw.slice(idx + 5).trim() : args.join(" ");
  // Handle echo. (blank line) and echo off/on (handled by caller for batch)
  if (text === "." || text === "") {
    ctx.print([""]);
  } else if (text.toLowerCase() === "off" || text.toLowerCase() === "on") {
    // These are handled by batch executor, but if called directly just print
    ctx.print([text]);
  } else {
    ctx.print([text]);
  }
}

function cmdCls(_args: string[], ctx: CmdContext) {
  ctx.clear();
}

function cmdExit(_args: string[], ctx: CmdContext) {
  ctx.closeWindow(ctx.windowId);
}

function cmdVer(_args: string[], ctx: CmdContext) {
  ctx.print(["", "RSNRA 95 [Version 4.95.1996]", ""]);
}

function cmdVol(_args: string[], ctx: CmdContext) {
  ctx.print([
    " Volume in drive C is RSNRA95",
    " Volume Serial Number is 1996-0824",
    "",
  ]);
}

function cmdPath(_args: string[], ctx: CmdContext) {
  ctx.print([
    "PATH=" +
      ["C:\\Windows", "C:\\Windows\\Command", "C:\\Program Files\\RSNRA"].join(
        ";",
      ),
  ]);
}

function cmdHead(args: string[], ctx: CmdContext) {
  let n = 10;
  const flagIdx = args.findIndex((a) => a === "-n");
  if (flagIdx >= 0 && args[flagIdx + 1]) n = parseInt(args[flagIdx + 1], 10);
  const shortFlag = args.find((a) => /^-\d+$/.test(a));
  if (shortFlag) n = parseInt(shortFlag.slice(1), 10);
  const files = args.filter(
    (a) => !a.startsWith("-") && !/^-\d+$/.test(a) && a !== "-n",
  );
  if (!files.length) {
    ctx.print(["head: missing file operand"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  for (const f of files) {
    const abs = ctx.vfs.resolvePath(f);
    const node = abs ? ctx.vfs.resolve(abs) : null;
    if (!node || node.type !== "file") {
      ctx.print(
        [`head: cannot open '${f}' for reading: No such file`],
        "error",
      );
      ctx.setErrorLevel(1);
      continue;
    }
    const lines = (node.content ?? "").split("\n").slice(0, n);
    ctx.print(lines);
  }
}

function cmdTail(args: string[], ctx: CmdContext) {
  let n = 10;
  const flagIdx = args.findIndex((a) => a === "-n");
  if (flagIdx >= 0 && args[flagIdx + 1]) n = parseInt(args[flagIdx + 1], 10);
  const shortFlag = args.find((a) => /^-\d+$/.test(a));
  if (shortFlag) n = parseInt(shortFlag.slice(1), 10);
  const files = args.filter(
    (a) => !a.startsWith("-") && !/^-\d+$/.test(a) && a !== "-n",
  );
  if (!files.length) {
    ctx.print(["tail: missing file operand"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  for (const f of files) {
    const abs = ctx.vfs.resolvePath(f);
    const node = abs ? ctx.vfs.resolve(abs) : null;
    if (!node || node.type !== "file") {
      ctx.print(
        [`tail: cannot open '${f}' for reading: No such file`],
        "error",
      );
      ctx.setErrorLevel(1);
      continue;
    }
    const lines = (node.content ?? "").split("\n");
    ctx.print(lines.slice(-n));
  }
}

function cmdGrep(args: string[], ctx: CmdContext) {
  const caseInsensitive = args.includes("-i");
  const showLineNum = args.includes("-n");
  const invert = args.includes("-v");
  const countOnly = args.includes("-c");
  const nonFlag = args.filter((a) => !a.startsWith("-"));
  if (nonFlag.length < 2) {
    ctx.print(["Usage: grep [options] PATTERN FILE..."], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const pattern = nonFlag[0];
  const file = nonFlag[1];
  const abs = ctx.vfs.resolvePath(file);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!node || node.type !== "file") {
    ctx.print([`grep: ${file}: No such file or directory`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const lines = (node.content ?? "").split("\n");
  let matchCount = 0;
  const out: string[] = [];
  const flags = caseInsensitive ? "i" : "";
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch {
    // Not a valid regex — treat as literal string
    regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  }
  for (let i = 0; i < lines.length; i++) {
    const matches = regex.test(lines[i]);
    if (invert ? !matches : matches) {
      matchCount++;
      if (!countOnly) {
        const prefix = showLineNum ? `${String(i + 1).padStart(5)}:` : "";
        out.push(`${prefix}${lines[i]}`);
      }
    }
  }
  if (countOnly) {
    ctx.print([String(matchCount)]);
  } else {
    ctx.print(out);
  }
  ctx.setErrorLevel(matchCount > 0 ? 0 : 1);
}

function cmdWc(args: string[], ctx: CmdContext) {
  const showLines = args.includes("-l");
  const showWords = args.includes("-w");
  const showChars = args.includes("-c");
  const files = args.filter((a) => !a.startsWith("-"));
  if (!files.length) {
    ctx.print(["wc: missing file operand"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  for (const f of files) {
    const abs = ctx.vfs.resolvePath(f);
    const node = abs ? ctx.vfs.resolve(abs) : null;
    if (!node || node.type !== "file") {
      ctx.print([`wc: ${f}: No such file or directory`], "error");
      ctx.setErrorLevel(1);
      continue;
    }
    const content = node.content ?? "";
    const lines = content.split("\n").length;
    const words = content.split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    if (showLines) ctx.print([`${String(lines).padStart(7)} ${f}`]);
    else if (showWords) ctx.print([`${String(words).padStart(7)} ${f}`]);
    else if (showChars) ctx.print([`${String(chars).padStart(7)} ${f}`]);
    else
      ctx.print([
        `${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(chars).padStart(7)} ${f}`,
      ]);
  }
}

function cmdFind(args: string[], ctx: CmdContext) {
  // find <path> -name <pattern>  or  find <path> -type f|d
  const pathArg = args[0] || ".";
  const nameIdx = args.indexOf("-name");
  const typeIdx = args.indexOf("-type");
  const pattern = nameIdx >= 0 ? args[nameIdx + 1] : "*";
  const typeFilter = typeIdx >= 0 ? args[typeIdx + 1] : undefined;

  const abs = ctx.vfs.resolvePath(pathArg);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!abs || !node || node.type !== "dir") {
    ctx.print([`find: '${pathArg}': No such file or directory`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const results: string[] = [];
  function walk(n: VfsNode, path: string) {
    if (!n.children) return;
    for (const child of n.children) {
      if (child.hidden) continue;
      const childPath = path + "\\" + child.name;
      const matches = matchWildcard(pattern, child.name);
      const typeOk =
        !typeFilter ||
        (typeFilter === "f" && child.type === "file") ||
        (typeFilter === "d" && child.type === "dir");
      if (matches && typeOk) results.push(childPath);
      if (child.type === "dir") walk(child, childPath);
    }
  }
  walk(node, abs);
  ctx.print(results.length ? results : [""]);
}

function cmdNano(args: string[], ctx: CmdContext) {
  const file = args[0];
  if (!file) {
    ctx.print(["Usage: nano <file>"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const abs = ctx.vfs.resolvePath(file);
  if (!abs) {
    ctx.print([`nano: ${file}: Invalid path`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  ctx.enterNano(abs);
}

function cmdSet(args: string[], ctx: CmdContext) {
  if (!args.length) {
    // Show all variables
    const lines = Object.entries(ctx.vars)
      .filter(([k]) => !k.startsWith("__"))
      .map(([k, v]) => `${k}=${v}`);
    ctx.print(lines.length ? lines : [""]);
    return;
  }
  const raw = args.join(" ");
  const eqIdx = raw.indexOf("=");
  if (eqIdx < 0) {
    // set VAR — show value
    const val = ctx.vars[raw.trim()];
    ctx.print(val ? [`${raw.trim()}=${val}`] : [`${raw.trim()}=`]);
    return;
  }
  const name = raw.slice(0, eqIdx).trim();
  const value = raw.slice(eqIdx + 1).trim();
  if (!value) {
    delete ctx.vars[name];
  } else {
    ctx.setVar(name, value);
  }
}

function cmdStart(args: string[], ctx: CmdContext) {
  // start notepad, start mspaint, start explorer, etc.
  // Also: start "title" cmd  (ignore title if first arg is quoted)
  let prog = args[0];
  if (prog.startsWith('"') && prog.endsWith('"')) {
    prog = args[1]; // skip window title
  }
  if (!prog) {
    ctx.print(["start: no program specified"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const lower = prog.toLowerCase();
  const exePath = ctx.vfs.findExecutable(lower);
  if (exePath) {
    const node = ctx.vfs.resolve(exePath);
    if (node?.appId) {
      const fileArg = args[args.indexOf(prog) + 1];
      if (node.appId === "notepad" && fileArg) {
        const abs = ctx.vfs.resolvePath(fileArg);
        if (abs && ctx.vfs.resolve(abs)) {
          const fname = abs.split("\\").pop() ?? "untitled.txt";
          openApp("notepad", {
            title: `${fname} - Notepad`,
            data: { path: abs },
          });
        } else {
          ctx.print(
            [`The system cannot find the file specified: ${fileArg}`],
            "error",
          );
        }
      } else {
        openApp(node.appId as never);
      }
      ctx.print([`Starting ${prog}...`]);
    }
  } else {
    ctx.print([`start: cannot find '${prog}'`], "error");
    ctx.setErrorLevel(1);
  }
}

function cmdTitle(args: string[], ctx: CmdContext) {
  const title = args.join(" ");
  if (title) ctx.setTitle(title);
}

function cmdColor(args: string[], ctx: CmdContext) {
  // Simplified color command — just print a message
  if (!args[0]) {
    ctx.print(["Color reset."]);
    return;
  }
  ctx.print([
    `Colors set to ${args[0]}. (Visual changes not supported in web terminal)`,
  ]);
}

function cmdPrompt(args: string[], ctx: CmdContext) {
  if (!args.length) {
    ctx.setPromptStr("$P$G");
    return;
  }
  ctx.setPromptStr(args.join(" "));
}

function cmdMore(
  args: string[],
  ctx: CmdContext,
  _raw: string,
  cmdName: string,
) {
  const file = args[0];
  if (!file) {
    ctx.print([`Usage: ${cmdName} <file>`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const abs = ctx.vfs.resolvePath(file);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!node || node.type !== "file") {
    ctx.print([`${cmdName}: ${file}: No such file`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  ctx.print((node.content ?? "").split("\n"));
}

function cmdWhich(args: string[], ctx: CmdContext) {
  if (!args[0]) {
    ctx.print(["which: missing operand"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const exePath = ctx.vfs.findExecutable(args[0].toLowerCase());
  if (exePath) {
    ctx.print([exePath]);
  } else {
    ctx.print([`which: no ${args[0]} in PATH`], "error");
    ctx.setErrorLevel(1);
  }
}

function cmdSort(args: string[], ctx: CmdContext) {
  const file = args.filter((a) => !a.startsWith("-"))[0];
  if (!file) {
    ctx.print(["sort: missing file"], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const abs = ctx.vfs.resolvePath(file);
  const node = abs ? ctx.vfs.resolve(abs) : null;
  if (!node || node.type !== "file") {
    ctx.print([`sort: ${file}: No such file`], "error");
    ctx.setErrorLevel(1);
    return;
  }
  const lines = (node.content ?? "").split("\n").sort();
  ctx.print(lines);
}

function cmdAbout(_args: string[], ctx: CmdContext) {
  ctx.print([
    `${BAND_NAME} — Alternative Rock, ${BAND_LOCATION}.`,
    "Fuzzed-out guitars, atmospheric synths, anthemic choruses.",
    'Run "links" for everything else.',
  ]);
}

function cmdLinks(_args: string[], ctx: CmdContext) {
  ctx.print([
    `Music       ${LINKS.music}`,
    `TikTok      ${LINKS.tiktok}`,
    `Instagram   ${LINKS.instagram}`,
    `Contact     ${CONTACT_EMAIL}`,
  ]);
}

function cmdWhoami(_args: string[], ctx: CmdContext) {
  ctx.print(["rsnra"]);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Probe a real round trip to `target` and time it. Browsers can't send raw
 * ICMP, so — like most web-based "ping" tools — this measures an actual
 * HTTPS request instead: a `no-cors` HEAD request can reach cross-origin
 * hosts without needing their CORS headers (the response body is opaque and
 * unreadable, but the fetch still genuinely resolves or fails over the
 * network). A resolved promise means the host really answered; a rejection
 * (DNS failure, connection refused, TLS failure, or our own abort-timeout)
 * means it didn't — same semantics as a real ping's "Reply" vs "timed out".
 */
async function pingOnce(target: string, timeoutMs: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    await fetch(target, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return Math.round(performance.now() - start);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function cmdPing(args: string[], ctx: CmdContext) {
  const nIdx = args.findIndex((a) => a === "-n");
  let count = 4;
  if (nIdx >= 0 && args[nIdx + 1]) {
    const parsed = parseInt(args[nIdx + 1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) count = Math.min(parsed, 20);
  }
  const host = args.filter(
    (a, i) => !a.startsWith("-") && (nIdx < 0 || i !== nIdx + 1),
  )[0];
  if (!host) {
    ctx.print(["Usage: ping [-n count] <hostname>"], "error");
    ctx.setErrorLevel(1);
    return;
  }

  const target = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  let hostname: string;
  try {
    hostname = new URL(target).hostname;
  } catch {
    ctx.print(
      [
        `Ping request could not find host ${host}.`,
        "Please check the name and try again.",
      ],
      "error",
    );
    ctx.setErrorLevel(1);
    return;
  }

  ctx.print([`Pinging ${hostname} with 32 bytes of data:`]);

  const TIMEOUT_MS = 4000;
  const times: number[] = [];
  let received = 0;
  for (let i = 0; i < count; i++) {
    const time = await pingOnce(target, TIMEOUT_MS);
    if (time === null) {
      ctx.print(["Request timed out."], "error");
    } else {
      received++;
      times.push(time);
      ctx.print([`Reply from ${hostname}: bytes=32 time=${time}ms`]);
    }
    if (i < count - 1) await sleep(1000);
  }

  const lost = count - received;
  ctx.print([
    "",
    `Ping statistics for ${hostname}:`,
    `    Packets: Sent = ${count}, Received = ${received}, Lost = ${lost} (${Math.round(
      (lost / count) * 100,
    )}% loss),`,
  ]);
  if (times.length) {
    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    ctx.print([
      "Approximate round trip times in milli-seconds:",
      `    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`,
    ]);
  }
  ctx.setErrorLevel(received > 0 ? 0 : 1);
}

function cmdDate(_args: string[], ctx: CmdContext) {
  ctx.print([`The current date is: ${new Date().toLocaleDateString()}`]);
}

function cmdTime(_args: string[], ctx: CmdContext) {
  ctx.print([`The current time is: ${new Date().toLocaleTimeString()}`]);
}

// ─── Batch script execution ───────────────────────────────────────────────

function evaluateCondition(line: string, ctx: CmdContext): boolean {
  // if [not] exist <file> <command>
  // if [not] "%var%"=="value" <command>
  // if [not] errorlevel <n> <command>
  let rest = line.slice(3).trim(); // after "if"

  const notFlag = rest.toLowerCase().startsWith("not ");
  if (notFlag) rest = rest.slice(4).trim();

  let result = false;

  if (rest.toLowerCase().startsWith("exist ")) {
    const filePart = rest.slice(6).trim();
    // The file part might be just the filename, or filename + command
    // Split on first space that's not inside quotes
    const spaceIdx = filePart.indexOf(" ");
    const fileName = spaceIdx >= 0 ? filePart.slice(0, spaceIdx) : filePart;
    result = ctx.vfs.exists(fileName);
  } else if (rest.toLowerCase().startsWith("errorlevel ")) {
    const numPart = rest.slice(11).trim();
    const spaceIdx = numPart.indexOf(" ");
    const num = parseInt(
      spaceIdx >= 0 ? numPart.slice(0, spaceIdx) : numPart,
      10,
    );
    result = ctx.errorLevel >= num;
  } else {
    // String comparison: "str1"=="str2" or str1==str2
    const eqMatch = rest.match(/^(.+?)\s*==\s*(.+)/);
    if (eqMatch) {
      let left = eqMatch[1].trim().replace(/^"|"$/g, "");
      let right = eqMatch[2].trim();
      // Find the command part (after the comparison)
      // The right side might be "value" command...
      // Actually in batch, the format is: if "str1"=="str2" command
      // So right is everything after ==, and the command is separate
      // Let's just do a simple comparison
      const cmdIdx = right.search(/\s+(?=\S)/);
      if (cmdIdx >= 0 && !right.startsWith('"')) {
        // right is: value command...
        right = right.slice(0, cmdIdx);
      }
      right = right.replace(/^"|"$/g, "");
      // Expand variables
      left = expandVars(left, ctx.vars, ctx.vfs);
      right = expandVars(right, ctx.vars, ctx.vfs);
      result = left === right;
    }
  }

  return notFlag ? !result : result;
}

function extractIfCommand(line: string): string {
  // Remove "if", optional "not", the condition, and return the rest
  let rest = line.replace(/^\s*if\s+/i, "");
  if (rest.toLowerCase().startsWith("not ")) rest = rest.slice(4).trim();

  // Skip "exist <file>"
  if (rest.toLowerCase().startsWith("exist ")) {
    const afterExist = rest.slice(6).trim();
    const spaceIdx = afterExist.search(/\s/);
    return spaceIdx >= 0 ? afterExist.slice(spaceIdx + 1).trim() : "";
  }
  // Skip "errorlevel <n>"
  if (rest.toLowerCase().startsWith("errorlevel ")) {
    const afterEl = rest.slice(11).trim();
    const spaceIdx = afterEl.search(/\s/);
    return spaceIdx >= 0 ? afterEl.slice(spaceIdx + 1).trim() : "";
  }
  // Skip string comparison: "str"=="str"
  const eqIdx = rest.indexOf("==");
  if (eqIdx >= 0) {
    const afterEq = rest.slice(eqIdx + 2).trim();
    // If right side is quoted, find the closing quote
    if (afterEq.startsWith('"')) {
      const closeQuote = afterEq.indexOf('"', 1);
      if (closeQuote >= 0) return afterEq.slice(closeQuote + 1).trim();
    }
    const spaceIdx = afterEq.search(/\s/);
    return spaceIdx >= 0 ? afterEq.slice(spaceIdx + 1).trim() : "";
  }
  return "";
}

export async function executeBatch(content: string, ctx: CmdContext) {
  const rawLines = content.replace(/\r\n/g, "\n").split("\n");
  const labels: Record<string, number> = {};

  // First pass: find labels
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed.startsWith(":")) {
      labels[trimmed.slice(1).toLowerCase()] = i;
    }
  }

  let echoOn = true;
  let i = 0;
  let iterations = 0;
  const maxIter = rawLines.length * 10; // Safety limit

  while (i < rawLines.length && iterations < maxIter) {
    iterations++;
    let line = rawLines[i].trim();

    // @echo off/on
    if (line.toLowerCase().startsWith("@echo ")) {
      const val = line.slice(6).trim().toLowerCase();
      echoOn = val !== "off";
      i++;
      continue;
    }
    if (line.toLowerCase() === "@echo") {
      i++;
      continue;
    }

    // rem (comments)
    if (line.toLowerCase().startsWith("rem ") || line.toLowerCase() === "rem") {
      i++;
      continue;
    }
    // :: is also a comment in batch
    if (line.startsWith("::")) {
      i++;
      continue;
    }

    // Labels — skip
    if (line.startsWith(":")) {
      i++;
      continue;
    }

    // Empty lines
    if (!line) {
      i++;
      continue;
    }

    // Expand variables
    line = expandVars(line, ctx.vars, ctx.vfs);

    // echo on/off control (without @)
    if (line.toLowerCase() === "echo off") {
      echoOn = false;
      i++;
      continue;
    }
    if (line.toLowerCase() === "echo on") {
      echoOn = true;
      i++;
      continue;
    }

    // Echo the command line if echo is on
    if (echoOn) ctx.print([line], "echo");

    // goto
    if (line.toLowerCase().startsWith("goto ")) {
      const label = line.slice(5).trim().toLowerCase();
      if (label in labels) {
        i = labels[label];
        continue;
      }
      ctx.print(
        [`The system cannot find the batch label specified: ${label}`],
        "error",
      );
      break;
    }

    // if
    if (
      line.toLowerCase().startsWith("if ") ||
      line.toLowerCase().startsWith("if(")
    ) {
      const condition = evaluateCondition(line, ctx);
      if (condition) {
        const cmdPart = extractIfCommand(line);
        if (cmdPart) {
          await executeLine(cmdPart, ctx);
        }
      }
      i++;
      continue;
    }

    // pause
    if (line.toLowerCase() === "pause") {
      ctx.print(["Press any key to continue . . ."]);
      i++;
      continue;
    }

    // call
    if (line.toLowerCase().startsWith("call ")) {
      const batPath = line.slice(5).trim();
      const batContent = ctx.vfs.read(batPath);
      if (batContent) {
        await executeBatch(batContent, ctx);
      } else {
        ctx.print(
          [`The system cannot find the batch file specified.`],
          "error",
        );
      }
      i++;
      continue;
    }

    // set (batch context)
    if (line.toLowerCase().startsWith("set ") && line.includes("=")) {
      const eqIdx = line.indexOf("=");
      const name = line.slice(4, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      ctx.setVar(name, value);
      i++;
      continue;
    }

    // Execute as normal command
    await executeLine(line, ctx);
    i++;
  }
}

// ─── Command registry ─────────────────────────────────────────────────────

type CmdHandler = (
  args: string[],
  ctx: CmdContext,
  raw: string,
  cmdName: string,
) => void | Promise<void>;

const REGISTRY: Record<string, CmdHandler> = {
  // Help
  help: cmdHelp,
  // Navigation
  dir: cmdDir,
  ls: cmdLs,
  cd: cmdCd,
  chdir: cmdCd,
  pwd: cmdPwd,
  // File display
  type: cmdType,
  cat: cmdType,
  more: cmdMore,
  less: cmdMore,
  head: cmdHead,
  tail: cmdTail,
  // File creation
  mkdir: cmdMkdir,
  md: cmdMkdir,
  touch: cmdTouch,
  // File deletion
  rmdir: cmdRmdir,
  rd: cmdRmdir,
  del: cmdDel,
  erase: cmdDel,
  rm: cmdRmdir,
  // File copy/move/rename
  copy: cmdCopy,
  cp: cmdCopy,
  move: cmdMove,
  mv: cmdMove,
  ren: cmdRen,
  rename: cmdRen,
  // Search
  grep: cmdGrep,
  find: cmdFind,
  sort: cmdSort,
  wc: cmdWc,
  which: cmdWhich,
  // Tree
  tree: cmdTree,
  // Editor
  nano: cmdNano,
  // System
  echo: cmdEcho,
  cls: cmdCls,
  clear: cmdCls,
  exit: cmdExit,
  quit: cmdExit,
  ver: cmdVer,
  vol: cmdVol,
  path: cmdPath,
  set: cmdSet,
  start: cmdStart,
  title: cmdTitle,
  color: cmdColor,
  prompt: cmdPrompt,
  // Info
  about: cmdAbout,
  links: cmdLinks,
  whoami: cmdWhoami,
  date: cmdDate,
  time: cmdTime,
  // Network
  ping: cmdPing,
};

const HELP_TOPICS: Record<string, string[]> = {
  dir: [
    "DIR [path][/B][/W][/A]",
    "  Lists directory contents.",
    "  /B  Bare format (names only)",
    "  /W  Wide format",
    "  /A  Show hidden files",
  ],
  ls: [
    "LS [options] [path]",
    "  -l  Long format",
    "  -a  Show hidden files",
    "  Lists directory contents (Unix style).",
  ],
  cd: [
    "CD [path]",
    "  Changes the current directory.",
    "  CD with no args shows the current directory.",
  ],
  cat: [
    "CAT [-n] file [file...]",
    "  Displays file contents.",
    "  -n  Show line numbers",
  ],
  type: ["TYPE file [file...]", "  Displays file contents (DOS style)."],
  mkdir: [
    "MKDIR <name>   (MD)",
    "  Creates a directory.",
    "  -p  Create parent directories if needed",
  ],
  rmdir: [
    "RMDIR <name>   (RD)",
    "  Removes a directory.",
    "  -r  Recursive (with contents)",
    "  -f  Force (no error if not found)",
  ],
  del: [
    "DEL <file>   (ERASE, RM)",
    "  Deletes a file.",
    "  /Q  Quiet mode",
    "  Supports wildcards: del *.txt",
  ],
  copy: ["COPY <src> <dst>   (CP)", "  Copies a file."],
  move: ["MOVE <src> <dst>   (MV)", "  Moves a file or directory."],
  ren: ["REN <file> <newname>   (RENAME, MV)", "  Renames a file."],
  tree: ["TREE [path]", "  Displays the directory tree."],
  echo: [
    "ECHO <text>",
    "  Prints text. Supports > and >> redirection.",
    "  ECHO. prints a blank line.",
  ],
  grep: [
    "GREP [options] PATTERN FILE",
    "  -i  Case-insensitive",
    "  -n  Show line numbers",
    "  -v  Invert match",
    "  -c  Count matches only",
  ],
  head: ["HEAD [-n N] <file>", "  Shows the first N lines (default 10)."],
  tail: ["TAIL [-n N] <file>", "  Shows the last N lines (default 10)."],
  wc: ["WC [-l] [-w] [-c] <file>", "  Counts lines, words, and characters."],
  find: [
    "FIND <path> -name <pattern> [-type f|d]",
    "  Finds files matching a pattern.",
  ],
  touch: ["TOUCH <file>", "  Creates an empty file or updates timestamp."],
  nano: [
    "NANO <file>",
    "  Opens the GNU nano 9.1 text editor.",
    "  ^O Write Out  ^X Exit  ^K Cut  ^U Paste",
    "  ^W Where Is   ^\\ Replace  ^R Read File  ^C Location",
  ],
  set: ["SET [var=value]", "  Sets or displays environment variables."],
  start: ["START <program>", "  Starts a program in a new window."],
  cls: ["CLS / CLEAR", "  Clears the screen."],
  ver: ["VER", "  Shows the Windows version."],
  vol: ["VOL", "  Shows the volume label."],
  path: ["PATH", "  Shows the executable search path."],
  pwd: ["PWD", "  Prints the working directory."],
  which: ["WHICH <command>", "  Shows the full path of a command."],
  ping: [
    "PING [-n count] <hostname>",
    "  Sends simulated ICMP echo requests to a host.",
    "  -n  Number of pings to send (default 4)",
  ],
};

export function buildHelpText(): string[] {
  return [
    "RSNRA 95 — Command Reference",
    "============================",
    "",
    "Directory & Navigation:",
    "  dir [path][/b][/w]   ls [-l][-a]     cd <path>",
    "  pwd                  tree [path]     chdir <path>",
    "",
    "File Operations:",
    "  type <file>          cat [-n] <file>    more <file>",
    "  mkdir <name>         md <name>          touch <file>",
    "  rmdir <name>         rd <name>          rm [-rf] <name>",
    "  del <file>           erase <file>       (supports *.txt)",
    "  copy <src> <dst>     cp <src> <dst>",
    "  move <src> <dst>     mv <src> <dst>",
    "  ren <old> <new>      rename <old> <new>",
    "",
    "Text Processing:",
    "  grep [-inv] <pat> <file>    head [-n N] <file>",
    "  tail [-n N] <file>          wc [-lwc] <file>",
    "  sort <file>                 find <path> -name <pattern>",
    "",
    "Editor:",
    "  nano <file>          (^O: Write, ^X: Exit, ^K: Cut, ^U: Paste)",
    "",
    "System:",
    "  echo <text>          set <var=value>    start <program>",
    "  cls / clear          ver                vol",
    "  path                 pwd                which <cmd>",
    "  title <text>         prompt <text>      color <code>",
    "  date                 time               exit",
    "",
    "Network:",
    "  ping [-n count] <host>",
    "",
    "Redirection:",
    "  command > file       Write output to file",
    "  command >> file      Append output to file",
    "",
    "Batch Scripts:",
    "  Run .bat files:  myscript.bat",
    "  Supports: @echo off, rem, set, %var%, goto,",
    "  if exist, if not exist, pause, call",
    "",
    'Type "help <command>" for detailed help.',
    "",
    "  about   links   whoami",
  ];
}

// ─── Line executor with redirection ───────────────────────────────────────

export async function executeLine(rawLine: string, ctx: CmdContext) {
  const { cmd: cmdLine, redirect } = parseRedirection(rawLine);

  if (redirect) {
    // Capture output and write to file
    const captured: string[] = [];
    const capturePrint = (lines: string[], _kind?: LineKind) => {
      captured.push(...lines);
    };
    const captureCtx: CmdContext = {
      ...ctx,
      print: capturePrint,
    };
    await dispatchCommand(cmdLine, captureCtx);
    const content = captured.join("\n");
    const abs = ctx.vfs.resolvePath(redirect.file);
    if (abs) {
      if (redirect.append) {
        const existing = ctx.vfs.read(redirect.file) ?? "";
        // Add newline only if existing content doesn't end with one
        const sep = existing && !existing.endsWith("\n") ? "\n" : "";
        ctx.vfs.writeFile(redirect.file, existing + sep + content);
      } else {
        ctx.vfs.writeFile(redirect.file, content);
      }
    } else {
      ctx.print(["The system cannot find the path specified."], "error");
    }
  } else {
    await dispatchCommand(cmdLine, ctx);
  }
}

async function dispatchCommand(cmdLine: string, ctx: CmdContext) {
  const trimmed = cmdLine.trim();
  if (!trimmed) return;

  // Parse command and arguments
  // Support quoted arguments
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === " " || ch === "\t") && !inQuotes) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const cmd = parts[0].replace(/"/g, "");
  const args = parts.slice(1).map((a) => a.replace(/^"|"$/g, ""));

  if (!cmd) return;

  const handler = REGISTRY[cmd.toLowerCase()];
  if (handler) {
    await handler(args, ctx, trimmed, cmd.toLowerCase());
    return;
  }

  // Try as .bat file
  const batAbs = ctx.vfs.resolvePath(cmd);
  if (batAbs) {
    const batNode = ctx.vfs.resolve(batAbs);
    if (
      batNode &&
      batNode.type === "file" &&
      cmd.toLowerCase().endsWith(".bat")
    ) {
      const content = ctx.vfs.read(batAbs);
      if (content) {
        ctx.print([`Executing ${cmd}...`]);
        // Pass any additional args as %1, %2, etc.
        const batchVars = { ...ctx.vars };
        args.forEach((a, idx) => {
          batchVars[String(idx + 1)] = a;
        });
        batchVars["0"] = cmd;
        const batchCtx: CmdContext = { ...ctx, vars: batchVars };
        await executeBatch(content, batchCtx);
        // Sync back any new variables
        for (const k of Object.keys(batchCtx.vars)) {
          if (!/^\d+$/.test(k) && k !== "0") {
            ctx.setVar(k, batchCtx.vars[k]);
          }
        }
      }
      return;
    }
  }

  // Try as an executable
  const lower = cmd.toLowerCase();
  let node: VfsNode | null = null;
  if (/^[A-Za-z]:[\\/]/.test(cmd) || cmd.startsWith("\\")) {
    const abs = ctx.vfs.resolvePath(cmd);
    node = abs ? ctx.vfs.resolve(abs) : null;
  } else {
    const exePath = ctx.vfs.findExecutable(lower);
    if (exePath) node = ctx.vfs.resolve(exePath);
  }

  if (node && node.appId) {
    // Pass a file argument through to apps that understand it
    if (node.appId === "notepad" && args[0]) {
      const abs = ctx.vfs.resolvePath(args[0]);
      if (abs && ctx.vfs.resolve(abs)) {
        const fname = abs.split("\\").pop() ?? "untitled.txt";
        openApp("notepad", {
          title: `${fname} - Notepad`,
          data: { path: abs },
        });
        ctx.print([`Starting ${node.name}...`]);
        return;
      }
      ctx.print(
        [`The system cannot find the file specified: ${args[0]}`],
        "error",
      );
      ctx.setErrorLevel(1);
      return;
    }
    if (node.appId === "paint" && args[0]) {
      const abs = ctx.vfs.resolvePath(args[0]);
      if (abs && ctx.vfs.resolve(abs)) {
        const fname = abs.split("\\").pop() ?? "untitled.png";
        openApp("paint", { title: `${fname} - Paint`, data: { path: abs } });
        ctx.print([`Starting ${node.name}...`]);
        return;
      }
    }
    openApp(node.appId as never);
    ctx.print([`Starting ${node.name}...`]);
    return;
  }

  ctx.print(
    [
      `'${cmd}' is not recognized as an internal or external command,`,
      `operable program or batch file. Type "help".`,
    ],
    "error",
  );
  ctx.setErrorLevel(1);
}

// ─── Tree formatting ───────────────────────────────────────────────────────

function formatTree(
  node: VfsNode,
  prefix = "",
  isLast = true,
  name = node.name,
): string[] {
  const branch = isLast ? "└── " : "├── ";
  const lines = [prefix + branch + name + (node.type === "dir" ? "\\" : "")];
  if (node.type === "dir" && node.children) {
    const sorted = [...node.children]
      .filter((c) => !c.hidden)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    sorted.forEach((c, i) => {
      const next = prefix + (isLast ? "    " : "│   ");
      lines.push(...formatTree(c, next, i === sorted.length - 1, c.name));
    });
  }
  return lines;
}

// Re-export for convenience
export { useVfsStore };
