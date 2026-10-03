import { vfsNodeAllocatedByteSize, VFS_DISK_CAPACITY } from "./vfsSize";
import { useRecycleBinStore } from "../store/recycleBinStore";
import type { VfsNode } from "../store/vfsStore";

export function recycleBinMaximumBytes(percent?: number): number {
  const storedPercent = useRecycleBinStore.getState().maximumSizePercent;
  const configuredPercent = percent ?? storedPercent;
  const finitePercent = Number.isFinite(configuredPercent)
    ? configuredPercent
    : 10;
  const safePercent = Math.min(100, Math.max(0, finitePercent));
  return Math.floor((VFS_DISK_CAPACITY * safePercent) / 100);
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
): string {
  const selectedCount = nodes.filter(containsReadOnlyFile).length;
  const result = permanentlyDelete
    ? "permanently deleted"
    : "sent to the Recycle Bin";
  return selectedCount === 1
    ? `This item contains a read-only file. It will be ${result} if you continue.`
    : `One or more selected items contain read-only files. They will be ${result} if you continue.`;
}

export function deleteConfirmationMessage(
  label: string,
  nodes: VfsNode[],
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
  const mayEvictOlderItems =
    useRecycleBinStore.getState().maximumSizePercent < 100;
  return `Are you sure you want to send ${label} to the Recycle Bin?${
    mayEvictOlderItems
      ? " Older items may be permanently deleted to make room."
      : ""
  }${readOnlyWarning}`;
}
