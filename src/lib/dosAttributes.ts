export type DosAttributeCode = "R" | "H" | "S" | "A" | "D";

export interface DosAttributeSelector {
  include: DosAttributeCode[];
  exclude: DosAttributeCode[];
}

type DosAttributeLike = {
  type?: "file" | "dir";
  readonly?: boolean;
  hidden?: boolean;
  system?: boolean;
  archive?: boolean;
};

/** Parse `/A`, `/AH`, `/A:H-S`, and their case-insensitive equivalents. */
export function parseDosAttributeSelector(
  argument: string,
  options: { allowDirectories?: boolean } = {},
): DosAttributeSelector | null {
  const match = argument.match(/^\/a(?::?(.*))?$/i);
  if (!match) return null;

  const include = new Set<DosAttributeCode>();
  const exclude = new Set<DosAttributeCode>();
  const expression = (match[1] ?? "").toUpperCase();
  const supportedAttributes = options.allowDirectories === false
    ? "RHSA"
    : "RHSAD";
  let index = 0;
  while (index < expression.length) {
    const excluded = expression[index] === "-";
    if (excluded) index++;
    const character = expression[index++];
    if (!character || !supportedAttributes.includes(character)) return null;
    (excluded ? exclude : include).add(character as DosAttributeCode);
  }
  return { include: [...include], exclude: [...exclude] };
}

/**
 * Apply a DOS `/A` selector. Without one, DEL/DIR omit Hidden and System
 * entries; an explicit empty `/A` selector requests all attributes.
 */
export function matchesDosAttributeSelector(
  node: DosAttributeLike,
  selector: DosAttributeSelector | null,
): boolean {
  const values: Record<DosAttributeCode, boolean> = {
    R: !!node.readonly,
    H: !!node.hidden,
    S: !!node.system,
    A: !!node.archive,
    D: node.type === "dir",
  };
  const include = selector?.include ?? [];
  const exclude = selector?.exclude ?? (selector === null ? ["H", "S"] : []);
  return (
    include.every((attribute) => values[attribute]) &&
    exclude.every((attribute) => !values[attribute])
  );
}
