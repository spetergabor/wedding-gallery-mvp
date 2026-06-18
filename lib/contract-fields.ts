export type ContractFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "textarea";
};

export const CONTRACT_FIELD_OPTIONS: ContractFieldDefinition[] = [
  { key: "coupleName", label: "Pár neve", type: "text" },
  { key: "primaryEmail", label: "Email cím", type: "email" },
  { key: "phone", label: "Telefonszám", type: "tel" },
  { key: "weddingDate", label: "Esküvő dátuma", type: "date" },
  { key: "venue", label: "Esküvő helyszíne", type: "text" },
  { key: "billingAddress", label: "Számlázási cím", type: "textarea" },
  { key: "personalId", label: "Személyi igazolvány / azonosító", type: "text" },
  { key: "notes", label: "Megjegyzés", type: "textarea" }
];

export type ContractTemplatePart =
  | { type: "text"; value: string }
  | { type: "field"; field: ContractFieldDefinition; token: string };

const TOKEN_PATTERN = /{{\s*([A-Za-z0-9_:-]+)\s*}}/g;

export function parseContractFields(value: unknown): ContractFieldDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const field = item as Partial<ContractFieldDefinition>;

      if (!field.key || !field.label || !field.type) {
        return null;
      }

      if (!["text", "email", "tel", "date", "textarea"].includes(field.type)) {
        return null;
      }

      return {
        key: field.key,
        label: field.label,
        type: field.type
      };
    })
    .filter((field): field is ContractFieldDefinition => Boolean(field));
}

export function parseContractAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, answer]) => typeof answer === "string")
      .map(([key, answer]) => [key, answer.trim()])
  );
}

export function contractFieldInputName(key: string) {
  return `contractField:${key}`;
}

export function contractFieldToken(key: string) {
  return `{{${key}}}`;
}

export function contractFieldByKey(key: string) {
  return CONTRACT_FIELD_OPTIONS.find((field) => field.key === key) ?? null;
}

export function fieldKeysInContractTemplate(bodyText: string) {
  const keys = new Set<string>();

  for (const match of bodyText.matchAll(TOKEN_PATTERN)) {
    if (contractFieldByKey(match[1])) {
      keys.add(match[1]);
    }
  }

  return keys;
}

export function contractFieldsFromKeys(keys: Iterable<string>) {
  const selectedKeys = new Set(keys);

  return CONTRACT_FIELD_OPTIONS.filter((field) => selectedKeys.has(field.key));
}

export function mergeContractFieldsFromTemplate(bodyText: string, selectedKeys: Iterable<string>) {
  const mergedKeys = new Set(selectedKeys);

  for (const key of fieldKeysInContractTemplate(bodyText)) {
    mergedKeys.add(key);
  }

  return contractFieldsFromKeys(mergedKeys);
}

export function parseContractTemplateParts(
  bodyText: string,
  fields: ContractFieldDefinition[] = CONTRACT_FIELD_OPTIONS
): ContractTemplatePart[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const parts: ContractTemplatePart[] = [];
  let cursor = 0;

  for (const match of bodyText.matchAll(TOKEN_PATTERN)) {
    const [token, key] = match;
    const index = match.index ?? 0;
    const field = byKey.get(key);

    if (!field) {
      continue;
    }

    if (index > cursor) {
      parts.push({ type: "text", value: bodyText.slice(cursor, index) });
    }

    parts.push({ type: "field", field, token });
    cursor = index + token.length;
  }

  if (cursor < bodyText.length) {
    parts.push({ type: "text", value: bodyText.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: bodyText }];
}

export function renderContractTemplateText(bodyText: string, answers: Record<string, string>) {
  return bodyText.replace(TOKEN_PATTERN, (token, key) => {
    if (!contractFieldByKey(key)) {
      return token;
    }

    return answers[key]?.trim() || "________________";
  });
}
