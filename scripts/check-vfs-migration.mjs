import assert from "node:assert/strict";

// The VFS imports the browser-only RainyDay saver at module load time. The
// migration itself does not use the DOM, so provide the one global that vendor
// module expects and a memory-only localStorage for Zustand persistence.
globalThis.window = globalThis;
const localStorageValues = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageValues.get(key) ?? null,
  setItem: (key, value) => localStorageValues.set(key, value),
  removeItem: (key) => localStorageValues.delete(key),
};

const [
  { useVfsStore },
  { dispatchSendToEntry, isSendToMenuEntry, sendToMenuLabel },
  paths,
  { mergeCommonAndUserEntries },
] =
  await Promise.all([
    import("../src/store/vfsStore.ts"),
    import("../src/lib/sendTo.ts"),
    import("../src/lib/windowsPaths.ts"),
    import("../src/lib/shellFolders.ts"),
  ]);

const {
  COMMON_DESKTOP_PATH,
  USER_DOCUMENTS_PATH,
  USER_PROFILE_PATH,
  USER_SEND_TO_PATH,
} = paths;
const state = useVfsStore.getState();

assert.equal(state.resolve(COMMON_DESKTOP_PATH)?.type, "dir");
assert.deepEqual(
  mergeCommonAndUserEntries(
    COMMON_DESKTOP_PATH,
    [
      { name: "Shared.lnk", source: "common" },
      { name: "Common Only.lnk", source: "common" },
    ],
    paths.USER_DESKTOP_PATH,
    [
      { name: "shared.LNK", source: "user" },
      { name: "Personal Only.lnk", source: "user" },
    ],
  ),
  [
    {
      node: { name: "Shared.lnk", source: "common" },
      path: COMMON_DESKTOP_PATH,
      id: `${COMMON_DESKTOP_PATH.toLowerCase()}\\shared.lnk`,
      positionKey: `${COMMON_DESKTOP_PATH.toLowerCase()}\\shared.lnk`,
    },
    {
      node: { name: "Common Only.lnk", source: "common" },
      path: COMMON_DESKTOP_PATH,
      id: `${COMMON_DESKTOP_PATH.toLowerCase()}\\common only.lnk`,
      positionKey: `${COMMON_DESKTOP_PATH.toLowerCase()}\\common only.lnk`,
    },
    {
      node: { name: "shared.LNK", source: "user" },
      path: paths.USER_DESKTOP_PATH,
      id: `${paths.USER_DESKTOP_PATH.toLowerCase()}\\shared.lnk`,
      positionKey: "shared.LNK",
    },
    {
      node: { name: "Personal Only.lnk", source: "user" },
      path: paths.USER_DESKTOP_PATH,
      id: `${paths.USER_DESKTOP_PATH.toLowerCase()}\\personal only.lnk`,
      positionKey: "Personal Only.lnk",
    },
  ],
);

// MAX_PATH is 260 characters including the terminating NUL, so 259 visible
// characters work and a 260-character input path does not.
const maxPath = `C:\\${"a".repeat(127)}\\${"b".repeat(128)}`;
const overlongPath = `C:\\${"a".repeat(128)}\\${"b".repeat(128)}`;
assert.equal(maxPath.length, 259);
assert.equal(overlongPath.length, 260);
assert.equal(state.resolvePath(maxPath), maxPath);
assert.equal(state.resolvePath(overlongPath), null);
assert.equal(
  state.resolvePath("C:\\DOCUME~1\\ADMINI~1\\MYDOCU~1"),
  USER_DOCUMENTS_PATH,
);

// Collision-generated copy names still fit a FAT/VFAT filename component.
const maxComponentName = `${"a".repeat(251)}.txt`;
const maxComponentPath = `C:\\${maxComponentName}`;
assert.equal(maxComponentName.length, 255);
assert.equal(state.writeFile(maxComponentPath, "copy boundary"), true);
const copiedMaxComponentName = state.copyTo(maxComponentPath, "C:\\");
assert.ok(copiedMaxComponentName);
assert.ok(copiedMaxComponentName.length <= 255);
assert.equal(state.resolve(`C:\\${copiedMaxComponentName}`)?.type, "file");

