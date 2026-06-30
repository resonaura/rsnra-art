import { useState } from 'react';
import styled from 'styled-components';
import { MenuList, MenuListItem, Separator } from 'react95';
import { useWindowData } from '../../store/windowStore';
import { BIO_TEXT } from '../../data/content';

const PRESS_KIT_TEXT = `RSNRA — Press Kit.txt
=====================================

RESONAURA is an alternative rock band from Vancouver, BC.

For interview requests, press photos, or stage plots, reach out
via the Contact app or email booking@rsnra.band.

Quick facts:
  Genre        Alternative Rock
  Based in     Vancouver, BC
  Listen       rsnra.link/resonaura
  TikTok       @resonaura
  Instagram    @resonaura
`;

const DOCS: Record<string, { title: string; text: string }> = {
  bio: { title: 'bio.txt - Notepad', text: BIO_TEXT },
  press: { title: 'press-kit.txt - Notepad', text: PRESS_KIT_TEXT },
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
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  background: white;
`;

export function Notepad({ windowId }: { windowId: string }) {
  const data = useWindowData(windowId);
  const docId = (data.docId as string) ?? 'bio';
  const doc = DOCS[docId] ?? DOCS.bio;
  const [text, setText] = useState(doc.text);

  return (
    <Layout>
      <FakeMenuBar inline>
        <MenuListItem disabled size="sm">
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
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
    </Layout>
  );
}
