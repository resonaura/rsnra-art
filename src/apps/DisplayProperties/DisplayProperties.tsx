import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Button,
  Checkbox,
  GroupBox,
  Monitor,
  Select,
  Separator,
  Tab,
  TabBody,
  Tabs,
  NumberInput,
} from "react95";
import styled, { ThemeProvider } from "styled-components";
import { R95_SCALE } from "../../react95.conf";
import { PATTERN_NAMES, patternDataUri } from "../../lib/patterns";
import { SCREENSAVERS, getScreenSaver } from "../../screensavers";
import {
  WALLPAPER_DIR,
  DEFAULT_WALLPAPER_FILES,
  wallpaperLabel,
  wallpaperUrl,
} from "../../data/wallpapers";
import { iconPickerPool } from "../../data/fileIcons";
import { THEMES, getThemeById, useThemeStore } from "../../store/themeStore";
import {
  DEFAULT_DESKTOP_ICONS,
  useDisplayStore,
  type ColorDepth,
  type DesktopIconSlot,
  type WallpaperMode,
} from "../../store/displayStore";
import { useVfsStore } from "../../store/vfsStore";
import { useSaverRunStore } from "../../store/saverRunStore";
import { useWindowStore } from "../../store/windowStore";
import { FileDialog } from "../../components/FileDialog/FileDialog";
import { IconPickerDialog } from "../../components/IconPickerDialog/IconPickerDialog";
import { SystemDialog } from "../../components/SystemDialog/SystemDialog";

// ─── staged state ─────────────────────────────────────────────────────────────

/**
 * Everything the dialog edits, staged locally and committed to the stores only
 * on OK/Apply — Cancel discards, exactly like the real Windows dialog.
 */
interface StagedState {
  wallpaperPath: string | null;
  wallpaperMode: WallpaperMode;
  pattern: string | null;
  desktopColor: string;
  screenSaverId: string;
  screenSaverWait: number;
  screenSaverPassword: boolean;
  zoom: number;
  colorDepth: ColorDepth;
  transitionEffects: boolean;
  smoothFonts: boolean;
  largeIcons: boolean;
  fullColorIcons: boolean;
  dragFullWindows: boolean;
  desktopIcons: Record<DesktopIconSlot, string>;
  themeId: string;
}

type UpdateStaged = (partial: Partial<StagedState>) => void;

const SCALAR_KEYS = [
  "wallpaperPath",
  "wallpaperMode",
  "pattern",
  "desktopColor",
  "screenSaverId",
  "screenSaverWait",
  "screenSaverPassword",
  "zoom",
  "colorDepth",
  "transitionEffects",
  "smoothFonts",
  "largeIcons",
  "fullColorIcons",
  "dragFullWindows",
] as const;

const ICON_SLOTS: { slot: DesktopIconSlot; label: string }[] = [
  { slot: "myComputer", label: "My Computer" },
  { slot: "myDocuments", label: "My Documents" },
  { slot: "recycleEmpty", label: "Recycle Bin\n(empty)" },
  { slot: "recycleFull", label: "Recycle Bin\n(full)" },
];

// ─── styled shells ────────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 11px;
`;

const Body = styled(TabBody)`
  padding: 10px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow: auto;
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px 10px;
  flex-shrink: 0;
`;

// ─── Monitor preview ──────────────────────────────────────────────────────────

// Inner screen area of the react95 <Monitor> (195×155 body minus 12px padding
// and 4px borders) — used to scale the wallpaper faithfully into the preview.
const PREVIEW_W = 163;

const MiniTaskbar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 9px;
  background: ${({ theme }) => theme.material};
  border-top: 1px solid ${({ theme }) => theme.borderLightest};
  display: flex;
  align-items: center;
  padding-left: 2px;
  gap: 1px;
`;

