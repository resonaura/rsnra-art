import { useEffect, useRef, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Button, Frame } from 'react95';

const GRID = 18;
const CELL = 16;
const INITIAL_SNAKE: [number, number][] = [
  [8, 8],
  [7, 8],
  [6, 8],
];
const SPEED_MS = 120;

type Direction = 'up' | 'down' | 'left' | 'right';

const DELTAS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function randomFood(snake: [number, number][]): [number, number] {
  let pos: [number, number];
  do {
    pos = [Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID)];
  } while (snake.some(([x, y]) => x === pos[0] && y === pos[1]));
  return pos;
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
  font-size: 12px;
`;

const BoardWrap = styled(Frame)`
  position: relative;
  width: ${GRID * CELL}px;
  height: ${GRID * CELL}px;
  background: #0a2a1a;
  flex-shrink: 0;
`;

const Segment = styled.div<{ $x: number; $y: number; $head?: boolean }>`
  position: absolute;
  left: ${({ $x }) => $x * CELL}px;
  top: ${({ $y }) => $y * CELL}px;
  width: ${CELL - 1}px;
  height: ${CELL - 1}px;
  background: ${({ $head }) => ($head ? '#9dff9d' : '#3ddc3d')};
  border: 1px solid #0a2a1a;
`;

const Food = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  left: ${({ $x }) => $x * CELL}px;
  top: ${({ $y }) => $y * CELL}px;
  width: ${CELL - 1}px;
  height: ${CELL - 1}px;
  background: #ff5d5d;
  border-radius: 50%;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  text-align: center;
  font-size: 13px;
`;

export function Snake() {
  const [snake, setSnake] = useState<[number, number][]>(INITIAL_SNAKE);
  const [food, setFood] = useState<[number, number]>(() => randomFood(INITIAL_SNAKE));
  const [direction, setDirection] = useState<Direction>('right');
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const directionRef = useRef(direction);
  const nextDirectionRef = useRef(direction);
  const containerRef = useRef<HTMLDivElement>(null);

  const start = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(randomFood(INITIAL_SNAKE));
    setDirection('right');
    directionRef.current = 'right';
    nextDirectionRef.current = 'right';
    setScore(0);
    setGameOver(false);
    setRunning(true);
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      directionRef.current = nextDirectionRef.current;
      setSnake((prev) => {
        const [hx, hy] = prev[0];
        const [dx, dy] = DELTAS[directionRef.current];
        const nx = hx + dx;
        const ny = hy + dy;

        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
          setRunning(false);
          setGameOver(true);
          return prev;
        }
        if (prev.some(([x, y]) => x === nx && y === ny)) {
          setRunning(false);
          setGameOver(true);
          return prev;
        }

        const ateFood = nx === food[0] && ny === food[1];
        const nextSnake: [number, number][] = [[nx, ny], ...prev];
        if (!ateFood) nextSnake.pop();
        else {
          setScore((s) => s + 10);
          setFood(randomFood(nextSnake));
        }
        return nextSnake;
      });
    }, SPEED_MS);
    return () => window.clearInterval(interval);
  }, [running, food]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const next = map[e.key];
    if (!next) return;
    e.preventDefault();
    if (next === OPPOSITE[directionRef.current]) return;
    nextDirectionRef.current = next;
    setDirection(next);
  };

  return (
    <Layout ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}>
      <Header variant="window">
        <span>Score: {score}</span>
        <span>Arrow keys / WASD to steer</span>
      </Header>
      <BoardWrap variant="window">
        {snake.map(([x, y], i) => (
          <Segment key={i} $x={x} $y={y} $head={i === 0} />
        ))}
        <Food $x={food[0]} $y={food[1]} />
        {!running && (
          <Overlay>
            <p style={{ margin: 0 }}>{gameOver ? `Game Over — Score: ${score}` : 'RSNRA Snake'}</p>
            <Button onClick={start}>{gameOver ? 'Play Again' : 'Start'}</Button>
          </Overlay>
        )}
      </BoardWrap>
    </Layout>
  );
}
