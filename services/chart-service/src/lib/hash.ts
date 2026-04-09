import { createHash } from "node:crypto";

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, normalizeValue(item)]);
    return Object.fromEntries(entries);
  }

  return value;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function stableSha256(value: unknown): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}
