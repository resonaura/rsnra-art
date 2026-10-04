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
  { isVfsNodeVisible },
  { useFilePrefsStore },
  { matchesDosAttributeSelector, parseDosAttributeSelector },
  { executeLine },
  { Shell },
] =
  await Promise.all([
    import("../src/store/vfsStore.ts"),
    import("../src/lib/sendTo.ts"),
    import("../src/lib/windowsPaths.ts"),
    import("../src/lib/shellFolders.ts"),
    import("../src/lib/fileVisibility.ts"),
    import("../src/store/filePrefsStore.ts"),
    import("../src/lib/dosAttributes.ts"),
    import("../src/apps/Terminal/commands.ts"),
    import("../src/apps/Terminal/shell.ts"),
  ]);

const {
  COMMON_DESKTOP_PATH,
  USER_DOCUMENTS_PATH,
  USER_PROFILE_PATH,
  USER_SEND_TO_PATH,
} = paths;
const state = useVfsStore.getState();
const filePrefs = useFilePrefsStore.getState();
assert.equal(filePrefs.showHidden, true);
assert.equal(filePrefs.hideProtectedSystemFiles, false);

assert.equal(isVfsNodeVisible({ hidden: true, system: true }, true, false), true);
assert.equal(isVfsNodeVisible({ hidden: true, system: true }, true, true), false);
assert.equal(isVfsNodeVisible({ hidden: true }, true, true), true);
assert.equal(isVfsNodeVisible({ hidden: true }, false, false), false);
assert.equal(isVfsNodeVisible({ system: true }, true, true), true);

const dosAttributes = [
  { name: "plain.txt", type: "file", archive: true },
  { name: "hidden.txt", type: "file", hidden: true, archive: true },
  { name: "system.txt", type: "file", system: true, archive: true },
  { name: "readonly.txt", type: "file", readonly: true, archive: true },
  { name: "System Folder", type: "dir", system: true },
];
const parseDos = (value) => parseDosAttributeSelector(value);
assert.equal(parseDos("/A-Z"), null);
assert.equal(parseDos("/A:H-"), null);
assert.deepEqual(parseDos("/A"), { include: [], exclude: [] });
assert.deepEqual(parseDos("/a:sh"), { include: ["S", "H"], exclude: [] });
assert.deepEqual(parseDos("/A:H-S"), { include: ["H"], exclude: ["S"] });
assert.deepEqual(parseDos("/A:-H-S"), { include: [], exclude: ["H", "S"] });
assert.deepEqual(parseDos("/A:D"), { include: ["D"], exclude: [] });
assert.equal(parseDos("/A:H--S"), null);
assert.equal(
  parseDosAttributeSelector("/A:D", { allowDirectories: false }),
  null,
);
assert.deepEqual(
  dosAttributes
    .filter((node) => matchesDosAttributeSelector(node, null))
    .map((node) => node.name),
  ["plain.txt", "readonly.txt"],
);
assert.deepEqual(
  dosAttributes
    .filter((node) => matchesDosAttributeSelector(node, parseDos("/A")))
    .map((node) => node.name),
  dosAttributes.map((node) => node.name),
);
assert.deepEqual(
  dosAttributes
    .filter((node) => matchesDosAttributeSelector(node, parseDos("/A:H-S")))
    .map((node) => node.name),
  ["hidden.txt"],
);
assert.deepEqual(
  dosAttributes
    .filter((node) => matchesDosAttributeSelector(node, parseDos("/A:D")))
    .map((node) => node.name),
  ["System Folder"],
);

// Exercise the selectors through the same Terminal dispatcher used by the UI.
const commandFixture = "C:\\DOS Attribute Regression";
assert.equal(state.mkdir(commandFixture), true);
for (const name of [
  "plain.txt",
  "hidden.txt",
  "hidden-system.txt",
  "system.txt",
  "readonly.txt",
  "README",
  "Long regression filename.txt",
]) {
  assert.equal(state.writeFile(`${commandFixture}\\${name}`, name), true);
}
assert.equal(state.mkdir(`${commandFixture}\\Folder`), true);
assert.equal(state.mkdir(`${commandFixture}\\Folder\\Nested`), true);
assert.equal(
  state.setAttributes(`${commandFixture}\\hidden.txt`, { hidden: true }),
  true,
);
assert.equal(
  state.setAttributes(`${commandFixture}\\system.txt`, { system: true }),
  true,
);
assert.equal(
  state.setAttributes(`${commandFixture}\\hidden-system.txt`, {
    hidden: true,
    system: true,
  }),
  true,
);
assert.equal(
  state.setAttributes(`${commandFixture}\\readonly.txt`, { readonly: true }),
  true,
);
assert.equal(
  state.writeFile(`${commandFixture}\\Folder\\Nested\\Deep note.txt`, "deep"),
  true,
);
assert.equal(state.writeFile(`${commandFixture}\\root.tmp`, "root temp"), true);
assert.equal(
  state.writeFile(`${commandFixture}\\Folder\\Nested\\deep.tmp`, "nested temp"),
  true,
);

const attribFixture = "C:\\ATTRIB recursion regression";
assert.equal(state.mkdir(attribFixture), true);
assert.equal(state.mkdir(`${attribFixture}\\Alpha`), true);
assert.equal(state.mkdir(`${attribFixture}\\Alpha\\Nested`), true);
assert.equal(state.writeFile(`${attribFixture}\\root.txt`, "root"), true);
assert.equal(
  state.writeFile(`${attribFixture}\\Alpha\\Nested\\deep.txt`, "deep"),
  true,
);

