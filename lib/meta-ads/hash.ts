import { createHash } from "node:crypto";

export function stablePayloadHash(payload: unknown) {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, normalize(item)])
      );
    }
    return value;
  };
  return createHash("sha256").update(JSON.stringify(normalize(payload))).digest("hex");
}
