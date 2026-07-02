import { useCallback, useEffect, useRef, useState } from "react";
import { Counter, Frame } from "react95";
import styled from "styled-components";

const COLS = 9;
const ROWS = 9;
const MINES = 10;
const CELL_SIZE = 24;

interface Cell {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
}

type GameStatus = "idle" | "playing" | "won" | "lost";
type Coord = { r: number; c: number };

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
      next[r][c].adjacent = neighbors(r, c).filter(
        ([nr, nc]) => next[nr][nc].mine,
      ).length;
    }
  }
  return next;
}

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

// The face/tile sprites (from the classic Minesweeper spritesheet) already
// include their own raised/pressed bevel art, so these buttons stay bare —
// any extra CSS border here would just double up on top of the sprite's own.
const FaceButton = styled.button`
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
`;

const Board = styled(Frame)`
  display: inline-grid;
  grid-template-columns: repeat(${COLS}, ${CELL_SIZE}px);
  grid-template-rows: repeat(${ROWS}, ${CELL_SIZE}px);
  background: ${({ theme }) => theme.material};
  padding: 4px;
`;

const CellButton = styled.button`
  width: ${CELL_SIZE}px;
  height: ${CELL_SIZE}px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
`;

function faceIcon(status: GameStatus, digging: boolean, pressed: boolean) {
  const state = pressed
    ? "depressed-smile"
    : status === "won"
      ? "sunglasses"
      : status === "lost"
        ? "dead"
        : digging
          ? "scared"
          : "smile";
  return `/icons/minesweeper-face-${state}.png`;
}

function tileIcon(cell: Cell, coord: Coord, status: GameStatus, losingCell: Coord | null) {
  if (cell.flagged && !cell.revealed) {
    if (status === "lost" && !cell.mine) return "mine-x"; // flagged a cell that wasn't a mine
    return "flag";
  }
  if (!cell.revealed) return "covered";
  if (cell.mine) {
    const isLosingCell =
      losingCell && losingCell.r === coord.r && losingCell.c === coord.c;
    return isLosingCell ? "mine-red" : "mine";
  }
  return cell.adjacent > 0 ? `count-${cell.adjacent}` : "empty";
}

export function Minesweeper() {
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [digging, setDigging] = useState(false);
  const [facePressed, setFacePressed] = useState(false);
  const [losingCell, setLosingCell] = useState<Coord | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "playing") {
      timerRef.current = window.setInterval(
        () => setSeconds((s) => Math.min(999, s + 1)),
        1000,
      );
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [status]);

  const flagCount = board.flat().filter((c) => c.flagged).length;

  const resetGame = useCallback(() => {
    setBoard(emptyBoard());
    setStatus("idle");
    setSeconds(0);
    setLosingCell(null);
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
    if (status === "won" || status === "lost") return;
    if (board[r][c].flagged) return;

    let working = board;
    let nextStatus: GameStatus = status;

    if (status === "idle") {
      working = plantMines(board, r, c);
      nextStatus = "playing";
    } else {
      working = board.map((row) => row.map((cell) => ({ ...cell })));
    }

    if (working[r][c].mine) {
      for (const row of working)
        for (const cell of row) if (cell.mine) cell.revealed = true;
      setBoard(working);
      setLosingCell({ r, c });
      setStatus("lost");
      return;
    }

    revealFlood(working, r, c);

    if (checkWin(working)) {
      nextStatus = "won";
    }

    setBoard(working);
    setStatus(nextStatus);
  };

  const handleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === "won" || status === "lost") return;
    if (board[r][c].revealed) return;
    const working = board.map((row) => row.map((cell) => ({ ...cell })));
    working[r][c].flagged = !working[r][c].flagged;
    setBoard(working);
  };

  return (
    <Layout>
      <Header variant="window">
        <Counter
          style={{ zoom: 0.67 }}
          value={Math.max(0, MINES - flagCount)}
        />
        <FaceButton
          onClick={resetGame}
          onMouseDown={() => setFacePressed(true)}
          onMouseUp={() => setFacePressed(false)}
          onMouseLeave={() => setFacePressed(false)}
        >
          <img src={faceIcon(status, digging, facePressed)} alt="" />
        </FaceButton>
        <Counter style={{ zoom: 0.67 }} value={seconds} />
      </Header>
      <Board variant="window" onMouseLeave={() => setDigging(false)}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const diggable =
              (status === "idle" || status === "playing") &&
              !cell.revealed &&
              !cell.flagged;
            return (
              <CellButton
                key={`${r}-${c}`}
                onClick={() => handleReveal(r, c)}
                onContextMenu={(e) => handleFlag(e, r, c)}
                onMouseDown={(e) => {
                  if (e.button === 0 && diggable) setDigging(true);
                }}
                onMouseUp={() => setDigging(false)}
              >
                <img
                  src={`/icons/minesweeper-tile-${tileIcon(cell, { r, c }, status, losingCell)}.png`}
                  alt=""
                />
              </CellButton>
            );
          }),
        )}
      </Board>
    </Layout>
  );
}