const MiniStart = styled.div`
  width: 20px;
  height: 7px;
  background: ${({ theme }) => theme.material};
  border: 1px solid ${({ theme }) => theme.borderDark};
  font-size: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MiniWindow = styled.div`
  position: absolute;
  top: 8px;
  left: 10px;
  width: 80px;
  height: 52px;
  background: ${({ theme }) => theme.material};
  border: 1px solid ${({ theme }) => theme.borderDarkest};
`;

const MiniTitleBar = styled.div`
  height: 9px;
  background: ${({ theme }) => theme.headerBackground};
  display: flex;
  align-items: center;
  padding: 0 2px;
  gap: 1px;
`;

const MiniClose = styled.div`
  width: 6px;
  height: 6px;
  background: ${({ theme }) => theme.material};
  border: 1px solid ${({ theme }) => theme.borderDark};
  margin-left: auto;
  font-size: 4px;
  line-height: 5px;
  text-align: center;
  color: #000;
`;

/** Natural pixel size of an image URL, for faithful mini-preview scaling. */
function useImageSize(url: string | null): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return size;
}

/**
 * The desktop, shrunk into the monitor preview: color, then pattern, then the
 * wallpaper rendered at the same relative size it would have on the real
 * (zoomed) screen.
 */
function usePreviewBackground(staged: StagedState): CSSProperties {
  const readVfs = useVfsStore((s) => s.read);
  const wpUrl = staged.wallpaperPath
    ? wallpaperUrl(staged.wallpaperPath, readVfs)
    : null;
  const imgSize = useImageSize(wpUrl);

  return useMemo(() => {
    const screenW = Math.max(1, window.innerWidth / staged.zoom);
    const scale = PREVIEW_W / screenW;
    const layers: { img: string; repeat: string; size: string; pos: string }[] =
      [];
    if (wpUrl) {
      const w = imgSize ? Math.max(3, imgSize.w * scale) : 0;
      const h = imgSize ? Math.max(3, imgSize.h * scale) : 0;
      layers.push({
        img: `url("${wpUrl}")`,
        repeat: staged.wallpaperMode === "tile" ? "repeat" : "no-repeat",
        size:
          staged.wallpaperMode === "stretch"
            ? "100% 100%"
            : imgSize
              ? `${w}px ${h}px`
              : "auto",
        pos: staged.wallpaperMode === "center" ? "center" : "0 0",
      });
    }
    const patternUri = patternDataUri(staged.pattern);
    if (patternUri) {
      const p = Math.max(2, 8 * scale);
      layers.push({
        img: `url("${patternUri}")`,
        repeat: "repeat",
        size: `${p}px ${p}px`,
        pos: "0 0",
      });
    }
    return {
      backgroundColor: staged.desktopColor,
      backgroundImage: layers.map((l) => l.img).join(", ") || undefined,
      backgroundRepeat: layers.map((l) => l.repeat).join(", ") || undefined,
      backgroundSize: layers.map((l) => l.size).join(", ") || undefined,
      backgroundPosition: layers.map((l) => l.pos).join(", ") || undefined,
      imageRendering: "pixelated" as const,
    };
  }, [
    wpUrl,
    imgSize,
    staged.zoom,
    staged.wallpaperMode,
    staged.pattern,
    staged.desktopColor,
  ]);
}

const MonitorWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
`;

function MonitorPreview({
  screenStyle,
  children,
}: {
  screenStyle?: CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <MonitorWrap>
      <Monitor backgroundStyles={{ background: "#000", ...screenStyle }}>
        {children}
      </Monitor>
    </MonitorWrap>
  );
}

// ─── Background tab ───────────────────────────────────────────────────────────

const BgListWrap = styled.div`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
  height: 110px;
  overflow-y: auto;
  background: ${({ theme }) => theme.canvas};
`;

