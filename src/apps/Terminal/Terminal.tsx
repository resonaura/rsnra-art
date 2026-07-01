import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { openApp } from "../../data/apps";
import {
  BAND_LOCATION,
  BAND_NAME,
  CONTACT_EMAIL,
  LINKS,
} from "../../data/content";
import { useVfsStore, type VfsNode } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #000;
`;

const Screen = styled.div`
  background: #000;
  color: #c0c0c0;
  font-family: "VT323", "Courier New", monospace;
  font-size: 17px;
  line-height: 1.3;
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Line = styled.div<{ $kind?: "echo" | "output" | "error" }>`
  color: ${({ $kind }) =>
    $kind === "error" ? "#ff6b6b" : $kind === "echo" ? "#ffffff" : "#c0c0c0"};
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
`;

const PromptSpan = styled.span`
  color: #6dff8f;
  margin-right: 6px;
  flex-shrink: 0;
`;

const HiddenInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-family: "VT323", "Courier New", monospace;
  font-size: 17px;
  caret-color: #6dff8f;
`;

interface HistoryEntry {
  text: string;
  kind?: "echo" | "output" | "error";
}

const BANNER = [
  "RSNRA 95 [Version 4.95.1996]",
  `(c) ${BAND_NAME}. All rights reserved.`,
  "",
  'Type "help" to see what this thing can do.',
  "",
];

function buildHelp(): string[] {
  return [
    "Available commands:",
    "  dir [path]        list directory contents",
    "  cd <path>         change directory (cd \\ , cd .. , cd My Documents)",
    "  type <file>       display a text file",
    "  mkdir <name>      create a directory   (md)",
    "  rmdir <name>      remove a directory   (rd)",
    "  del <file>        delete a file        (erase)",
    "  copy <src> <dst>  copy a file",
    "  move <src> <dir>  move a file",
    "  ren <f> <new>     rename a file        (rename)",
    "  tree [path]       show directory tree",
    "  ver               show Windows version",
    "  vol               show volume label",
    "  path              show executable search path",
    "  echo <text>       print text back",
    "  cls / clear       clear the screen",
    "",
    "Run a program by name or full path:",
    "  notepad           mspaint             winmine",
    "  control           explorer            command",
    "  C:\\Windows\\notepad.exe",
    "",
    "  about   bio   links   whoami   date   exit",
  ];
}

// Format a dir listing like MS-DOS 7 (Win95) `dir`.
function formatDirListing(entries: VfsNode[], absPath: string): string[] {
  const lines: string[] = [];
  lines.push(` Directory of ${absPath}`);
  lines.push("");
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  let fileCount = 0;
  let dirCount = 0;
  let totalBytes = 0;
  for (const e of sorted) {
    const date = new Date(e.created);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours() % 12 || 12).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ampm = date.getHours() >= 12 ? "PM" : "AM";
    const stamp = `${mm}/${dd}/${yy}  ${hh}:${mi} ${ampm}`;
    if (e.type === "dir") {
      dirCount++;
      lines.push(`${stamp}    <DIR>          ${e.name}`);
    } else {
      fileCount++;
      const size = (e.content?.length ?? 0) || (e.appId ? 32768 : 0);
      totalBytes += size;
      lines.push(`${stamp}    ${String(size).padStart(14)} ${e.name}`);
    }
  }
  lines.push("");
  lines.push(
    `      ${fileCount} file(s)    ${totalBytes.toLocaleString()} bytes`,
  );
  lines.push(`      ${dirCount} dir(s)`);
  return lines;
}

function formatTree(
  node: VfsNode,
  prefix = "",
  isLast = true,
  name = node.name,
): string[] {
  const branch = isLast ? "└── " : "├── ";
  const lines = [prefix + branch + name + (node.type === "dir" ? "\\" : "")];
  if (node.type === "dir" && node.children) {
    const sorted = [...node.children].sort((a, b) => {
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

export function Terminal({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const cwd = useVfsStore((s) => s.cwd);
  const [history, setHistory] = useState<HistoryEntry[]>(
    BANNER.map((text) => ({ text, kind: "output" })),
  );
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIndex, setCmdIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const prompt = `${cwd}>`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight });
  }, [history]);

  const print = (lines: string[], kind?: HistoryEntry["kind"]) => {
    setHistory((h) => [...h, ...lines.map((text) => ({ text, kind }))]);
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    print([`${prompt} ${raw}`], "echo");
    if (!trimmed) return;

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(" ");
    const vfs = useVfsStore.getState();

    switch (cmd.toLowerCase()) {
      case "help":
        print(buildHelp());
        break;
      case "about":
        print([
          `${BAND_NAME} — Alternative Rock, ${BAND_LOCATION}.`,
          "Fuzzed-out guitars, atmospheric synths, anthemic choruses.",
          'Run "links" for everything else.',
        ]);
        break;
      case "ver":
        print(["", "RSNRA 95 [Version 4.95.1996]", ""]);
        break;
      case "vol":
        print([
          " Volume in drive C is RSNRA95",
          " Volume Serial Number is 1996-0824",
          "",
        ]);
        break;
      case "path":
        print([
          "PATH=" +
            [
              "C:\\Windows",
              "C:\\Windows\\Command",
              "C:\\Program Files\\RSNRA",
            ].join(";"),
        ]);
        break;
      case "links":
        print([
          `Music       ${LINKS.music}`,
          `TikTok      ${LINKS.tiktok}`,
          `Instagram   ${LINKS.instagram}`,
          `Contact     ${CONTACT_EMAIL}`,
        ]);
        break;
      case "whoami":
        print(["A friendly visitor browsing RSNRA 95. Welcome."]);
        break;
      case "date":
        print([new Date().toString()]);
        break;
      case "echo":
        print([arg]);
        break;
      case "cls":
      case "clear":
        setHistory([]);
        break;
      case "exit":
        closeWindow(windowId);
        break;

      // ── directory listing ────────────────────────────────────────────────
      case "dir":
      case "ls": {
        const target = arg || vfs.cwd;
        const abs = vfs.resolvePath(target);
        const node = abs ? vfs.resolve(abs) : null;
        if (!abs || !node) {
          print([`The system cannot find the path specified.`], "error");
          break;
        }
        if (node.type !== "dir") {
          print([`Not a directory.`], "error");
          break;
        }
        const entries = node.children ?? [];
        if (entries.length === 0) {
          print([
            ` Directory of ${abs}`,
            "",
            "        <empty>",
            "",
            "      0 file(s)",
            "      0 dir(s)",
          ]);
        } else {
          print(formatDirListing(entries, abs));
        }
        break;
      }

      // ── change directory ─────────────────────────────────────────────────
      case "cd": {
        if (!arg) {
          print([vfs.cwd]);
          break;
        }
        const abs = vfs.resolvePath(arg);
        if (!abs || !vfs.setCwd(abs)) {
          print([`The system cannot find the path specified.`], "error");
        }
        break;
      }
      case "chdir":
        if (
          !arg ||
          !vfs.resolvePath(arg) ||
          !vfs.setCwd(vfs.resolvePath(arg)!)
        ) {
          print([`The system cannot find the path specified.`], "error");
        }
        break;

      // ── type a file ──────────────────────────────────────────────────────
      case "type": {
        if (!arg) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        const abs = vfs.resolvePath(arg);
        const node = abs ? vfs.resolve(abs) : null;
        if (!node) {
          print([`The system cannot find the file specified.`], "error");
        } else if (node.type === "dir") {
          print([`Access is denied.`], "error");
        } else {
          print((node.content ?? "").split("\n"));
        }
        break;
      }

      // ── make directory ───────────────────────────────────────────────────
      case "mkdir":
      case "md": {
        if (!arg) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        if (!vfs.mkdir(arg)) {
          print([`Directory already exists or path not found.`], "error");
        }
        break;
      }

      // ── remove directory ─────────────────────────────────────────────────
      case "rmdir":
      case "rd": {
        if (!arg) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        const abs = vfs.resolvePath(arg);
        const node = abs ? vfs.resolve(abs) : null;
        if (!node || node.type !== "dir") {
          print([`The system cannot find the directory specified.`], "error");
          break;
        }
        if (node.children && node.children.length > 0) {
          print([`The directory is not empty.`], "error");
          break;
        }
        if (!vfs.remove(arg)) {
          print([`Access is denied — system directory.`], "error");
        }
        break;
      }

      // ── delete file ──────────────────────────────────────────────────────
      case "del":
      case "erase": {
        if (!arg) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        const abs = vfs.resolvePath(arg);
        const node = abs ? vfs.resolve(abs) : null;
        if (!node) {
          print([`Could not find ${arg}.`], "error");
        } else if (node.type === "dir") {
          print([`Access is denied.`], "error");
        } else if (!vfs.remove(arg)) {
          print([`Access is denied — system file.`], "error");
        } else {
          print([`Deleted ${node.name}.`]);
        }
        break;
      }

      // ── copy / move / rename ─────────────────────────────────────────────
      case "copy": {
        const [src, dst] = rest;
        if (!src || !dst) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        const dstDir = vfs.resolve(dst);
        if (dstDir && dstDir.type === "dir") {
          if (vfs.copy(src, dst)) print([`        1 file(s) copied.`]);
          else
            print(
              [
                `The system cannot find the file specified, or it already exists.`,
              ],
              "error",
            );
        } else if (vfs.writeFile(dst, vfs.read(src) ?? "")) {
          print([`        1 file(s) copied.`]);
        } else {
          print([`The system cannot find the file specified.`], "error");
        }
        break;
      }
      case "move": {
        const [src, dst] = rest;
        if (!src || !dst) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        if (vfs.move(src, dst)) print([`        1 file(s) moved.`]);
        else
          print(
            [
              `The system cannot find the file specified, or it already exists.`,
            ],
            "error",
          );
        break;
      }
      case "ren":
      case "rename": {
        const [target, newName] = rest;
        if (!target || !newName) {
          print([`The syntax of the command is incorrect.`], "error");
          break;
        }
        if (vfs.rename(target, newName)) print([`Renamed to ${newName}.`]);
        else
          print(
            [`The system cannot find the file, or the name is in use.`],
            "error",
          );
        break;
      }

      // ── tree ─────────────────────────────────────────────────────────────
      case "tree": {
        const target = arg || vfs.cwd;
        const abs = vfs.resolvePath(target);
        const node = abs ? vfs.resolve(abs) : null;
        if (!abs || !node || node.type !== "dir") {
          print([`The system cannot find the path specified.`], "error");
          break;
        }
        print([abs, ...formatTree(node, "", true, node.name)]);
        break;
      }

      // ── launch a program ─────────────────────────────────────────────────
      default: {
        // Try as an executable: bare name (search PATH) or a path.
        const lower = cmd.toLowerCase();
        let node: VfsNode | null = null;
        if (/^[A-Za-z]:[\\/]/.test(cmd) || cmd.startsWith("\\")) {
          const abs = vfs.resolvePath(cmd);
          node = abs ? vfs.resolve(abs) : null;
        } else {
          const exePath = vfs.findExecutable(lower);
          if (exePath) node = vfs.resolve(exePath);
        }
        if (node && node.appId) {
          // Pass a file argument through to apps that understand it (e.g. notepad).
          if (node.appId === "notepad" && arg) {
            const abs = vfs.resolvePath(arg);
            if (abs && vfs.resolve(abs)) {
              const fname = abs.split("\\").pop() ?? "untitled.txt";
              openApp("notepad", {
                title: `${fname} - Notepad`,
                data: { path: abs },
              });
              print([`Starting ${node.name}...`]);
              break;
            }
            print(
              [`The system cannot find the file specified: ${arg}`],
              "error",
            );
            break;
          }
          openApp(node.appId as never);
          print([`Starting ${node.name}...`]);
        } else {
          print(
            [
              `'${cmd}' is not recognized as an internal or external command,`,
              `operable program or batch file. Type "help".`,
            ],
            "error",
          );
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand(input);
      setCmdHistory((h) => (input.trim() ? [...h, input] : h));
      setCmdIndex(null);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIndex =
        cmdIndex === null ? cmdHistory.length - 1 : Math.max(0, cmdIndex - 1);
      setCmdIndex(nextIndex);
      setInput(cmdHistory[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cmdIndex === null) return;
      const nextIndex = cmdIndex + 1;
      if (nextIndex >= cmdHistory.length) {
        setCmdIndex(null);
        setInput("");
      } else {
        setCmdIndex(nextIndex);
        setInput(cmdHistory[nextIndex]);
      }
    }
  };

  const menus = [
    {
      label: "Edit",
      items: [
        { label: "Mark", disabled: true },
        { label: "Copy\tEnter", disabled: true },
        { label: "Paste", disabled: true },
        { label: "Scroll", disabled: true },
        { label: "", divider: true },
        { label: "Select All", disabled: true },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Font...", disabled: true },
        { label: "", divider: true },
        { label: "Full Screen", disabled: true },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help Topics", disabled: true },
        { label: "", divider: true },
        { label: 'Type "help" for commands', disabled: true },
      ],
    },
  ];

  return (
    <Root>
      <AppMenuBar menus={menus} />
      <Screen ref={screenRef} onClick={() => inputRef.current?.focus()}>
        {history.map((entry, i) => (
          <Line key={i} $kind={entry.kind}>
            {entry.text}
          </Line>
        ))}
        <InputRow>
          <PromptSpan>{prompt}</PromptSpan>
          <HiddenInput
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
        </InputRow>
      </Screen>
    </Root>
  );
}
