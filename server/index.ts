import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { promises as fs } from 'fs'
import path from 'path'

const app = new Hono()

const HUB_DIR = process.env.HUB_PATH ?? 'H:\\f11hub'
const SAVES_DIR = path.join(HUB_DIR, 'saves')
const SCORES_DIR = path.join(HUB_DIR, 'scores')
const HIGHSCORES_FILE = path.resolve('./data/highscores.json')
const HIGHSCORE_LOG_FILE = path.resolve('./data/highscore-log.json')
const USERNAME = process.env.USERNAME || process.env.USER || 'Anonym'

type HighscoreEntry = { name: string; score: number; date: string }
type Highscores = Record<string, HighscoreEntry>

// Log jedes Highscores pro Person & Spiel (anders als Highscores: dort steht nur
// der eine Klassenbeste). Damit lässt sich z.B. ermitteln, wer aktuell Schlusslicht ist.
type HighscoreLogEntry = { score: number; date: string }
type HighscoreLog = Record<string, Record<string, HighscoreLogEntry>>

async function ensureDirs() {
  for (const dir of [SAVES_DIR, SCORES_DIR]) {
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch (err) {
      console.warn(`[WARN] Verzeichnis konnte nicht erstellt werden (${dir}):`, err)
    }
  }
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

// Mehrere PCs schreiben parallel auf denselben Server — ohne Lock liest Request B
// die Datei, bevor Request A seine Änderung geschrieben hat, und überschreibt sie
// beim eigenen Schreiben wieder. withFileLock serialisiert Read-Modify-Write pro Datei.
const fileLocks = new Map<string, Promise<unknown>>()

function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(file) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  fileLocks.set(file, next.then(() => undefined, () => undefined))
  return next
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
  const file = saveFile(c.req.param('game'))
  const lowerIsBetter = c.req.query('lower') === 'true'
  return withFileLock(file, async () => {
    if (typeof body === 'number') {
      const existing = await readJson<number>(file, lowerIsBetter ? Infinity : 0)
      const notBetter = lowerIsBetter ? body >= existing : body <= existing
      if (notBetter) return c.json({ ok: true, updated: false })
    }
    await writeJson(file, body)
    return c.json({ ok: true, updated: true })
  })
})

app.delete('/api/saves/:game', async (c) => {
  try {
    await fs.unlink(saveFile(c.req.param('game')))
  } catch {
    // already gone
  }
  return c.json({ ok: true })
})

// ── Username ─────────────────────────────────────────────────────────────────

app.get('/api/username', (c) => c.json({ name: USERNAME }))

// ── Highscores (Klassen-Bestenliste, lokal im Projektordner) ─────────────────

app.get('/api/highscores', async (c) => {
  return c.json(await readJson<Highscores>(HIGHSCORES_FILE, {}))
})

app.get('/api/highscores/:game/log', async (c) => {
  const log = await readJson<HighscoreLog>(HIGHSCORE_LOG_FILE, {})
  return c.json(log[c.req.param('game')] ?? {})
})

app.post('/api/highscores/:game', async (c) => {
  const { score, lowerIsBetter } = await c.req.json() as { score: number; lowerIsBetter?: boolean }
  if (typeof score !== 'number') return c.json({ error: 'score required' }, 400)
  const game = c.req.param('game')

  // Persönliches Bestes pro Person mitloggen (unabhängig vom Klassenrekord),
  // damit sich z.B. das aktuelle Schlusslicht pro Spiel ermitteln lässt.
  withFileLock(HIGHSCORE_LOG_FILE, async () => {
    const log = await readJson<HighscoreLog>(HIGHSCORE_LOG_FILE, {})
    const gameLog = log[game] ?? {}
    const prevOwn = gameLog[USERNAME]
    const ownIsBetter = lowerIsBetter ? (!prevOwn || score < prevOwn.score) : (!prevOwn || score > prevOwn.score)
    if (ownIsBetter) {
      log[game] = { ...gameLog, [USERNAME]: { score, date: new Date().toLocaleDateString('de') } }
      await writeJson(HIGHSCORE_LOG_FILE, log)
    }
  }).catch(err => console.warn(`[Highscore-Log] Schreiben fehlgeschlagen (${HIGHSCORE_LOG_FILE}):`, err))

  return withFileLock(HIGHSCORES_FILE, async () => {
    const all = await readJson<Highscores>(HIGHSCORES_FILE, {})
    const current = all[game]
    const isBetter = lowerIsBetter ? (!current || score < current.score) : (!current || score > current.score)
    if (isBetter) {
      all[game] = { name: USERNAME, score, date: new Date().toLocaleDateString('de') }
      try {
        await writeJson(HIGHSCORES_FILE, all)
        console.log(`[Highscore] ${game}: ${score} von ${USERNAME}`)
      } catch (err) {
        console.warn(`[Highscore] Schreiben fehlgeschlagen (${HIGHSCORES_FILE}):`, err)
      }
      return c.json({ updated: true, entry: all[game] })
    }
    return c.json({ updated: false, entry: current })
  })
})

// ── Scores ───────────────────────────────────────────────────────────────────

const MAX_SCORES = 10

app.get('/api/scores/:game', async (c) => {
  const scores = await readJson<{ name: string; score: number }[]>(scoresFile(c.req.param('game')), [])
  return c.json(scores)
})

app.post('/api/scores/:game', async (c) => {
  const body = await c.req.json() as { score: number }
  if (typeof body.score !== 'number') {
    return c.json({ error: 'score required' }, 400)
  }
  const file = scoresFile(c.req.param('game'))
  return withFileLock(file, async () => {
    const scores = await readJson<{ name: string; score: number }[]>(file, [])
    scores.push({ name: USERNAME, score: body.score })
    scores.sort((a, b) => b.score - a.score)
    if (scores.length > MAX_SCORES) scores.length = MAX_SCORES
    await writeJson(file, scores)
    return c.json(scores)
  })
})

// ── Static ───────────────────────────────────────────────────────────────────

app.get('/', (c) => c.redirect('/index.html'))
app.use('/*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT) || 3000

ensureDirs().then(() => {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`F11 HUB läuft auf http://localhost:${info.port}`)
    console.log(`Benutzer: ${USERNAME}`)
    console.log(`Saves    → ${SAVES_DIR}`)
    console.log(`Scores   → ${SCORES_DIR}`)
    console.log(`Highscores → ${HIGHSCORES_FILE}`)
  })
})
