import { openApp } from './apps';
import { useWindowStore } from '../store/windowStore';

export interface MenuNode {
  id: string;
  label: string;
  icon?: string;
  action?: () => void;
  children?: MenuNode[];
  disabled?: boolean;
}

function closeStartMenu() {
  useWindowStore.getState().setStartMenuOpen(false);
}

function run(fn: () => void) {
  return () => {
    fn();
    closeStartMenu();
  };
}

export function requestShutdown() {
  useWindowStore.getState().setStartMenuOpen(false);
  useWindowStore.getState().setPowerState('shutting-down');
}

export const START_MENU_TREE: MenuNode[] = [
  {
    id: 'programs',
    label: 'Programs',
    icon: '/icons/folder-open.png',
    children: [
      {
        id: 'accessories',
        label: 'Accessories',
        icon: '/icons/folder-open.png',
        children: [
          {
            id: 'terminal',
            label: 'RSNRA Terminal',
            icon: '/icons/terminal.png',
            action: run(() => openApp('terminal')),
          },
          {
            id: 'notepad',
            label: 'Notepad',
            icon: '/icons/notepad.png',
            action: run(() =>
              openApp('notepad', { title: 'bio.txt - Notepad', data: { docId: 'bio' } }),
            ),
          },
          {
            id: 'paint',
            label: 'Paint',
            icon: '/icons/paint.png',
            action: run(() => openApp('paint')),
          },
        ],
      },
      {
        id: 'games',
        label: 'Games',
        icon: '/icons/joystick.png',
        children: [
          {
            id: 'minesweeper',
            label: 'Minesweeper',
            icon: '/icons/minesweeper.png',
            action: run(() => openApp('minesweeper')),
          },
          {
            id: 'snake',
            label: 'RSNRA Snake',
            icon: '/icons/joystick.png',
            action: run(() => openApp('snake')),
          },
        ],
      },
      {
        id: 'my-computer',
        label: 'My Computer',
        icon: '/icons/computer.png',
        action: run(() => openApp('my-computer')),
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: '/icons/documents.png',
    children: [
      {
        id: 'bio',
        label: 'bio.txt',
        icon: '/icons/notepad-file.png',
        action: run(() =>
          openApp('notepad', { title: 'bio.txt - Notepad', data: { docId: 'bio' } }),
        ),
      },
      {
        id: 'press',
        label: 'press-kit.txt',
        icon: '/icons/notepad-file.png',
        action: run(() =>
          openApp('notepad', { title: 'press-kit.txt - Notepad', data: { docId: 'press' } }),
        ),
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '/icons/settings.png',
    children: [
      {
        id: 'control-panel',
        label: 'Control Panel',
        icon: '/icons/control-panel.png',
        action: run(() => openApp('control-panel')),
      },
    ],
  },
  {
    id: 'find',
    label: 'Find',
    icon: '/icons/find.png',
    children: [{ id: 'find-files', label: 'Files or Folders...', disabled: true }],
  },
  {
    id: 'help',
    label: 'Help',
    icon: '/icons/help.png',
    action: run(() => openApp('help')),
  },
  {
    id: 'run',
    label: 'Run...',
    icon: '/icons/msdos.png',
    action: () => {
      useWindowStore.getState().setRunDialogOpen(true);
      closeStartMenu();
    },
  },
  {
    id: 'shut-down',
    label: 'Shut Down...',
    icon: '/icons/battery.png',
    action: requestShutdown,
  },
];
