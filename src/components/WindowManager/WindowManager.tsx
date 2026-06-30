import { useWindowStore } from '../../store/windowStore';
import { AppWindow } from './AppWindow';

export function WindowManager() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <>
      {windows
        .filter((w) => !w.isMinimized)
        .map((w) => (
          <AppWindow key={w.id} win={w} />
        ))}
    </>
  );
}