const BgListItem = styled.div<{ $active: boolean }>`
  padding: 2px 6px;
  background: ${({ $active, theme }) =>
    $active ? theme.headerBackground : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.headerText : theme.canvasText};
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

function BackgroundTab({
  staged,
  update,
}: {
  staged: StagedState;
  update: UpdateStaged;
}) {
  const [showBrowse, setShowBrowse] = useState(false);
  const previewStyle = usePreviewBackground(staged);

  const wallpaperItems: { label: string; value: string | null }[] = [
    { label: "(None)", value: null },
    ...DEFAULT_WALLPAPER_FILES.map((f) => ({
      label: wallpaperLabel(`${WALLPAPER_DIR}\\${f}`),
      value: `${WALLPAPER_DIR}\\${f}`,
    })),
  ];
  // A wallpaper picked via Browse… that isn't part of the default set still
  // shows (selected) in the list, like the real dialog.
  if (
    staged.wallpaperPath &&
    !wallpaperItems.some((i) => i.value === staged.wallpaperPath)
  ) {
    wallpaperItems.push({
      label: wallpaperLabel(staged.wallpaperPath),
      value: staged.wallpaperPath,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      <MonitorPreview screenStyle={previewStyle}>
        <MiniWindow>
          <MiniTitleBar>
            <MiniClose>×</MiniClose>
          </MiniTitleBar>
        </MiniWindow>
        <MiniTaskbar>
          <MiniStart>Start</MiniStart>
        </MiniTaskbar>
      </MonitorPreview>

      <GroupBox label="Wallpaper">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Select an HTML Document or a picture:</span>
          <BgListWrap>
            {wallpaperItems.map((item) => (
              <BgListItem
                key={item.value ?? "__none__"}
                $active={item.value === staged.wallpaperPath}
                onClick={() => update({ wallpaperPath: item.value })}
              >
                {item.label}
              </BgListItem>
            ))}
          </BgListWrap>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
          >
            <Button onClick={() => setShowBrowse(true)} style={{ width: 80 }}>
              Browse...
            </Button>
            <div
              style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}
            >
              <span style={{ whiteSpace: "nowrap" }}>Picture Display:</span>
              <Select
                value={staged.wallpaperMode}
                onChange={(opt: { value: string }) =>
                  update({ wallpaperMode: opt.value as WallpaperMode })
                }
                options={[
                  { value: "center", label: "Center" },
                  { value: "tile", label: "Tile" },
                  { value: "stretch", label: "Stretch" },
                ]}
                style={{ flex: 1, minWidth: 80 }}
              />
            </div>
          </div>
        </div>
      </GroupBox>

      <GroupBox label="Pattern">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Select
            value={staged.pattern ?? "(None)"}
            onChange={(opt: { value: string }) =>
              update({ pattern: opt.value === "(None)" ? null : opt.value })
            }
            options={PATTERN_NAMES.map((p) => ({ value: p, label: p }))}
            style={{ flex: 1 }}
          />
          <Button disabled style={{ width: 96 }}>
            Edit Pattern...
          </Button>
        </div>
      </GroupBox>

      {showBrowse && (
        <FileDialog
          title="Browse for Wallpaper"
          mode="open"
          filters={[
            {
              label: "Image Files (*.bmp;*.png;*.jpg)",
              extensions: ["bmp", "png", "jpg", "jpeg", "gif"],
            },
            { label: "All Files (*.*)", extensions: [] },
          ]}
          onConfirm={(path) => {
            update({ wallpaperPath: path });
            setShowBrowse(false);
          }}
          onCancel={() => setShowBrowse(false)}
        />
      )}
    </div>
  );
}

// ─── Screen Saver tab ─────────────────────────────────────────────────────────

function ScreenSaverTab({
  staged,
  update,
}: {
  staged: StagedState;
  update: UpdateStaged;
}) {
  const runSaver = useSaverRunStore((s) => s.run);

  const saverDef =
    staged.screenSaverId !== "none" ? getScreenSaver(staged.screenSaverId) : null;
  const SaverComponent = saverDef?.Component ?? null;

  const saverOptions = [
    { value: "none", label: "(None)" },
    ...SCREENSAVERS.map((s) => ({ value: s.id, label: s.label })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      <MonitorPreview>
        {SaverComponent && <SaverComponent preview />}
      </MonitorPreview>

      <GroupBox label="Screen Saver">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Select
              value={staged.screenSaverId}
              onChange={(opt: { value: string }) =>
                update({ screenSaverId: opt.value })
              }
              options={saverOptions}
              style={{ flex: 1 }}
            />
            <Button disabled={!saverDef?.Settings} style={{ width: 80 }}>
              Settings...
            </Button>
            <Button
              disabled={staged.screenSaverId === "none"}
              style={{ width: 80 }}
              onClick={() => {
                if (staged.screenSaverId !== "none")
                  runSaver(staged.screenSaverId);
              }}
            >
              Preview
            </Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Wait:</span>
            <NumberInput
              value={staged.screenSaverWait}
              onChange={(v: number) => update({ screenSaverWait: v })}
              min={1}
              max={60}
              style={{ width: 60 }}
            />
            <span>minutes</span>
            <Checkbox
              label="Password protected"
              checked={staged.screenSaverPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update({ screenSaverPassword: e.target.checked })
              }
              style={{ marginLeft: 12 }}
            />
          </div>
        </div>
      </GroupBox>

      <GroupBox label="Energy saving features of monitor">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ margin: 0, flex: 1 }}>
            To adjust the power settings for your monitor, click Settings.
          </p>
          <Button disabled style={{ width: 80 }}>
            Settings...
          </Button>
        </div>
      </GroupBox>
    </div>
  );
}

// ─── Appearance tab ───────────────────────────────────────────────────────────

const WIN_PALETTE = [
  "#000000", "#800000", "#008000", "#808000",
  "#000080", "#800080", "#008080", "#808080",
  "#C0C0C0", "#FF0000", "#00FF00", "#FFFF00",
  "#0000FF", "#FF00FF", "#00FFFF", "#FFFFFF",
  "#2d1b4e", "#3a6ea5", "#5f9ea0", "#654321",
];

const AppearancePreviewBox = styled.div<{ $bg: string }>`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
  height: 96px;
  position: relative;
  overflow: hidden;
  background: ${({ $bg }) => $bg};
