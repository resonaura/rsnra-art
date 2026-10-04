import { useVfsStore, type VfsNode } from "../store/vfsStore";
import { alertError } from "../lib/systemDialogs";
import {
  dispatchSendToEntry,
  isSendToMenuEntry,
  isSendToMenuEntryEnabled,
  sendToMenuLabel,
  type SendToSource,
} from "../lib/sendTo";
import { USER_SEND_TO_PATH } from "../lib/windowsPaths";
import { CtxItem, CtxSubmenu } from "./ContextMenu";

const EMPTY: VfsNode[] = [];

export function SendToSubmenu({
  sources,
  onComplete,
}: {
  sources: SendToSource[];
  onComplete: () => void;
}) {
  const folder = useVfsStore((state) => state.resolve(USER_SEND_TO_PATH));
  const entries = (folder?.children ?? EMPTY).filter(isSendToMenuEntry);

  return (
    <CtxSubmenu label="Send To">
      {entries.length ? (
        entries.map((entry) => (
          <CtxItem
            key={entry.name.toLowerCase()}
            $disabled={!isSendToMenuEntryEnabled(entry, sources.length)}
            onClick={() => {
              const result = dispatchSendToEntry(entry, sources);
              onComplete();
              if (result.failed) {
                void alertError(
                  "Send To",
                  result.succeeded
                    ? `Windows could not send ${result.failed} item(s).`
                    : "Windows could not send the selected item(s).",
                );
              }
            }}
          >
            {sendToMenuLabel(entry)}
          </CtxItem>
        ))
      ) : (
        <CtxItem $disabled>No destinations available</CtxItem>
      )}
    </CtxSubmenu>
  );
}
