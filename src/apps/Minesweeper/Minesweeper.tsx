import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Frame } from 'react95';

const COLS = 9;
const ROWS = 9;
const MINES = 10;

interface Cell {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
}

type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
    })),
  );
}

function neighbors(r: number, c: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) result.push([nr, nc]);
    }
  }
  return result;
}

function plantMines(board: Cell[][], avoidR: number, avoidC: number): Cell[][] {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (next[r][c].mine) continue;
    if (Math.abs(r - avoidR) <= 1 && Math.abs(c - avoidC) <= 1) continue;
    next[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (next[r][c].mine) continue;
      next[r][c].adjacent = neighbors(r, c).filter(([nr, nc]) => next[nr][nc].mine).length;
    }
  }
  return next;
}

const NUMBER_COLORS: Record<number, string> = {
  1: '#0000ff',
  2: '#008200',
  3: '#ff0000',
  4: '#000084',
  5: '#840000',
  6: '#008284',
  7: '#000000',
  8: '#848484',
};

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  height: 100%;
`;

const Header = styled(Frame)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  background: ${({ theme }) => theme.material};
`;

const Counter = styled.div`
  background: #000;
  color: #ff0000;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 20px;
  padding: 2px 6px;
  min-width: 48px;
  text-align: center;
  letter-spacing: 2px;
`;

const FaceButton = styled.button`
  width: 32px;
  height: 32px;
  font-size: 18px;
  background: ${({ theme }) => theme.material};
  border: 2px solid;
  border-color: ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest}
    ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderLightest};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:active {
    border-color: ${({ theme }) => theme.borderDarkest} ${({ theme }) => theme.borderLightest}
      ${({ theme }) => theme.borderLightest} ${({ theme }) => theme.borderDarkest};
  }
`;

const Board = styled(Frame)`
  display: inline-grid;
  grid-template-columns: repeat(${COLS}, 24px);
  grid-template-rows: repeat(${ROWS}, 24px);
  background: ${({ theme }) => theme.material};
  padding: 4px;
`;

const CellButton = styled.button<{ $revealed: boolean }>`
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 13px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${({ theme }) => theme.material};

  ${({ $revealed, theme }) =>
    $revealed
      ? `
    border: 1px solid ${theme.borderDark};
    background: ${theme.material};
  `
      : `
    border: 2px solid;
    border-color: ${theme.borderLightest} ${theme.borderDarkest} ${theme.borderDarkest} ${theme.borderLightest};
  `}
`;

function faceForStatus(status: GameStatus) {
  if (status === 'won') return '😎';
  if (status === 'lost') return '😵';
  return '🙂';
}

export function Minesweeper() {
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = window.setInterval(() => setSeconds((s) => Math.min(999, s + 1)), 1000);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [status]);

  const flagCount = board.flat().filter((c) => c.flagged).length;

  const resetGame = useCallback(() => {
    setBoard(emptyBoard());
    setStatus('idle');
    setSeconds(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const revealFlood = (b: Cell[][], r: number, c: number) => {
    const stack: [number, number][] = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      const cell = b[cr][cc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.adjacent === 0 && !cell.mine) {
        for (const [nr, nc] of neighbors(cr, cc)) {
          if (!b[nr][nc].revealed) stack.push([nr, nc]);
        }
      }
    }
  };

  const checkWin = (b: Cell[][]) =>
    b.every((row) => row.every((cell) => cell.mine || cell.revealed));

  const handleReveal = (r: number, c: number) => {
    if (status === 'won' || status === 'lost') return;
    if (board[r][c].flagged) return;

    let working = board;
    let nextStatus: GameStatus = status;

    if (status === 'idle') {
      working = plantMines(board, r, c);
      nextStatus = 'playing';
    } else {
      working = board.map((row) => row.map((cell) => ({ ...cell })));
    }

    if (working[r][c].mine) {
      for (const row of working) for (const cell of row) if (cell.mine) cell.revealed = true;
      setBoard(working);
      setStatus('lost');
      return;
    }

    revealFlood(working, r, c);

    if (checkWin(working)) {
      nextStatus = 'won';
    }

    setBoard(working);
    setStatus(nextStatus);
  };

  const handleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === 'won' || status === 'lost') return;
    if (board[r][c].revealed) return;
    const working = board.map((row) => row.map((cell) => ({ ...cell })));
    working[r][c].flagged = !working[r][c].flagged;
    setBoard(working);
  };

  return (
    <Layout>
      <Header variant="window">
        <Counter>{String(Math.max(0, MINES - flagCount)).padStart(3, '0')}</Counter>
        <FaceButton onClick={resetGame}>{faceForStatus(status)}</FaceButton>
        <Counter>{String(seconds).padStart(3, '0')}</Counter>
      </Header>
      <Board variant="window">
        {board.map((row, r) =>
          row.map((cell, c) => (
            <CellButton
              key={`${r}-${c}`}
              $revealed={cell.revealed}
              onClick={() => handleReveal(r, c)}
              onContextMenu={(e) => handleFlag(e, r, c)}
              style={{
                color:
                  cell.revealed && cell.adjacent > 0 && !cell.mine
                    ? NUMBER_COLORS[cell.adjacent]
                    : undefined,
              }}
            >
              {cell.revealed
                ? cell.mine
                  ? '💣'
                  : cell.adjacent > 0
                    ? cell.adjacent
                    : ''
                : cell.flagged
                  ? '🚩'
                  : ''}
            </CellButton>
          )),
        )}
      </Board>
      <p style={{ fontSize: 11, margin: 0 }}>
        Left click to reveal, right click to flag.
      </p>
    </Layout>
  );
}
