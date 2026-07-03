import { useMemo, useState } from "react";
import {
  Button,
  GroupBox,
  ProgressBar,
  Tab,
  TabBody,
  Table,
  TableBody,
  TableDataCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Tabs,
} from "react95";
import styled from "styled-components";
import { ScrollArea } from "../../components/ScrollArea";
import { Icon } from "../../components/Icon/Icon";
import { buildProcessRows, REAL_PROCESS_NAME } from "../../data/processList";
import { usePerfStats } from "../../hooks/usePerfStats";
import { useWindowStore } from "../../store/windowStore";

const ZOOM = 0.8;

function formatMemoryKB(kb: number): string {
  const bytes = kb * 1024;
  if (bytes < 1024) return `${bytes} B`;
  const kbVal = bytes / 1024;
  if (kbVal < 1024) return `${Math.round(kbVal)} KB`;
  const mbVal = kbVal / 1024;
  if (mbVal < 1024) return `${mbVal.toFixed(1)} MB`;
  const gbVal = mbVal / 1024;
  return `${gbVal.toFixed(1)} GB`;
}

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Body = styled(TabBody)`
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
`;

const ListFrame = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
  background: white;
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderLightest}
    ${({ theme }) => theme.borderDarkest};
`;

const Th = styled(TableHeadCell)`
  position: sticky;
  top: 0;
  z-index: 2;
  cursor: pointer;
  user-select: none;
  background: ${({ theme }) => theme.material};
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.hoverBackground};
    color: ${({ theme }) => theme.headerText};
  }
