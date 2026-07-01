import { useState } from "react";
import { MenuList, MenuListItem, Separator } from "react95";
import styled from "styled-components";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowData } from "../../store/windowStore";

// Legacy docId -> virtual filesystem path.
const DOC_PATHS: Record<string, string> = {
  bio: "C:\\My Documents\\bio.txt",
  press: "C:\\My Documents\\press-kit.txt",
};

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const FakeMenuBar = styled(MenuList)`
  flex-shrink: 0;
`;

const TextArea = styled.textarea`
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 8px;
  font-family: "Courier New", monospace;
  font-size: 13px;
  line-height: 1.4;
  background: white;
`;

export function Notepad({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const vfs = useVfsStore();

  // Resolve the file path: prefer an explicit VFS path, fall back to a docId,
  // then to bio.txt. The window title is derived from the filename.
  const filePath =
    (data.path as string) ??
    DOC_PATHS[(data.docId as string) ?? "bio"] ??
    "C:\\My Documents\\bio.txt";
  const fileName = filePath.split("\\").pop() ?? "untitled.txt";
  const initial = vfs.read(filePath) ?? "";
  const [text, setText] = useState(initial);
  const [dirty, setDirty] = useState(false);

  const save = () => {
    vfs.writeFile(filePath, text);
    setDirty(false);
  };

  return (
    <Layout>
      <FakeMenuBar inline>
        <MenuListItem size="sm" onClick={save}>
          File
        </MenuListItem>
        <MenuListItem disabled size="sm">
          Edit
        </MenuListItem>
        <MenuListItem disabled size="sm">
          Search
        </MenuListItem>
        <MenuListItem disabled size="sm">
          Help
        </MenuListItem>
      </FakeMenuBar>
      <Separator />
      <TextArea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        spellCheck={false}
      />
      {dirty && (
        <div
          style={{
            fontSize: 11,
            padding: "2px 8px",
            background: "#c6c6c6",
            borderTop: "1px solid #848584",
          }}
        >
          {fileName} — unsaved changes. Click <b>File</b> to save to {filePath}.
        </div>
      )}
    </Layout>
  );
}
