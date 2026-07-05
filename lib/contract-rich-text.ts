import {
  contractFieldByKey,
  contractFieldDisplayLabel,
  contractFieldInputName,
  type ContractFieldDefinition
} from "@/lib/contract-fields";

const TOKEN_PATTERN = /{{\s*([A-Za-z0-9_:-]+)\s*}}/g;
const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);
const VOID_TAGS = new Set(["br"]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function hasHtmlMarkup(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function getAttribute(attrs: string, name: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = attrs.match(pattern);

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function sanitizeStyle(value: string | null) {
  if (!value) {
    return null;
  }

  const allowed: string[] = [];

  for (const declaration of value.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const propertyValue = rawValueParts.join(":").trim();

    if (!property || !propertyValue || /url\s*\(|expression\s*\(/i.test(propertyValue)) {
      continue;
    }

    if (property === "text-align" && /^(left|center|right|justify)$/i.test(propertyValue)) {
      allowed.push(`${property}: ${propertyValue.toLowerCase()}`);
    }

    if (property === "font-weight" && /^(normal|bold|[1-9]00)$/i.test(propertyValue)) {
      allowed.push(`${property}: ${propertyValue.toLowerCase()}`);
    }

    if (property === "font-style" && /^(normal|italic)$/i.test(propertyValue)) {
      allowed.push(`${property}: ${propertyValue.toLowerCase()}`);
    }

    if (property === "text-decoration" && /^(none|underline|line-through)$/i.test(propertyValue)) {
      allowed.push(`${property}: ${propertyValue.toLowerCase()}`);
    }
  }

  return allowed.length > 0 ? allowed.join("; ") : null;
}

function sanitizeHref(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function sanitizeNumericAttribute(value: string | null) {
  if (!value || !/^[1-9][0-9]{0,2}$/.test(value.trim())) {
    return null;
  }

  return value.trim();
}

function sanitizeTag(tagName: string, attrs: string, closing: boolean) {
  const tag = tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    return "";
  }

  if (closing) {
    return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
  }

  const sanitizedAttrs: string[] = [];
  const style = sanitizeStyle(getAttribute(attrs, "style"));

  if (style) {
    sanitizedAttrs.push(`style="${escapeAttribute(style)}"`);
  }

  if (tag === "a") {
    const href = sanitizeHref(getAttribute(attrs, "href"));

    if (href) {
      sanitizedAttrs.push(`href="${escapeAttribute(href)}"`);
      sanitizedAttrs.push('target="_blank"');
      sanitizedAttrs.push('rel="noopener noreferrer"');
    }
  }

  if (tag === "td" || tag === "th") {
    const colspan = sanitizeNumericAttribute(getAttribute(attrs, "colspan"));
    const rowspan = sanitizeNumericAttribute(getAttribute(attrs, "rowspan"));

    if (colspan) {
      sanitizedAttrs.push(`colspan="${colspan}"`);
    }

    if (rowspan) {
      sanitizedAttrs.push(`rowspan="${rowspan}"`);
    }
  }

  return `<${tag}${sanitizedAttrs.length ? ` ${sanitizedAttrs.join(" ")}` : ""}>`;
}

function preserveTextLineBreaks(value: string) {
  return value
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) {
        return part;
      }

      if (/^[\t\n\r ]+$/.test(part) && /[\n\r]/.test(part)) {
        return "";
      }

      return part
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n/g, "<br>");
    })
    .join("");
}

export function sanitizeContractHtml(value: string) {
  const sanitized = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|select|textarea|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|select|textarea|svg|math)[^>]*\/?\s*>/gi, "")
    .replace(/<\s*\/?\s*([a-zA-Z][\w:-]*)([^>]*)>/g, (match, tagName: string, attrs: string) =>
      sanitizeTag(tagName, attrs ?? "", /^<\s*\//.test(match))
    );

  return preserveTextLineBreaks(sanitized)
    .replace(/>\s+</g, "><")
    .replace(/(?:<br>){3,}/g, "<br><br>")
    .trim();
}

export function plainTextToContractHtml(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\n+|\n+$/g, "")
    .split(/\n{2,}/)
    .filter((paragraph) => Boolean(paragraph.trim()))
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function normalizeContractBodyHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return sanitizeContractHtml(hasHtmlMarkup(trimmed) ? trimmed : plainTextToContractHtml(trimmed));
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };

  return value.replace(/&(#(\d+)|#x([0-9a-f]+)|[a-z]+);/gi, (entity, _body, decimal, hexadecimal) => {
    if (decimal) {
      return String.fromCodePoint(Number.parseInt(decimal, 10));
    }

    if (hexadecimal) {
      return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
    }

    return namedEntities[entity.slice(1, -1).toLowerCase()] ?? entity;
  });
}

export function contractBodyToPlainText(value: string) {
  if (!value.trim()) {
    return "";
  }

  const html = normalizeContractBodyHtml(value);

  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h1|h2|h3|h4|blockquote|tr|table|ul|ol)>/gi, "\n")
      .replace(/<\/(td|th)>/gi, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function renderFieldHtml(field: ContractFieldDefinition, value: string, formId: string) {
  const inputName = contractFieldInputName(field.key);
  const label = contractFieldDisplayLabel(field);
  const escapedName = escapeAttribute(inputName);
  const escapedLabel = escapeAttribute(label);
  const escapedValue = escapeAttribute(value);
  const formAttribute = escapeAttribute(formId);

  if (field.type === "textarea") {
    return `<label class="contract-inline-field contract-inline-field-block"><span>${escapeHtml(label)}</span><textarea form="${formAttribute}" name="${escapedName}" required rows="3">${escapeHtml(value)}</textarea></label>`;
  }

  return `<label class="contract-inline-field"><span>${escapeHtml(label)}</span><input form="${formAttribute}" name="${escapedName}" type="${escapeAttribute(field.type)}" value="${escapedValue}" required placeholder="${escapedLabel}"></label>`;
}

export function renderContractTemplateHtml({
  bodyText,
  fields,
  values,
  formId
}: {
  bodyText: string;
  fields: ContractFieldDefinition[];
  values: Record<string, string>;
  formId: string;
}) {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));

  return normalizeContractBodyHtml(bodyText).replace(TOKEN_PATTERN, (token, key) => {
    const field = fieldsByKey.get(key) ?? contractFieldByKey(key);

    if (!field) {
      return escapeHtml(token);
    }

    return renderFieldHtml(field, values[field.key] ?? "", formId);
  });
}