`;

const Row = styled(TableRow)<{ $selected?: boolean }>`
  cursor: pointer;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"};
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : theme.canvasText};

  &:hover {
    background: ${({ theme }) => theme.hoverBackground};
    color: ${({ theme }) => theme.headerText};
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const StatusBar = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 3px 6px;
  font-size: 11px;
  border-top: 1px solid ${({ theme }) => theme.borderDark};
`;

type SortDir = 1 | -1;
interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as SortDir } : { key, dir: 1 }));
  const arrow = (key: K) => (sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "");
  return { sort, toggle, arrow };
}

function cmp(a: string | number, b: string | number, dir: SortDir): number {
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return String(a).localeCompare(String(b)) * dir;
}

export function TaskManager(_props: { windowId: string }) {
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const setRunDialogOpen = useWindowStore((s) => s.setRunDialogOpen);

  const [tab, setTab] = useState("Applications");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const perf = usePerfStats();

  const appSort = useSort<"title" | "status">({ key: "title", dir: 1 });
  const procSort = useSort<"name" | "pid" | "cpu" | "mem">({ key: "cpu", dir: -1 });

  const sortedApps = useMemo(() => {
    const list = [...windows];
    list.sort((a, b) =>
      appSort.sort.key === "title"
        ? cmp(a.title, b.title, appSort.sort.dir)
        : cmp("Running", "Running", appSort.sort.dir),
    );
    return list;
  }, [windows, appSort.sort]);

  const processRows = useMemo(
    () => buildProcessRows(windows, perf.cpuPct),
    [windows, perf.cpuPct],
  );

  const sortedProcs = useMemo(() => {
    const key = procSort.sort.key;
    const field = key === "name" ? "name" : key === "pid" ? "pid" : key === "cpu" ? "cpuPct" : "memK";
    return [...processRows].sort((a, b) => cmp(a[field], b[field], procSort.sort.dir));
  }, [processRows, procSort.sort]);

  const endSelectedApp = () => {
    if (selectedApp) closeWindow(selectedApp);
    setSelectedApp(null);
  };

  const switchToSelectedApp = () => {
    if (selectedApp) focusWindow(selectedApp);
  };

  const selectedProcRow = processRows.find((r) => r.pid === selectedPid);

  const endSelectedProcess = () => {
    if (selectedProcRow?.windowId) closeWindow(selectedProcRow.windowId);
    setSelectedPid(null);
  };

  return (
    <Layout>
      <Tabs
        value={tab}
        onChange={(v: string) => setTab(v)}
        style={{ fontSize: 11, zoom: ZOOM }}
      >
        <Tab value="Applications">Applications</Tab>
        <Tab value="Processes">Processes</Tab>
        <Tab value="Performance">Performance</Tab>
      </Tabs>
      <Body>
        {tab === "Applications" && (
          <>
            <ListFrame orientation="vertical">
              <Table style={{ zoom: ZOOM, width: "100%" }}>
                <TableHead>
                  <TableRow>
                    <Th onClick={() => appSort.toggle("title")}>
                      Task{appSort.arrow("title")}
                    </Th>
                    <Th onClick={() => appSort.toggle("status")}>
                      Status{appSort.arrow("status")}
                    </Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedApps.map((w) => (
                    <Row
                      key={w.id}
                      $selected={selectedApp === w.id}
                      onClick={() => setSelectedApp(w.id)}
                      onDoubleClick={() => focusWindow(w.id)}
                    >
                      <TableDataCell>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon src={w.icon} size={16} />
                          <span>{w.title}</span>
                        </div>
                      </TableDataCell>
                      <TableDataCell>Running</TableDataCell>
                    </Row>
                  ))}
                  {windows.length === 0 && (
                    <TableRow>
                      <TableDataCell style={{ color: "#888" }}>
                        No tasks are running.
                      </TableDataCell>
                      <TableDataCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ListFrame>
            <Footer>
              <Button
                style={{ zoom: ZOOM, width: 96 }}
                disabled={!selectedApp}
                onClick={endSelectedApp}
              >
                End Task
              </Button>
              <Button
                style={{ zoom: ZOOM, width: 96 }}
                disabled={!selectedApp}
                onClick={switchToSelectedApp}
              >
                Switch To
              </Button>
              <Button
                style={{ zoom: ZOOM, width: 96 }}
                onClick={() => setRunDialogOpen(true)}
              >
                New Task...
              </Button>
            </Footer>
          </>
        )}

        {tab === "Processes" && (
          <>
            <ListFrame orientation="vertical">
              <Table style={{ zoom: ZOOM, width: "100%" }}>
                <TableHead>
                  <TableRow>
                    <Th onClick={() => procSort.toggle("name")}>
                      Image Name{procSort.arrow("name")}
                    </Th>
                    <Th onClick={() => procSort.toggle("pid")}>
                      PID{procSort.arrow("pid")}
                    </Th>
                    <Th onClick={() => procSort.toggle("cpu")}>
                      CPU{procSort.arrow("cpu")}
                    </Th>
                    <Th onClick={() => procSort.toggle("mem")}>
                      Mem Usage{procSort.arrow("mem")}
                    </Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedProcs.map((row) => {
                    let iconPath = "/icons/w98_executable.ico";
                    if (row.windowId) {
                      const w = windows.find((win) => win.id === row.windowId);
                      if (w) iconPath = w.icon;
                    } else if (row.pid === 0) {
                      iconPath = "/icons/w98_standby_monitor_moon.ico";
                    } else if (row.pid === 4) {
                      iconPath = "/icons/w2k_my_computer.ico";
                    } else if (row.name === "explorer.exe") {
                      iconPath = "/icons/w98_directory_open.ico";
                    } else if (row.name === REAL_PROCESS_NAME) {
                      iconPath = "/icons/w98_windows.ico";
                    } else if (row.name === "winlogon.exe") {
                      iconPath = "/icons/w98_shut_down_normal.ico";
                    } else if (row.name === "services.exe") {
                      iconPath = "/icons/w98_settings_gear.ico";
                    }

                    return (
                      <Row
                        key={row.pid}
                        $selected={selectedPid === row.pid}
                        onClick={() => setSelectedPid(row.pid)}
                      >
                        <TableDataCell>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon src={iconPath} size={16} />
                            <span>{row.name}</span>
                          </div>
                        </TableDataCell>
                        <TableDataCell>{row.pid}</TableDataCell>
                        <TableDataCell>{row.cpuPct}%</TableDataCell>
                        <TableDataCell>{formatMemoryKB(row.memK)}</TableDataCell>
                      </Row>
                    );
                  })}
                </TableBody>
              </Table>
            </ListFrame>
            <Footer>
              <Button
                style={{ zoom: ZOOM, width: 96 }}
                disabled={!selectedProcRow?.windowId}
                onClick={endSelectedProcess}
              >
                End Process
              </Button>
            </Footer>
          </>
        )}

        {tab === "Performance" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <GroupBox label="CPU Usage" style={{ zoom: ZOOM }}>
                <ProgressBar value={perf.cpuPct} />
                {!perf.cpuSupported && (
                  <div style={{ fontSize: 16, color: "#888" }}>
                    Long Tasks API unavailable in this browser
                  </div>
                )}
              </GroupBox>
              <GroupBox label="MEM Usage" style={{ zoom: ZOOM }}>
                <ProgressBar value={perf.memPct} />
                {!perf.memSupported && (
                  <div style={{ fontSize: 16, color: "#888" }}>
                    performance.memory unavailable in this browser
                  </div>
                )}
              </GroupBox>
            </div>
            <GroupBox label="Totals" style={{ zoom: ZOOM }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  fontSize: 16,
                }}
              >
                <span>Handles (DOM nodes)</span>
                <span>{perf.domNodes}</span>
                <span>Threads (logical CPUs)</span>
                <span>{navigator.hardwareConcurrency ?? "?"}</span>
                <span>Processes</span>
                <span>{processRows.length}</span>
                <span>Physical Memory</span>
                <span>
                  {formatMemoryKB(perf.usedMemMB * 1024)} / {formatMemoryKB(perf.limitMemMB * 1024)}
                </span>
              </div>
            </GroupBox>
          </>
        )}
      </Body>
      <StatusBar>
        <span>Processes: {processRows.length}</span>
        <span>CPU Usage: {perf.cpuPct}%</span>
        <span>
          Mem Usage: {formatMemoryKB(perf.usedMemMB * 1024)} / {formatMemoryKB(perf.limitMemMB * 1024)}
        </span>
      </StatusBar>
    </Layout>
  );
}
