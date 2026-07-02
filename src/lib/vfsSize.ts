// Real byte size of a VFS file's content. Text files store their content
// as-is, but binary files (Paint PNGs, Sound Recorder WAVs) store it as a
// `data:...;base64,...` URL — measuring that string's length (or its Blob
// size) counts the base64 encoding overhead (~33% larger) and the "data:"
// prefix, not the actual file size. Decode the base64 payload instead.
export function contentByteSize(content: string | undefined): number {
  if (!content) return 0;
  const match = content.match(/^data:[^,]*;base64,([\s\S]*)$/);
  if (match) {
    try {
      return atob(match[1]).length;
    } catch {
      return 0;
    }
  }
  return new Blob([content]).size;
}
