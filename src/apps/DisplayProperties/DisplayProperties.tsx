import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Button,
  Checkbox,
  GroupBox,
  Monitor,
  NumberInput,
  Window as R95Window,
  Select,
  Separator,
  Tab,
  TabBody,
  Tabs,
  TextInput,
  WindowHeader,
} from "react95";
import type { Theme } from "react95/dist/themes/types";
import styled, { ThemeProvider } from "styled-components";
import { ColorPickerDialog } from "../../components/ColorPickerDialog/ColorPickerDialog";
import { FileDialog } from "../../components/FileDialog/FileDialog";
import { Icon } from "../../components/Icon/Icon";
import { IconPickerDialog } from "../../components/IconPickerDialog/IconPickerDialog";
import { ScrollArea } from "../../components/ScrollArea";
import { Slider95 } from "../../components/Slider95/Slider95";
import { SystemDialog } from "../../components/SystemDialog/SystemDialog";
import { CloseGlyph } from "../../components/WindowManager/windowGlyphs";
import { iconPickerPool } from "../../data/fileIcons";
import {
  DEFAULT_WALLPAPER_FILES,
  WALLPAPER_DIR,
  wallpaperLabel,
  wallpaperUrl,
} from "../../data/wallpapers";
import { PATTERN_NAMES, patternDataUri } from "../../lib/patterns";
import { alertError, confirmDialog } from "../../lib/systemDialogs";
import { R95_SCALE } from "../../react95.conf";
import { SCREENSAVERS, getScreenSaver } from "../../screensavers";
import {
  DEFAULT_DESKTOP_ICONS,
  useDisplayStore,
  type ColorDepth,
  type DesktopIconSlot,
  type FontSizeOption,
  type WallpaperMode,
} from "../../store/displayStore";
import { useSaverRunStore } from "../../store/saverRunStore";
import {
  FONT_FAMILIES,
  ITEM_FONT_SIZES,
  THEMES,
  fontFamilyCss,
  isBuiltinLabel,
  resolveThemeId,
  useThemeStore,
  type AppearanceItemId,
  type ItemFont,
} from "../../store/themeStore";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

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
  fontSize: FontSizeOption;
  desktopIcons: Record<DesktopIconSlot, string>;
  themeId: string;
  /** Unsaved Appearance ▸ Item color tweaks layered on top of `themeId`. */
  themeOverrides: Partial<Theme>;
  /** Unsaved Appearance ▸ Item font tweaks. */
  itemFonts: Partial<Record<AppearanceItemId, ItemFont>>;
  /** Unsaved Active Title Bar "Color 2" (gradient end) tweak. */
  headerGradientEnd: string | null;
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
  "fontSize",
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

const BgListWrap = styled(ScrollArea)`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  height: 110px;
  background: ${({ theme }) => theme.canvas};
`;

const BgListItem = styled.div<{ $active: boolean }>`
  padding: 2px 6px;
  background: ${({ $active, theme }) =>
    $active ? theme.headerBackground : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.headerText : theme.canvasText};
  cursor: pointer;
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
          <BgListWrap isInReact95>
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
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
    staged.screenSaverId !== "none"
      ? getScreenSaver(staged.screenSaverId)
      : null;
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

const AppearancePreviewBox = styled.div<{ $bg: string }>`
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  height: 245px;
  position: relative;
  overflow: hidden;
  background: ${({ $bg }) => $bg};
`;

// Real react95 Window + WindowHeader, shrunk via `zoom` (the same technique
// AppWindow/SystemDialog use) so the preview is pixel-identical to an actual
// window — not an approximation — for whatever scheme is being edited.
const PreviewWinWrap = styled.div`
  position: absolute;
`;

const PreviewHeaderRow = styled(WindowHeader)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

// No size override here on purpose: react95's WindowHeader already sizes its
// own Button children (27×31, see react95's internal CSS) — matching that
// natively, rather than guessing pixel values, is what makes this read as a
// real window's close button instead of an approximation.
const PreviewCloseBtn = styled(Button)`
  flex-shrink: 0;
