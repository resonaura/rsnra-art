import { vfsNodeAllocatedByteSize, VFS_DISK_CAPACITY } from "./vfsSize";
import { useRecycleBinStore } from "../store/recycleBinStore";
import type { RecycledItem, VfsNode } from "../store/vfsStore";

export function recycleBinMaximumBytes(percent?: number): number {
  const storedPercent = useRecycleBinStore.getState().maximumSizePercent;
  const configuredPercent = percent ?? storedPercent;
  const finitePercent = Number.isFinite(configuredPercent)
    ? configuredPercent
    : 10;
  const safePercent = Math.min(100, Math.max(0, finitePercent));
  return Math.floor((VFS_DISK_CAPACITY * safePercent) / 100);
}

export function recycleBinPayloadSizes(
  root: Pick<VfsNode, "children">,
  items: Pick<RecycledItem, "storageName">[],
): number[] {
  const recycledFolder = root.children?.find(
    (node) => node.type === "dir" && node.name.toLowerCase() === "recycled",
  );
  return items.map((item) => {
    const payload = recycledFolder?.children?.find(
      (node) => node.name.toLowerCase() === item.storageName.toLowerCase(),
    );
    return payload ? vfsNodeAllocatedByteSize(payload) : 0;
  });
}

export function willRecycleBinEvictOldestItems(
  nodes: VfsNode[],
  existingPayloadSizes: number[],
): boolean {
  const { skipRecycleBin, maximumSizePercent } = useRecycleBinStore.getState();
  const maximumBytes = recycleBinMaximumBytes(maximumSizePercent);
  if (skipRecycleBin || maximumBytes === 0) return false;

  let queuedSizes = [...existingPayloadSizes];
  let usedBytes = queuedSizes.reduce((total, size) => total + size, 0);
  let willEvict = false;
  for (const node of nodes) {
    const incomingBytes = vfsNodeAllocatedByteSize(node);
    // An item larger than the configured bin is deleted permanently instead
    // of evicting every smaller item already in the bin.
    if (incomingBytes > maximumBytes) continue;
    while (usedBytes + incomingBytes > maximumBytes && queuedSizes.length) {
      usedBytes -= queuedSizes.shift() ?? 0;
      willEvict = true;
    }
    usedBytes += incomingBytes;
    queuedSizes.push(incomingBytes);
  }
  return willEvict;
}

export function isRecycleBinBypassed(node: VfsNode): boolean {
  const { skipRecycleBin } = useRecycleBinStore.getState();
  const maximumBytes = recycleBinMaximumBytes();
  return (
    skipRecycleBin ||
    maximumBytes === 0 ||
    vfsNodeAllocatedByteSize(node) > maximumBytes
  );
}

/** Read-only is a DOS file attribute, not a deletion lock in Explorer. */
export function containsReadOnlyFile(node: VfsNode): boolean {
  if (node.type === "file") return !!node.readonly;
  return (node.children ?? []).some(containsReadOnlyFile);
}

export function readOnlyFileWarning(
  nodes: VfsNode[],
  permanentlyDelete = false,
  willEvictOlderItems = false,
): string {
  const selectedCount = nodes.filter(containsReadOnlyFile).length;
  const result = permanentlyDelete
    ? "permanently deleted"
    : "sent to the Recycle Bin";
  const quotaWarning = willEvictOlderItems
    ? " Older Recycle Bin items will be permanently deleted to make room."
    : "";
  return selectedCount === 1
    ? `This item contains a read-only file. It will be ${result} if you continue.${quotaWarning}`
    : `One or more selected items contain read-only files. They will be ${result} if you continue.${quotaWarning}`;
}

export function deleteConfirmationMessage(
  label: string,
  nodes: VfsNode[],
  existingPayloadSizes: number[] = [],
): string {
  const readOnlyWarning = nodes.some(containsReadOnlyFile)
    ? " This selection contains read-only files; they will also be deleted if you continue."
    : "";
  const permanentCount = nodes.filter(isRecycleBinBypassed).length;
  if (permanentCount === nodes.length) {
    return `Are you sure you want to permanently delete ${label}?${readOnlyWarning}`;
  }
  if (permanentCount > 0) {
    return `Are you sure you want to delete ${label}? Some items will be permanently deleted because they exceed the Recycle Bin size limit.${readOnlyWarning}`;
  }
  const willEvictOlderItems = willRecycleBinEvictOldestItems(
    nodes,
    existingPayloadSizes,
  );
  return `Are you sure you want to send ${label} to the Recycle Bin?${
    willEvictOlderItems
      ? " Older items may be permanently deleted to make room."
      : ""
  }${readOnlyWarning}`;
}
