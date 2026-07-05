import { contractFieldByKey, type ContractFieldDefinition } from "@/lib/contract-fields";

export type ContractPdfField = ContractFieldDefinition & {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePercent(value: unknown, fallback: number) {
  return Math.round(clamp(finiteNumber(value, fallback), 0, 100) * 100) / 100;
}

export function parseContractPdfFields(value: unknown): ContractPdfField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as Partial<ContractPdfField>;
      const field = raw.key ? contractFieldByKey(raw.key) : null;

      if (!field) {
        return null;
      }

      const width = clamp(normalizePercent(raw.width, 24), 4, 100);
      const height = clamp(normalizePercent(raw.height, 4.2), 3, 100);
      const x = normalizePercent(raw.x, 8);
      const y = normalizePercent(raw.y, 8);

      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `${field.key}-${index}`,
        key: field.key,
        label: field.label,
        type: field.type,
        page: Math.max(1, Math.floor(finiteNumber(raw.page, 1))),
        x: clamp(x, 0, Math.max(0, 100 - width)),
        y: clamp(y, 0, Math.max(0, 100 - height)),
        width,
        height
      };
    })
    .filter((field): field is ContractPdfField => Boolean(field));
}

export function parseContractPdfFieldsJson(value: string) {
  try {
    return parseContractPdfFields(JSON.parse(value));
  } catch {
    return null;
  }
}
