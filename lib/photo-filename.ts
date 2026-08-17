export function photoFilenameWithoutExtension(filename: string) {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, "");

  return withoutExtension || filename;
}

export function lightroomFilenameList(filenames: string[]) {
  return filenames.map(photoFilenameWithoutExtension).join(", ");
}
