# Functional audit — 2026-10-03

Baseline: Windows 2000 (NT 5.0), not Windows 95/Me. Scope covers desktop and
window behavior, Explorer and the virtual filesystem, screen savers, Recycle
Bin, Find, Command Prompt, and app menus. Findings were checked against source,
historical references, and the local running UI. This is a living checklist,
not a claim that every Windows 2000 feature is implemented.

## Findings

| Priority | Area | Finding | Status |
| --- | --- | --- | --- |
| P1 | Find | “All or part of the file name” searched as an exact wildcard expression; directory results opened My Computer at its old location; application files showed as 0 bytes; hidden files ignored Explorer visibility preferences. | Implemented; live checked for substring and `*.exe` search |
| P1 | Windows 2000 filesystem | The visible system tree used Windows 9x locations (`C:\Windows`, a root-level `C:\My Documents`, and a `System` directory), and the terminal reported Windows 95. | Implemented; migrated to `C:\WINNT\System32` and `C:\Documents and Settings\Administrator`, with old-path compatibility and a preserving VFS migration |
| P1 | Windows 2000 profile | A legacy migration left a duplicate `History` beside the profile folders instead of only under `Local Settings`. | Fixed in VFS migration v15; merges existing entries into `Local Settings\History` and removes the stale duplicate without discarding its contents. Adds the missing local Application Data, NetHood, PrintHood, and Templates folders. |
| P1 | Screen savers | Built-in savers lacked their period-appropriate setup controls; the text savers had no editable text/time modes, and DVD Bounce cycled through an overly harsh palette. | Implemented: 3D Text now has text/time, spin style, size, speed, resolution, surface, font and colors; Marquee has text/speed/colors; Mystify, Starfield and Flower Box expose motion/count controls. `(None)` is the clean-install default. DVD Bounce is an extra—not a stock Windows 2000 saver—with a restrained DVD-blue/silver default and optional Windows/spectrum palettes. Preview uses staged settings. Rainy Window remains an extra with no settings panel. |
| P2 | Windows 2000 appearance | Default desktop and title-bar colors did not match the Windows 2000 palette. | Implemented; default migrated to the characteristic `#3a6ea5` desktop and Windows 2000 theme |
| P1 | Command Prompt | `rmdir /s` deleted only one directory level and could partially alter a protected tree before failing. | Implemented; build checked, recursive operation grouped into one Undo |
| P1 | Window manager | Closing or minimizing the focused window did not activate the next visible window. | Implemented; build checked |
| P1 | Command Prompt | Edit menu exposed Copy, Paste, and Select All as disabled even though xterm supports these operations. | Implemented; build checked |
| P2 | Command Prompt | `SET` started empty and PATH output diverged from the command-search folders. | Implemented: Windows 2000-style environment variables, case-insensitive variable access, and one shared System32/WINNT/Wbem path; visually checked with `set path` |
| P2 | File metadata | File sizes were calculated differently in Explorer, Find, Properties, File Dialog, and the terminal; stub executable files appeared empty in some views. | Implemented; live checked for application size |
| P2 | Folder attributes | Properties treated a folder's Read-only checkbox as a lock on the directory, preventing rename/move/delete; it exposed Archive and System controls that the Windows 2000 folder Properties page does not show. | Implemented: folder Read-only applies to unprotected files directly inside the folder, directory operations ignore the flag, and folder Properties shows only Read-only/Hidden with a mixed-state checkbox. |
| P2 | File associations | File Properties hard-coded “Opens with” labels and offered no way to change the per-user association from the file itself. | Implemented: Properties reads the same association catalog/preferences as Folder Options and opens the existing Open With picker from Change…; live checked on a PNG without altering its association. |
| P2 | Screen saver files | Double-clicking a `.scr` in Explorer or Find fell through to Notepad instead of running the selected saver. | Implemented: known `.scr` files launch the registered saver from Explorer and Find, matching Desktop behavior. |
| P2 | File Dialog | Open/Save dialogs always hid Hidden files, regardless of Explorer's shared visibility preferences. | Implemented |
| P2 | Properties | Attribute checkboxes held their initial local values if the underlying file changed while Properties stayed open. | Implemented |
| P2 | Find | Results had no working Select All or Save Results command. | Implemented; selection and saving wired to the virtual filesystem |
| P3 | App menus | Several Help/About entries and secondary modes remain disabled; these are lower impact than core file and window operations. | Pending |

## Work sequence

1. Unify file-size calculation and correct Find's matching, visibility, opening,
   selection, and save behavior.
2. Make recursive directory deletion safe and make terminal clipboard actions
   usable.
3. Restore focus to the topmost remaining window after close/minimize.
4. Synchronize file-picker visibility and Properties attributes with current
   filesystem preferences and metadata.
5. Revisit the remaining disabled secondary menu items in a follow-up audit pass.
6. Continue the NTFS-era filesystem audit: attributes/security semantics, shared
   versus per-user shell folders, file associations, and built-in system files;
   assess the volume type and user model before adding a Security page.
7. Unify file-open dispatch across Explorer, Desktop, Find, and the Start menu
   while preserving installed-app and per-user association behavior.

## Historical checks used

- [Windows 2000 screen-saver walkthrough](https://www.informit.com/articles/article.aspx?p=411736&seqNum=113): screen-saver selection, Preview, Settings, and the wait interval.
- [Running Microsoft Windows 2000 Professional: Display Properties](https://flylib.com/books/en/3.229.1.32/1/): the Screen Saver list's default choice is `(None)`.
- [Windows 2000 exercises (PDF)](https://knowware.dk/down/windows_2000_exercises.pdf): 3D Text's Text/Time modes and editable text field.
- [Microsoft Learn: Local User Profiles](https://learn.microsoft.com/en-us/windows/win32/shell/local-user-profiles): Windows 2000/XP profile management and profile placement.
- [NT-era 3D Text setup reference](https://www.bitsavers.org/pdf/microsoft/windows_NT_4.0/Osborne_-_Windows_NT_Registry_Settings_Reference_1998.pdf): documents the period setup controls for size, speed, resolution, spin style, and solid/textured surfaces. Using it as a Windows 2000 UI reference is an era-continuity inference; the Windows 2000-specific exercise above confirms Text/Time and custom text.
- [DVD-Video logo color reference](https://m.svgmix.com/item/zlrZW4/dvd-video): lists the mark's blue as `#51688E`; used to steer the default away from unrelated neon cycling.
- [Microsoft Learn: CSIDL shell folders](https://learn.microsoft.com/en-us/windows/win32/shell/csidl): shell-folder conventions, including per-user Cookies/Favorites/Start Menu and `Local Settings\Temporary Internet Files`.
- [Microsoft KB 326549 (Windows 2000 predecessor KB 256614)](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/326/549.HTM): folder Properties' Read-only control applies to files directly in the folder; the directory's own Read-only bit is normally ignored.
- [Microsoft Learn: File Attribute Constants](https://learn.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants): definitions for Read-only, Hidden, System, and Archive attributes.
- [Microsoft Learn: File Types](https://learn.microsoft.com/en-us/windows/win32/shell/fa-file-types): extension-to-application association model and Open With conventions.
- [Microsoft Windows 2000 profile guidance](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/314/045.HTM): default profile placement under `Documents and Settings`.
- [Windows 2000 color reference](https://desktopcolors.com/os/windows-2000): desktop blue `#3a6ea5`.