`;

const PreviewMiniWin = styled.div`
  position: absolute;
  top: 24px;
  left: 12px;
  width: 150px;
  height: 66px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const PreviewTitleBar = styled.div`
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.headerBackground},
    ${({ theme }) => theme.headerNotActiveBackground ?? theme.headerBackground}
  );
  color: ${({ theme }) => theme.headerText};
  height: 14px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  font-size: 9px;
  font-weight: bold;
`;

const PreviewMiniBtn = styled.div`
  width: 12px;
  height: 10px;
  background: ${({ theme }) => theme.material};
  border: 1px solid ${({ theme }) => theme.borderDark};
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  color: ${({ theme }) => theme.materialText};
`;

const PreviewBody = styled.div`
  padding: 4px;
  font-size: 9px;
  color: ${({ theme }) => theme.materialText};
`;

const PreviewInactiveWin = styled.div`
  position: absolute;
  top: 8px;
  left: 34px;
  width: 150px;
  height: 60px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const InactiveTitleBar = styled.div`
  background: ${({ theme }) => theme.headerNotActiveBackground ?? theme.borderDark};
  height: 14px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  font-size: 9px;
  font-weight: bold;
  color: ${({ theme }) => theme.headerNotActiveText ?? "#c0c0c0"};
`;

const Swatch = styled.button<{ $color: string; $disabled?: boolean }>`
  width: 40px;
  height: 20px;
  background: ${({ $color }) => $color};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  padding: 0;