const renFixture = "C:\\REN wildcard regression";
assert.equal(state.mkdir(renFixture), true);
for (const [name, content] of [
  ["alpha.txt", "alpha"],
  ["beta.txt", "beta"],
  ["blocked.txt", "blocked source"],
  ["blocked.doc", "existing destination"],
  ["img001.jpg", "image"],
]) {
  assert.equal(state.writeFile(`${renFixture}\\${name}`, content), true);
}

const runTerminalCommand = async (command, options = {}) => {
  const output = [];
  let errorLevel = 0;
  const vars = options.vars ?? {};
  await executeLine(command, {
    vfs: state,
    print: (lines, kind = "output") => output.push({ lines, kind }),
    clear: () => {},
    closeWindow: () => {},
    windowId: "vfs-regression",
    enterNano: () => {},
    vars,
    inBatch: options.inBatch,
    setVar: (name, value) => {
      vars[name] = value;
    },
    setTitle: () => {},
    setPromptStr: () => {},
    promptStr: "$P$G",
    errorLevel,
    confirm: options.confirm,
    setErrorLevel: (value) => {
      errorLevel = value;
    },
  });
  return { text: output.flatMap((entry) => entry.lines).join("\n"), errorLevel };
};

const recursiveAttrib = await runTerminalCommand(
  `attrib +h /s "${attribFixture}\\*"`,
);
assert.equal(recursiveAttrib.errorLevel, 0);
assert.equal(state.resolve(`${attribFixture}\\root.txt`)?.hidden, true);
assert.equal(
  state.resolve(`${attribFixture}\\Alpha\\Nested\\deep.txt`)?.hidden,
  true,
);
assert.equal(!!state.resolve(`${attribFixture}\\Alpha`)?.hidden, false);
assert.equal(useVfsStore.getState().undoDescription, "Change file attributes");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(!!state.resolve(`${attribFixture}\\root.txt`)?.hidden, false);
assert.equal(
  !!state.resolve(`${attribFixture}\\Alpha\\Nested\\deep.txt`)?.hidden,
  false,
);
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.resolve(`${attribFixture}\\root.txt`)?.hidden, true);

const recursiveAttribDirectories = await runTerminalCommand(
  `attrib +s /s /d "${attribFixture}\\*"`,
);
assert.equal(recursiveAttribDirectories.errorLevel, 0);
assert.equal(state.resolve(`${attribFixture}\\Alpha`)?.system, true);
assert.equal(state.resolve(`${attribFixture}\\Alpha\\Nested`)?.system, true);
assert.equal(
  state.resolve(`${attribFixture}\\Alpha\\Nested\\deep.txt`)?.system,
  true,
);
assert.equal(useVfsStore.getState().undoDescription, "Change file attributes");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.resolve(`${attribFixture}\\Alpha`)?.system, false);
assert.equal(
  state.resolve(`${attribFixture}\\Alpha\\Nested\\deep.txt`)?.system,
  false,
);
assert.equal(useVfsStore.getState().redo(), true);
const clearRecursiveAttrib = await runTerminalCommand(
  `attrib -h -s /s /d "${attribFixture}\\*"`,
);
assert.equal(clearRecursiveAttrib.errorLevel, 0);
assert.equal(state.resolve(`${attribFixture}\\Alpha`)?.system, false);
assert.equal(!!state.resolve(`${attribFixture}\\root.txt`)?.hidden, false);

const wildcardRename = await runTerminalCommand(
  `ren "${renFixture}\\*.txt" "*.doc"`,
);
assert.equal(wildcardRename.errorLevel, 1);
assert.equal(state.read(`${renFixture}\\alpha.doc`), "alpha");
assert.equal(state.read(`${renFixture}\\beta.doc`), "beta");
assert.equal(state.read(`${renFixture}\\blocked.txt`), "blocked source");
assert.equal(state.read(`${renFixture}\\blocked.doc`), "existing destination");
assert.equal(useVfsStore.getState().undoDescription, "Rename files");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.exists(`${renFixture}\\alpha.doc`), false);
assert.equal(state.exists(`${renFixture}\\beta.doc`), false);
assert.equal(state.exists(`${renFixture}\\alpha.txt`), true);
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.exists(`${renFixture}\\alpha.doc`), true);

const positionalRename = await runTerminalCommand(
  `ren "${renFixture}\\img*.jpg" "photo*.jpg"`,
);
assert.equal(positionalRename.errorLevel, 0);
assert.equal(state.read(`${renFixture}\\photo1.jpg`), "image");
assert.equal(state.exists(`${renFixture}\\img001.jpg`), false);

class MemoryTerminal {
  output = "";
  listeners = new Set();
  options = { theme: {} };

