import { defineConfig, Plugin } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'

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
  plugins: [htmlIncludes()],
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
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: false,
    // class mode: HMR deaktiviert → kein Auto-Reload bei Mitschülern
    hmr: mode === 'class' ? false : undefined,
  },
}))
