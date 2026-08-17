export function photoFilenameWithoutExtension(filename: string) {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, "");

  return withoutExtension || filename;
}