`;

// CloseGlyph bakes in R95_SCALE_COMPENSATION (1/0.7) so it renders at a crisp
// 16px once shrunk by the real app's `zoom: R95_SCALE` window wrapper. This
// preview zooms by a different factor, so wrapping the glyph in its own
// `zoom: R95_SCALE` span first cancels that bake-in back to a native 16px —
// which the preview's own outer zoom then scales consistently with
// everything else around it, instead of coming out oversized.
const GlyphZoomFix = styled.span`
  display: inline-flex;
  zoom: ${R95_SCALE};
`;

// "Normal / Disabled / Selected" sample row, demonstrating the scheme's
// regular, disabled, and selection colors side by side — same idea as the
// real dialog's listbox-state sample.
const StatesRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 4px 8px;
  font-size: 12px;
  background: ${({ theme }) => theme.material};
  border-bottom: 1px solid ${({ theme }) => theme.borderDark};
`;

const NormalSample = styled.span`
  color: ${({ theme }) => theme.materialText};
`;
const DisabledSample = styled.span`
  color: ${({ theme }) => theme.materialTextDisabled};
`;
const SelectedSample = styled.span`
  padding: 0 3px;
  background: ${({ theme }) => theme.headerBackground};
  color: ${({ theme }) => theme.headerText};
`;

const PreviewBody = styled.div`
  position: relative;
  display: flex;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: bold;
  background: ${({ theme }) => theme.canvas};
  color: ${({ theme }) => theme.canvasText};
  flex: 1;
`;

// Decorative (non-interactive) Win95 scrollbar, just for preview authenticity.
const FakeScrollbar = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 15px;
  background: ${({ theme }) => theme.material};
  border-left: 1px solid ${({ theme }) => theme.borderDark};
`;
const FakeScrollThumb = styled.div`
  position: absolute;
  top: 4px;
  left: 1px;
  right: 1px;
  height: 40px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest};
`;

const MsgBoxWrap = styled.div`
  position: absolute;
`;

const MsgBoxBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  font-size: 12px;
  background: ${({ theme }) => theme.canvas};
  color: ${({ theme }) => theme.canvasText};
`;

const MsgBoxOkBtn = styled(Button)`
  width: 56px !important;
  height: 18px !important;
  font-size: 11px;
`;

const Swatch = styled.button<{ $color: string | null; $disabled?: boolean }>`
  width: 40px;
  height: 20px;
  background: ${({ $color, theme }) => $color ?? theme.canvas};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  padding: 0;
  ${({ $color, theme, $disabled }) =>
    $color === null &&
    !$disabled &&
    `background-image: linear-gradient(45deg, ${theme.borderDark} 25%, transparent 25%, transparent 75%, ${theme.borderDark} 75%), linear-gradient(45deg, ${theme.borderDark} 25%, transparent 25%, transparent 75%, ${theme.borderDark} 75%);
     background-size: 8px 8px;
     background-position: 0 0, 4px 4px;`}
`;

const ToggleBtn = styled(Button)`
  width: 26px !important;
  height: 22px !important;
  min-width: 0 !important;
  padding: 0 !important;
  font-size: 12px;
  flex-shrink: 0;
`;

// Real Windows 95 Appearance ▸ Item list, reduced to the items this app
// actually renders distinct chrome for. `bgKey`/`textKey` point at the Theme
// fields that item's swatches edit; `fontId` (when present) is which
// itemFonts slot its Font/Size controls edit. Desktop has no theme keys of
// its own — it edits the Background tab's live desktop color directly, same
// as real Windows (Desktop is one setting shared by both tabs).
interface AppearanceItemDef {
  id: string;
  label: string;
  bgKey?: keyof Theme;
  textKey?: keyof Theme;
  fontId?: AppearanceItemId;
}

