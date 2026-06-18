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
