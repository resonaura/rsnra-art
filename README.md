<img src="icon.svg" width="64" height="64" alt="RSNRA.ART Icon" />

# RSNRA.ART

[![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)](package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](package.json)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF.svg?logo=vite&logoColor=white)](package.json)
[![UI](https://img.shields.io/badge/UI-Windows%2095%20%7C%20React95-008080.svg)](https://react95.io)
[![Website](https://img.shields.io/badge/Website-rsnra.art-8A2BE2.svg)](https://rsnra.art)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/resonaura)

The official desktop of **RESONAURA** — an alternative rock band from Vancouver, BC — rebuilt as a fully-clickable, draggable, minimizable homage to Windows 95.


<p align="center">
  <img src="media/rsnra-art-desktop.png" width="800" alt="rsnra.art Windows 95 Desktop Experience" />
</p>

---

Built with Vite, React, TypeScript, [react95](https://react95.io), and
zustand. Window icons curated from
[trapd00r/win95-winxp_icons](https://github.com/trapd00r/win95-winxp_icons).

## Getting started

```sh
pnpm install
pnpm dev
```

## Editing content

All band-specific copy and links live in one place:
[`src/data/content.ts`](src/data/content.ts) — band name, location,
bio text, the `rsnra.link/resonaura` music link, TikTok/Instagram
handles, and the booking email. Edit that file; nothing else hardcodes
this copy.

Wallpaper presets live in
[`src/store/desktopStore.ts`](src/store/desktopStore.ts).

## Structure

- `src/store` — zustand stores for window/process management and
  desktop preferences.
- `src/components` — Desktop, Taskbar, Start Menu, Window chrome,
  Close Program (Ctrl+Alt+Delete) dialog, Run dialog, boot/shutdown
  screens.
- `src/apps` — each "app" (Welcome, My Computer, Notepad, Music,
  Social, Contact, Terminal, Minesweeper, Snake, Games folder,
  Recycle Bin, Help, Control Panel).
- `src/data/apps.tsx` — the app registry; `openApp(id)` opens any app
  from anywhere (Start Menu, desktop icons, Terminal `open` command,
  Run dialog).

## Notes

- The Contact app sends via `mailto:` — there's no backend, so it
  opens the visitor's email client pre-filled. Swap in a real form
  handler if you want it to submit silently instead.
- Try the RSNRA Terminal (Start Menu → Programs → Accessories) and
  type `help`. Also try Ctrl+Alt+Delete.
