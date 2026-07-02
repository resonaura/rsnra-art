import { useCallback, useEffect, useRef, useState } from "react";
import { Counter, Frame } from "react95";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useWindowStore } from "../../store/windowStore";

const CELL_SIZE = 24;

// Same three presets as the classic game (Game ▸ Beginner/Intermediate/Expert).
const DIFFICULTIES = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 30, rows: 16, mines: 99 },
} as const;
type DifficultyName = keyof typeof DIFFICULTIES;
type Dims = (typeof DIFFICULTIES)[DifficultyName];

function difficultyName(dims: Dims): DifficultyName | null {
  for (const name of Object.keys(DIFFICULTIES) as DifficultyName[]) {
    const d = DIFFICULTIES[name];
    if (d.cols === dims.cols && d.rows === dims.rows && d.mines === dims.mines) {
      return name;
    }
  }
  return null;
}

// Window content height/width for a given board size — tuned to fit the
// menu bar, mine/timer header and board padding without extra dead space.
function windowSizeFor(dims: Dims) {
  return {
    width: dims.cols * CELL_SIZE + 64,
    height: dims.rows * CELL_SIZE + 168,
  };
}

interface Cell {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
}

type GameStatus = "idle" | "playing" | "won" | "lost";
type Coord = { r: number; c: number };

function emptyBoard(cols: number, rows: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
    })),
  );
}

function neighborsOf(
  r: number,
  c: number,
  cols: number,
  rows: number,
): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc]);
    }
  }
  return result;
}

function plantMines(
  board: Cell[][],
  avoidR: number,
  avoidC: number,
  cols: number,
  rows: number,
  mines: number,
): Cell[][] {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (next[r][c].mine) continue;
    if (Math.abs(r - avoidR) <= 1 && Math.abs(c - avoidC) <= 1) continue;
    next[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (next[r][c].mine) continue;
      next[r][c].adjacent = neighborsOf(r, c, cols, rows).filter(
        ([nr, nc]) => next[nr][nc].mine,
      ).length;
    }
  }
  return next;
}

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  flex: 1;
  padding: 10px;
  overflow: auto;
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

