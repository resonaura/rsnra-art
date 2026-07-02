import { useCallback, useEffect, useRef, useState } from "react";
import { Counter, Frame } from "react95";
import styled from "styled-components";
import { AppMenuBar } from "../../components/AppMenuBar";
import { useWindowStore } from "../../store/windowStore";
import {
  TileFlag,
  TileMine,
  TileMineRed,
  TileMineX,
  TileCount1,
  TileCount2,
  TileCount3,
  TileCount4,
  TileCount5,
  TileCount6,
  TileCount7,
  TileCount8,
  FaceSmile,
  FaceDead,
  FaceSunglasses,
  FaceScared,
  FaceDepressedSmile,
} from "./MinesweeperSprites";

const CELL_SIZE = 24;

const DIFFICULTIES = {
  beginner:     { cols: 9,  rows: 9,  mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert:       { cols: 30, rows: 16, mines: 99 },
} as const;
type DifficultyName = keyof typeof DIFFICULTIES;
type Dims = (typeof DIFFICULTIES)[DifficultyName];

function difficultyName(dims: Dims): DifficultyName | null {
  for (const name of Object.keys(DIFFICULTIES) as DifficultyName[]) {
    const d = DIFFICULTIES[name];
    if (d.cols === dims.cols && d.rows === dims.rows && d.mines === dims.mines)
      return name;
  }
  return null;
}

function windowSizeFor(dims: Dims) {
  return {
    width:  dims.cols * CELL_SIZE + 64,
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
      mine: false, adjacent: 0, revealed: false, flagged: false,
    })),
  );
}

function neighborsOf(r: number, c: number, cols: number, rows: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc]);
    }
  return result;
}

function plantMines(
  board: Cell[][], avoidR: number, avoidC: number,
  cols: number, rows: number, mines: number,
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
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (next[r][c].mine) continue;
      next[r][c].adjacent = neighborsOf(r, c, cols, rows)
        .filter(([nr, nc]) => next[nr][nc].mine).length;
    }
  return next;
}

// ── Styled layout ─────────────────────────────────────────────────────────────
/**
 * Root wrapper: sets all CSS custom properties that the inline SVG sprites
 * read via var(). Since SVGs are rendered as real DOM nodes (not <img>),
 * they inherit these values — and every theme gets its own bevel colours.
 */
const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  /* ── sprite CSS variables from the active react95 theme ── */
  --ms-hl:     ${({ theme }) => theme.borderLightest};
  --ms-sh:     ${({ theme }) => theme.borderDark};
  --ms-fg:     ${({ theme }) => theme.borderDarkest};

  /* semantic sprite colours — intentionally theme-independent */
  --ms-red:    #ff0000;
  --ms-yellow: #ffff00;
  --ms-ydark:  #7b7b00;
  --ms-c1:     #0000ff;   /* digit 1 — blue  */
  --ms-c2:     #007b00;   /* digit 2 — green */
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
  padding: 6px 10px;
  background: ${({ theme }) => theme.material};
`;

// ── Face button ───────────────────────────────────────────────────────────────
// Drawn entirely with CSS bevels; only the face artwork comes from an
// inline SVG component (so it inherits the CSS variables above).

const FaceButton = styled.button<{ $pressed: boolean }>`
  width: 32px;
  height: 32px;
  padding: 0;
  cursor: pointer;
  background: ${({ theme }) => theme.material};
  display: flex;
  align-items: center;
  justify-content: center;

  border-style: solid;
  border-width: 2px;
  border-top-color:    ${({ $pressed, theme }) => $pressed ? theme.borderDarkest : theme.borderLightest};
  border-left-color:   ${({ $pressed, theme }) => $pressed ? theme.borderDarkest : theme.borderLightest};
  border-right-color:  ${({ $pressed, theme }) => $pressed ? theme.borderLightest : theme.borderDark};
  border-bottom-color: ${({ $pressed, theme }) => $pressed ? theme.borderLightest : theme.borderDark};

  outline: none;

  svg {
    /* nudge content 1 px when pressed for tactile feel */
    transform: ${({ $pressed }) => ($pressed ? "translate(1px,1px)" : "none")};
  }
`;

// ── Board ─────────────────────────────────────────────────────────────────────

const Board = styled(Frame)<{ $cols: number; $rows: number }>`
  display: inline-grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, ${CELL_SIZE}px);
  grid-template-rows:    repeat(${({ $rows }) => $rows}, ${CELL_SIZE}px);
  background: ${({ theme }) => theme.material};
  padding: 4px;