  onData(listener) {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  onResize() {
    return { dispose: () => {} };
  }

  write(value) {
    this.output += value;
  }

  writeln(value) {
    this.write(`${value}\r\n`);
  }

  clear() {
    this.output = "";
  }

  send(value) {
    for (const character of value) {
      for (const listener of this.listeners) listener(character);
    }
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const defaultDir = await runTerminalCommand(`dir /b "${commandFixture}"`);
assert.deepEqual(
  defaultDir.text.split("\n").sort(),
  [
    "Folder",
    "Long regression filename.txt",
    "plain.txt",
    "readonly.txt",
    "README",
    "root.tmp",
  ].sort(),
);
const allDir = await runTerminalCommand(`dir /b /a "${commandFixture}"`);
assert.deepEqual(
  allDir.text.split("\n").sort(),
  [
    "Folder",
    "hidden-system.txt",
    "hidden.txt",
    "Long regression filename.txt",
    "plain.txt",
    "readonly.txt",
    "README",
    "root.tmp",
    "system.txt",
  ].sort(),
);
const hiddenDir = await runTerminalCommand(`dir /b /a:h "${commandFixture}"`);
assert.deepEqual(
  hiddenDir.text.split("\n").sort(),
  ["hidden.txt", "hidden-system.txt"].sort(),
);
const hiddenFileWithoutAttributes = await runTerminalCommand(
  `dir /b "${commandFixture}\\hidden.txt"`,
);
assert.equal(hiddenFileWithoutAttributes.text, "File Not Found");
const hiddenFileWithAttributes = await runTerminalCommand(
  `dir /b /a:h "${commandFixture}\\hidden.txt"`,
);
assert.equal(hiddenFileWithAttributes.text, "hidden.txt");
const foldersDir = await runTerminalCommand(`dir /b /a:d "${commandFixture}"`);
assert.equal(foldersDir.text, "Folder");
const textFilesDir = await runTerminalCommand(`dir /b "${commandFixture}\\*.txt"`);
assert.deepEqual(
  textFilesDir.text.split("\n").sort(),
  ["Long regression filename.txt", "plain.txt", "readonly.txt"].sort(),
);
const filteredTextFilesDir = await runTerminalCommand(
  `dir /b /a:h-s "${commandFixture}\\*.txt"`,
);
assert.equal(filteredTextFilesDir.text, "hidden.txt");
const everyNameDir = await runTerminalCommand(`dir /b /a "${commandFixture}\\*.*"`);
assert.deepEqual(
  everyNameDir.text.split("\n").sort(),
  [
    "Folder",
    "Long regression filename.txt",
    "README",
    "hidden-system.txt",
    "hidden.txt",
    "plain.txt",
    "readonly.txt",
    "system.txt",
    "root.tmp",
  ].sort(),
);
const exactFileDir = await runTerminalCommand(`dir /b "${commandFixture}\\plain.txt"`);
assert.equal(exactFileDir.text, "plain.txt");
const missingFileDir = await runTerminalCommand(`dir /b "${commandFixture}\\missing.bin"`);
assert.equal(missingFileDir.errorLevel, 1);
assert.equal(missingFileDir.text, "File Not Found");
const longFilePath = `${commandFixture}\\Long regression filename.txt`;
const longFileAlias = state.getShortName(longFilePath);
assert.ok(longFileAlias && longFileAlias !== "Long regression filename.txt");
const shortAliasDir = await runTerminalCommand(`dir /b "${commandFixture}\\${longFileAlias}"`);
assert.equal(shortAliasDir.text, "Long regression filename.txt");
const recursiveDir = await runTerminalCommand(`dir /b /s /a "${commandFixture}"`);
assert.deepEqual(
  recursiveDir.text.split("\n").sort(),
  [
    `${commandFixture}\\Folder`,
    `${commandFixture}\\Folder\\Nested`,
    `${commandFixture}\\Folder\\Nested\\Deep note.txt`,
    `${commandFixture}\\Long regression filename.txt`,
    `${commandFixture}\\README`,
    `${commandFixture}\\hidden-system.txt`,
    `${commandFixture}\\hidden.txt`,
    `${commandFixture}\\plain.txt`,
    `${commandFixture}\\readonly.txt`,
    `${commandFixture}\\system.txt`,
    `${commandFixture}\\root.tmp`,
    `${commandFixture}\\Folder\\Nested\\deep.tmp`,
  ].sort(),
);
const recursiveTextFiles = await runTerminalCommand(
  `dir /b /s "${commandFixture}\\*.txt"`,
);
assert.deepEqual(
  recursiveTextFiles.text.split("\n").sort(),
  [
    `${commandFixture}\\Folder\\Nested\\Deep note.txt`,
    `${commandFixture}\\Long regression filename.txt`,
    `${commandFixture}\\plain.txt`,
    `${commandFixture}\\readonly.txt`,
  ].sort(),
);
const recursiveDirectories = await runTerminalCommand(
  `dir /b /s /a:d "${commandFixture}"`,
);
assert.deepEqual(
  recursiveDirectories.text.split("\n").sort(),
  [`${commandFixture}\\Folder`, `${commandFixture}\\Folder\\Nested`].sort(),
);
const recursiveSummary = await runTerminalCommand(`dir /s /a "${commandFixture}"`);
assert.ok(recursiveSummary.text.includes(`Directory of ${commandFixture}\\Folder\\Nested`));
assert.ok(recursiveSummary.text.includes("Total Files Listed:"));
const recursiveMiss = await runTerminalCommand(
  `dir /b /s "${commandFixture}\\*.missing"`,
);
assert.equal(recursiveMiss.text, "File Not Found");

const sortFixture = `${commandFixture}\\Sort fixture`;
assert.equal(state.mkdir(sortFixture), true);
assert.equal(state.mkdir(`${sortFixture}\\Alpha`), true);
assert.equal(state.mkdir(`${sortFixture}\\Zulu`), true);
assert.equal(state.writeFile(`${sortFixture}\\Alpha\\inner-a.txt`, "a"), true);
assert.equal(state.writeFile(`${sortFixture}\\Zulu\\inner-z.txt`, "z"), true);
assert.equal(state.writeFile(`${sortFixture}\\zeta.txt`, "123456789"), true);
assert.equal(state.writeFile(`${sortFixture}\\alpha.bin`, "1"), true);
assert.equal(state.writeFile(`${sortFixture}\\beta.txt`, "22"), true);
for (const [name, timestamp] of [
  ["Alpha", 40],
  ["Zulu", 10],
  ["zeta.txt", 50],
  ["alpha.bin", 20],
  ["beta.txt", 30],
]) {
  const node = state.resolve(`${sortFixture}\\${name}`);
  assert.ok(node);
  node.modified = timestamp;
  node.created = timestamp;
  node.accessed = 60 - timestamp;
}
const sortAll = (options) =>
  runTerminalCommand(`dir /b /a ${options} "${sortFixture}"`);
assert.equal(
  (await sortAll("/o:n")).text,
  "Alpha\nalpha.bin\nbeta.txt\nzeta.txt\nZulu",
);
assert.equal(
  (await sortAll("/o")).text,
  "Alpha\nZulu\nalpha.bin\nbeta.txt\nzeta.txt",
);
assert.equal(
  (await sortAll("/o:gn")).text,
  "Alpha\nZulu\nalpha.bin\nbeta.txt\nzeta.txt",
);
assert.equal(
  (await sortAll("/oe")).text,
  "Alpha\nZulu\nalpha.bin\nbeta.txt\nzeta.txt",
);
assert.equal(
  (await sortAll("/o:s")).text,
  "Alpha\nZulu\nalpha.bin\nbeta.txt\nzeta.txt",
);
assert.equal(
  (await sortAll("/o:-s")).text,
  "zeta.txt\nbeta.txt\nalpha.bin\nAlpha\nZulu",
);
assert.equal(
  (await sortAll("/o:d")).text,
  "Zulu\nalpha.bin\nbeta.txt\nAlpha\nzeta.txt",
);
assert.equal(
  (await runTerminalCommand(
    `dir /b /a /o:d /t:c "${sortFixture}"`,
  )).text,
  "Zulu\nalpha.bin\nbeta.txt\nAlpha\nzeta.txt",
);
assert.equal(
  (await runTerminalCommand(
    `dir /b /a /o:d /t:w "${sortFixture}"`,
  )).text,
  "Zulu\nalpha.bin\nbeta.txt\nAlpha\nzeta.txt",
);
assert.equal(
  (await runTerminalCommand(
    `dir /b /a /o:d /t:a "${sortFixture}"`,
  )).text,
  "zeta.txt\nAlpha\nbeta.txt\nalpha.bin\nZulu",
);
assert.deepEqual(
  (
    await runTerminalCommand(
      `dir /b /s /a /o:d /t:a "${sortFixture}"`,
    )
  ).text.split("\n"),
  [
    `${sortFixture}\\zeta.txt`,
    `${sortFixture}\\Alpha`,
    `${sortFixture}\\beta.txt`,
    `${sortFixture}\\alpha.bin`,
    `${sortFixture}\\Zulu`,
    `${sortFixture}\\Alpha\\inner-a.txt`,
    `${sortFixture}\\Zulu\\inner-z.txt`,
  ],
);
assert.equal(
  (await sortAll("/o:-d")).text,
  "zeta.txt\nAlpha\nbeta.txt\nalpha.bin\nZulu",
);
const creationListing = await runTerminalCommand(
  `dir /t:c "${sortFixture}\\alpha.bin"`,
);
const creationLine = creationListing.text
  .split("\n")
  .find((line) => line.endsWith("alpha.bin"));
assert.ok(creationLine);
const creationDate = new Date(20);
const creationStamp = [
  String(creationDate.getMonth() + 1).padStart(2, "0"),
  String(creationDate.getDate()).padStart(2, "0"),
  String(creationDate.getFullYear()).slice(-2),
].join("/") +
  `  ${String(creationDate.getHours() % 12 || 12).padStart(2, "0")}:${String(creationDate.getMinutes()).padStart(2, "0")} ${creationDate.getHours() >= 12 ? "PM" : "AM"}`;
assert.equal(creationLine.slice(0, creationStamp.length), creationStamp);
assert.equal(
  (await sortAll("/o:e-s")).text,
  "Alpha\nZulu\nalpha.bin\nzeta.txt\nbeta.txt",
);
const recursiveSorted = await runTerminalCommand(
  `dir /b /s /a /o:-n "${sortFixture}"`,
);
assert.deepEqual(recursiveSorted.text.split("\n"), [
  `${sortFixture}\\Zulu`,
  `${sortFixture}\\zeta.txt`,
  `${sortFixture}\\beta.txt`,
  `${sortFixture}\\alpha.bin`,
  `${sortFixture}\\Alpha`,
  `${sortFixture}\\Zulu\\inner-z.txt`,
  `${sortFixture}\\Alpha\\inner-a.txt`,
]);
const invalidDirSort = await sortAll("/o:n-z");
assert.equal(invalidDirSort.errorLevel, 1);
assert.equal(invalidDirSort.text, "Invalid sort order specification.");
const invalidDirTime = await runTerminalCommand(
  `dir /t:z "${sortFixture}"`,
);
assert.equal(invalidDirTime.errorLevel, 1);
assert.equal(invalidDirTime.text, "Invalid time field specification.");

const copyTarget = `${commandFixture}\\CopyTarget`;
assert.equal(state.mkdir(copyTarget), true);
assert.equal(state.writeFile(`${commandFixture}\\copy-one.dat`, "one"), true);
assert.equal(state.writeFile(`${commandFixture}\\copy-two.dat`, "two"), true);
const wildcardCopy = await runTerminalCommand(
  `copy "${commandFixture}\\copy-*.dat" "${copyTarget}"`,
);
assert.equal(wildcardCopy.errorLevel, 0);
assert.equal(wildcardCopy.text, "        2 file(s) copied.");
assert.equal(state.read(`${copyTarget}\\copy-one.dat`), "one");
assert.equal(state.read(`${copyTarget}\\copy-two.dat`), "two");
assert.equal(useVfsStore.getState().undoDescription, "Copy files");
assert.equal(useVfsStore.getState().undo(), true);
assert.deepEqual(state.list(copyTarget), []);
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.read(`${copyTarget}\\copy-one.dat`), "one");
assert.equal(state.read(`${copyTarget}\\copy-two.dat`), "two");

const longCopySource = `${commandFixture}\\Long regression filename.txt`;
const shortCopyName = state.getShortName(longCopySource);
assert.ok(shortCopyName && shortCopyName !== "Long regression filename.txt");
const shortCopyPath = `${copyTarget}\\${shortCopyName}`;
const shortNameCopy = await runTerminalCommand(
  `copy /n "${longCopySource}" "${copyTarget}"`,
);
assert.equal(shortNameCopy.errorLevel, 0);
assert.equal(shortNameCopy.text, "        1 file(s) copied.");
assert.equal(state.resolve(shortCopyPath)?.name, shortCopyName);
assert.equal(state.read(shortCopyPath), state.read(longCopySource));
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.exists(shortCopyPath), false);
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.exists(shortCopyPath), true);
const explicitCopyNamePath = `${copyTarget}\\chosen-name.txt`;
const explicitShortCopy = await runTerminalCommand(
  `copy /n "${longCopySource}" "${explicitCopyNamePath}"`,
);
assert.equal(explicitShortCopy.errorLevel, 0);
assert.equal(state.resolve(explicitCopyNamePath)?.name, "chosen-name.txt");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.exists(explicitCopyNamePath), false);
const plainCopyPath = `${copyTarget}\\plain.txt`;
const plainShortCopy = await runTerminalCommand(
  `copy /n "${commandFixture}\\plain.txt" "${copyTarget}"`,
);
assert.equal(plainShortCopy.errorLevel, 0);
assert.equal(state.resolve(plainCopyPath)?.name, "plain.txt");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.exists(plainCopyPath), false);
assert.equal(useVfsStore.getState().redo(), true);
const declinedShortOverwriteQuestions = [];
const declinedShortOverwrite = await runTerminalCommand(
  `copy /n "${longCopySource}" "${copyTarget}"`,
  {
    confirm: async (question) => {
      declinedShortOverwriteQuestions.push(question);
      return false;
    },
  },
);
assert.equal(declinedShortOverwrite.errorLevel, 0);
assert.deepEqual(declinedShortOverwriteQuestions, [
  `Overwrite ${shortCopyPath}? (Y/N)`,
]);

