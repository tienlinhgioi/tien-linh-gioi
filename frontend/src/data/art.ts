declare const __ART_FILES__: string[];
/** The build discovers files on disk: missing optional art is never requested. */
export function art(file: string): string | undefined {
  return __ART_FILES__.includes(file)
    ? `${import.meta.env.BASE_URL}art/${file}`
    : undefined;
}
