import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useWindowStore } from '../../store/windowStore';
import { openApp } from '../../data/apps';
import { BAND_NAME, BAND_LOCATION, LINKS, CONTACT_EMAIL } from '../../data/content';

const PROMPT = 'RSNRA>';

const Screen = styled.div`
  background: #000;
  color: #c0c0c0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.4;
  height: 100%;
  width: 100%;
  padding: 8px;
  overflow-y: auto;
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Line = styled.div<{ $kind?: 'echo' | 'output' | 'error' }>`
  color: ${({ $kind }) =>
    $kind === 'error' ? '#ff6b6b' : $kind === 'echo' ? '#ffffff' : '#c0c0c0'};
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
`;

const PromptSpan = styled.span`
  color: #6dff8f;
  margin-right: 6px;
  flex-shrink: 0;
`;

const HiddenInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  caret-color: #6dff8f;
`;

interface HistoryEntry {
  text: string;
  kind?: 'echo' | 'output' | 'error';
}

const BANNER = [
  'RSNRA 95 [Version 4.95.1996]',
  `(c) ${BAND_NAME}. All rights reserved.`,
  '',
  'Type "help" to see what this thing can do.',
  '',
];

function buildHelp(): string[] {
  return [
    'Available commands:',
    '  help              show this list',
    '  about             about the band',
    '  bio               open bio.txt in Notepad',
    '  music             open the Music app',
    '  social            open the Social app',
    '  contact           open the Contact app',
    '  games             open the Games folder',
    '  open <app>        open an app by name',
    '  links             list all our links',
    '  whoami            who are you, really',
    '  date              current date and time',
    '  echo <text>       print text back',
    '  cls / clear       clear the screen',
    '  exit              close this window',
  ];
}

export function Terminal({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const [history, setHistory] = useState<HistoryEntry[]>(
    BANNER.map((text) => ({ text, kind: 'output' })),
  );
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIndex, setCmdIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight });
  }, [history]);

  const print = (lines: string[], kind?: HistoryEntry['kind']) => {
    setHistory((h) => [...h, ...lines.map((text) => ({ text, kind }))]);
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    print([`${PROMPT} ${raw}`], 'echo');
    if (!trimmed) return;

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        print(buildHelp());
        break;
      case 'about':
        print([
          `${BAND_NAME} — Alternative Rock, ${BAND_LOCATION}.`,
          'Fuzzed-out guitars, atmospheric synths, anthemic choruses.',
          'Run "links" for everything else.',
        ]);
        break;
      case 'bio':
        print(['Opening bio.txt...']);
        openApp('notepad', { title: 'bio.txt - Notepad', data: { docId: 'bio' } });
        break;
      case 'music':
        print(['Opening Music...']);
        openApp('music');
        break;
      case 'social':
        print(['Opening Social...']);
        openApp('social');
        break;
      case 'contact':
        print(['Opening Contact...']);
        openApp('contact');
        break;
      case 'games':
        print(['Opening Games folder...']);
        openApp('games-folder');
        break;
      case 'open': {
        const map: Record<string, Parameters<typeof openApp>[0]> = {
          'my-computer': 'my-computer',
          computer: 'my-computer',
          notepad: 'notepad',
          music: 'music',
          social: 'social',
          contact: 'contact',
          games: 'games-folder',
          minesweeper: 'minesweeper',
          snake: 'snake',
          help: 'help',
          'control-panel': 'control-panel',
          'recycle-bin': 'recycle-bin',
        };
        const target = map[arg.toLowerCase()];
        if (target) {
          openApp(target);
          print([`Opening ${arg}...`]);
        } else {
          print([`Unknown app "${arg}". Try: ${Object.keys(map).join(', ')}`], 'error');
        }
        break;
      }
      case 'links':
        print([
          `Music       ${LINKS.music}`,
          `TikTok      ${LINKS.tiktok}`,
          `Instagram   ${LINKS.instagram}`,
          `Contact     ${CONTACT_EMAIL}`,
        ]);
        break;
      case 'whoami':
        print(['A friendly visitor browsing RSNRA 95. Welcome.']);
        break;
      case 'date':
        print([new Date().toString()]);
        break;
      case 'echo':
        print([arg]);
        break;
      case 'cls':
      case 'clear':
        setHistory([]);
        break;
      case 'exit':
        closeWindow(windowId);
        break;
      default:
        print([`'${cmd}' is not recognized as an internal command. Try "help".`], 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input);
      setCmdHistory((h) => (input.trim() ? [...h, input] : h));
      setCmdIndex(null);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIndex =
        cmdIndex === null ? cmdHistory.length - 1 : Math.max(0, cmdIndex - 1);
      setCmdIndex(nextIndex);
      setInput(cmdHistory[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cmdIndex === null) return;
      const nextIndex = cmdIndex + 1;
      if (nextIndex >= cmdHistory.length) {
        setCmdIndex(null);
        setInput('');
      } else {
        setCmdIndex(nextIndex);
        setInput(cmdHistory[nextIndex]);
      }
    }
  };

  return (
    <Screen ref={screenRef} onClick={() => inputRef.current?.focus()}>
      {history.map((entry, i) => (
        <Line key={i} $kind={entry.kind}>
          {entry.text}
        </Line>
      ))}
      <InputRow>
        <PromptSpan>{PROMPT}</PromptSpan>
        <HiddenInput
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
      </InputRow>
    </Screen>
  );
}
