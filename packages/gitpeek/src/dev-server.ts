/**
 * Browser dev mode server — exposes git service as HTTP API.
 * Run with: bun run dev:browser
 * Frontend served by Vite on :5173, API on :3001
 */
import { createGitService, isGitRepo } from './bun/services/git'
import path from 'path'

const repoPath = process.argv[2] || process.cwd()

async function main() {
  if (!(await isGitRepo(repoPath))) {
    console.error(`Not a git repo: ${repoPath}`)
    process.exit(1)
  }

  const gitService = createGitService(repoPath)
  console.log(`[dev-server] Git repo: ${repoPath}`)

  const server = Bun.serve({
    port: 3001,
    async fetch(req) {
      const url = new URL(req.url)
      const cors: HeadersInit = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }

      if (req.method === 'OPTIONS') {
        return new Response(null, { headers: cors })
      }

      try {
        if (url.pathname === '/api/status' && req.method === 'GET') {
          const status = await gitService.status()
          return Response.json(status, { headers: cors })
        }

        if (url.pathname === '/api/diff' && req.method === 'POST') {
          const body = await req.json() as { filePath: string; staged: boolean }
          const diff = await gitService.diff(body.filePath, body.staged)
          return Response.json({ diff }, { headers: cors })
        }

        if (url.pathname === '/api/stage' && req.method === 'POST') {
          const body = await req.json() as { filePaths: string[] }
          await gitService.stage(body.filePaths)
          return Response.json({ ok: true }, { headers: cors })
        }

        if (url.pathname === '/api/unstage' && req.method === 'POST') {
          const body = await req.json() as { filePaths: string[] }
          await gitService.unstage(body.filePaths)
          return Response.json({ ok: true }, { headers: cors })
        }

        if (url.pathname === '/api/commit' && req.method === 'POST') {
          const body = await req.json() as { summary: string; description?: string }
          const result = await gitService.commit(body.summary, body.description)
          return Response.json(result, { headers: cors })
        }

        if (url.pathname === '/api/push' && req.method === 'POST') {
          const result = await gitService.push()
          return Response.json(result, { headers: cors })
        }

        if (url.pathname === '/api/pushSetUpstream' && req.method === 'POST') {
          const result = await gitService.pushSetUpstream()
          return Response.json(result, { headers: cors })
        }

        if (url.pathname === '/api/branchInfo' && req.method === 'GET') {
          const info = await gitService.branchInfo()
          return Response.json(info, { headers: cors })
        }

        if (url.pathname === '/api/repoPath' && req.method === 'GET') {
          return Response.json({ path: repoPath }, { headers: cors })
        }

        return new Response('Not Found', { status: 404, headers: cors })
      } catch (err: any) {
        console.error('[dev-server] Error:', err)
        return Response.json({ error: err.message }, { status: 500, headers: cors })
      }
    },
  })

  console.log(`[dev-server] API running on http://localhost:${server.port}`)
}

main()