// Profile-level operations must not carry away the protected NTUSER.DAT or
// leave the rest of the profile partially altered.
const protectedProfileFile = `${USER_PROFILE_PATH}\\NTUSER.DAT`;
assert.equal(state.resolve(protectedProfileFile)?.protected, true);
assert.equal(state.remove(USER_PROFILE_PATH), false);
assert.equal(state.moveToRecycleBin(USER_PROFILE_PATH), false);
assert.equal(state.rename(USER_PROFILE_PATH, "Administrator Backup"), false);
assert.equal(state.move(USER_PROFILE_PATH, USER_DOCUMENTS_PATH), false);
assert.equal(
  state.moveAs(
    USER_PROFILE_PATH,
    `${USER_DOCUMENTS_PATH}\\Administrator Backup`,
  ),
  false,
);
assert.equal(state.moveTo(USER_PROFILE_PATH, USER_DOCUMENTS_PATH), null);
assert.ok(state.resolve(protectedProfileFile));
assert.equal(useVfsStore.getState().recycled.length, 0);

// Explorer copies create new file objects but preserve each file's FAT
// last-write timestamp. Directories get timestamps for the copied tree.
const originalDateNow = Date.now;
let copyClock = Date.UTC(2001, 0, 2, 3, 4, 5, 670);
Date.now = () => copyClock;
const copyFixturePath = `${USER_DOCUMENTS_PATH}\\Copy Metadata Fixture`;
const copySourcePath = `${copyFixturePath}\\Source.txt`;
try {
  assert.equal(state.mkdir(copyFixturePath), true);
  assert.equal(state.writeFile(copySourcePath, "copy timestamp fixture"), true);
  const sourceFolder = state.resolve(copyFixturePath);
  const sourceFile = state.resolve(copySourcePath);
  assert.ok(sourceFolder && sourceFile);

  copyClock += 24 * 60 * 60 * 1000 + 60_000;
  const copiedFolderName = state.copyTo(copyFixturePath, USER_DOCUMENTS_PATH);
  assert.ok(copiedFolderName);
  const copiedFolderPath = `${USER_DOCUMENTS_PATH}\\${copiedFolderName}`;
  const copiedFilePath = `${copiedFolderPath}\\Source.txt`;
  const copiedFolder = state.resolve(copiedFolderPath);
  const copiedFile = state.resolve(copiedFilePath);
  assert.ok(copiedFolder && copiedFile);
  assert.notEqual(copiedFolder.created, sourceFolder.created);
  assert.notEqual(copiedFolder.modified, sourceFolder.modified);
  assert.notEqual(copiedFile.created, sourceFile.created);
  assert.equal(copiedFile.modified, sourceFile.modified);
  assert.notEqual(state.resolve(copySourcePath)?.accessed, sourceFile.accessed);
  assert.equal(
    copiedFile.accessed,
    state.resolve(copySourcePath)?.accessed,
  );

  const explicitCopyPath = `${USER_DOCUMENTS_PATH}\\Explicit Copy.txt`;
  assert.equal(state.copyAs(copySourcePath, explicitCopyPath), true);
  assert.equal(
    state.resolve(explicitCopyPath)?.modified,
    sourceFile.modified,
  );
  const automaticCopyName = state.copyTo(copySourcePath, USER_DOCUMENTS_PATH);
  assert.ok(automaticCopyName);
  assert.equal(
    state.resolve(`${USER_DOCUMENTS_PATH}\\${automaticCopyName}`)?.modified,
    sourceFile.modified,
  );

  assert.equal(state.remove(copiedFolderPath), true);
  assert.equal(state.remove(explicitCopyPath), true);
  assert.equal(
    state.remove(`${USER_DOCUMENTS_PATH}\\${automaticCopyName}`),
    true,
  );
  assert.equal(state.remove(copyFixturePath), true);
} finally {
  Date.now = originalDateNow;
}

const temporaryPath = `${USER_DOCUMENTS_PATH}\\migration-check-v19.txt`;

assert.equal(state.writeFile(temporaryPath, "preserve me across migration"), true);
assert.equal(state.moveToRecycleBin(temporaryPath), true);