`;

const PaletteWrap = styled.div`
  position: absolute;
  z-index: 10;
  top: 24px;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, 20px);
  gap: 2px;
  padding: 4px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const PaletteCell = styled.button<{ $color: string; $active: boolean }>`
  width: 20px;
  height: 16px;
  padding: 0;
  background: ${({ $color }) => $color};
  border: 1px solid ${({ $active }) => ($active ? "#fff" : "#000")};
  outline: ${({ $active }) => ($active ? "1px solid #000" : "none")};
  cursor: pointer;
`;

function AppearanceTab({
  staged,
  update,
}: {
  staged: StagedState;
  update: UpdateStaged;
}) {
  const [item, setItem] = useState("desktop");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const schemeOptions = THEMES.map((t) => ({ value: t.id, label: t.label }));
  const stagedTheme = getThemeById(staged.themeId);
  const colorEditable = item === "desktop";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ThemeProvider theme={stagedTheme}>
        <AppearancePreviewBox $bg={staged.desktopColor}>
          <PreviewInactiveWin>
            <InactiveTitleBar>Inactive Window</InactiveTitleBar>
          </PreviewInactiveWin>
          <PreviewMiniWin>
            <PreviewTitleBar>
              Active Window
              <PreviewMiniBtn>×</PreviewMiniBtn>
            </PreviewTitleBar>
            <PreviewBody>Window Text</PreviewBody>
          </PreviewMiniWin>
        </AppearancePreviewBox>
      </ThemeProvider>

      <GroupBox label="Scheme">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Select
            value={staged.themeId}
            onChange={(opt: { value: string }) => update({ themeId: opt.value })}
            options={schemeOptions}
            style={{ flex: 1 }}
          />
          <Button disabled style={{ width: 72 }}>
            Save As...
          </Button>
          <Button disabled style={{ width: 64 }}>
            Delete
          </Button>
        </div>
      </GroupBox>

      <GroupBox label="Item">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Select
              value={item}
              onChange={(opt: { value: string }) => {
                setItem(opt.value);
                setPaletteOpen(false);
              }}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "window", label: "Active Title Bar" },
                { value: "inactive", label: "Inactive Title Bar" },
                { value: "menu", label: "Menu" },
                { value: "msgbox", label: "Message Box" },
                { value: "tooltip", label: "Tooltip" },
              ]}
              style={{ flex: 1 }}
            />
            <span style={{ whiteSpace: "nowrap" }}>Color:</span>
            <div style={{ position: "relative" }}>
              <Swatch
                $color={colorEditable ? staged.desktopColor : "#c0c0c0"}
                $disabled={!colorEditable}
                onClick={() => colorEditable && setPaletteOpen((o) => !o)}
              />
              {paletteOpen && colorEditable && (
                <PaletteWrap>
                  {WIN_PALETTE.map((c) => (
                    <PaletteCell
                      key={c}
                      $color={c}
                      $active={c === staged.desktopColor}
                      onClick={() => {
                        update({ desktopColor: c });
                        setPaletteOpen(false);
                      }}
                    />
                  ))}
                </PaletteWrap>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Font:</span>
            <Select
              value="sans"
              onChange={() => {}}
              options={[{ value: "sans", label: "MS Sans Serif" }]}
              style={{ flex: 1 }}
              disabled
            />
            <span>Size:</span>
            <Select
              value="8"
              onChange={() => {}}
              options={[{ value: "8", label: "8" }]}
              style={{ width: 52 }}
              disabled
            />
          </div>
        </div>
      </GroupBox>
    </div>
  );
}

// ─── Effects tab ──────────────────────────────────────────────────────────────

const IconSlot = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 76px;
  padding: 6px 2px 4px;
  border: 1px dotted
    ${({ $selected, theme }) => ($selected ? theme.borderDarkest : "transparent")};
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.materialText};
  cursor: pointer;
  font-size: 9px;
  font-family: inherit;
  text-align: center;
  white-space: pre-line;
