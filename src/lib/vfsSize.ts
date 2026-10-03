// Real byte size of a VFS file's content. Text files store their content
// as-is, but binary files (Paint PNGs, Sound Recorder WAVs) store it as a
// `data:...;base64,...` URL — measuring that string's length (or its Blob
// size) counts the base64 encoding overhead (~33% larger) and the "data:"
// prefix, not the actual file size. Decode the base64 payload instead.
export function contentByteSize(content: string | undefined): number {
  if (!content) return 0;
  const match = content.match(/^data:[^,]*;base64,([\s\S]*)$/);
  if (match) {
    try {
      return atob(match[1]).length;
    } catch {
      return 0;
    }
  }
  return new Blob([content]).size;
}

export interface VfsSizeNode {
  name?: string;
  type: "file" | "dir";
  content?: string;
  appId?: string;
  children?: VfsSizeNode[];
}

// The virtual C: volume is modeled as a 2 GB FAT16 disk. At this size,
// Windows 2000's default FAT16 allocation unit is 32 KB, so a non-empty file
// occupies at least one full cluster even when its logical content is tiny.
export const VFS_CLUSTER_SIZE = 32 * 1024;

export function vfsAllocatedByteSize(logicalBytes: number): number {
  return logicalBytes > 0
    ? Math.ceil(logicalBytes / VFS_CLUSTER_SIZE) * VFS_CLUSTER_SIZE
    : 0;
}

/** One size rule shared by Explorer, Find, Properties, and the DOS listing. */
export function vfsNodeByteSize(node: VfsSizeNode): number {
  if (node.type === "file") {
    if (node.content) return contentByteSize(node.content);
    const isExecutable = /\.(?:exe|com|dll|sys|scr|cpl)$/i.test(node.name ?? "");
    return node.appId || isExecutable ? 32768 : 0;
  }
  return (node.children ?? []).reduce(
    (total, child) => total + vfsNodeByteSize(child),
    0,
  );
}

function isShortNameRepresentable(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot !== name.indexOf(".")) return false;
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot + 1) : "";
  const validChars = /^[A-Za-z0-9_$%'-@^_`{}~!#&()]+$/;
  const hasUniformCase = (part: string) =>
    !(/[a-z]/.test(part) && /[A-Z]/.test(part));
  return (
    base.length > 0 &&
    base.length <= 8 &&
    extension.length <= 3 &&
    validChars.test(base) &&
    (!extension || validChars.test(extension)) &&
    hasUniformCase(base) &&
    hasUniformCase(extension)
  );
}

/**
 * Space occupied by a node on the virtual FAT16 volume. Files and subdirectory
 * entries consume 32 KB clusters; the fixed root directory and FAT metadata
 * are not counted. Empty files consume no data clusters.
 */
export function vfsNodeAllocatedByteSize(
  node: VfsSizeNode,
  volumeRoot = false,
): number {
  if (node.type === "file") return vfsAllocatedByteSize(vfsNodeByteSize(node));
  const children = node.children ?? [];
  const directoryEntryBytes = children.reduce((total, child) => {
    const name = child.name ?? "";
    const longNameRecords = isShortNameRepresentable(name)
      ? 0
      : Math.ceil(name.length / 13);
    return total + (1 + longNameRecords) * 32;
  }, 0);
  // Non-root FAT directories contain `.` and `..` entries and always occupy
  // at least one cluster. FAT16's root directory is a fixed reserved table.
  const directoryBytes = volumeRoot
    ? 0
    : vfsAllocatedByteSize(directoryEntryBytes + 2 * 32);
  return (
    directoryBytes +
    children.reduce(
      (total, child) =>
        total + vfsNodeAllocatedByteSize(child),
      0,
    )
  );
}