const copyOnePath = `${commandFixture}\\copy-one.dat`;
const copiedOnePath = `${copyTarget}\\copy-one.dat`;
assert.equal(state.writeFile(copyOnePath, "updated-one"), true);
const declinedCopyPrompts = [];
const declinedCopy = await runTerminalCommand(
  `copy "${copyOnePath}" "${copyTarget}"`,
  {
    confirm: async (question) => {
      declinedCopyPrompts.push(question);
      return false;
    },
  },
);
assert.equal(declinedCopy.errorLevel, 0);
assert.equal(declinedCopy.text, "        0 file(s) copied.");
assert.deepEqual(declinedCopyPrompts, [`Overwrite ${copiedOnePath}? (Y/N)`]);
assert.equal(state.read(copiedOnePath), "one");
const acceptedCopy = await runTerminalCommand(
  `copy "${copyOnePath}" "${copyTarget}"`,
  { confirm: async () => true },
);
assert.equal(acceptedCopy.errorLevel, 0);
assert.equal(state.read(copiedOnePath), "updated-one");
assert.equal(useVfsStore.getState().undoDescription, "Copy");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.read(copiedOnePath), "one");
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.read(copiedOnePath), "updated-one");

assert.equal(state.writeFile(copyOnePath, "copy-y"), true);
let copyYPromptCount = 0;
const quietCopy = await runTerminalCommand(
  `copy /y "${copyOnePath}" "${copyTarget}"`,
  {
    confirm: async () => {
      copyYPromptCount++;
      return false;
    },
  },
);
assert.equal(quietCopy.errorLevel, 0);
assert.equal(copyYPromptCount, 0);
assert.equal(state.read(copiedOnePath), "copy-y");

