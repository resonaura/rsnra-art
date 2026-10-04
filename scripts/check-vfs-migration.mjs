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

const [{ useVfsStore }, { dispatchSendToEntry, isSendToMenuEntry, sendToMenuLabel }, paths] =
  await Promise.all([
    import("../src/store/vfsStore.ts"),
    import("../src/lib/sendTo.ts"),
    import("../src/lib/windowsPaths.ts"),
  ]);

const { USER_DOCUMENTS_PATH, USER_PROFILE_PATH, USER_SEND_TO_PATH } = paths;
const state = useVfsStore.getState();

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

console.log("VFS v19/v20 → v21 migration preserves populated Recycle Bin data and SendTo defaults.");
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