const APPEARANCE_ITEMS: AppearanceItemDef[] = [
  { id: "desktop", label: "Desktop" },
  {
    id: "window",
    label: "Active Title Bar",
    bgKey: "headerBackground",
    textKey: "headerText",
    fontId: "window",
  },
  {
    id: "inactive",
    label: "Inactive Title Bar",
    bgKey: "headerNotActiveBackground",
    textKey: "headerNotActiveText",
  },
  {
    id: "menu",
    label: "Menu",
    bgKey: "material",
    textKey: "materialText",
    fontId: "menu",
  },
  {
    id: "msgbox",
    label: "Message Box",
    bgKey: "canvas",
    textKey: "canvasText",
    fontId: "msgbox",
  },
  { id: "tooltip", label: "ToolTip", bgKey: "tooltip" },
];

const DEFAULT_ITEM_FONT_SIZE: Record<AppearanceItemId, number> = {
  window: 16,
  menu: 12,
  msgbox: 13,
};

function SaveSchemeDialog({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <SystemDialog title="Save Scheme" width={300} onClose={onCancel}>
      <div
        style={{
          padding: "12px 14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span>Save this color scheme as:</span>
        <TextInput
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          fullWidth
          autoFocus
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && trimmed) onSave(trimmed);
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            marginTop: 4,
          }}
        >
          <Button
            primary
            style={{ width: 72 }}
            disabled={!trimmed}
            onClick={() => onSave(trimmed)}
          >
            OK
          </Button>
          <Button style={{ width: 72 }} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </SystemDialog>
  );
}

