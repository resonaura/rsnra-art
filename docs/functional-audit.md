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
| P1 | Recycle Bin policy | The bin had no Windows 2000 Properties policy: quota, bypass, and delete-confirmation settings were absent, so all deleted items stayed recoverable indefinitely. | Implemented and live checked: desktop Properties displays the 10%/confirmation defaults; a staged 11% quota persisted across close/reopen and was returned to 10%. A temporary Explorer file appeared with original path/date/size in the bin, then Undo returned the original four-file Documents listing and emptied the bin. FAT16 allocation enforces the quota, evicts oldest entries first, permanently deletes over-limit items, and applies confirmation preferences. Shift+Delete bypasses the bin in Explorer. |
| P1 | FAT Recycle Bin storage | Deleted payloads were held only in app state, detached from `C:\Recycled`; the directory had an inspectable text placeholder rather than the period binary index. | Implemented and live checked: payloads move into `C:\Recycled\Dc<n>.<ext>` and the v5 `INFO2` file contains 800-byte Unicode records, FILETIME deletion stamps, the original path, drive number, and FAT16 cluster-rounded size. Restore/permanent delete tombstones a record; Empty removes the index. VFS v17/v18 states migrate without discarding the detached or already-moved payloads. The byte layout is based on forensic reverse engineering, not a published Microsoft format specification. |
| P2 | Recycle Bin quota warning | Delete confirmation warned about purging older items whenever the quota was below 100%, even if the new object could not exceed the current bin usage limit. | Implemented and live checked: the prompt forecasts FAT-cluster allocation and FIFO eviction using existing payloads and the current selection; deleting an empty test file from an empty bin no longer shows the stale warning. |
| P2 | Command Prompt | `SET` started empty and PATH output diverged from the command-search folders. | Implemented: Windows 2000-style environment variables, case-insensitive variable access, and one shared System32/WINNT/Wbem path; visually checked with `set path` |
| P2 | Command Prompt / filesystem | `MD`/`MKDIR` rejected a nested path unless every parent directory had already been created. | Fixed: Windows directory commands now create missing intermediate folders atomically as one VFS operation; Undo/Redo and invalid-name rollback are covered by memory regressions. |
| P2 | Command Prompt / DOS attributes | `DIR` did not distinguish normal, Hidden, System, Read-only, Archive, and directory attributes; `DEL` had no attribute selector and could silently treat hidden/system entries inconsistently; `ATTRIB` did not implement recursive traversal. | Implemented: default `DIR`/`DEL` omit Hidden and System; `/A` includes all, and attribute selectors support combinations/exclusions (`/A:H-S`). `ATTRIB /S` changes matching files throughout the subtree and `/D` also includes matching directories; the batch is one Undo operation. `DIR /A:D`, `DEL /A:R`, and `/F` behavior are covered through the terminal dispatcher. `DEL` keeps system ownership protection separate from the DOS System bit. |
| P2 | Command Prompt / file specifications | `DIR *.txt` was resolved as a directory path, while `DIR file.txt` rejected an existing file as “Not a directory”; `*.*` also failed to include extensionless names. | Implemented: directory listings accept exact filenames and wildcard specifications, match long and 8.3 names, and use DOS `*.*` behavior. Terminal-dispatcher regressions cover extension filters, one-file listings, short aliases, and extensionless files. |
| P2 | Command Prompt / recursive listings | `DIR /S` was accepted as an option but did not traverse any subdirectories, so results were incomplete and `/B` could not return searchable full paths. | Implemented: recursive listings descend the virtual tree, apply wildcard and attribute filters at each level, emit full paths with `/B`, and include per-directory plus aggregate totals in standard mode. |
| P2 | Command Prompt / directory ordering | `DIR` silently ignored `/O` and `/T`, so scripts could not request documented ordering or choose the displayed/sorted timestamp. | Implemented: `/O` supports `N`, `E`, `G`, `S`, and `D`, reversed criteria, and chained keys; `/T:C`, `/T:A`, and `/T:W` select creation/access/write times for display and date sorting in ordinary and recursive listings. Dispatcher regressions cover all fields and invalid syntax. |
| P2 | Command Prompt / recursive deletion | `DEL /S` was ignored, so a wildcard that should span subdirectories only removed matching files from the current directory; each successful file deletion also created its own Undo entry. | Implemented: `/S` searches the selected virtual subtree with the same wildcard and DOS attribute rules, leaves directories in place, reports full paths, and groups the batch into one Undo/Redo transaction. |
| P2 | Command Prompt / wildcard copy | `COPY` accepted only one literal source, so normal patterns such as `COPY *.TXT destination` failed even though the DOS wildcard resolver already existed for listing/deletion. | Implemented: wildcard sources resolve both long names and their stored 8.3 aliases, copy only matching files into an existing destination folder, report the count, and form one Undo/Redo step. |
| P2 | Command Prompt / short-name copy | `COPY /N` was ignored, so scripts could not create a destination using the source file's short 8.3 name. | Implemented: `/N` uses the stored VFAT alias for long names copied into a directory, leaves already-8.3 names unchanged, and respects an explicit destination filename; alias collisions use normal confirmation and Undo. |
| P2 | Command Prompt / copy overwrite policy | `COPY` rejected an existing destination instead of using Windows 2000's overwrite warning and `/Y`/`/-Y` controls. | Implemented: interactive overwrites ask per file; `/Y` and `COPYCMD=/Y` suppress the prompt, `/-Y` forces it, and batch files overwrite without the interactive prompt. Replacements preserve the old file in the command's single Undo step. |
| P2 | Command Prompt / wildcard move | `MOVE` accepted one literal source, so a batch of matching files could not be moved into another directory as a unit. | Implemented: wildcard matches are resolved by long/short name, moved into an existing directory, and grouped into one Undo/Redo transaction with per-file failures preserved. |
| P2 | Command Prompt / wildcard rename | `REN` only renamed one literal node; it rejected wildcard file sets and wildcard destination templates. | Implemented: source masks match long and 8.3 names; destination `*`/`?` characters copy corresponding source-name characters, extension replacement works, collisions are reported without destroying the existing file, and successful batch renames share one Undo. |
| P2 | Command Prompt / move overwrite policy | `MOVE` rejected an existing destination instead of prompting or honoring Windows 2000's `/Y`/`/-Y` controls. | Implemented: interactive overwrites ask per file; `/Y` and `COPYCMD=/Y` suppress the prompt, `/-Y` forces it, and batch files move without the interactive prompt. The replaced destination and moved source restore together with one Undo. |
| P2 | Command Prompt / delete confirmations | `DEL /P` and `/Q` were silently discarded, so the command could not ask before each deletion and `/Q` could not override an interactive request. | Implemented: the terminal supports per-file Y/N input for `/P`; `/Q` suppresses those prompts, and the command remains busy without swallowing the confirmation keystrokes. |
| P2 | File metadata | File sizes were calculated differently in Explorer, Find, Properties, File Dialog, and the terminal; stub executable files appeared empty in some views. | Implemented; live checked for application size |
| P2 | Windows paths | Drive-relative paths such as `C:..` were incorrectly treated as rooted paths on `C:\`, and the VFS accepted paths longer than classic `MAX_PATH`. | Implemented and live checked: `C:..` moved from My Documents to its parent, and `C:My Documents` returned relative to that C: directory; rooted forms remain distinct. A deterministic boundary check accepts 259 visible characters and rejects 260, counting the terminating NUL as part of the 260-character Win32 limit. |
| P2 | File-operation path length | Copy and Move validated the destination directory but not the final `directory\filename`, and Rename could lengthen an existing path beyond classic `MAX_PATH`. | Fixed: derived child paths are rejected before mutation using the caller's normalized path (so 8.3 paths are not expanded for the limit check); boundary regressions cover Copy, Move, and Rename, including Rename's 259/260-character boundary. |
| P2 | VFAT short names | Properties fabricated a first-name `~1` alias, while Explorer and Command Prompt could not resolve short paths. | Implemented and live checked: `press-kit.txt` reports `PRESS-~1.TXT`; `C:\DOCUME~1\ADMINI~1\MYDOCU~1` resolves to the profile path, and `dir /x` lists aliases. Collision-safe per-directory aliases are migrated and stored on nodes; Properties and paths share the same alias. The exact FAT alias-assignment algorithm is an approximation. |
| P2 | VFAT filename limits | Copy/move collision handling prefixed a full 255-character filename with `Copy of `, creating an invalid component that exceeded the volume limit. | Fixed: generated collision names preserve the extension where possible and stay within 255 characters; an in-memory regression creates, copies, and resolves a maximum-length root file. |
| P2 | FAT16 storage | Disk free-space accounting used logical byte counts while file Properties rounded “Size on disk” to 4 KB, inconsistent with the modeled 2 GB FAT16 volume. | Implemented and live checked: 600-byte `bio.txt` reports 32 KB on disk and the folder status bar shows the cluster-aware free-space total. File data and subdirectory records consume 32 KB clusters across free-space, copy/write checks, and Size on disk; the fixed root-directory table and FAT metadata remain outside this approximation. |
| P2 | FAT timestamps | Access time stored arbitrary milliseconds and rename changed a file's modified time, despite the volume being modeled as FAT16. | Implemented and live checked after v17 migration: the existing `press-kit.txt` remained present; Properties showed Modified on a 2-second boundary and Accessed at local midnight. Creation rounds to 10 ms; migration normalizes existing metadata; same-volume rename/move preserves a file's last-write time. In-memory regression checks verify copies get a new Creation time, preserve each file's last-write time, and update the source tree's FAT access date; terminal text reads also update access date. |
| P2 | FAT access-date writes | `read()` replaced and persisted the whole virtual tree on every repeated read, even when FAT's one-day access-date value had not changed; Notepad performed that read during every render. | Implemented: the VFS only writes a new tree when the local access date changes, and Notepad reads its initial file contents once. |
| P2 | Folder attributes | Properties treated a folder's Read-only checkbox as a lock on the directory, preventing rename/move/delete; it exposed Archive and System controls that the Windows 2000 folder Properties page does not show. | Implemented: folder Read-only applies to unprotected files directly inside the folder, directory operations ignore the flag, and folder Properties shows only Read-only/Hidden with a mixed-state checkbox. |
| P2 | File associations | File Properties hard-coded “Opens with” labels and offered no way to change the per-user association from the file itself. | Implemented: Properties reads the same association catalog/preferences as Folder Options and opens the existing Open With picker from Change…; live checked on a PNG without altering its association. |
| P1 | File-open dispatch | Desktop, Explorer, and Find duplicated file-opening rules: the same object could behave differently, Find treated `.lnk` as text, and an Open With choice could intercept a registered executable. | Implemented: one VFS shell dispatcher now handles Desktop, Explorer, and Find; a desktop `.lnk` opened My Computer correctly, and Find located and launched that same shortcut. Folder browsing preferences, screen savers, Quick Launch's Show Desktop command, app executables, user associations, media, and the Notepad fallback keep their respective behavior. |
| P2 | Read-only deletion | Explorer hid Delete for Read-only files and the virtual volume treated that DOS attribute as immutable ownership, so even an explicit shell confirmation could not remove them. | Implemented: Explorer now warns when deleting a Read-only file (including one inside a selected folder) and can send it to the Recycle Bin or permanently delete it; Command Prompt still refuses unless `DEL /F` is used. |
| P1 | Protected descendants | A user-owned parent such as `Administrator` had `protected: false` while containing protected `NTUSER.DAT`; deleting it passed the top-level check, exceeded the bin quota, and permanently removed the whole profile without a Recycle Bin record. | Fixed: delete, rename, and move operations recursively reject any tree containing an immutable Windows-owned node; Explorer disables those operations and reports skipped/blocked selections. The memory-only regression check verifies remove, Recycle Bin, rename, and all move variants leave the profile and bin unchanged; live menu verification is pending. |
| P2 | Context-menu disabled state | `$disabled` only changed `CtxItem` colors; native buttons remained clickable, so visually disabled shell actions could still run. | Fixed in code: disabled context items now set the native `disabled` attribute and expose `aria-disabled`, while retaining the Windows menu appearance; live accessibility verification is pending. |
| P2 | Screen saver files | Double-clicking a `.scr` in Explorer or Find fell through to Notepad instead of running the selected saver. | Implemented: known `.scr` files launch the registered saver from Explorer and Find, matching Desktop behavior. |
| P2 | File Dialog | Open/Save dialogs always hid Hidden files, regardless of Explorer's shared visibility preferences. | Implemented |
| P2 | Folder Options visibility | Desktop ignored “Hide protected operating system files” while Explorer, Find, and Open/Save dialogs applied it. | Fixed: one shared VFS visibility predicate now drives all four surfaces; in-memory checks cover hidden/system combinations, including the inspectable default. |
| P2 | Properties | Attribute checkboxes held their initial local values if the underlying file changed while Properties stayed open. | Implemented |
| P2 | Find | Results had no working Select All or Save Results command. | Implemented; selection and saving wired to the virtual filesystem |
| P2 | Start Menu / user profiles | Programs read only `All Users\Start Menu\Programs`, so per-user shortcuts and groups were missing; identical groups had no merge behavior. | Implemented and live checked: `Administrator\Start Menu\Programs` now merges with `All Users\Start Menu\Programs`; matching groups merge recursively and a same-name per-user shortcut takes precedence. A unique per-user test group appeared immediately; a same-named `Games` group retained the four shared game entries. Both test folders were removed through Explorer Undo. |
| P2 | Desktop / user profiles | The desktop rendered only `Administrator\Desktop`, ignoring shortcuts installed into `All Users\Desktop`. | Implemented: the shell displays entries from both physical folders, including same-named entries as separate icons, while opening, renaming, deleting, and dragging each through its actual profile path. The deterministic merge regression passes; live UI verification is pending. |
| P1 | Start Menu / Recent documents | Documents listed every item under My Documents instead of the Shell's profile-local Recent shortcuts; opening, saving, and clearing did not maintain Windows-style MRU history. | Implemented and live checked: opening a document from Explorer or Notepad creates/refreshes a per-profile `.lnk` in `C:\Documents and Settings\Administrator\Recent`; Start → Documents reopens the target through normal file associations and shows the newest 15. Advanced → Clear empties unprotected entries in Recent but leaves their target documents untouched. Recent is empty after the live test. |
| P2 | Taskbar properties | Taskbar context-menu Properties was disabled, so the documented General/Advanced property sheet and its shell options were unavailable. | Implemented and live checked: General/Advanced tabs, staged Apply/OK/Cancel, taskbar topmost/auto-hide, small Start-menu icons, clock, and personalized menus persist and affect the shell. Show Clock, auto-hide, small icons, and restoration to the user's prior settings were verified live. |
| P2 | Shell shortcuts / context menus | Explorer and Desktop could open `.lnk` files but offered no normal Send To action for creating a file/folder shortcut; clicking a nested context menu also bubbled to the owning Explorer window and closed the menu. | Implemented and live checked: the common `Send To → Desktop (create shortcut)` action creates a collision-safe, icon-preserving virtual `.lnk`; shortcuts reopen the original file and are undoable. Explorer multi-selection is one Undo; Desktop-origin shortcuts are undoable too. ContextMenu stops portal click bubbling. |
| P2 | Per-user Send To | `C:\Documents and Settings\Administrator\SendTo` existed but was empty while Explorer hard-coded a single Desktop action; My Documents and user-defined folder/program destinations could not participate. | Implemented: VFS v21 seeds all four historical destinations (floppy, Desktop, Mail Recipient, My Documents), and the submenu enumerates current profile-folder contents. Desktop shortcuts, My Documents copies, custom folder copies and supported app shortcuts execute; the empty A: drive and absent MAPI client report specific Windows-style errors. Live checked: My Documents copy/Undo and immediate menu removal/restoration after deleting/undoing DeskLink. |
| P1 | VFS schema migration | Advancing persisted VFS v19 to a newer schema would route modern `RecycledItem` records through the legacy detached-node migration path, which expects an embedded `node` and can fail with non-empty Recycle Bin metadata. | Fixed in v20 and regression-tested for both v19/v20 → v21: populated `RecycledItem` metadata, `C:\Recycled` payload, and binary INFO2 content survive unchanged; missing SendTo defaults are added without dropping a custom destination. `pnpm test:vfs-migration` passes. |
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
   assess the volume type and user model before adding a Security page. **Partial:**
   Start Menu Programs now merges the shared and per-user profile folders; the
   broader shell-folder and security audit remains open.
7. Unify file-open dispatch across Explorer, Desktop, Find, and the Start menu
   while preserving installed-app and per-user association behavior. **Complete:**
   `openVfsNode` is shared by Explorer, Desktop, and Find; the desktop shortcut
   and Find result were live checked.
8. Keep DOS Read-only distinct from immutable system ownership: allow Explorer
   to delete with a warning and preserve the command-line `/F` override. **Complete:**
   the shared VFS deletion methods accept a narrow explicit override; ordinary
   terminal `DEL` continues to respect the Read-only attribute.
9. Forecast Recycle Bin quota eviction with cluster allocation before warning.
   **Complete:** the deletion prompt uses the current payload sizes and FIFO
   policy; live checked against an empty file and empty bin.
10. Avoid persistent FAT access-date writes for same-day re-reads. **Complete:**
    `read()` updates only if the FAT local-calendar access date changes; Notepad
    initializes file content lazily rather than on every render.
11. Restore the Windows 2000 Taskbar and Start Menu property sheet, including
    the profile's Recent/Documents behavior. **Complete:** the Advanced tab's
    Clear command empties Recent entries without deleting their target files;
    General settings are persisted and wired to taskbar/menu behavior.
12. Restore the common shell shortcut action. **Complete:** Explorer/Desktop
    Send To creates `.lnk` nodes targeting original VFS paths; names are
    collision-safe, target icons are retained, and file operations have clear
    Undo descriptions. The shared ContextMenu also stops portal clicks from
    reaching the owning window's close handler.
13. Make the profile's SendTo folder drive the shell submenu. **Partial:** the
    folder is now virtual and live; Desktop and My Documents entries work, and
    folder/app shortcuts are dispatched. Floppy and mail destinations still
    need corresponding virtual device/client behavior.
14. Keep schema upgrades non-destructive as the VFS grows. **Complete:** a
    memory-only fixture migrates populated v19 and v20 bins, checks the payload
    and INFO2 bytes, and confirms custom SendTo entries survive while new stock
    entries are added.
15. Match the historical Send To defaults without pretending missing devices
    are available. **Partial:** the four stock profile entries are present;
    Desktop/My Documents work, while the floppy has no inserted virtual medium
    and Mail Recipient has no MAPI client to launch.
16. Keep protected installed files safe when acting on their parent folders.
    **Implemented:** VFS remove, rename, and move methods reject a selected
    tree containing a protected object; Explorer reflects the same policy in
    Delete, Rename, Cut, and drag behavior. Regression assertions cover a
    profile with `NTUSER.DAT`; live menu verification remains pending.
17. Make disabled context-menu items non-interactive, not merely gray.
    **Implemented:** the shared context-menu item renders a native disabled
    button with `aria-disabled`; live accessibility verification remains
    pending.
18. Match Explorer file-copy timestamps on the FAT16 volume.
    **Complete:** copies receive new creation times, copied files keep their
    source last-write times, copied directories receive new timestamps, and
    reading the source advances its FAT access date. A deterministic
    in-memory regression check covers file and folder copies.
19. Enforce the classic Win32 path-length boundary without breaking short
    names. **Complete:** normalized path input is limited to 259 visible
    characters plus the NUL terminator; short-name resolution still happens
    after validating the string the caller supplied.
20. Merge the two physical Windows 2000 desktop folders in the Shell.
    **Implemented:** common and per-user entries are both displayed; equal
    names remain distinct because they are separate files in separate profile
    folders. File actions keep each entry's real source path. The pure merge
    behavior is covered in memory; live UI verification remains pending.
21. Keep Explorer's generated collision names addressable at the VFAT
    component boundary. **Complete:** `Copy of`/numbered names truncate only
    the base portion needed to stay within 255 characters; a memory regression
    confirms the maximum-length copy can be resolved afterward.
22. Apply `MAX_PATH` to paths derived by Copy/Move/Rename as well as typed
    paths. **Complete:** the destination directory's caller-visible
    normalized form and final filename are checked before editing the tree;
    regression checks verify overlong Copy/Move/Rename is rejected atomically
    while a 259-character Rename target remains addressable.
23. Apply shared Folder Options visibility consistently to the Desktop.
    **Complete:** Desktop, Explorer, Find, and file dialogs share one visibility
    predicate; tests verify that protected hidden system files are shown by
    default, hidden when the option is enabled, and ordinary hidden files stay
    independently controlled by “Show hidden files”.
24. Match Windows `MD`/`MKDIR` nested-path behavior.
    **Complete:** one command creates every missing parent and the target as
    one atomic, single-Undo operation; `-p` remains an idempotent convenience.
25. Match Windows 2000 `DIR`/`DEL` file-attribute filters. **Complete:** the
    shared selector implements Hidden/System defaults, combined positive and
    negative attributes, and directory filtering for `DIR`; terminal-level
    regression checks cover the selectors, read-only `/F`, and the independent
    immutable-system-file safety gate.
26. Match DOS `DIR` file specifications. **Complete:** exact files and wildcard
    patterns list from their containing directory, wildcard matching recognizes
    stored 8.3 aliases, and `*.*` includes extensionless entries. In-memory
    terminal checks cover each form.
27. Implement `DIR /S` traversal. **Complete:** recurse over virtual folders,
    preserve wildcard and attribute filtering, and output full paths in bare
    mode; regression checks cover matching files, directory-only output, empty
    matches, and standard aggregate output.
28. Implement `DEL /S` file traversal. **Complete:** search within the requested
    folder subtree, retain the DOS Hidden/System/Read-only rules, leave folders
    intact, and group successful removals for a single Undo/Redo step.
29. Support `COPY` wildcard sources. **Complete:** expand matches in the source
    directory using both long and short names, copy the selected files to a
    destination folder as one transaction, and report partial failures without
    losing successful copies.
30. Support `MOVE` wildcard sources. **Complete:** expand long/short matches,
    move them to an existing folder, and make the batch a single reversible
    transaction.
31. Restore `DEL /P` and `/Q` confirmation behavior. **Complete:** each
    matching file can be accepted or declined; `/Q` takes precedence, and
    terminal-input regression checks exercise both the command and interactive
    shell route.
32. Restore `DIR /O` ordering and `/T` timestamps. **Complete:** Windows
    2000's name, extension, directory-first, size, and date keys can be
    combined and individually reversed; `/T` selects Creation, Access, or
    Write times for display and date sorting, including recursive sections.
33. Restore Windows 2000 `COPY` overwrite behavior. **Complete:** interactive
    overwrite prompts, `/Y`, `/-Y`, `COPYCMD=/Y`, and non-interactive batch
    replacement are covered; accepted replacements are grouped into one Undo.
34. Restore Windows 2000 `MOVE` overwrite behavior. **Complete:** interactive
    and wildcard overwrite prompts, `/Y`, `/-Y`, `COPYCMD=/Y`, and the batch
    exception are covered; accepted replacements and moved sources share one
    Undo step.
35. Restore `COPY /N` short-name output. **Complete:** long-name copies into
    directories use the source's stored VFAT 8.3 alias, already-short names
    and explicit destination names are kept, and alias collisions use the
    same overwrite confirmation.
36. Restore recursive Windows 2000 `ATTRIB`. **Complete:** `/S` applies the
    selected attribute changes to matching files through the subtree; `/D`
    includes directories, and one command forms one Undo/Redo operation.
37. Restore wildcard `REN` filename mapping. **Complete:** source and
    destination masks work in the same directory, destination wildcards retain
    the corresponding original characters, collisions are protected, and a
    partially successful set of renames is reversible as one operation.
38. Enforce the classic Win32 path boundary after Rename. **Complete:** the
    target's caller-visible parent path plus the new name must remain below
    260 characters, and an in-memory check covers both sides of the boundary.

## Historical checks used

- [Windows 2000 screen-saver walkthrough](https://www.informit.com/articles/article.aspx?p=411736&seqNum=113): screen-saver selection, Preview, Settings, and the wait interval.
- [Running Microsoft Windows 2000 Professional: Display Properties](https://flylib.com/books/en/3.229.1.32/1/): the Screen Saver list's default choice is `(None)`.
- [Windows 2000 exercises (PDF)](https://knowware.dk/down/windows_2000_exercises.pdf): 3D Text's Text/Time modes and editable text field.
- [Microsoft Learn: Local User Profiles](https://learn.microsoft.com/en-us/windows/win32/shell/local-user-profiles): Windows 2000/XP profile management and profile placement.
- [NT-era 3D Text setup reference](https://www.bitsavers.org/pdf/microsoft/windows_NT_4.0/Osborne_-_Windows_NT_Registry_Settings_Reference_1998.pdf): documents the period setup controls for size, speed, resolution, spin style, and solid/textured surfaces. Using it as a Windows 2000 UI reference is an era-continuity inference; the Windows 2000-specific exercise above confirms Text/Time and custom text.
- [DVD-Video logo color reference](https://m.svgmix.com/item/zlrZW4/dvd-video): lists the mark's blue as `#51688E`; used to steer the default away from unrelated neon cycling.
- [Microsoft Learn: CSIDL shell folders](https://learn.microsoft.com/en-us/windows/win32/shell/csidl): identifies `CSIDL_PROGRAMS` as the current user's Programs folder and `CSIDL_COMMON_PROGRAMS` as the shared All Users Programs folder; both contribute program groups to the Start Menu. It also identifies `CSIDL_DESKTOPDIRECTORY` and `CSIDL_COMMON_DESKTOPDIRECTORY` as the per-user and all-user desktop folders, and documents per-user Cookies/Favorites/Start Menu and `Local Settings\Temporary Internet Files`.
- [Microsoft Open Specifications: Filename](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/2917da5c-253c-4c0e-aaf6-9dddc37d2e6e): specifies a maximum filename component length of 255 characters.
- [Contemporary Windows XP desktop report](https://groups.google.com/g/microsoft.public.windowsxp.customize/c/b8CZY-tVZ6U): describes duplicate-caption shortcuts associated with separate user-profile desktop folders; used as evidence that the virtual desktop must preserve same-named entries from distinct folders instead of collapsing them.
- [Microsoft KB 326549 (Windows 2000 predecessor KB 256614)](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/326/549.HTM): folder Properties' Read-only control applies to files directly in the folder; the directory's own Read-only bit is normally ignored.
- [Microsoft Learn: File Attribute Constants](https://learn.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants): definitions for Read-only, Hidden, System, and Archive attributes.
- [Microsoft Learn: File Types](https://learn.microsoft.com/en-us/windows/win32/shell/fa-file-types): extension-to-application association model and Open With conventions.
- [Microsoft Learn: Naming Files, Paths, and Namespaces](https://learn.microsoft.com/en-us/windows/desktop/fileio/naming-a-file): distinguishes `C:\file` (rooted) from `C:file` (relative to the current directory on C:) and documents the classic 260-character `MAX_PATH` limit before Windows 10's opt-in long-path behavior.
- [Windows 2000 command-line administration reference](https://hlevkin.com/hlevkin/92usefulBooks/Windows/Mueller%20-%20Windows%20Administration%20at%20the%20Command%20Line%20for%20Windows%202003%20Windows%20XP%20and%20Windows%202000%20I.pdf): documents `MKDIR`/`MD` creating intermediate directories with a single command.
- [Windows 2000 command-line administration reference](https://hlevkin.com/hlevkin/92usefulBooks/Windows/Mueller%20-%20Windows%20Administration%20at%20the%20Command%20Line%20for%20Windows%202003%20Windows%20XP%20and%20Windows%202000%20I.pdf): documents `ATTRIB`'s four DOS attributes and recursive `/S`/`/D` syntax; current [Microsoft Learn: ATTRIB](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/attrib) corroborates that `/S` processes matching files recursively and `/D` includes directories.
- [Microsoft Learn: REN (previous versions)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-R2-and-2012/cc754276%28v%3Dws.11%29): includes Windows Server 2000 in its applicability list and documents wildcard source/destination names, positional wildcard mapping, same-directory behavior, and collision errors.
- [Windows 2000 Commands Pocket Reference](https://elhacker.info/manuales/OReilly%204%20GB%20Collection/O%27Reilly%20-%20Windows%202000%20Commands%20Pocket%20Reference.pdf): period reference for `COPY /N`, `COPY`/`MOVE /Y` and `/-Y`, `DEL`/`DIR` options, `/A` attribute selection, `/O` sort keys (`N`, `E`, `G`, `S`, `D`), `/T` Creation/Access/Write timestamps, `/S` recursion, `MOVE files destination`, the `D` directory code for `DIR`, and distinct `/Q` (no confirmations) versus `/P` (confirm each deletion).
- [Microsoft KB 240268: COPY, XCOPY, and MOVE Overwrite Functionality Changes in Windows](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/240/268.HTM): Windows 2000-specific overwrite prompts, `/Y` and `/-Y`, `COPYCMD`, and the batch-script exception.
- [Microsoft Windows 2000 Server Operations Guide: Using Long File Names](https://flylib.com/books/en/2.901.1.54/1/): documents that Windows 2000's command-line wildcard matching for `COPY` and `DEL` checks both long names and their short 8.3 aliases.
- [Microsoft Learn: DEL](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc771049%28v%3Dws.11%29): corroborates DEL's `/A` filters, including the `-` exclusion prefix, and `/Q`/`/P` semantics; Windows 2000-specific option codes are taken from the period reference above.
- [Microsoft Learn: COPY](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/copy): corroborates the `/Y`, `/-Y`, `/N`, `/V`, and `COPYCMD` behavior; Windows 2000 batch semantics use KB 240268 above.
- [Microsoft Learn: DIR](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/dir): corroborates that `DIR` omits Hidden/System by default, `/A` alone shows all, `/A` combines and negates attributes, `/O` chains or reverses sort keys, and `/T` selects timestamps for display and date sorting; current documentation is used as corroboration for the Windows 2000 command reference.
- [Microsoft Learn: MS-FSCC 8.3 Filename](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/18e63b13-ba43-4f5f-a5b7-11e871b71f14): defines the character and length constraints for an 8.3/DOS filename.
- [Microsoft Learn: File Times](https://learn.microsoft.com/en-us/windows/win32/sysinfo/file-times): FAT creation time resolves to 10 ms, write time to 2 seconds, and access time to one day (the access date).
- [Microsoft Learn: GetFileTime](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfiletime): defines last-access time as including the last time a file or directory was read or written.
- [Raymond Chen, The Old New Thing: Explorer preserves Date modified on copy](https://devblogs.microsoft.com/oldnewthing/20120306-00/?p=8163): explains why a copied file retains the same last-write timestamp; this matches the VFS's two-second FAT timestamp model.
- [Windows 2000 Explorer creation-date discussion (2005)](https://groups.google.com/g/microsoft.public.win2000.general/c/u8LG9xwoAJg): contemporary users describe Explorer setting a copied file's Creation time to the copy date while preserving the original content date; community recollection, not a Microsoft specification.
- [Contemporary Windows 2000/XP Explorer report](https://msfn.org/board/topic/30603-explorer-prompts-for-del-exe-and-mov-of-files/): describes Explorer asking before deleting, moving, or renaming Read-only files; treated as an observed-era behavior report, not a format specification.
- [NIST: Security Administration Guidance for Windows 2000 Professional](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-43.pdf): period-specific baseline with the Recycle Bin quota set to 10%.
- [Microsoft KB 136517: How the Recycle Bin Stores Files](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/136/517.HTM): documents the per-volume Recycled directory, original-path metadata, restoration, and removal of older items when the quota is exceeded. Its listed platforms are Windows 95/98 and NT 4.0; using the documented quota behavior for Windows 2000 is an era-continuity inference.
- [Rifiuti2 technical notes](https://abelcheung.github.io/rifiuti2/technical/): forensic reference distinguishing FAT16/32 `C:\RECYCLED` from NTFS `C:\RECYCLER\<SID>` and describing the historical `INFO2` index.
- [Reverse-engineered INFO2 format notes](https://github.com/danielmarschall/recyclebinunit/blob/master/FORMAT.md): v5/800-byte Unicode record fields, `Dc<drive><number>.<ext>` payload names, FAT/NTFS locations, and record tombstoning. This is community forensic research rather than a Microsoft specification; it is used as the concrete implementation reference for the virtual FAT16 volume.
- [Microsoft Windows 2000 Server Operations Guide: FAT File System](https://bitsavers.trailing-edge.com/pdf/microsoft/windows_2000/097-0002722_Windows_2000_Server_Operations_Guide_2000.pdf): documents 32 KB clusters for a 2 GB FAT16 volume and explains that allocation is cluster-granular.
- [Microsoft Windows 2000 profile guidance](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/314/045.HTM): default profile placement under `Documents and Settings`.
- [Windows 2000 color reference](https://desktopcolors.com/os/windows-2000): desktop blue `#3a6ea5`.
- [Running Microsoft Windows 2000 Professional: Removing Items from the Documents Menu](https://flylib.com/books/en/3.229.1.22/1/): the Documents menu reflects the profile's Recent folder, displays its newest 15 shortcuts, and the Advanced-tab Clear command empties Recent (including unrecognized entries).
- [Windows 2000 Exercises (PDF)](https://knowware.dk/down/windows_2000_exercises.pdf): period screenshots and walkthroughs for the General/Advanced Taskbar properties tabs, Auto hide, Always on top, Show clock, and Recent-folder clearing.
- [Sams Teach Yourself Microsoft Windows 2000 Professional: Customizing the Taskbar](https://www.informit.com/articles/article.aspx?p=411736&seqNum=161): documents the taskbar property-sheet controls and their visible effects, including personalized menus and small Start-menu icons.
- [Windows 2000 Quick Fixes: Add a new option to the Send To menu](https://www.oreilly.com/library/view/windows-2000-quick/0596000170/ch04s13.html): contemporary source identifies Send To on Windows 2000's common context menu, describes Desktop as a shortcut action and My Documents as a copy destination, and says the menu reads the profile's SendTo folder.
- [Windows 2000 Exercises (PDF)](https://knowware.dk/down/windows_2000_exercises.pdf): period screenshots show the default `3½ Floppy (A:)`, Desktop, Mail Recipient, and My Documents menu entries; the exercise copies files to a floppy and notes the 1.44 MB capacity.
- [University of Wisconsin KB: Windows — Creating Shortcuts](https://kb.wisc.edu/helpdesk/page.php?id=198): period-era walkthrough gives the exact right-click → Send to → Desktop (create shortcut) sequence.
