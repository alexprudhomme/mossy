import { describe, test, expect } from 'bun:test'
import { parseDiff } from '../lib/diff-parser'

describe('parseDiff', () => {
  test('parses a simple modification diff', () => {
    const raw = `diff --git a/.gitignore b/.gitignore
index a74b34d..dd65e93 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,5 +1,8 @@
 node_modules/
 dist/
 out/
+build/
 *.dmg
+*.lockb
+bun.lock
 .DS_Store`

    const result = parseDiff(raw)
    expect(result.isBinary).toBe(false)
    expect(result.isNewFile).toBe(false)
    expect(result.isDeletedFile).toBe(false)
    expect(result.hunks).toHaveLength(1)

    const hunk = result.hunks[0]
    expect(hunk.oldStart).toBe(1)
    expect(hunk.oldCount).toBe(5)
    expect(hunk.newStart).toBe(1)
    expect(hunk.newCount).toBe(8)

    // hunk-header + 3 context + 3 added + 2 context = 9 lines
    const added = hunk.lines.filter((l) => l.type === 'added')
    const context = hunk.lines.filter((l) => l.type === 'context')
    expect(added).toHaveLength(3)
    expect(context).toHaveLength(5) // node_modules, dist, out, *.dmg, .DS_Store
    expect(added[0].content).toBe('build/')
    expect(added[0].newLineNumber).toBe(4)
    expect(added[0].oldLineNumber).toBeNull()
  })

  test('parses a new file diff', () => {
    const raw = `diff --git a/hello.txt b/hello.txt
new file mode 100644
index 0000000..ce01362
--- /dev/null
+++ b/hello.txt
@@ -0,0 +1,3 @@
+hello
+world
+!`

    const result = parseDiff(raw)
    expect(result.isNewFile).toBe(true)
    expect(result.isDeletedFile).toBe(false)
    expect(result.hunks).toHaveLength(1)

    const added = result.hunks[0].lines.filter((l) => l.type === 'added')
    expect(added).toHaveLength(3)
    expect(added[0].content).toBe('hello')
    expect(added[0].newLineNumber).toBe(1)
    expect(added[2].content).toBe('!')
    expect(added[2].newLineNumber).toBe(3)
  })

  test('parses a deleted file diff', () => {
    const raw = `diff --git a/old.txt b/old.txt
deleted file mode 100644
index ce01362..0000000
--- a/old.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-hello
-world
-!`

    const result = parseDiff(raw)
    expect(result.isDeletedFile).toBe(true)
    expect(result.hunks).toHaveLength(1)

    const removed = result.hunks[0].lines.filter((l) => l.type === 'removed')
    expect(removed).toHaveLength(3)
    expect(removed[0].content).toBe('hello')
    expect(removed[0].oldLineNumber).toBe(1)
  })

  test('parses binary file diff', () => {
    const raw = `diff --git a/image.png b/image.png
Binary files /dev/null and b/image.png differ`

    const result = parseDiff(raw)
    expect(result.isBinary).toBe(true)
    expect(result.hunks).toHaveLength(0)
  })

  test('parses multiple hunks', () => {
    const raw = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,4 +1,4 @@
 import foo from 'foo'
-import bar from 'bar'
+import baz from 'baz'
 
 function main() {
@@ -10,3 +10,4 @@ function main() {
   console.log('hello')
+  console.log('world')
   return true
 }`

    const result = parseDiff(raw)
    expect(result.hunks).toHaveLength(2)

    // First hunk: 1 removed, 1 added
    const h1added = result.hunks[0].lines.filter((l) => l.type === 'added')
    const h1removed = result.hunks[0].lines.filter((l) => l.type === 'removed')
    expect(h1added).toHaveLength(1)
    expect(h1removed).toHaveLength(1)
    expect(h1removed[0].content).toBe("import bar from 'bar'")
    expect(h1added[0].content).toBe("import baz from 'baz'")

    // Second hunk
    expect(result.hunks[1].oldStart).toBe(10)
    expect(result.hunks[1].newStart).toBe(10)
    const h2added = result.hunks[1].lines.filter((l) => l.type === 'added')
    expect(h2added).toHaveLength(1)
    expect(h2added[0].content).toBe("  console.log('world')")
  })

  test('handles "no newline at end of file" marker', () => {
    const raw = `diff --git a/file.txt b/file.txt
index abc..def 100644
--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,2 @@
 hello
-world
\\ No newline at end of file
+world!
\\ No newline at end of file`

    const result = parseDiff(raw)
    expect(result.hunks).toHaveLength(1)
    // Should not include the "no newline" marker as a diff line
    const nonHeader = result.hunks[0].lines.filter((l) => l.type !== 'hunk-header')
    expect(nonHeader).toHaveLength(3) // 1 context + 1 removed + 1 added
  })

  test('parses synthetic diff for untracked files', () => {
    // This is the format our git service generates for untracked files
    const raw = `--- /dev/null
+++ b/packages/gitpeek/src/lib/diff-parser.ts
@@ -0,0 +1,3 @@
+line one
+line two
+line three`

    const result = parseDiff(raw)
    expect(result.hunks).toHaveLength(1)
    expect(result.isNewFile).toBe(false) // no "new file mode" header
    const added = result.hunks[0].lines.filter((l) => l.type === 'added')
    expect(added).toHaveLength(3)
    expect(added[0].newLineNumber).toBe(1)
  })

  test('returns empty hunks for empty input', () => {
    const result = parseDiff('')
    expect(result.hunks).toHaveLength(0)
    expect(result.isBinary).toBe(false)
  })

  test('line numbers are correct with mixed add/remove/context', () => {
    const raw = `diff --git a/f.txt b/f.txt
--- a/f.txt
+++ b/f.txt
@@ -5,7 +5,8 @@
 context1
-removed1
-removed2
+added1
+added2
+added3
 context2
 context3`

    const result = parseDiff(raw)
    const lines = result.hunks[0].lines.filter((l) => l.type !== 'hunk-header')

    // context1: old=5, new=5
    expect(lines[0]).toMatchObject({ type: 'context', oldLineNumber: 5, newLineNumber: 5 })
    // removed1: old=6, new=null
    expect(lines[1]).toMatchObject({ type: 'removed', oldLineNumber: 6, newLineNumber: null })
    // removed2: old=7, new=null
    expect(lines[2]).toMatchObject({ type: 'removed', oldLineNumber: 7, newLineNumber: null })
    // added1: old=null, new=6
    expect(lines[3]).toMatchObject({ type: 'added', oldLineNumber: null, newLineNumber: 6 })
    // added2: old=null, new=7
    expect(lines[4]).toMatchObject({ type: 'added', oldLineNumber: null, newLineNumber: 7 })
    // added3: old=null, new=8
    expect(lines[5]).toMatchObject({ type: 'added', oldLineNumber: null, newLineNumber: 8 })
    // context2: old=8, new=9
    expect(lines[6]).toMatchObject({ type: 'context', oldLineNumber: 8, newLineNumber: 9 })
  })
})
