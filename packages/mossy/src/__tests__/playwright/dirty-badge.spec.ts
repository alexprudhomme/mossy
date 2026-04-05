import { test, expect } from '@playwright/test'

/**
 * Tests that the DirtyBadge correctly renders diff line stats (+N / -N)
 * from the git:worktreeStatus RPC response.
 *
 * This exercises the full pipeline:
 *   getWorktreeStatus (backend) → git:worktreeStatus RPC → useWorktreeStatus hook → DirtyBadge
 *
 * The browser-dev stub returns { linesAdded: 42, linesDeleted: 7 } for all worktrees.
 * Before the fix, untracked files were excluded from these counts — so a worktree
 * with many new untracked files would show a misleadingly small number like "+51 -8"
 * instead of the true total.
 */

test.describe('DirtyBadge diff stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the app to hydrate — the stub returns branch names we can anchor on
    await page.getByText('feature/diff-panel').waitFor({ timeout: 10_000 })
  })

  test('shows linesAdded as green +N badge', async ({ page }) => {
    // The stub returns linesAdded: 42 — expect at least one "+42" to appear
    const addedBadges = page.locator('text=+42')
    await expect(addedBadges.first()).toBeVisible({ timeout: 8_000 })
  })

  test('shows linesDeleted as red -N badge', async ({ page }) => {
    // The stub returns linesDeleted: 7 — expect at least one "-7" to appear
    const deletedBadges = page.locator('text=-7')
    await expect(deletedBadges.first()).toBeVisible({ timeout: 8_000 })
  })

  test('added badge has emerald colour class', async ({ page }) => {
    // The +42 span must specifically have the emerald colour
    const badge = page.locator('span.text-emerald-400', { hasText: '+42' }).first()
    await expect(badge).toBeVisible({ timeout: 8_000 })
    await expect(badge).toHaveText('+42')
  })

  test('deleted badge has red colour class', async ({ page }) => {
    const badge = page.locator('span.text-red-400').first()
    await expect(badge).toBeVisible({ timeout: 8_000 })
    await expect(badge).toHaveText('-7')
  })

  test('badge tooltip includes human-readable line counts', async ({ page }) => {
    // The DirtyBadge title attribute is "42 lines added, 7 lines deleted, 2 unpushed"
    const badgeContainer = page.locator('[title*="lines added"]').first()
    await expect(badgeContainer).toBeVisible({ timeout: 8_000 })
    await expect(badgeContainer).toHaveAttribute('title', /42 lines added/)
    await expect(badgeContainer).toHaveAttribute('title', /7 lines deleted/)
  })
})