assert.equal(state.writeFile(copyOnePath, "copycmd-y"), true);
let copyCmdPromptCount = 0;
await runTerminalCommand(`copy "${copyOnePath}" "${copyTarget}"`, {
  vars: { copycmd: "/Y" },
  confirm: async () => {
    copyCmdPromptCount++;
    return false;
  },
});
assert.equal(copyCmdPromptCount, 0);
assert.equal(state.read(copiedOnePath), "copycmd-y");

assert.equal(state.writeFile(copyOnePath, "copy-minus-y"), true);
const copyMinusY = await runTerminalCommand(
  `copy /-y "${copyOnePath}" "${copyTarget}"`,
  { vars: { COPYCMD: "/Y" }, confirm: async () => true },
);
assert.equal(copyMinusY.errorLevel, 0);
assert.match(copyMinusY.text, /1 file\(s\) copied\./);
assert.equal(state.read(copiedOnePath), "copy-minus-y");

assert.equal(state.writeFile(copyOnePath, "wildcard-one"), true);
assert.equal(state.writeFile(`${commandFixture}\\copy-two.dat`, "wildcard-two"), true);
const wildcardCopyAnswers = [true, false];
const wildcardOverwrite = await runTerminalCommand(
  `copy /-y "${commandFixture}\\copy-*.dat" "${copyTarget}"`,
  { confirm: async () => wildcardCopyAnswers.shift() },
);
assert.equal(wildcardOverwrite.errorLevel, 0);
assert.equal(wildcardOverwrite.text, "        1 file(s) copied.");
assert.equal(state.read(copiedOnePath), "wildcard-one");
assert.equal(state.read(`${copyTarget}\\copy-two.dat`), "two");
assert.equal(useVfsStore.getState().undoDescription, "Copy files");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.read(copiedOnePath), "copy-minus-y");
assert.equal(state.read(`${copyTarget}\\copy-two.dat`), "two");
assert.equal(useVfsStore.getState().redo(), true);

