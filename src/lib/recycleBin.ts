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

export function deleteConfirmationMessage(
  label: string,
  nodes: VfsNode[],
): string {
  const permanentCount = nodes.filter(isRecycleBinBypassed).length;
  if (permanentCount === nodes.length) {
    return `Are you sure you want to permanently delete ${label}?`;
  }
  if (permanentCount > 0) {
    return `Are you sure you want to delete ${label}? Some items will be permanently deleted because they exceed the Recycle Bin size limit.`;
  }
  const mayEvictOlderItems =
    useRecycleBinStore.getState().maximumSizePercent < 100;
  return `Are you sure you want to send ${label} to the Recycle Bin?${
    mayEvictOlderItems
      ? " Older items may be permanently deleted to make room."
      : ""
  }`;
}