`;

function EffectsTab({
  staged,
  update,
}: {
  staged: StagedState;
  update: UpdateStaged;
}) {
  const [selectedSlot, setSelectedSlot] = useState<DesktopIconSlot>("myComputer");
  const [showPicker, setShowPicker] = useState(false);

  const setSlotIcon = (icon: string) =>
    update({ desktopIcons: { ...staged.desktopIcons, [selectedSlot]: icon } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <GroupBox label="Desktop icons">
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "flex-start",
            marginBottom: 8,
            justifyContent: "center",
          }}
        >
          {ICON_SLOTS.map(({ slot, label }) => (
            <IconSlot
              key={slot}
              $selected={selectedSlot === slot}
              onClick={() => setSelectedSlot(slot)}
              onDoubleClick={() => setShowPicker(true)}
            >
              <img
                src={staged.desktopIcons[slot]}
                width={32}
                height={32}
                style={{ imageRendering: "pixelated" }}
              />
              {label}
            </IconSlot>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button style={{ width: 120 }} onClick={() => setShowPicker(true)}>
            Change Icon...
          </Button>
          <Button
            style={{ width: 120 }}
            disabled={
              staged.desktopIcons[selectedSlot] ===
              DEFAULT_DESKTOP_ICONS[selectedSlot]
            }
            onClick={() => setSlotIcon(DEFAULT_DESKTOP_ICONS[selectedSlot])}
          >
            Default Icon
          </Button>
        </div>
      </GroupBox>

      <GroupBox label="Visual effects">
        <Checkbox
          label="Use transition effects for menus and tooltips"
          checked={staged.transitionEffects}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            update({ transitionEffects: e.target.checked })
          }
        />
        <Checkbox
          label="Smooth edges of screen fonts"
          checked={staged.smoothFonts}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            update({ smoothFonts: e.target.checked })
          }
          style={{ marginTop: 4 }}
        />
        <Checkbox
          label="Use large icons"
          checked={staged.largeIcons}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            update({ largeIcons: e.target.checked })
          }
          style={{ marginTop: 4 }}
        />
        <Checkbox
          label="Show icons using all possible colors"
          checked={staged.fullColorIcons}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            update({ fullColorIcons: e.target.checked })
          }
          style={{ marginTop: 4 }}
        />
        <Checkbox
          label="Show window contents while dragging"
          checked={staged.dragFullWindows}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            update({ dragFullWindows: e.target.checked })
          }
          style={{ marginTop: 4 }}
        />
        <Checkbox
          label="Hide keyboard navigation indicators until I use the Alt key"
          disabled
          style={{ marginTop: 4 }}
        />
      </GroupBox>

      {showPicker && (
        <IconPickerDialog
          title="Change Icon"
          icons={iconPickerPool()}
          current={staged.desktopIcons[selectedSlot]}
          onPick={setSlotIcon}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

// Screen-area steps, "Less" → "More". More screen area = higher simulated
// resolution = everything renders smaller, i.e. a lower body zoom.
const ZOOM_STEPS = [2.0, 1.5, 1.25, 1.0, 0.75, 0.67, 0.5];

function zoomToResLabel(zoom: number): string {
  const rw = Math.round(window.innerWidth / zoom);
  const rh = Math.round(window.innerHeight / zoom);
  return `${rw} by ${rh} pixels`;
}

const ResSlider = styled.input`
  width: 100%;
  accent-color: ${({ theme }) => theme.headerBackground};
`;

const ColorDepthOptions = [
  { value: 4, label: "16 Colors" },
  { value: 8, label: "256 Colors" },
  { value: 16, label: "High Color (16 bit)" },
  { value: 32, label: "True Color (32 bit)" },
];

const DepthStrip = styled.div<{ $depth: ColorDepth }>`
  height: 12px;
  margin-top: 4px;
  border: 1px solid ${({ theme }) => theme.borderDark};
  background: linear-gradient(
    90deg,
    red, yellow, lime, cyan, blue, magenta, red
  );
  image-rendering: pixelated;
  filter: ${({ $depth }) =>
    $depth === 4 ? "saturate(1.4) contrast(2)" : $depth === 8 ? "contrast(1.3)" : "none"};