function AppearanceTab({
  staged,
  update,
}: {
  staged: StagedState;
  update: UpdateStaged;
}) {
  const [item, setItem] = useState("desktop");
  const [paletteOpen, setPaletteOpen] = useState<"bg" | "text" | "gradient2" | null>(
    null,
  );
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  const customThemes = useThemeStore((s) => s.customThemes);

  const schemeOptions = THEMES.map((t) => ({ value: t.id, label: t.label }));
  const allSchemeOptions = [
    ...schemeOptions,
    ...customThemes.map((c) => ({ value: c.id, label: c.label })),
  ];

  const stagedTheme = useMemo(
    () => ({
      ...resolveThemeId(staged.themeId, customThemes),
      ...staged.themeOverrides,
    }),
    [staged.themeId, staged.themeOverrides, customThemes],
  );

  const currentCustom = customThemes.find((c) => c.id === staged.themeId);
  const hasPendingEdits =
    Object.keys(staged.themeOverrides).length > 0 ||
    JSON.stringify(staged.itemFonts) !==
      JSON.stringify(currentCustom?.itemFonts ?? {});
  const currentLabel =
    allSchemeOptions.find((o) => o.value === staged.themeId)?.label ?? "Custom";
  const displaySchemeOptions = hasPendingEdits
    ? [
        ...allSchemeOptions,
        { value: "__modified__", label: `${currentLabel} (Modified)` },
      ]
    : allSchemeOptions;
  const schemeSelectValue = hasPendingEdits ? "__modified__" : staged.themeId;

  const itemDef = APPEARANCE_ITEMS.find((i) => i.id === item);

  const itemBg =
    item === "desktop"
      ? staged.desktopColor
      : itemDef?.bgKey
        ? (stagedTheme[itemDef.bgKey] as string)
        : "#c0c0c0";
  const itemText = itemDef?.textKey
    ? (stagedTheme[itemDef.textKey] as string)
    : null;

  const setItemBg = (color: string) => {
    if (item === "desktop") {
      update({ desktopColor: color });
      return;
    }
    if (!itemDef?.bgKey) return;
    update({
      themeOverrides: { ...staged.themeOverrides, [itemDef.bgKey]: color },
    });
  };
  const setItemText = (color: string) => {
    if (!itemDef?.textKey) return;
    update({
      themeOverrides: { ...staged.themeOverrides, [itemDef.textKey]: color },
    });
  };

  const itemFont = itemDef?.fontId
    ? staged.itemFonts[itemDef.fontId]
    : undefined;
  const fontEditable = !!itemDef?.fontId;
  const currentFamily = itemFont?.family ?? "ms_sans_serif";
  const currentSize =
    itemFont?.size ??
    (itemDef?.fontId ? DEFAULT_ITEM_FONT_SIZE[itemDef.fontId] : 12);

  const setItemFont = (patch: Partial<ItemFont>) => {
    if (!itemDef?.fontId) return;
    update({
      itemFonts: {
        ...staged.itemFonts,
        [itemDef.fontId]: {
          family: currentFamily,
          size: currentSize,
          ...patch,
        },
      },
    });
  };

  const windowFont = staged.itemFonts.window;
  const windowFontStyle: CSSProperties | undefined = windowFont
    ? {
        fontFamily: fontFamilyCss(windowFont.family),
        fontSize: `${windowFont.size}px`,
        fontWeight: windowFont.bold === false ? "normal" : "bold",
        fontStyle: windowFont.italic ? "italic" : "normal",
      }
    : undefined;

  const menuFont = staged.itemFonts.menu;
  const menuFontStyle: CSSProperties | undefined = menuFont
    ? {
        fontFamily: fontFamilyCss(menuFont.family),
        fontSize: `${menuFont.size}px`,
        fontWeight: menuFont.bold ? "bold" : "normal",
        fontStyle: menuFont.italic ? "italic" : "normal",
      }
    : undefined;

  const msgboxFont = staged.itemFonts.msgbox;
  const msgboxFontStyle: CSSProperties | undefined = msgboxFont
    ? {
        fontFamily: fontFamilyCss(msgboxFont.family),
        fontSize: `${msgboxFont.size}px`,
        fontWeight: msgboxFont.bold ? "bold" : "normal",
        fontStyle: msgboxFont.italic ? "italic" : "normal",
      }
    : undefined;

  const activeHeaderStyle: CSSProperties = {
    ...windowFontStyle,
    background: `linear-gradient(to right, ${stagedTheme.headerBackground}, ${staged.headerGradientEnd ?? stagedTheme.headerBackground})`,
  };

  const handleSaveAs = async (name: string) => {
    if (isBuiltinLabel(name)) {
      await alertError(
        "Save Scheme",
        `"${name}" is a system color scheme and cannot be overwritten. Please choose a different name.`,
      );
      return;
    }
    const existing = customThemes.find(
      (c) => c.label.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      const res = await confirmDialog(
        "Save Scheme",
        `The color scheme "${name}" already exists.\nDo you want to replace it?`,
        "yesno",
      );
      if (res !== "yes") return;
    }
    const id = existing?.id ?? `custom:${crypto.randomUUID()}`;
    useThemeStore
      .getState()
      .saveCustom(id, name, stagedTheme, staged.itemFonts, staged.headerGradientEnd);
    update({ themeId: id, themeOverrides: {} });
    setSaveAsOpen(false);
  };

  const handleDelete = async () => {
    if (!currentCustom) return;
    const res = await confirmDialog(
      "Delete Scheme",
      `Are you sure you want to delete the "${currentCustom.label}" scheme?`,
      "yesno",
    );
    if (res !== "yes") return;
    useThemeStore.getState().deleteCustom(currentCustom.id);
    update({
      themeId: "original",
      themeOverrides: {},
      itemFonts: {},
      headerGradientEnd: null,
    });
  };

  const isWindowItem = item === "window";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ThemeProvider theme={stagedTheme}>
        <AppearancePreviewBox $bg={staged.desktopColor}>
          <PreviewWinWrap style={{ top: 8, left: 35, width: 220, zoom: 0.95 }}>
            <R95Window shadow={false}>
              <WindowHeader active={false} style={windowFontStyle}>
                Inactive Window
              </WindowHeader>
            </R95Window>
          </PreviewWinWrap>
          <PreviewWinWrap style={{ top: 28, left: 8, width: 290, zoom: 0.95 }}>
            <R95Window shadow>
              <PreviewHeaderRow active style={activeHeaderStyle}>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Active Window
                </span>
                <PreviewCloseBtn>
                  <GlyphZoomFix>
                    <CloseGlyph />
                  </GlyphZoomFix>
                </PreviewCloseBtn>
              </PreviewHeaderRow>
              <StatesRow style={menuFontStyle}>
                <NormalSample>Normal</NormalSample>
                <DisabledSample>Disabled</DisabledSample>
                <SelectedSample>Selected</SelectedSample>
              </StatesRow>
              <PreviewBody>
                <span>Window Text</span>
                <FakeScrollbar>
                  <FakeScrollThumb />
                </FakeScrollbar>
              </PreviewBody>
            </R95Window>
          </PreviewWinWrap>
          <MsgBoxWrap style={{ top: 125, left: 95, width: 190, zoom: 0.95 }}>
            <R95Window shadow>
              <WindowHeader active style={windowFontStyle}>
                Message Box
              </WindowHeader>
              <MsgBoxBody style={msgboxFontStyle}>
                <span>Message Text</span>
                <MsgBoxOkBtn>OK</MsgBoxOkBtn>
              </MsgBoxBody>
            </R95Window>
          </MsgBoxWrap>
        </AppearancePreviewBox>
      </ThemeProvider>

      <GroupBox label="Scheme">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Select
            value={schemeSelectValue}
            onChange={(opt: { value: string }) => {
              if (opt.value === "__modified__") return;
              const custom = customThemes.find((c) => c.id === opt.value);
              update({
                themeId: opt.value,
                themeOverrides: {},
                itemFonts: custom?.itemFonts ?? {},
                headerGradientEnd: custom?.headerGradientEnd ?? null,
              });
            }}
            options={displaySchemeOptions}
            style={{ flex: 1 }}
          />
          <Button style={{ width: 72 }} onClick={() => setSaveAsOpen(true)}>
            Save As...
          </Button>
          <Button
            style={{ width: 64 }}
            disabled={!currentCustom}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </GroupBox>

      <GroupBox label="Item">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Select
            value={item}
            onChange={(opt: { value: string }) => {
              setItem(opt.value);
              setPaletteOpen(null);
            }}
            options={APPEARANCE_ITEMS.map((i) => ({
              value: i.id,
              label: i.label,
            }))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Size:</span>
            <NumberInput value={0} width={56} onChange={() => {}} disabled />
            <span style={{ whiteSpace: "nowrap" }}>Color:</span>
            <Swatch $color={itemBg} onClick={() => setPaletteOpen("bg")} />
            <span style={{ whiteSpace: "nowrap" }}>Color 2:</span>
            <Swatch
              $color={isWindowItem ? (staged.headerGradientEnd ?? null) : null}
              $disabled={!isWindowItem}
              onClick={() => isWindowItem && setPaletteOpen("gradient2")}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Font:</span>
            <Select
              value={currentFamily}
              onChange={(opt: { value: string }) =>
                setItemFont({ family: opt.value })
              }
              options={FONT_FAMILIES.map((f) => ({
                value: f.id,
                label: f.label,
              }))}
              style={{ flex: 1 }}
              disabled={!fontEditable}
            />
            <span>Size:</span>
            <Select
              value={currentSize}
              onChange={(opt: { value: number }) =>
                setItemFont({ size: opt.value })
              }
              options={ITEM_FONT_SIZES.map((s) => ({
                value: s,
                label: String(s),
              }))}
              style={{ width: 60 }}
              disabled={!fontEditable}
            />
            <span>Color:</span>
            <Swatch
              $color={itemText}
              $disabled={itemText === null}
              onClick={() => itemText !== null && setPaletteOpen("text")}
            />
            <ToggleBtn
              active={!!itemFont?.bold}
              disabled={!fontEditable}
              onClick={() => setItemFont({ bold: !itemFont?.bold })}
            >
              <b>B</b>
            </ToggleBtn>
            <ToggleBtn
              active={!!itemFont?.italic}
              disabled={!fontEditable}
              onClick={() => setItemFont({ italic: !itemFont?.italic })}
            >
              <i>I</i>
            </ToggleBtn>
          </div>
        </div>
      </GroupBox>

      {saveAsOpen && (
        <SaveSchemeDialog
          initialName={currentCustom ? currentCustom.label : ""}
          onSave={handleSaveAs}
          onCancel={() => setSaveAsOpen(false)}
        />
      )}

      {paletteOpen && (
        <ColorPickerDialog
          color={
            paletteOpen === "bg"
              ? itemBg
              : paletteOpen === "text"
                ? (itemText ?? "#000000")
                : (staged.headerGradientEnd ?? stagedTheme.headerBackground)
          }
          onPick={(c) => {
            if (paletteOpen === "bg") setItemBg(c);
            else if (paletteOpen === "text") setItemText(c);
            else update({ headerGradientEnd: c });
            setPaletteOpen(null);
          }}
          onClose={() => setPaletteOpen(null)}
        />
      )}
    </div>
  );
}

