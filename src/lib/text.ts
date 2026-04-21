export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function toLocation(input: string, index: number) {
  const safeIndex = Math.max(0, Math.min(index, input.length))
  const slice = input.slice(0, safeIndex)
  const lines = slice.split('\n')
  const line = lines.length
  const column = (lines.at(-1)?.length ?? 0) + 1

  return { line, column }
}