`;

// ── Cell tile ─────────────────────────────────────────────────────────────────
// Covered:  raised 2-px Win95 bevel — background only, inner art via SVG.
// Revealed: flat 1-px sunken border — background only, inner art via SVG.

const CellButton = styled.button<{ $revealed: boolean; $redBg?: boolean }>`
  width: ${CELL_SIZE}px;
  height: ${CELL_SIZE}px;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;

  background: ${({ $redBg, theme }) => ($redBg ? "#ff0000" : theme.material)};

  ${({ $revealed, theme }) =>
    $revealed
      ? /* sunken / revealed */`
        border-style: solid;
        border-width: 1px;
        border-top-color:    ${theme.borderDark};
        border-left-color:   ${theme.borderDark};
        border-right-color:  ${theme.borderLightest};
        border-bottom-color: ${theme.borderLightest};
      `
      : /* raised / covered */`
        border-style: solid;
        border-width: 2px;
        border-top-color:    ${theme.borderLightest};
        border-left-color:   ${theme.borderLightest};
        border-right-color:  ${theme.borderDark};
        border-bottom-color: ${theme.borderDark};
      `}
`;

// ── Sprite maps ───────────────────────────────────────────────────────────────

type FaceState = "smile" | "dead" | "sunglasses" | "scared" | "depressed-smile";

const FACE_COMPONENTS: Record<FaceState, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  "smile":            FaceSmile,
  "dead":             FaceDead,
  "sunglasses":       FaceSunglasses,
  "scared":           FaceScared,
  "depressed-smile":  FaceDepressedSmile,
};

const COUNT_COMPONENTS = [
  null, TileCount1, TileCount2, TileCount3,
  TileCount4, TileCount5, TileCount6, TileCount7, TileCount8,
] as const;

function faceState(
  status: GameStatus, digging: boolean, pressed: boolean,
): FaceState {
  if (pressed)             return "smile";
  if (status === "won")    return "sunglasses";
  if (status === "lost")   return "dead";
  if (digging)             return "scared";
  return "smile";
}

// ── Konami code ───────────────────────────────────────────────────────────────
const KONAMI_CODE = [
  "arrowup","arrowup","arrowdown","arrowdown",
  "arrowleft","arrowright","arrowleft","arrowright","b","a",
];
const AUTO_PLAY_INTERVAL_MS = 180;

// ── Component ─────────────────────────────────────────────────────────────────

export function Minesweeper({ windowId }: { windowId: string }) {
  const closeWindow  = useWindowStore((s) => s.closeWindow);
  const updateBounds = useWindowStore((s) => s.updateBounds);
  const isFocused    = useWindowStore(
    (s) => s.windows.find((w) => w.id === windowId)?.isFocused ?? false,
  );

  const [dims, setDims]       = useState<Dims>(DIFFICULTIES.beginner);
  const [board, setBoard]     = useState<Cell[][]>(() => emptyBoard(dims.cols, dims.rows));
  const [status, setStatus]   = useState<GameStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [digging, setDigging] = useState(false);
  const [facePressed, setFacePressed] = useState(false);
  const [losingCell, setLosingCell]   = useState<Coord | null>(null);
  const [chordCenter, setChordCenter] = useState<Coord | null>(null);
  const timerRef     = useRef<number | null>(null);
  const didChordRef  = useRef(false);

  useEffect(() => {
    if (status === "playing") {
      timerRef.current = window.setInterval(
        () => setSeconds((s) => Math.min(999, s + 1)), 1000,
      );
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [status]);

  const flagCount = board.flat().filter((c) => c.flagged).length;

  const autoPlayIntervalRef = useRef<number | null>(null);
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
      if (cell.adjacent === 0 && !cell.mine)
        for (const [nr, nc] of neighborsOf(cr, cc, dims.cols, dims.rows))
          if (!b[nr][nc].revealed) stack.push([nr, nc]);
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
    if (checkWin(working)) nextStatus = "won";
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
      if (working[nr][nc].mine) { hitMine = { r: nr, c: nc }; continue; }
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

  // ── Konami autoplay easter egg ────────────────────────────────────────────
  const boardRef   = useRef(board);
  const statusRef  = useRef(status);
  const revealRef  = useRef(handleReveal);
  useEffect(() => {
    boardRef.current  = board;
    statusRef.current = status;
    revealRef.current = handleReveal;
  });

  const startAutoPlay = useCallback(() => {
    if (autoPlayIntervalRef.current) return;
    autoPlayIntervalRef.current = window.setInterval(() => {
      const b = boardRef.current;
      if (statusRef.current === "won" || statusRef.current === "lost") {
        stopAutoPlay(); return;
      }
      const safe: Coord[] = [];
      for (let r = 0; r < b.length; r++)
        for (let c = 0; c < b[r].length; c++)
          if (!b[r][c].mine && !b[r][c].revealed && !b[r][c].flagged)
            safe.push({ r, c });
      if (!safe.length) { stopAutoPlay(); return; }
      const pick = safe[Math.floor(Math.random() * safe.length)];
      revealRef.current(pick.r, pick.c);
    }, AUTO_PLAY_INTERVAL_MS);
  }, [stopAutoPlay]);

  useEffect(() => stopAutoPlay, [stopAutoPlay]);

  const konamiBufferRef = useRef<string[]>([]);
  useEffect(() => {
    if (!isFocused) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
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
  const FaceIcon = FACE_COMPONENTS[faceState(status, digging, facePressed)];

  const menus = [
    {
      label: "Game",
      items: [
        { label: "New\tF2", action: resetGame },
        { label: "", divider: true },
        {
          label: currentDifficulty === "beginner" ? "✓ Beginner" : "Beginner",
          action: () => newGame(DIFFICULTIES.beginner),
        },
        {
          label: currentDifficulty === "intermediate" ? "✓ Intermediate" : "Intermediate",
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
        { label: "Help Topics",          disabled: true },
        { label: "", divider: true },
        { label: "About Minesweeper",    disabled: true },
      ],
    },
  ];

  return (
    <Layout>
      <AppMenuBar menus={menus} />
      <GameArea>
        <Header variant="window" style={{ width: dims.cols * CELL_SIZE + 8 }}>
          <Counter style={{ zoom: 0.67 }} value={Math.max(0, dims.mines - flagCount)} />
          <FaceButton
            $pressed={facePressed}
            onClick={resetGame}
            onMouseDown={() => setFacePressed(true)}
            onMouseUp={() => setFacePressed(false)}
            onMouseLeave={() => setFacePressed(false)}
          >
            <FaceIcon width={20} height={20} />
          </FaceButton>
          <Counter style={{ zoom: 0.67 }} value={seconds} />
        </Header>

        <Board
          variant="window"
          $cols={dims.cols}
          $rows={dims.rows}
          onMouseLeave={() => { setDigging(false); setChordCenter(null); }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const diggable =
                (status === "idle" || status === "playing") && !cell.revealed && !cell.flagged;

              // Chord preview: unflagged unrevealed neighbours appear "pressed" (flat)
              const isChordPreview =
                !!chordCenter && !cell.revealed && !cell.flagged &&
                Math.abs(r - chordCenter.r) <= 1 && Math.abs(c - chordCenter.c) <= 1;

              const isFlat = cell.revealed || isChordPreview;
              const isLosingRedCell =
                cell.revealed && cell.mine &&
                losingCell?.r === r && losingCell?.c === c;

              // ── choose inner sprite ──
              let Sprite: React.ComponentType<React.SVGProps<SVGSVGElement>> | null = null;

              if (cell.flagged && !cell.revealed) {
                Sprite = (status === "lost" && !cell.mine) ? TileMineX : TileFlag;
              } else if (cell.revealed) {
                if (cell.mine) {
                  Sprite = isLosingRedCell ? TileMineRed : TileMine;
                } else if (cell.adjacent > 0) {
                  Sprite = COUNT_COMPONENTS[cell.adjacent] ?? null;
                }
              }

              return (
                <CellButton
                  key={`${r}-${c}`}
                  $revealed={isFlat}
                  $redBg={isLosingRedCell}
                  onClick={() => {
                    if (didChordRef.current) { didChordRef.current = false; return; }
                    handleReveal(r, c);
                  }}
                  onContextMenu={(e) => handleFlag(e, r, c)}
                  onMouseDown={(e) => {
                    if (status === "won" || status === "lost") return;
                    if (e.buttons === 3) {
                      if (cell.revealed && !cell.mine) setChordCenter({ r, c });
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
                  {Sprite && <Sprite width={12} height={12} />}
                </CellButton>
              );
            }),
          )}
        </Board>
      </GameArea>
    </Layout>
  );
}
