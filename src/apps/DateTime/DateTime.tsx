import { useEffect, useMemo, useState } from "react";
import { Button, GroupBox, Tab, TabBody, Tabs, Window } from "react95";
import styled from "styled-components";
import { useWindowStore } from "../../store/windowStore";

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 4px;
`;

const Body = styled(TabBody)`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ClockWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
`;

const ClockFace = styled.svg`
  display: block;
`;

const Digital = styled.div`
  text-align: center;
  font-size: 15px;
  letter-spacing: 1px;
  margin-top: 6px;
`;

const CalHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const CalTitle = styled.div`
  font-size: 13px;
  font-weight: bold;
`;

const NavBtn = styled.button`
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
`;

const Dow = styled.div`
  text-align: center;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 0;
`;

const Day = styled.div<{ $today?: boolean; $other?: boolean }>`
  text-align: center;
  font-size: 12px;
  padding: 4px 0;
  border: 1px solid
    ${({ $today, theme }) => ($today ? theme.borderDarkest : "transparent")};
  background: ${({ $today, theme }) =>
    $today ? theme.material : "transparent"};
  color: ${({ $other, theme }) =>
    $other ? theme.materialTextDisabled : theme.materialText};
  outline: ${({ $today }) => ($today ? "1px dotted black" : "none")};
  outline-offset: -3px;
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 4px 0 0;
`;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function Analog({ date }: { date: Date }) {
  const size = 120;
  const c = size / 2;
  const r = size / 2 - 6;
  const sec = date.getSeconds();
  const min = date.getMinutes();
  const hr = date.getHours() % 12;
  const secA = (sec / 60) * Math.PI * 2 - Math.PI / 2;
  const minA = ((min + sec / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const hrA = ((hr + min / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const hand = (a: number, len: number) => {
    const x = c + Math.cos(a) * len;
    const y = c + Math.sin(a) * len;
    return { x, y };
  };
  const h = hand(hrA, r * 0.5);
  const m = hand(minA, r * 0.72);
  const s = hand(secA, r * 0.82);

  return (
    <ClockFace width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="white" stroke="#000" strokeWidth={2} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const inner = r - 8;
        const outer = r - 2;
        return (
          <line
            key={i}
            x1={c + Math.cos(a) * inner}
            y1={c + Math.sin(a) * inner}
            x2={c + Math.cos(a) * outer}
            y2={c + Math.sin(a) * outer}
            stroke="#000"
            strokeWidth={i % 3 === 0 ? 2 : 1}
          />
        );
      })}
      <line x1={c} y1={c} x2={h.x} y2={h.y} stroke="#000" strokeWidth={3} />
      <line x1={c} y1={c} x2={m.x} y2={m.y} stroke="#000" strokeWidth={2} />
      <line x1={c} y1={c} x2={s.x} y2={s.y} stroke="#c00" strokeWidth={1} />
      <circle cx={c} cy={c} r={2.5} fill="#000" />
    </ClockFace>
  );
}

function Calendar({ today }: { today: Date }) {
  const [view, setView] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(
      view.getFullYear(),
      view.getMonth() + 1,
      0,
    ).getDate();
    const prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
    const out: { day: number; other: boolean; today: boolean }[] = [];
    for (let i = 0; i < startDow; i++) {
      out.push({
        day: prevDays - startDow + 1 + i,
        other: true,
        today: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        day: d,
        other: false,
        today:
          d === today.getDate() &&
          view.getMonth() === today.getMonth() &&
          view.getFullYear() === today.getFullYear(),
      });
    }
    while (out.length % 7 !== 0) {
      out.push({
        day: out.length - startDow - daysInMonth + 1,
        other: true,
        today: false,
      });
    }
    return out;
  }, [view, today]);

  return (
    <div>
      <CalHead>
        <NavBtn
          onClick={() =>
            setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
          }
        >
          ◀
        </NavBtn>
        <CalTitle>
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </CalTitle>
        <NavBtn
          onClick={() =>
            setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
          }
        >
          ▶
        </NavBtn>
      </CalHead>
      <Grid>
        {DOW.map((d, i) => (
          <Dow key={i}>{d}</Dow>
        ))}
        {cells.map((c, i) => (
          <Day key={i} $today={c.today} $other={c.other}>
            {c.day}
          </Day>
        ))}
      </Grid>
    </div>
  );
}

export function DateTime({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState("Date & Time");

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Layout>
      <Window>
        <Tabs
          value={tab}
          onChange={(v: string) => setTab(v)}
          style={{ fontSize: 11 }}
        >
          <Tab value="Date & Time">Date &amp; Time</Tab>
          <Tab value="Time Zone">Time Zone</Tab>
        </Tabs>
        <Body>
          {tab === "Date & Time" ? (
            <>
              <GroupBox label="Date">
                <Calendar today={now} />
              </GroupBox>
              <GroupBox label="Time">
                <ClockWrap>
                  <Analog date={now} />
                </ClockWrap>
                <Digital>{timeStr}</Digital>
              </GroupBox>
              <div style={{ fontSize: 12, textAlign: "center" }}>{dateStr}</div>
            </>
          ) : (
            <GroupBox label="Time Zone">
              <div style={{ fontSize: 12 }}>
                Your current time zone is determined by your computer&apos;s
                system clock.
              </div>
              <div style={{ fontSize: 13, marginTop: 8 }}>
                <b>Local time:</b> {timeStr}
              </div>
            </GroupBox>
          )}
          <BtnRow>
            <Button onClick={() => closeWindow(windowId)}>OK</Button>
          </BtnRow>
        </Body>
      </Window>
    </Layout>
  );
}