const Board = styled(Frame)<{ $cols: number; $rows: number }>`
  display: inline-grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, ${CELL_SIZE}px);
  grid-template-rows: repeat(${({ $rows }) => $rows}, ${CELL_SIZE}px);
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

function tileIcon(
  cell: Cell,
  coord: Coord,
  status: GameStatus,
  losingCell: Coord | null,
  chordCenter: Coord | null,
) {
  if (cell.flagged && !cell.revealed) {
    if (status === "lost" && !cell.mine) return "mine-x"; // flagged a cell that wasn't a mine
    return "flag";
  }
  if (!cell.revealed) {
    // Chording (both mouse buttons on a revealed number) previews which
    // neighboring tiles are about to be revealed by flattening them, same
    // as the classic game's "highlighted" tile state.
    if (
      chordCenter &&
      Math.abs(coord.r - chordCenter.r) <= 1 &&
      Math.abs(coord.c - chordCenter.c) <= 1
    ) {
      return "empty";
    }
    return "covered";
  }
  if (cell.mine) {
    const isLosingCell =
      losingCell && losingCell.r === coord.r && losingCell.c === coord.c;
    return isLosingCell ? "mine-red" : "mine";
  }
  return cell.adjacent > 0 ? `count-${cell.adjacent}` : "empty";
}

// ↑↑↓↓←→←→BA — hold onto your hat.
const KONAMI_CODE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];
const AUTO_PLAY_INTERVAL_MS = 180;

export function Minesweeper({ windowId }: { windowId: string }) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const updateBounds = useWindowStore((s) => s.updateBounds);
  const isFocused = useWindowStore(
    (s) => s.windows.find((w) => w.id === windowId)?.isFocused ?? false,
  );

  const [dims, setDims] = useState<Dims>(DIFFICULTIES.beginner);
  const [board, setBoard] = useState<Cell[][]>(() =>
    emptyBoard(dims.cols, dims.rows),
  );
  const [status, setStatus] = useState<GameStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [digging, setDigging] = useState(false);
  const [facePressed, setFacePressed] = useState(false);
  const [losingCell, setLosingCell] = useState<Coord | null>(null);
  const [chordCenter, setChordCenter] = useState<Coord | null>(null);
  const timerRef = useRef<number | null>(null);
  const didChordRef = useRef(false);

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

  const stopAutoPlay = useCallback(() => {
    if (autoPlayIntervalRef.current) {
      window.clearInterval(autoPlayIntervalRef.current);
      autoPlayIntervalRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newGame = useCallback(
    (next: Dims) => {
      stopAutoPlay();
      setDims(next);
      setBoard(emptyBoard(next.cols, next.rows));
      setStatus("idle");
      setSeconds(0);
      setLosingCell(null);
      setChordCenter(null);
      if (timerRef.current) window.clearInterval(timerRef.current);
      updateBounds(windowId, windowSizeFor(next));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windowId],
  );

  const resetGame = useCallback(() => newGame(dims), [newGame, dims]);

  const revealFlood = (b: Cell[][], r: number, c: number) => {
    const stack: [number, number][] = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      const cell = b[cr][cc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.adjacent === 0 && !cell.mine) {
        for (const [nr, nc] of neighborsOf(cr, cc, dims.cols, dims.rows)) {
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
      working = plantMines(board, r, c, dims.cols, dims.rows, dims.mines);
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

  // Chording: press both mouse buttons on a revealed number to reveal all
  // of its unflagged neighbors at once, same as the classic game — but only
  // if you've flagged exactly as many neighbors as the number says.
  const commitChord = (r: number, c: number) => {
    setChordCenter(null);
    const cell = board[r][c];
    if (!cell.revealed || cell.mine || cell.adjacent === 0) return;
    const around = neighborsOf(r, c, dims.cols, dims.rows);
    const flagged = around.filter(([nr, nc]) => board[nr][nc].flagged).length;
    if (flagged !== cell.adjacent) return;

    didChordRef.current = true;
    const working = board.map((row) => row.map((cell) => ({ ...cell })));
    let hitMine: Coord | null = null;
    for (const [nr, nc] of around) {
      if (working[nr][nc].flagged || working[nr][nc].revealed) continue;
      if (working[nr][nc].mine) {
        hitMine = { r: nr, c: nc };
        continue;
      }
      revealFlood(working, nr, nc);
    }

    if (hitMine) {
      for (const row of working)
        for (const cell of row) if (cell.mine) cell.revealed = true;
      setBoard(working);
      setLosingCell(hitMine);
      setStatus("lost");
      return;
    }

    setBoard(working);
    if (checkWin(working)) setStatus("won");
  };

  // ── Konami-code easter egg: watch it play itself ────────────────────────
  const autoPlayIntervalRef = useRef<number | null>(null);
  const boardRef = useRef(board);
  const statusRef = useRef(status);
  const revealRef = useRef(handleReveal);
  useEffect(() => {
    boardRef.current = board;
    statusRef.current = status;
    revealRef.current = handleReveal;
  });

  const startAutoPlay = useCallback(() => {
    if (autoPlayIntervalRef.current) return;
    autoPlayIntervalRef.current = window.setInterval(() => {
      const b = boardRef.current;
      if (statusRef.current === "won" || statusRef.current === "lost") {
        stopAutoPlay();
        return;
      }
      const safe: Coord[] = [];
      for (let r = 0; r < b.length; r++) {
        for (let c = 0; c < b[r].length; c++) {
          if (!b[r][c].mine && !b[r][c].revealed && !b[r][c].flagged) {
            safe.push({ r, c });
          }
        }
      }
      if (!safe.length) {
        stopAutoPlay();
        return;
      }
      const pick = safe[Math.floor(Math.random() * safe.length)];
      revealRef.current(pick.r, pick.c);
    }, AUTO_PLAY_INTERVAL_MS);
  }, [stopAutoPlay]);

  useEffect(() => stopAutoPlay, [stopAutoPlay]);

  const konamiBufferRef = useRef<string[]>([]);
  useEffect(() => {
    if (!isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      const buf = [...konamiBufferRef.current, key].slice(-KONAMI_CODE.length);
      konamiBufferRef.current = buf;
      if (buf.join(",") === KONAMI_CODE.join(",")) {
        konamiBufferRef.current = [];
        startAutoPlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFocused, startAutoPlay]);

  const currentDifficulty = difficultyName(dims);

  const menus = [
    {
      label: "Game",
      items: [
        { label: "New\tF2", action: resetGame },
        { label: "", divider: true },
        {
          label:
            currentDifficulty === "beginner" ? "✓ Beginner" : "Beginner",
          action: () => newGame(DIFFICULTIES.beginner),
        },
        {
          label:
            currentDifficulty === "intermediate"
              ? "✓ Intermediate"
              : "Intermediate",
          action: () => newGame(DIFFICULTIES.intermediate),
        },
        {
          label: currentDifficulty === "expert" ? "✓ Expert" : "Expert",
          action: () => newGame(DIFFICULTIES.expert),
        },
        { label: "", divider: true },
        { label: "Best Times...", disabled: true },
        { label: "", divider: true },
        { label: "Exit", action: () => closeWindow(windowId) },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help Topics", disabled: true },
        { label: "", divider: true },
        { label: "About Minesweeper", disabled: true },
      ],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <GameArea>
        <Header variant="window" style={{ width: dims.cols * CELL_SIZE + 8 }}>
          <Counter
            style={{ zoom: 0.67 }}
            value={Math.max(0, dims.mines - flagCount)}
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
        <Board
          variant="window"
          $cols={dims.cols}
          $rows={dims.rows}
          onMouseLeave={() => {
            setDigging(false);
            setChordCenter(null);
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const diggable =
                (status === "idle" || status === "playing") &&
                !cell.revealed &&
                !cell.flagged;
              return (
                <CellButton
                  key={`${r}-${c}`}
                  onClick={() => {
                    if (didChordRef.current) {
                      didChordRef.current = false;
                      return;
                    }
                    handleReveal(r, c);
                  }}
                  onContextMenu={(e) => handleFlag(e, r, c)}
                  onMouseDown={(e) => {
                    if (status === "won" || status === "lost") return;
                    if (e.buttons === 3) {
                      if (cell.revealed && !cell.mine) {
                        setChordCenter({ r, c });
                      }
                      setDigging(true);
                    } else if (e.buttons === 1 && diggable) {
                      setDigging(true);
                    }
                  }}
                  onMouseUp={() => {
                    if (chordCenter) commitChord(chordCenter.r, chordCenter.c);
                    setDigging(false);
                  }}
                >
                  <img
                    src={`/icons/minesweeper-tile-${tileIcon(cell, { r, c }, status, losingCell, chordCenter)}.png`}
                    alt=""
                  />
                </CellButton>
              );
            }),
          )}
        </Board>
      </GameArea>
    </Layout>
  );
}
