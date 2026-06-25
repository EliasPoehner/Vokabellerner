import { defineConfig, Plugin } from 'vite'
import { resolve } from 'path'
import { readFileSync, promises as fs } from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'

const HUB_DIR = process.env.HUB_PATH ?? 'H:\\f11hub'
const SCORES_DIR = HUB_DIR + '\\scores'
const SAVES_DIR = HUB_DIR + '\\saves'
const HIGHSCORES_FILE = resolve(__dirname, 'data', 'highscores.json')
const USERNAME = process.env.USERNAME || process.env.USER || 'Anonym'
const MAX_SCORES = 10

type HighscoreEntry = { name: string; score: number; date: string }
type Highscores = Record<string, HighscoreEntry>

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf-8')) as T } catch { return fallback }
}
async function writeJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

// Mehrere PCs schreiben parallel auf dieselbe Datei (H:\f11hub) — ohne Lock liest
// Request B die Datei, bevor Request A seine Änderung geschrieben hat, und überschreibt
// sie beim eigenen Schreiben wieder. withFileLock serialisiert Read-Modify-Write pro Datei.
const fileLocks = new Map<string, Promise<unknown>>()

function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(file) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  fileLocks.set(file, next.then(() => undefined, () => undefined))
  return next
}

function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      for (const dir of [SAVES_DIR, SCORES_DIR]) {
        fs.mkdir(dir, { recursive: true }).catch((err: Error) => {
          console.warn(`[dev-api] Verzeichnis nicht erreichbar (${dir}): ${err.message}`)
        })
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const fullUrl = req.url ?? ''
        const [url, queryString = ''] = fullUrl.split('?')
        const query = new URLSearchParams(queryString)
        const json = (data: unknown, status = 200) => {
          res.writeHead(status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        }

        const body = (): Promise<unknown> => new Promise((ok, fail) => {
          let raw = ''
          req.on('data', (c) => { raw += c })
          req.on('end', () => { try { ok(JSON.parse(raw)) } catch { fail(new Error('Bad JSON')) } })
        })

        // Highscores (Klassen-Bestenliste)
        if (url === '/api/highscores' && req.method === 'GET') {
          return json(await readJson<Highscores>(HIGHSCORES_FILE, {}))
        }
        const hsMatch = url.match(/^\/api\/highscores\/([^/?]+)$/)
        if (hsMatch && req.method === 'POST') {
          let b: { score: number }
          try { b = await body() as { score: number } } catch { return json({ error: 'Bad JSON' }, 400) }
          if (typeof b.score !== 'number') return json({ error: 'score required' }, 400)
          const game = hsMatch[1]
          return withFileLock(HIGHSCORES_FILE, async () => {
            const all = await readJson<Highscores>(HIGHSCORES_FILE, {})
            const current = all[game]
            if (!current || b.score > current.score) {
              all[game] = { name: USERNAME, score: b.score, date: new Date().toLocaleDateString('de') }
              try {
                await writeJson(HIGHSCORES_FILE, all)
                console.log(`[Highscore] ${game}: ${b.score} von ${USERNAME}`)
              } catch (err) {
                console.warn(`[Highscore] Schreiben fehlgeschlagen (${HIGHSCORES_FILE}):`, err)
              }
              return json({ updated: true, entry: all[game] })
            }
            return json({ updated: false, entry: current })
          })
        }

        // Username
        if (url === '/api/username' && req.method === 'GET') {
          return json({ name: USERNAME })
        }

        // Scores
        const scoresMatch = url.match(/^\/api\/scores\/([^/?]+)$/)
        if (scoresMatch) {
          const file = resolve(SCORES_DIR, `${scoresMatch[1]}.json`)
          if (req.method === 'GET') {
            return json(await readJson<unknown[]>(file, []))
          }
          if (req.method === 'POST') {
            const b = await body() as { score: number }
            if (typeof b.score !== 'number') return json({ error: 'score required' }, 400)
            return withFileLock(file, async () => {
              const scores = await readJson<{ name: string; score: number }[]>(file, [])
              scores.push({ name: USERNAME, score: b.score })
              scores.sort((a, b) => b.score - a.score)
              if (scores.length > MAX_SCORES) scores.length = MAX_SCORES
              await writeJson(file, scores)
              return json(scores)
            })
          }
        }

        // Saves
        const savesMatch = url.match(/^\/api\/saves\/([^/?]+)$/)
        if (savesMatch) {
          const file = resolve(SAVES_DIR, `${savesMatch[1]}.json`)
          if (req.method === 'GET') {
            const data = await readJson(file, null)
            return data ? json(data) : json({ error: 'No save found' }, 404)
          }
          if (req.method === 'POST') {
            const incoming = await body()
            const lowerIsBetter = query.get('lower') === 'true'
            return withFileLock(file, async () => {
              if (typeof incoming === 'number') {
                const existing = await readJson<number>(file, lowerIsBetter ? Infinity : 0)
                const notBetter = lowerIsBetter ? incoming >= existing : incoming <= existing
                if (notBetter) return json({ ok: true, updated: false })
              }
              await writeJson(file, incoming)
              return json({ ok: true, updated: true })
            })
          }
          if (req.method === 'DELETE') {
            await fs.unlink(file).catch(() => {})
            return json({ ok: true })
          }
        }

        next()
      })
    },
  }
}

function htmlIncludes(): Plugin {
  return {
    name: 'html-includes',
    transformIndexHtml(html) {
      return html.replace(/<!--#include\s+file="([^"]+)"\s*-->/g, (_, file) =>
        readFileSync(resolve(__dirname, file), 'utf-8')
      )
    },
  }
}

export default defineConfig(({ mode }) => ({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [devApi(), htmlIncludes()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dorf: resolve(__dirname, 'Hub/Sammlung/Dorf/dorf.html'),
        sudoku: resolve(__dirname, 'Hub/Sammlung/sudoku.html'),
        asteroid: resolve(__dirname, 'Hub/Sammlung/asteroid_blaster.html'),
        solitaire: resolve(__dirname, 'Hub/Sammlung/solitaire.html'),
        runner: resolve(__dirname, 'Hub/Sammlung/runner/runner.html'),
        klassiker: resolve(__dirname, 'Hub/Sammlung/Klassiker/Klassiker.html'),
        linux: resolve(__dirname, 'Hub/Schule/linux.html'),
        notenkalkulator: resolve(__dirname, 'Hub/Schule/Notenkalkulator.html'),
        sa3: resolve(__dirname, 'Hub/Schule/sa3-pruefungsvorbereitung.html'),
        sa3adsa: resolve(__dirname, 'Hub/Schule/sa3-pruefungsvorbereitungadsa.html'),
        lexikon: resolve(__dirname, 'Hub/Schule/LEXIKONVokabeltrainer.html'),
        dorfchronik: resolve(__dirname, 'Hub/Sammlung/Dorf/dorfchronik_tutorial.html'),
        lebenslauf: resolve(__dirname, 'Hub/Schule/lebenslauf.html'),
        candybox: resolve(__dirname, 'Hub/Sammlung/CandyBox/candybox.html'),
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: false,
    // class mode: HMR deaktiviert → kein Auto-Reload bei Mitschülern
    hmr: mode === 'class' ? false : undefined,
    watch: {
      // Windows: nativer FS-Watcher crasht mit UNKNOWN-Fehler bei großen Verzeichnissen
      usePolling: true,
      interval: 300,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
  },
}))
