import { useMemo, useState } from "react";
import { Button, Checkbox, GroupBox, Tab, TabBody, Tabs } from "react95";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { USER_RECENT_PATH } from "../../lib/windowsPaths";
import {
  useTaskbarPrefsStore,
  type TaskbarPreferences,
} from "../../store/taskbarPrefsStore";
import { useVfsStore } from "../../store/vfsStore";
import { useWindowStore } from "../../store/windowStore";

type TaskbarOption = Exclude<keyof TaskbarPreferences, "menuUse">;
type TaskbarDraft = Pick<TaskbarPreferences, TaskbarOption>;

const Layout = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  font-size: 12px;
`;

const PageBody = styled(TabBody)`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 12px;
`;

const TaskbarGroup = styled(GroupBox)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px 8px;

  & > label {
    margin: 0;
  }
`;

const Description = styled.div`
  line-height: 1.45;
`;

const ClearRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 4px 2px;
`;

function readDraft(): TaskbarDraft {
  const {
    alwaysOnTop,
    autoHide,
    showSmallStartIcons,
    showClock,
    usePersonalizedMenus,
  } = useTaskbarPrefsStore.getState();
  return {
    alwaysOnTop,
    autoHide,
    showSmallStartIcons,
    showClock,
    usePersonalizedMenus,
  };
}

function sameOptions(left: TaskbarDraft, right: TaskbarDraft): boolean {
  return (
    left.alwaysOnTop === right.alwaysOnTop &&
    left.autoHide === right.autoHide &&
    left.showSmallStartIcons === right.showSmallStartIcons &&
    left.showClock === right.showClock &&
    left.usePersonalizedMenus === right.usePersonalizedMenus
  );
}

/** Windows 2000's General/Advanced Taskbar and Start Menu property sheet. */
export function TaskbarProperties({ windowId }: { windowId: string }) {
  const recentFolder = useVfsStore((state) => state.resolve(USER_RECENT_PATH));
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const [tab, setTab] = useState("General");
  const [draft, setDraft] = useState<TaskbarDraft>(readDraft);
  const saved = useTaskbarPrefsStore(
    useShallow((state) =>
      ({
        alwaysOnTop: state.alwaysOnTop,
        autoHide: state.autoHide,
        showSmallStartIcons: state.showSmallStartIcons,
        showClock: state.showClock,
        usePersonalizedMenus: state.usePersonalizedMenus,
      }) satisfies TaskbarDraft),
  );
  const dirty = useMemo(() => !sameOptions(draft, saved), [draft, saved]);
  const recentCount = (recentFolder?.children ?? []).filter(
    (child) => !child.protected,
  ).length;

  const setOption = (key: TaskbarOption, value: boolean) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const apply = () =>
    useTaskbarPrefsStore.getState().setPreferences({
      ...draft,
      menuUse: useTaskbarPrefsStore.getState().menuUse,
    });
  const ok = () => {
    apply();
    closeWindow(windowId);
  };

  return (
    <Layout>
      <Tabs value={tab} onChange={setTab}>
        <Tab value="General">General</Tab>
        <Tab value="Advanced">Advanced</Tab>
      </Tabs>
      <PageBody>
        {tab === "General" ? (
          <TaskbarGroup label="Taskbar options">
            <Checkbox
              checked={draft.alwaysOnTop}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setOption("alwaysOnTop", event.target.checked)
              }
              label="Always on top"
            />
            <Checkbox
              checked={draft.autoHide}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setOption("autoHide", event.target.checked)
              }
              label="Auto hide"
            />
            <Checkbox
              checked={draft.showSmallStartIcons}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setOption("showSmallStartIcons", event.target.checked)
              }
              label="Show small icons in Start menu"
            />
            <Checkbox
              checked={draft.showClock}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setOption("showClock", event.target.checked)
              }
              label="Show clock"
            />
            <Checkbox
              checked={draft.usePersonalizedMenus}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setOption("usePersonalizedMenus", event.target.checked)
              }
              label="Use Personalized Menus"
            />
          </TaskbarGroup>
        ) : (
          <>
            <Description>
              Customize the Start menu and clear the list of recently opened
              documents.
            </Description>
            <TaskbarGroup label="Documents menu">
              <Description>
                The Documents menu displays the 15 most recently opened files.
                Clearing Recent does not delete those files.
              </Description>
              <ClearRow>
                <span>Remove items from the Recent folder:</span>
                <Button
                  disabled={recentCount === 0}
                  onClick={() => useVfsStore.getState().clearRecentDocuments()}
                  style={{ width: 76 }}
                >
                  Clear
                </Button>
              </ClearRow>
            </TaskbarGroup>
          </>
        )}
      </PageBody>
      <Footer>
        <Button onClick={ok} style={{ width: 72 }}>
          OK
        </Button>
        <Button onClick={() => closeWindow(windowId)} style={{ width: 72 }}>
          Cancel
        </Button>
        <Button disabled={!dirty} onClick={apply} style={{ width: 72 }}>
          Apply
        </Button>
      </Footer>
    </Layout>
  );
}