// ─── Effects tab ──────────────────────────────────────────────────────────────

const IconSlot = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 76px;
  padding: 6px 2px 4px;
  border: 1px dotted
    ${({ $selected, theme }) =>
      $selected ? theme.borderDarkest : "transparent"};
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.materialText};
  cursor: pointer;
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
  const [selectedSlot, setSelectedSlot] =
    useState<DesktopIconSlot>("myComputer");
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
              <Icon
                src={staged.desktopIcons[slot]}
                size={32}
                isInReact95
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
    red,
    yellow,
    lime,
    cyan,
    blue,
    magenta,
    red
  );
  image-rendering: pixelated;
  filter: ${({ $depth }) =>
    $depth === 4
      ? "saturate(1.4) contrast(2)"
      : $depth === 8
        ? "contrast(1.3)"
        : "none"};
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
            }}
          >
            <span>Less</span>
            <span>More</span>
          </div>
          <div style={{ padding: "4px 2px" }}>
            <Slider95
              value={stepIdx}
              min={0}
              max={ZOOM_STEPS.length - 1}
              step={1}
              size="100%"
              onChange={(v) => update({ zoom: ZOOM_STEPS[v] })}
            />
          </div>
          <div style={{ textAlign: "center", fontWeight: "bold" }}>
            {zoomToResLabel(staged.zoom)}
          </div>
        </GroupBox>
      </div>

      <Separator />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>Font size:</span>
        <Select
          value={staged.fontSize}
          onChange={(opt: { value: FontSizeOption }) =>
            update({ fontSize: opt.value })
          }
          options={[
            { value: "small", label: "Small Fonts" },
            { value: "normal", label: "Normal Size" },
            { value: "large", label: "Large Fonts" },
          ]}
          style={{ flex: 1 }}
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
      <div style={{ padding: "12px 14px 10px" }}>
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
  const themeOverrides = useThemeStore((s) => s.overrides);
  const themeItemFonts = useThemeStore((s) => s.itemFonts);
  const themeHeaderGradientEnd = useThemeStore((s) => s.headerGradientEnd);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const setThemeOverrides = useThemeStore((s) => s.setOverrides);
  const setThemeItemFonts = useThemeStore((s) => s.setItemFonts);
  const setThemeHeaderGradientEnd = useThemeStore((s) => s.setHeaderGradientEnd);

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
    fontSize: display.fontSize,
    desktopIcons: { ...display.desktopIcons },
    themeId,
    themeOverrides: { ...themeOverrides },
    itemFonts: { ...themeItemFonts },
    headerGradientEnd: themeHeaderGradientEnd,
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
    JSON.stringify(staged.themeOverrides) !== JSON.stringify(themeOverrides) ||
    JSON.stringify(staged.itemFonts) !== JSON.stringify(themeItemFonts) ||
    staged.headerGradientEnd !== themeHeaderGradientEnd ||
    ICON_SLOTS.some(
      ({ slot }) => staged.desktopIcons[slot] !== display.desktopIcons[slot],
    );

  const commit = () => {
    const {
      themeId: stagedThemeId,
      themeOverrides: stagedOverrides,
      itemFonts: stagedItemFonts,
      headerGradientEnd: stagedHeaderGradientEnd,
      ...displayPartial
    } = staged;
    display.set({
      ...displayPartial,
      desktopIcons: { ...staged.desktopIcons },
    });
    if (stagedThemeId !== themeId) setThemeId(stagedThemeId);
    setThemeOverrides(stagedOverrides);
    setThemeItemFonts(stagedItemFonts);
    setThemeHeaderGradientEnd(stagedHeaderGradientEnd);
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
