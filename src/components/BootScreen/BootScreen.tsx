import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

const blink = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: #000;
  color: #c0c0c0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  cursor: pointer;
`;

const Logo = styled.div`
  font-size: 38px;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 2px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  span {
    font-size: 20px;
    color: #6dff8f;
  }
`;

const Bar = styled.div`
  width: 280px;
  height: 14px;
  border: 2px solid #888;
  padding: 2px;
`;

const Fill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: repeating-linear-gradient(
    90deg,
    #ffffff 0px,
    #ffffff 8px,
    transparent 8px,
    transparent 12px
  );
  transition: width 0.15s linear;
`;

const Hint = styled.div`
  font-size: 11px;
  color: #666;
  animation: ${blink} 1.4s step-end infinite;
`;

interface BootScreenProps {
  onDone: () => void;
}

export function BootScreen({ onDone }: BootScreenProps) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPct((p) => Math.min(100, p + Math.random() * 18));
    }, 140);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pct >= 100) {
      const t = window.setTimeout(onDone, 350);
      return () => window.clearTimeout(t);
    }
  }, [pct, onDone]);

  return (
    <Screen onClick={onDone}>
      <Logo>RSNRA</Logo>
      <Bar>
        <Fill $pct={pct} />
      </Bar>
      <Hint>Click anywhere to skip</Hint>
    </Screen>
  );
}
