import { useEffect, useState } from 'react';

function formatTime(date: Date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function TaskbarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(interval);
  }, []);

  return <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatTime(now)}</span>;
}
