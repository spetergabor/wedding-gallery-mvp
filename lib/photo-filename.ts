export function photoFilenameWithoutExtension(filename: string) {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, "");

  return withoutExtension || filename;
}

export type PhotoFilenameSearch = {
  isList: boolean;
  terms: string[];
};

function normalizeFilenameSearchTerm(value: string) {
  const filename = value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.trim();

  return filename?.toLocaleLowerCase() ?? "";
}

function looksLikeWhitespaceSeparatedFilenameList(tokens: string[]) {
  return (
    tokens.length > 1 &&
    tokens.every((token) => /\.[a-z0-9]{2,5}$/i.test(token) || /[_-]/.test(token) || /\d/.test(token))
  );
}

export function parsePhotoFilenameSearch(value: string): PhotoFilenameSearch {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { isList: false, terms: [] };
  }

  const hasExplicitListSeparator = /[\r\n,;\t]/.test(trimmedValue);
  const whitespaceTokens = trimmedValue.split(/\s+/).filter(Boolean);
  const isWhitespaceSeparatedList =
    !hasExplicitListSeparator && looksLikeWhitespaceSeparatedFilenameList(whitespaceTokens);
  const rawTerms = hasExplicitListSeparator
    ? trimmedValue.split(/[\r\n,;\t]+/)
    : isWhitespaceSeparatedList
      ? whitespaceTokens
      : [trimmedValue];
  const terms = Array.from(new Set(rawTerms.map(normalizeFilenameSearchTerm).filter(Boolean)));

  return {
    isList: hasExplicitListSeparator || isWhitespaceSeparatedList || terms.length > 1,
    terms
  };
}

export function photoMatchesFilenameSearch(filename: string, search: PhotoFilenameSearch) {
  if (search.terms.length === 0) {
    return true;
  }

  const normalizedFilename = normalizeFilenameSearchTerm(filename);
  const filenameWithoutExtension = photoFilenameWithoutExtension(normalizedFilename);

  if (!search.isList) {
    const term = search.terms[0];

    return normalizedFilename.includes(term) || filenameWithoutExtension.includes(photoFilenameWithoutExtension(term));
  }

  return search.terms.some((term) => {
    const termWithoutExtension = photoFilenameWithoutExtension(term);

    return normalizedFilename === term || filenameWithoutExtension === termWithoutExtension;
  });
}

export function lightroomFilenameList(filenames: string[]) {
  return filenames.map(photoFilenameWithoutExtension).join(", ");
}