const before = useVfsStore.getState();
assert.equal(before.recycled.length, 1, "fixture must have one Recycle Bin item");
const recycledItem = before.recycled[0];
const recycledPath = `C:\\Recycled\\${recycledItem.storageName}`;
const indexPath = "C:\\Recycled\\INFO2";
const beforePayload = findNode(before.root, recycledPath);
const beforeIndex = findNode(before.root, indexPath);
assert.ok(beforePayload, "fixture payload must already live in C:\\Recycled");
assert.ok(beforeIndex?.content, "fixture must include its populated INFO2 index");

// v20 had only these two stock items. Keep any other profile-created targets
// while removing only the two defaults introduced by v21.
const sendTo = findNode(before.root, USER_SEND_TO_PATH);
assert.ok(sendTo?.children);
const legacyDefaults = new Set([
  "desktop (create shortcut).desklink",
  "my documents.lnk",
]);
const v19SendToChildren = sendTo.children.filter(
  (entry) =>
    legacyDefaults.has(entry.name.toLowerCase()) ||
    ![
      "3½ floppy (a:).lnk",
      "mail recipient.mapimail",
    ].includes(entry.name.toLowerCase()),
);
v19SendToChildren.push({
  name: "Archive",
  type: "dir",
  children: [],
  system: false,
  protected: false,
  created: Date.now(),
});
const withV19SendTo = replaceNodeAtPath(
  before.root,
  USER_SEND_TO_PATH,
  (node) => ({ ...node, children: v19SendToChildren }),
);

const migrate = useVfsStore.persist.getOptions().migrate;
assert.equal(typeof migrate, "function");
for (const version of [19, 20]) {
  const migrated = await migrate(
    {
      root: withV19SendTo,
      cwd: USER_DOCUMENTS_PATH,
      recycled: before.recycled,
    },
    version,
  );

  const afterPayload = findNode(migrated.root, recycledPath);
  const afterIndex = findNode(migrated.root, indexPath);
  assert.deepEqual(migrated.recycled, before.recycled, "Recycle Bin metadata changed");
  assert.equal(afterPayload?.content, beforePayload.content, "recycled file data changed");
  assert.equal(afterPayload?.name, beforePayload.name, "recycled storage name changed");
  assert.equal(afterIndex?.content, beforeIndex.content, "INFO2 bytes changed");

  const migratedSendTo = findNode(migrated.root, USER_SEND_TO_PATH);
  const names = new Set(
    (migratedSendTo?.children ?? []).map((entry) => entry.name.toLowerCase()),
  );
  for (const required of [
    "3½ floppy (a:).lnk",
    "desktop (create shortcut).desklink",
    "mail recipient.mapimail",
    "my documents.lnk",
    "archive",
  ]) {
    assert.ok(names.has(required), `migration lost SendTo entry: ${required}`);
  }

  const floppy = migratedSendTo.children.find(
    (entry) => entry.name.toLowerCase() === "3½ floppy (a:).lnk",
  );
  const mail = migratedSendTo.children.find(
    (entry) => entry.name.toLowerCase() === "mail recipient.mapimail",
  );
  const documents = findNode(migrated.root, `${USER_DOCUMENTS_PATH}\\bio.txt`);
  assert.ok(floppy && mail && documents);
  assert.equal(isSendToMenuEntry(floppy), true);
  assert.equal(sendToMenuLabel(mail), "Mail Recipient");
  const source = { node: documents, path: `${USER_DOCUMENTS_PATH}\\bio.txt` };
  assert.match(dispatchSendToEntry(floppy, [source]).message, /drive A:/);
  assert.match(dispatchSendToEntry(mail, [source]).message, /e-mail program/i);
}

console.log("VFS safety, copy timestamps, and v19/v20 → v21 migration checks passed.");
process.exit(0);

function findNode(root, path) {
  const parts = path.slice(3).split(/[\\/]+/).filter(Boolean);
  let node = root;
  for (const part of parts) {
    node = node?.children?.find((child) => child.name.toLowerCase() === part.toLowerCase());
    if (!node) return null;
  }
  return node;
}

function replaceNodeAtPath(root, path, update) {
  const parts = path.slice(3).split(/[\\/]+/).filter(Boolean);
  function visit(node, depth) {
    if (depth === parts.length) return update(node);
    return {
      ...node,
      children: node.children.map((child) =>
        child.name.toLowerCase() === parts[depth].toLowerCase()
          ? visit(child, depth + 1)
          : child,
      ),
    };
  }
  return visit(root, 0);
}
