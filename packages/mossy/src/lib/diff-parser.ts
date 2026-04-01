/**
 * Unified diff parser — converts git diff output into structured data
 * for rendering with custom React components (similar to GitHub Desktop).
 */

export interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'hunk-header'
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: DiffLine[]
}

export interface ParsedDiff {
  hunks: DiffHunk[]
  isBinary: boolean
  isNewFile: boolean
  isDeletedFile: boolean
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

export function parseDiff(raw: string): ParsedDiff {
  const lines = raw.split('\n')
  const result: ParsedDiff = {
    hunks: [],
    isBinary: false,
    isNewFile: false,
    isDeletedFile: false,
  }

  let i = 0

  // Skip diff header lines (diff --git, index, ---, +++)
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('Binary files')) {
      result.isBinary = true
      return result
    }
    if (line.startsWith('new file')) {
      result.isNewFile = true
    }
    if (line.startsWith('deleted file')) {
      result.isDeletedFile = true
    }
    if (line.startsWith('@@')) break
    i++
  }

  // Parse hunks
  while (i < lines.length) {
    const line = lines[i]
    const match = HUNK_HEADER_RE.exec(line)
    if (!match) {
      i++
      continue
    }

    const hunk: DiffHunk = {
      header: line,
      oldStart: parseInt(match[1], 10),
      oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
      newStart: parseInt(match[3], 10),
      newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
      lines: [],
    }

    hunk.lines.push({
      type: 'hunk-header',
      content: match[5]?.trim() || '',
      oldLineNumber: null,
      newLineNumber: null,
    })

    let oldLine = hunk.oldStart
    let newLine = hunk.newStart
    i++

    while (i < lines.length) {
      const l = lines[i]
      if (l.startsWith('@@')) break
      if (l.startsWith('diff --git')) break
      if (l === '\\ No newline at end of file') {
        i++
        continue
      }

      if (l.startsWith('+')) {
        hunk.lines.push({
          type: 'added',
          content: l.slice(1),
          oldLineNumber: null,
          newLineNumber: newLine++,
        })
      } else if (l.startsWith('-')) {
        hunk.lines.push({
          type: 'removed',
          content: l.slice(1),
          oldLineNumber: oldLine++,
          newLineNumber: null,
        })
      } else {
        hunk.lines.push({
          type: 'context',
          content: l.length > 0 ? l.slice(1) : '',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
        })
      }

      i++
    }

    result.hunks.push(hunk)
  }

  return result
}
