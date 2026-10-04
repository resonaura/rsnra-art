/** Apply Folder Options' Hidden and protected operating-system file filters. */
export function isVfsNodeVisible(
  node: { hidden?: boolean; system?: boolean },
  showHidden: boolean,
  hideProtectedSystemFiles: boolean,
): boolean {
  if (node.hidden && !showHidden) return false;
  if (node.hidden && node.system && hideProtectedSystemFiles) return false;
  return true;
}
