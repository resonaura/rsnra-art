import { useEffect, useState } from "react";
import styled from "styled-components";
import { openApp } from "../../data/apps";

function formatTime(date: Date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
}

const ClockBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  padding: 0 4px;
  color: inherit;
  font-family: inherit;

  &:active {
    outline: 1px dotted #000;
    outline-offset: -2px;
  }
`;

// Clicking the taskbar clock opens the Date/Time Properties window (just like
// double-clicking the Win95 system tray clock).
export function TaskbarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <ClockBtn title="Date and Time" onClick={() => openApp("datetime")}>
      {formatTime(now)}
    </ClockBtn>
  );
}