assert.equal(state.writeFile(copyOnePath, "batch-overwrite"), true);
const batchCopyPath = `${commandFixture}\\copy-overwrite.bat`;
assert.equal(
  state.writeFile(
    batchCopyPath,
    `@echo off\ncopy "${copyOnePath}" "${copyTarget}"`,
  ),
  true,
);
let batchCopyPromptCount = 0;
const batchCopy = await runTerminalCommand(`"${batchCopyPath}"`, {
  confirm: async () => {
    batchCopyPromptCount++;
    return false;
  },
});
assert.equal(batchCopy.errorLevel, 0);
assert.equal(batchCopyPromptCount, 0);
assert.equal(state.read(copiedOnePath), "batch-overwrite");

const moveTarget = `${commandFixture}\\MoveTarget`;
assert.equal(state.mkdir(moveTarget), true);
assert.equal(state.writeFile(`${commandFixture}\\move-one.dat`, "one"), true);
assert.equal(state.writeFile(`${commandFixture}\\move-two.dat`, "two"), true);
const wildcardMove = await runTerminalCommand(
  `move "${commandFixture}\\move-*.dat" "${moveTarget}"`,
);
assert.equal(wildcardMove.errorLevel, 0);
assert.equal(wildcardMove.text, "        2 file(s) moved.");
assert.equal(state.exists(`${commandFixture}\\move-one.dat`), false);
assert.equal(state.exists(`${commandFixture}\\move-two.dat`), false);
assert.equal(state.read(`${moveTarget}\\move-one.dat`), "one");
assert.equal(state.read(`${moveTarget}\\move-two.dat`), "two");
assert.equal(useVfsStore.getState().undoDescription, "Move files");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.exists(`${commandFixture}\\move-one.dat`), true);
assert.equal(state.exists(`${commandFixture}\\move-two.dat`), true);
assert.equal(state.list(moveTarget).length, 0);
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.read(`${moveTarget}\\move-one.dat`), "one");
assert.equal(state.read(`${moveTarget}\\move-two.dat`), "two");

const moveOnePath = `${commandFixture}\\move-one.dat`;
const movedOnePath = `${moveTarget}\\move-one.dat`;
assert.equal(state.writeFile(moveOnePath, "replacement-one"), true);
const declinedMovePrompts = [];
const declinedMove = await runTerminalCommand(
  `move "${moveOnePath}" "${moveTarget}"`,
  {
    confirm: async (question) => {
      declinedMovePrompts.push(question);
      return false;
    },
  },
);
assert.equal(declinedMove.errorLevel, 0);
assert.equal(state.exists(moveOnePath), true);
assert.equal(state.read(movedOnePath), "one");
assert.deepEqual(declinedMovePrompts, [`Overwrite ${movedOnePath}? (Y/N)`]);
const acceptedMove = await runTerminalCommand(
  `move "${moveOnePath}" "${moveTarget}"`,
  { confirm: async () => true },
);
assert.equal(acceptedMove.errorLevel, 0);
assert.equal(acceptedMove.text, "        1 file(s) moved.");
assert.equal(state.exists(moveOnePath), false);
assert.equal(state.read(movedOnePath), "replacement-one");
assert.equal(useVfsStore.getState().undoDescription, "Move");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.read(moveOnePath), "replacement-one");
assert.equal(state.read(movedOnePath), "one");
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.read(movedOnePath), "replacement-one");

assert.equal(state.writeFile(moveOnePath, "move-y"), true);
let moveYPromptCount = 0;
const quietMove = await runTerminalCommand(
  `move /y "${moveOnePath}" "${moveTarget}"`,
  {
    confirm: async () => {
      moveYPromptCount++;
      return false;
    },
  },
);
assert.equal(quietMove.errorLevel, 0);
assert.equal(moveYPromptCount, 0);
assert.equal(state.exists(moveOnePath), false);
assert.equal(state.read(movedOnePath), "move-y");

assert.equal(state.writeFile(moveOnePath, "move-copycmd"), true);
let moveCopyCmdPromptCount = 0;
await runTerminalCommand(`move "${moveOnePath}" "${moveTarget}"`, {
  vars: { copycmd: "/Y" },
  confirm: async () => {
    moveCopyCmdPromptCount++;
    return false;
  },
});
assert.equal(moveCopyCmdPromptCount, 0);
assert.equal(state.exists(moveOnePath), false);
assert.equal(state.read(movedOnePath), "move-copycmd");

assert.equal(state.writeFile(moveOnePath, "wild-move-one"), true);
assert.equal(state.writeFile(`${commandFixture}\\move-two.dat`, "wild-move-two"), true);
const wildcardMoveAnswers = [true, false];
const wildcardOverwriteMove = await runTerminalCommand(
  `move /-y "${commandFixture}\\move-*.dat" "${moveTarget}"`,
  {
    vars: { COPYCMD: "/Y" },
    confirm: async () => wildcardMoveAnswers.shift(),
  },
);
assert.equal(wildcardOverwriteMove.errorLevel, 0);
assert.equal(wildcardOverwriteMove.text, "        1 file(s) moved.");
assert.equal(state.exists(moveOnePath), false);
assert.equal(state.read(movedOnePath), "wild-move-one");
assert.equal(state.read(`${commandFixture}\\move-two.dat`), "wild-move-two");
assert.equal(state.read(`${moveTarget}\\move-two.dat`), "two");
assert.equal(useVfsStore.getState().undoDescription, "Move files");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.read(moveOnePath), "wild-move-one");
assert.equal(state.read(movedOnePath), "move-copycmd");
assert.equal(state.read(`${commandFixture}\\move-two.dat`), "wild-move-two");
assert.equal(useVfsStore.getState().redo(), true);

