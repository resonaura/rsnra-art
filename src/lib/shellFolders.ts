/**
 * Present the entries from a shared Shell folder and its per-user counterpart.
 * Equal names are kept as distinct Shell items because they belong to distinct
 * physical folders. User items keep the legacy name-based position key so
 * existing desktop icon placements continue to work; shared items always use
 * a path-qualified key that cannot collide with a per-user item.
 */
export function mergeCommonAndUserEntries<T extends { name: string }>(
  commonPath: string,
  common: T[],
  userPath: string,
  perUser: T[],
): Array<{ node: T; path: string; id: string; positionKey: string }> {
  const entries = [
    ...common.map((node) => ({ node, path: commonPath })),
    ...perUser.map((node) => ({ node, path: userPath })),
  ];

  return entries.map(({ node, path }) => {
    const id = desktopEntryId(path, node.name);
    const isPerUser = path.toLowerCase() === userPath.toLowerCase();
    return {
      node,
      path,
      id,
      positionKey: isPerUser ? node.name : id,
    };
  });
}

export function desktopEntryId(path: string, name: string): string {
  return `${path.replace(/[\\/]+$/, "").toLowerCase()}\\${name.toLowerCase()}`;
}
