"use client";

import { normalizeContractBodyHtml, plainTextToContractHtml } from "@/lib/contract-rich-text";

type TextMarks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
};

type RichCharacter = {
  char: string;
  marks: TextMarks;
};

const emptyMarks: TextMarks = { bold: false, italic: false, underline: false, strike: false };

function escapeEditorHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function marksEqual(left: TextMarks, right: TextMarks) {
  return (
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.strike === right.strike
  );
}

function cloneMarks(marks: TextMarks): TextMarks {
  return { ...marks };
}

function wrapMarkedText(value: string, marks: TextMarks) {
  let html = value;

  if (marks.strike) {
    html = `<s>${html}</s>`;
  }

  if (marks.underline) {
    html = `<u>${html}</u>`;
  }

  if (marks.italic) {
    html = `<em>${html}</em>`;
  }

  if (marks.bold) {
    html = `<strong>${html}</strong>`;
  }

  return html;
}

function marksFromElement(element: Element, inherited: TextMarks): TextMarks {
  const tag = element.tagName.toLowerCase();
  const style = element.getAttribute("style")?.toLowerCase() ?? "";
  const className = element.getAttribute("class")?.toLowerCase() ?? "";
  const fontWeight = style.match(/font-weight\s*:\s*([^;]+)/)?.[1]?.trim() ?? "";
  const textDecoration = style.match(/text-decoration(?:-line)?\s*:\s*([^;]+)/)?.[1] ?? "";

  return {
    bold:
      inherited.bold ||
      tag === "b" ||
      tag === "strong" ||
      /\b(bold|strong)\b/.test(className) ||
      /^(bold|bolder|[6-9]00)(\s*!important)?$/.test(fontWeight),
    italic: inherited.italic || tag === "i" || tag === "em" || /font-style\s*:\s*italic/.test(style),
    underline: inherited.underline || tag === "u" || textDecoration.includes("underline"),
    strike: inherited.strike || tag === "s" || tag === "strike" || textDecoration.includes("line-through")
  };
}

function flattenRichCharacters(node: Node, marks: TextMarks, output: RichCharacter[]) {
  if (node.nodeType === 3) {
    for (const char of node.textContent ?? "") {
      output.push({ char, marks: cloneMarks(marks) });
    }
    return;
  }

  if (node.nodeType !== 1) {
    return;
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  if (["script", "style", "meta", "link", "svg", "math"].includes(tag)) {
    return;
  }

  const nextMarks = marksFromElement(element, marks);

  if (tag === "br") {
    output.push({ char: "\n", marks: cloneMarks(nextMarks) });
    return;
  }

  for (const child of Array.from(element.childNodes)) {
    flattenRichCharacters(child, nextMarks, output);
  }
}

function richCharactersFromHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const characters: RichCharacter[] = [];

  flattenRichCharacters(document.body, emptyMarks, characters);

  return characters;
}

function normalizedCharacter(value: string) {
  return value.replace(/\u00a0/g, " ").toLocaleLowerCase();
}

function renderPlainTextWithRichMarks(text: string, richCharacters: RichCharacter[]) {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\n+|\n+$/g, "");
  let richIndex = 0;
  let currentMarks = emptyMarks;

  function marksForCharacter(char: string) {
    if (char === " " || char === "\u00a0") {
      return currentMarks;
    }

    if (char === "\t" || char === "\n") {
      return emptyMarks;
    }

    const normalized = normalizedCharacter(char);

    for (let index = richIndex; index < richCharacters.length; index += 1) {
      const candidate = richCharacters[index];

      if (!candidate.char.trim()) {
        continue;
      }

      if (normalizedCharacter(candidate.char) === normalized) {
        richIndex = index + 1;
        currentMarks = candidate.marks;
        return candidate.marks;
      }
    }

    for (let index = richIndex; index < richCharacters.length; index += 1) {
      const candidate = richCharacters[index];

      if (candidate.char.trim()) {
        richIndex = index + 1;
        currentMarks = candidate.marks;
        return candidate.marks;
      }
    }

    return currentMarks;
  }

  function renderInline(segment: string) {
    let html = "";
    let buffer = "";
    let activeMarks = emptyMarks;

    function flush() {
      if (!buffer) {
        return;
      }

      html += wrapMarkedText(escapeEditorHtml(buffer), activeMarks);
      buffer = "";
    }

    for (const char of segment) {
      const nextMarks = marksForCharacter(char);

      if (buffer && !marksEqual(activeMarks, nextMarks)) {
        flush();
      }

      activeMarks = nextMarks;
      buffer += char;
    }

    flush();
    return html;
  }

  return normalizedText
    .split(/\n{2,}/)
    .filter((paragraph) => Boolean(paragraph.trim()))
    .map((paragraph) => `<p>${paragraph.split("\n").map(renderInline).join("<br>")}</p>`)
    .join("");
}

export function clipboardHtmlToContractHtml(html: string, text: string) {
  if (!html) {
    return plainTextToContractHtml(text);
  }

  if (text && /[\n\t]/.test(text) && !/<table[\s>]/i.test(html)) {
    const markedPlainText = renderPlainTextWithRichMarks(text, richCharactersFromHtml(html));

    if (markedPlainText) {
      return normalizeContractBodyHtml(markedPlainText);
    }
  }

  return normalizeContractBodyHtml(html);
}
