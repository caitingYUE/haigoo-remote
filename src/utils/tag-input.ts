const TAG_DELIMITER_REGEX = /[\n\r\t,，、;；]+/g

export function splitTagInput(input: unknown): string[] {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.flatMap((item) => splitTagInput(item))))
  }

  if (typeof input !== 'string') return []

  return Array.from(
    new Set(
      input
        .split(TAG_DELIMITER_REGEX)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export function joinTagInput(input: unknown): string {
  return splitTagInput(input).join(', ')
}

export function appendTagInput(existing: unknown, nextValue: string): string {
  return joinTagInput([...splitTagInput(existing), nextValue])
}
