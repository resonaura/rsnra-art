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
import { usePerfStats } from "../../hooks/usePerfStats";
import { useWindowStore } from "../../store/windowStore";

const ZOOM = 0.8;

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

const Row = styled(TableRow)<{ $selected?: boolean }>`
  cursor: pointer;
  background: ${({ $selected, theme }) =>
    $selected ? theme.hoverBackground : "transparent"} !important;
  color: ${({ $selected, theme }) =>
    $selected ? theme.headerText : "inherit"};
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

// The real process behind everything on this desktop is this one browser
// tab. Everything below it is theatre — a Win98 process list needs more
// than one row — so those rows always read 0% CPU / a small fixed memory
// footprint rather than faking motion with random jitter.
const REAL_PROCESS = "rsnra-art.exe";
const DECORATIVE_PROCESSES: { name: string; pid: number; memK: number }[] = [
  { name: "System Idle Process", pid: 0, memK: 16 },
  { name: "System", pid: 4, memK: 212 },
  { name: "smss.exe", pid: 168, memK: 348 },
  { name: "csrss.exe", pid: 196, memK: 1024 },
  { name: "winlogon.exe", pid: 224, memK: 692 },
  { name: "services.exe", pid: 252, memK: 1188 },
  { name: "explorer.exe", pid: 340, memK: 3072 },
];

interface ProcRow {
  name: string;
  pid: number;
  cpuPct: number;
  memK: number;
  windowId?: string;
}

export function TaskManager(_props: { windowId: string }) {
  const windows = useWindowStore((s) => s.windows);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const setRunDialogOpen = useWindowStore((s) => s.setRunDialogOpen);

  const [tab, setTab] = useState("Applications");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedProc, setSelectedProc] = useState<string | null>(null);

  const perf = usePerfStats();

  const processRows: ProcRow[] = useMemo(() => {
    const idleCpu = Math.max(0, 100 - perf.cpuPct);
    return [
      ...DECORATIVE_PROCESSES.map((p) => ({
        ...p,
        cpuPct: p.name === "System Idle Process" ? idleCpu : 0,
      })),
      {
        name: REAL_PROCESS,
        pid: 512,
        cpuPct: perf.cpuPct,
        memK: perf.usedMemMB * 1024,
      },
      ...windows.map(
        (w, i): ProcRow => ({
          name: `${w.appId}.exe`,
          pid: 1000 + i * 4,
          cpuPct: 0,
          memK: 1800,
          windowId: w.id,
        }),
      ),
    ];
  }, [windows, perf.cpuPct, perf.usedMemMB]);

  const endSelectedApp = () => {
    if (selectedApp) closeWindow(selectedApp);
    setSelectedApp(null);
  };

  const switchToSelectedApp = () => {
    if (selectedApp) focusWindow(selectedApp);
  };

  const endSelectedProcess = () => {
    const row = processRows.find((r) => r.name === selectedProc);
    if (row?.windowId) closeWindow(row.windowId);
    setSelectedProc(null);
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
                    <TableHeadCell>Task</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {windows.map((w) => (
                    <Row
                      key={w.id}
                      $selected={selectedApp === w.id}
                      onClick={() => setSelectedApp(w.id)}
                      onDoubleClick={() => focusWindow(w.id)}
                    >
                      <TableDataCell>{w.title}</TableDataCell>
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
                    <TableHeadCell>Image Name</TableHeadCell>
                    <TableHeadCell>PID</TableHeadCell>
                    <TableHeadCell>CPU</TableHeadCell>
                    <TableHeadCell>Mem Usage</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {processRows.map((row) => (
                    <Row
                      key={row.name + row.pid}
                      $selected={selectedProc === row.name}
                      onClick={() => setSelectedProc(row.name)}
                    >
                      <TableDataCell>{row.name}</TableDataCell>
                      <TableDataCell>{row.pid}</TableDataCell>
                      <TableDataCell>{row.cpuPct}%</TableDataCell>
                      <TableDataCell>{Math.round(row.memK)} K</TableDataCell>
                    </Row>
                  ))}
                </TableBody>
              </Table>
            </ListFrame>
            <Footer>
              <Button
                style={{ zoom: ZOOM, width: 96 }}
                disabled={
                  !selectedProc ||
                  !processRows.find(
                    (r) => r.name === selectedProc && r.windowId,
                  )
                }
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
                <span>Physical Memory (K)</span>
                <span>
                  {perf.usedMemMB * 1024} / {perf.limitMemMB * 1024}
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
          Mem Usage: {perf.usedMemMB}MB / {perf.limitMemMB}MB
        </span>
      </StatusBar>
    </Layout>
  );
}