assert.equal(state.writeFile(moveOnePath, "batch-move"), true);
const batchMovePath = `${commandFixture}\\move-overwrite.bat`;
assert.equal(
  state.writeFile(
    batchMovePath,
    `@echo off\nmove "${moveOnePath}" "${moveTarget}"`,
  ),
  true,
);
let batchMovePromptCount = 0;
await runTerminalCommand(`"${batchMovePath}"`, {
  confirm: async () => {
    batchMovePromptCount++;
    return false;
  },
});
assert.equal(batchMovePromptCount, 0);
assert.equal(state.exists(moveOnePath), false);
assert.equal(state.read(movedOnePath), "batch-move");

assert.equal((await runTerminalCommand(`del "${commandFixture}\\hidden.txt"`)).errorLevel, 1);
assert.equal(state.exists(`${commandFixture}\\hidden.txt`), true);
assert.equal((await runTerminalCommand(`del "${commandFixture}\\system.txt"`)).errorLevel, 1);
assert.equal(state.exists(`${commandFixture}\\system.txt`), true);
assert.equal(
  (await runTerminalCommand(`del /a:h-s "${commandFixture}\\*.txt"`)).errorLevel,
  0,
);
assert.equal(state.exists(`${commandFixture}\\hidden.txt`), false);
assert.equal(state.exists(`${commandFixture}\\hidden-system.txt`), true);
assert.equal(
  (await runTerminalCommand(`del /a:hs "${commandFixture}\\hidden-system.txt"`)).errorLevel,
  0,
);
assert.equal(state.exists(`${commandFixture}\\hidden-system.txt`), false);
assert.equal((await runTerminalCommand(`del /a:s "${commandFixture}\\system.txt"`)).errorLevel, 0);
assert.equal(state.exists(`${commandFixture}\\system.txt`), false);
assert.equal((await runTerminalCommand(`del /a:d "${commandFixture}\\Folder"`)).errorLevel, 1);
assert.equal(state.exists(`${commandFixture}\\Folder`), true);
assert.equal((await runTerminalCommand(`del "${commandFixture}\\readonly.txt"`)).errorLevel, 1);
assert.equal(state.exists(`${commandFixture}\\readonly.txt`), true);
assert.equal((await runTerminalCommand(`del /f /a:r "${commandFixture}\\readonly.txt"`)).errorLevel, 0);
assert.equal(state.exists(`${commandFixture}\\readonly.txt`), false);
const recursiveDelete = await runTerminalCommand(
  `del /s "${commandFixture}\\*.tmp"`,
);
assert.equal(recursiveDelete.errorLevel, 0);
assert.deepEqual(
  recursiveDelete.text.split("\n").sort(),
  [
    `Deleting ${commandFixture}\\root.tmp`,
    `Deleting ${commandFixture}\\Folder\\Nested\\deep.tmp`,
  ].sort(),
);
assert.equal(state.exists(`${commandFixture}\\root.tmp`), false);
assert.equal(state.exists(`${commandFixture}\\Folder\\Nested\\deep.tmp`), false);
assert.equal(useVfsStore.getState().undoDescription, "Delete files");
assert.equal(useVfsStore.getState().undo(), true);
assert.equal(state.exists(`${commandFixture}\\root.tmp`), true);
assert.equal(state.exists(`${commandFixture}\\Folder\\Nested\\deep.tmp`), true);
assert.equal(useVfsStore.getState().redo(), true);
assert.equal(state.exists(`${commandFixture}\\root.tmp`), false);
assert.equal(state.exists(`${commandFixture}\\Folder\\Nested\\deep.tmp`), false);

const declinedPath = `${commandFixture}\\confirm-decline.tmp`;
assert.equal(state.writeFile(declinedPath, "keep"), true);
const declinedQuestions = [];
const declinedDelete = await runTerminalCommand(`del /p "${declinedPath}"`, {
  confirm: async (question) => {
    declinedQuestions.push(question);
    return false;
  },
});
assert.equal(declinedDelete.errorLevel, 0);
assert.equal(state.exists(declinedPath), true);
assert.deepEqual(declinedQuestions, [`${declinedPath}, Delete (Y/N)?`]);

const acceptedPath = `${commandFixture}\\confirm-accept.tmp`;
assert.equal(state.writeFile(acceptedPath, "delete"), true);
const acceptedDelete = await runTerminalCommand(`del /p "${acceptedPath}"`, {
  confirm: async () => true,
});
assert.equal(acceptedDelete.errorLevel, 0);
assert.equal(state.exists(acceptedPath), false);

const noPromptPath = `${commandFixture}\\confirm-quiet.tmp`;
assert.equal(state.writeFile(noPromptPath, "delete"), true);
let quietPromptCount = 0;
await runTerminalCommand(`del /p /q "${noPromptPath}"`, {
  confirm: async () => {
    quietPromptCount++;
    return false;
  },
});
assert.equal(quietPromptCount, 0);
assert.equal(state.exists(noPromptPath), false);

const wildcardPromptA = `${commandFixture}\\confirm-wild-a.tmp`;
const wildcardPromptB = `${commandFixture}\\confirm-wild-b.tmp`;
assert.equal(state.writeFile(wildcardPromptA, "delete"), true);
assert.equal(state.writeFile(wildcardPromptB, "keep"), true);
const wildcardAnswers = [true, false];
const wildcardPrompt = await runTerminalCommand(
  `del /p "${commandFixture}\\confirm-wild-*.tmp"`,
  { confirm: async () => wildcardAnswers.shift() },
);
assert.equal(wildcardPrompt.errorLevel, 0);
assert.equal(state.exists(wildcardPromptA), false);
assert.equal(state.exists(wildcardPromptB), true);

