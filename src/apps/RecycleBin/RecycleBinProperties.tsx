import { useState } from "react";
import { Button, Checkbox, GroupBox } from "react95";
import styled from "styled-components";
import { Slider95 } from "../../components/Slider95/Slider95";
import { useRecycleBinStore } from "../../store/recycleBinStore";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
  gap: 8px;
  font-size: 12px;
`;

const DriveGroup = styled(GroupBox)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  padding: 10px 8px 8px;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
`;

export function RecycleBinProperties({ windowId }: { windowId: string }) {
  const settings = useRecycleBinStore();
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const [maximumSizePercent, setMaximumSizePercent] = useState(
    settings.maximumSizePercent,
  );
  const [skipRecycleBin, setSkipRecycleBin] = useState(settings.skipRecycleBin);
  const [confirmDelete, setConfirmDelete] = useState(settings.confirmDelete);

  const apply = () =>
    settings.setSettings({
      maximumSizePercent,
      skipRecycleBin,
      confirmDelete,
    });
  const ok = () => {
    apply();
    closeWindow(windowId);
  };

  return (
    <Layout>
      <DriveGroup label="Settings for drive C:">
        <Checkbox
          checked={skipRecycleBin}
          onChange={(event: any) => setSkipRecycleBin(event.target.checked)}
          label="Do not move files to the Recycle Bin. Remove files immediately when deleted"
        />
        <div style={{ opacity: skipRecycleBin ? 0.5 : 1 }}>
          <SliderLabel>
            <span>Maximum size of Recycle Bin</span>
            <span>{maximumSizePercent}%</span>
          </SliderLabel>
          <Slider95
            value={maximumSizePercent}
            min={0}
            max={100}
            disabled={skipRecycleBin}
            onChange={setMaximumSizePercent}
            name="recycle-bin-maximum-size"
          />
          <SliderLabel style={{ fontSize: 10, color: "#666" }}>
            <span>0%</span>
            <span>100%</span>
          </SliderLabel>
        </div>
        <Checkbox
          checked={confirmDelete}
          onChange={(event: any) => setConfirmDelete(event.target.checked)}
          label="Display delete confirmation dialog"
        />
      </DriveGroup>
      <ButtonRow>
        <Button onClick={ok} style={{ width: 70 }}>
          OK
        </Button>
        <Button onClick={() => closeWindow(windowId)} style={{ width: 70 }}>
          Cancel
        </Button>
        <Button onClick={apply} style={{ width: 70 }}>
          Apply
        </Button>
      </ButtonRow>
    </Layout>
  );
}
