import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { promises as fs } from 'fs'
import path from 'path'

const app = new Hono()

const DATA_DIR = path.resolve('./data')
const SAVES_DIR = path.join(DATA_DIR, 'saves')
const SCORES_DIR = path.join(DATA_DIR, 'scores')

async function ensureDirs() {
  await fs.mkdir(SAVES_DIR, { recursive: true })
  await fs.mkdir(SCORES_DIR, { recursive: true })
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

function saveFile(game: string) {
  return path.join(SAVES_DIR, `${game}.json`)
}

function scoresFile(game: string) {
  return path.join(SCORES_DIR, `${game}.json`)
}

// ── Saves ────────────────────────────────────────────────────────────────────

app.get('/api/saves/:game', async (c) => {
  const data = await readJson(saveFile(c.req.param('game')), null)
  if (!data) return c.json({ error: 'No save found' }, 404)
  return c.json(data)
})

app.post('/api/saves/:game', async (c) => {
  const body = await c.req.json()
  await writeJson(saveFile(c.req.param('game')), body)
  return c.json({ ok: true })
})

app.delete('/api/saves/:game', async (c) => {
  try {
    await fs.unlink(saveFile(c.req.param('game')))
  } catch {
    // already gone
  }
  return c.json({ ok: true })
})

// ── Scores ───────────────────────────────────────────────────────────────────

const MAX_SCORES = 10

app.get('/api/scores/:game', async (c) => {
  const scores = await readJson<{ name: string; score: number }[]>(scoresFile(c.req.param('game')), [])
  return c.json(scores)
})

app.post('/api/scores/:game', async (c) => {
  const body = await c.req.json() as { name: string; score: number }
  if (!body.name || typeof body.score !== 'number') {
    return c.json({ error: 'name and score required' }, 400)
  }
  const file = scoresFile(c.req.param('game'))
  const scores = await readJson<{ name: string; score: number }[]>(file, [])
  scores.push({ name: body.name, score: body.score })
  scores.sort((a, b) => b.score - a.score)
  if (scores.length > MAX_SCORES) scores.length = MAX_SCORES
  await writeJson(file, scores)
  return c.json(scores)
})

// ── Static ───────────────────────────────────────────────────────────────────

app.get('/', (c) => c.redirect('/index.html'))
app.use('/*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT) || 3000

ensureDirs().then(() => {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`F11 HUB läuft auf http://localhost:${info.port}`)
  })
})