const shellPromptPath = `${commandFixture}\\shell-confirm.tmp`;
assert.equal(state.writeFile(shellPromptPath, "delete"), true);
const memoryTerminal = new MemoryTerminal();
const testShell = new Shell(memoryTerminal, "confirm-test", () => {}, () => {});
testShell.start();
memoryTerminal.send(`del /p "${shellPromptPath}"\r`);
await tick();
assert.ok(memoryTerminal.output.includes(`${shellPromptPath}, Delete (Y/N)?`));
assert.equal(state.exists(shellPromptPath), true);
memoryTerminal.send("Y\r");
await tick();
assert.equal(state.exists(shellPromptPath), false);

assert.equal(state.writeFile(copyOnePath, "shell-copy"), true);
memoryTerminal.send(`copy /-y "${copyOnePath}" "${copyTarget}"\r`);
await tick();
assert.ok(memoryTerminal.output.includes(`Overwrite ${copiedOnePath}? (Y/N)`));
memoryTerminal.send("Y\r");
await tick();
assert.equal(state.read(copiedOnePath), "shell-copy");

const cancelledPromptA = `${commandFixture}\\shell-cancel-a.tmp`;
const cancelledPromptB = `${commandFixture}\\shell-cancel-b.tmp`;
assert.equal(state.writeFile(cancelledPromptA, "keep"), true);
assert.equal(state.writeFile(cancelledPromptB, "keep"), true);
memoryTerminal.send(`del /p "${commandFixture}\\shell-cancel-*.tmp"\r`);
await tick();
assert.ok(memoryTerminal.output.includes(`${cancelledPromptA}, Delete (Y/N)?`));
memoryTerminal.send("\x03");
await tick();
await tick();
assert.equal(state.exists(cancelledPromptA), true);
assert.equal(state.exists(cancelledPromptB), true);
assert.equal(
  memoryTerminal.output.includes(`${cancelledPromptB}, Delete (Y/N)?`),
  false,
);
testShell.destroy();

assert.equal(state.remove(commandFixture), true);

const protectedCommandPath = "C:\\WINNT\\System32\\cmd.exe";
assert.equal(state.resolve(protectedCommandPath)?.protected, true);
assert.equal((await runTerminalCommand(`del /a:s "${protectedCommandPath}"`)).errorLevel, 1);
assert.equal(state.resolve(protectedCommandPath)?.type, "file");

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

// Copy/Move must validate the resulting child path, not just its directory.
const maxPathDestination = `C:\\${"d".repeat(247)}`;
const shortPathSource = "C:\\short-path-check.txt";
assert.equal(maxPathDestination.length, 250);
assert.equal(state.mkdir(maxPathDestination), true);
assert.equal(state.writeFile(shortPathSource, "must remain in place"), true);
assert.equal(state.copy(shortPathSource, maxPathDestination), false);
assert.equal(state.move(shortPathSource, maxPathDestination), false);
assert.equal(state.copyTo(shortPathSource, maxPathDestination), null);
assert.equal(state.moveTo(shortPathSource, maxPathDestination), null);
assert.equal(state.resolve(shortPathSource)?.type, "file");
assert.deepEqual(state.list(maxPathDestination), []);

const maxRenameDirectory = `C:\\${"r".repeat(245)}`;
const renameBoundarySource = `${maxRenameDirectory}\\x`;
const overlongRenameName = "n".repeat(11);
const boundaryRenameName = "m".repeat(10);
assert.equal(maxRenameDirectory.length, 248);
assert.equal(state.mkdir(maxRenameDirectory), true);
assert.equal(state.writeFile(renameBoundarySource, "rename boundary"), true);
assert.equal(
  `${maxRenameDirectory}\\${overlongRenameName}`.length,
  260,
);
assert.equal(state.rename(renameBoundarySource, overlongRenameName), false);
assert.equal(state.resolve(renameBoundarySource)?.content, "rename boundary");
const boundaryRenamePath = `${maxRenameDirectory}\\${boundaryRenameName}`;
assert.equal(boundaryRenamePath.length, 259);
assert.equal(state.rename(renameBoundarySource, boundaryRenameName), true);
assert.equal(state.resolve(boundaryRenamePath)?.content, "rename boundary");

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

const nestedDirectoryPath = `${USER_DOCUMENTS_PATH}\\md-tree-regression\\level-one\\level-two`;
assert.equal(state.mkdirs(nestedDirectoryPath), true);
assert.equal(state.resolve(nestedDirectoryPath)?.type, "dir");
assert.equal(state.mkdirs(nestedDirectoryPath), false);
assert.equal(state.mkdirs(nestedDirectoryPath, { allowExisting: true }), true);
assert.equal(
  state.resolve(`${USER_DOCUMENTS_PATH}\\md-tree-regression`)?.type,
  "dir",
);
assert.equal(state.undo(), true, "directory tree should use one Undo step");
assert.equal(state.resolve(`${USER_DOCUMENTS_PATH}\\md-tree-regression`), null);
assert.equal(state.redo(), true, "directory tree should redo as one step");
assert.equal(state.resolve(nestedDirectoryPath)?.type, "dir");

const invalidTreePath = `${USER_DOCUMENTS_PATH}\\md-tree-invalid\\CON\\leaf`;
assert.equal(state.mkdirs(invalidTreePath), false);
assert.equal(state.resolve(`${USER_DOCUMENTS_PATH}\\md-tree-invalid`), null);

console.log(
  "VFS, shell, Command Prompt, copy timestamp, and migration checks passed.",
);
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