`;

function SettingsTab({
  staged,
  update,
}: {
  staged: StagedState;
  update: UpdateStaged;
}) {
  const previewStyle = usePreviewBackground(staged);

  // Re-render on browser resize so the simulated resolution label stays true.
  const [, forceResize] = useState(0);
  useEffect(() => {
    const onResize = () => forceResize((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stepIdx = ZOOM_STEPS.reduce(
    (best, step, i) =>
      Math.abs(step - staged.zoom) < Math.abs(ZOOM_STEPS[best] - staged.zoom)
        ? i
        : best,
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MonitorPreview screenStyle={previewStyle}>
        <MiniWindow>
          <MiniTitleBar>
            <MiniClose>×</MiniClose>
          </MiniTitleBar>
        </MiniWindow>
        <MiniTaskbar>
          <MiniStart>Start</MiniStart>
        </MiniTaskbar>
      </MonitorPreview>

      <div style={{ display: "flex", gap: 10 }}>
        <GroupBox label="Colors" style={{ flex: 1 }}>
          <Select
            value={staged.colorDepth}
            onChange={(opt: { value: number }) =>
              update({ colorDepth: opt.value as ColorDepth })
            }
            options={ColorDepthOptions}
            style={{ width: "100%" }}
          />
          <DepthStrip $depth={staged.colorDepth} />
        </GroupBox>

        <GroupBox label="Screen area" style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
            }}
          >
            <span>Less</span>
            <span>More</span>
          </div>
          <ResSlider
            type="range"
            min={0}
            max={ZOOM_STEPS.length - 1}
            step={1}
            value={stepIdx}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              update({ zoom: ZOOM_STEPS[Number(e.target.value)] })
            }
          />
          <div style={{ textAlign: "center", fontWeight: "bold" }}>
            {zoomToResLabel(staged.zoom)}
          </div>
        </GroupBox>
      </div>

      <Separator />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>Font size:</span>
        <Select
          value="normal"
          onChange={() => {}}
          options={[
            { value: "small", label: "Small Fonts" },
            { value: "normal", label: "Normal Size" },
            { value: "large", label: "Large Fonts" },
          ]}
          style={{ flex: 1 }}
          disabled
        />
        <Button disabled style={{ width: 90 }}>
          Advanced...
        </Button>
      </div>
    </div>
  );
}

// ─── Monitor-settings confirmation (after Screen area change) ─────────────────

const CONFIRM_SECONDS = 15;

function MonitorSettingsConfirm({
  onKeep,
  onRevert,
}: {
  onKeep: () => void;
  onRevert: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(CONFIRM_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onRevert();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onRevert]);

  return (
    <SystemDialog
      title="Monitor Settings"
      width={360}
      placement="top-left"
      closable={false}
      zIndex={600000}
    >
      <div style={{ padding: "12px 14px 10px", fontSize: 12 }}>
        <p style={{ margin: "0 0 8px" }}>
          Your desktop has been reconfigured. Do you want to keep these
          settings?
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Reverting in {secondsLeft} second{secondsLeft === 1 ? "" : "s"}.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <Button primary style={{ width: 80 }} onClick={onKeep}>
            Yes
          </Button>
          <Button style={{ width: 80 }} onClick={onRevert}>
            No
          </Button>
        </div>
      </div>
    </SystemDialog>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function DisplayProperties({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const display = useDisplayStore();
  const themeId = useThemeStore((s) => s.themeId);
  const setThemeId = useThemeStore((s) => s.setThemeId);

  const [tab, setTab] = useState("Background");
  const [staged, setStaged] = useState<StagedState>(() => ({
    wallpaperPath: display.wallpaperPath,
    wallpaperMode: display.wallpaperMode,
    pattern: display.pattern,
    desktopColor: display.desktopColor,
    screenSaverId: display.screenSaverId,
    screenSaverWait: display.screenSaverWait,
    screenSaverPassword: display.screenSaverPassword,
    zoom: display.zoom,
    colorDepth: display.colorDepth,
    transitionEffects: display.transitionEffects,
    smoothFonts: display.smoothFonts,
    largeIcons: display.largeIcons,
    fullColorIcons: display.fullColorIcons,
    dragFullWindows: display.dragFullWindows,
    desktopIcons: { ...display.desktopIcons },
    themeId,
  }));
  const update: UpdateStaged = (partial) =>
    setStaged((s) => ({ ...s, ...partial }));

  // Pending "keep these settings?" confirmation after a Screen area change.
  const [zoomConfirm, setZoomConfirm] = useState<{
    prevZoom: number;
    closeAfter: boolean;
  } | null>(null);

  const dirty =
    SCALAR_KEYS.some((k) => staged[k] !== display[k]) ||
    staged.themeId !== themeId ||
    ICON_SLOTS.some(
      ({ slot }) => staged.desktopIcons[slot] !== display.desktopIcons[slot],
    );

  const commit = () => {
    const { themeId: stagedThemeId, ...displayPartial } = staged;
    display.set({
      ...displayPartial,
      desktopIcons: { ...staged.desktopIcons },
    });
    if (stagedThemeId !== themeId) setThemeId(stagedThemeId);
  };

  const handleApply = (closeAfter: boolean) => {
    const prevZoom = useDisplayStore.getState().zoom;
    commit();
    if (staged.zoom !== prevZoom) {
      // The desktop just resized under the user — ask (Windows-style, with a
      // countdown) whether to keep it; no answer means revert.
      setZoomConfirm({ prevZoom, closeAfter });
    } else if (closeAfter) {
      closeWindow(windowId);
    }
  };

  const keepZoom = () => {
    const closeAfter = zoomConfirm?.closeAfter;
    setZoomConfirm(null);
    if (closeAfter) closeWindow(windowId);
  };

  const revertZoom = () => {
    if (zoomConfirm) {
      useDisplayStore.getState().set({ zoom: zoomConfirm.prevZoom });
      update({ zoom: zoomConfirm.prevZoom });
    }
    setZoomConfirm(null);
  };

  return (
    <Root style={{ zoom: R95_SCALE }}>
      <Tabs value={tab} onChange={(v: string) => setTab(v)}>
        <Tab value="Background">Background</Tab>
        <Tab value="Screen Saver">Screen Saver</Tab>
        <Tab value="Appearance">Appearance</Tab>
        <Tab value="Effects">Effects</Tab>
        <Tab value="Settings">Settings</Tab>
      </Tabs>
      <Body>
        {tab === "Background" && (
          <BackgroundTab staged={staged} update={update} />
        )}
        {tab === "Screen Saver" && (
          <ScreenSaverTab staged={staged} update={update} />
        )}
        {tab === "Appearance" && (
          <AppearanceTab staged={staged} update={update} />
        )}
        {tab === "Effects" && <EffectsTab staged={staged} update={update} />}
        {tab === "Settings" && <SettingsTab staged={staged} update={update} />}
      </Body>
      <BtnRow>
        <Button style={{ width: 72 }} onClick={() => handleApply(true)}>
          OK
        </Button>
        <Button style={{ width: 72 }} onClick={() => closeWindow(windowId)}>
          Cancel
        </Button>
        <Button
          style={{ width: 72 }}
          disabled={!dirty}
          onClick={() => handleApply(false)}
        >
          Apply
        </Button>
      </BtnRow>

      {zoomConfirm && (
        <MonitorSettingsConfirm onKeep={keepZoom} onRevert={revertZoom} />
      )}
    </Root>
  );
}
