interface Tipp {
  cat: string;
  color: 'primary' | 'secondary' | 'tertiary';
  icon: string;
  title: string;
  body: string;
  code?: string;
}

const COLOR: Record<string, { badge: string; text: string; bg: string }> = {
  primary:   { badge: 'bg-primary/10 text-primary',    text: '#ddb7ff', bg: 'rgba(221,183,255,0.08)' },
  secondary: { badge: 'bg-secondary/10 text-secondary', text: '#4edea3', bg: 'rgba(78,222,163,0.08)' },
  tertiary:  { badge: 'bg-tertiary/10 text-tertiary',   text: '#adc6ff', bg: 'rgba(173,198,255,0.08)' },
};

const TIPPS: Tipp[] = [
  // ── Web ───────────────────────────────────────────────────────────────
  { cat: 'Web', color: 'secondary', icon: 'language',
    title: 'CSS Custom Properties',
    body: 'CSS-Variablen lassen sich mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">var(--name)</code> überall nutzen — ideal für Themes.',
    code: ':root { --primary: #6366f1; }\nh1 { color: var(--primary); }' },

  { cat: 'Web', color: 'secondary', icon: 'language',
    title: 'Flexbox: gap statt margin',
    body: 'Mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">gap</code> auf dem Flex-Container vermeidest du negative Margins und :last-child-Hacks.',
    code: '.row { display: flex; gap: 1rem; }' },

  { cat: 'Web', color: 'secondary', icon: 'language',
    title: 'Optional Chaining (?.) in JS',
    body: 'Mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">?.</code> prüfst du auf null/undefined ohne verschachtelte if-Blöcke.',
    code: 'const name = user?.profile?.name ?? "Anonym";' },

  { cat: 'Web', color: 'secondary', icon: 'language',
    title: 'CSS Grid: auto-fill',
    body: 'Responsive Spalten ohne Media Queries — das Grid passt sich automatisch der Breite an.',
    code: '.grid {\n  display: grid;\n  grid-template-columns:\n    repeat(auto-fill, minmax(200px, 1fr));\n}' },

  { cat: 'Web', color: 'secondary', icon: 'language',
    title: 'HTML: article vs. div',
    body: '<code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">&lt;article&gt;</code> steht für eigenständigen Inhalt (z.B. Blogpost). <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">&lt;section&gt;</code> gruppiert thematisch verwandten Inhalt. Semantik hilft Screenreadern und SEO.' },

  { cat: 'Web', color: 'secondary', icon: 'language',
    title: 'const vs. let',
    body: 'Nutze immer <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">const</code> als Standard. Nur wenn der Wert neu zugewiesen werden muss, wechsle zu <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">let</code>.',
    code: 'const PI = 3.14;      // nie neu zuweisen\nlet counter = 0;     // wird geändert\ncounter++;' },

  // ── Java ──────────────────────────────────────────────────────────────
  { cat: 'Java', color: 'primary', icon: 'code',
    title: 'String.format()',
    body: 'Bei mehreren Variablen ist <code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">String.format()</code> lesbarer als <code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">+</code>-Verkettung.',
    code: 'String.format(\n  "Hallo %s, du bist %d Jahre alt.",\n  name, age);' },

  { cat: 'Java', color: 'primary', icon: 'code',
    title: 'Enhanced for-Loop',
    body: 'Die for-each-Schleife ist für Collections kürzer und fehlerunanfälliger als der klassische Index-Loop.',
    code: 'for (String s : liste) {\n  System.out.println(s);\n}' },

  { cat: 'Java', color: 'primary', icon: 'code',
    title: 'ArrayList vs. Array',
    body: '<code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">ArrayList</code> wächst dynamisch und bietet add()/remove(). Arrays haben fixe Größe und sind bei Primitiven etwas schneller.' },

  { cat: 'Java', color: 'primary', icon: 'code',
    title: 'try-with-resources',
    body: 'Ressourcen wie Streams werden automatisch geschlossen — kein finally-Block nötig.',
    code: 'try (FileReader fr = new FileReader("f.txt")) {\n  // nutze fr — wird auto. geschlossen\n}' },

  { cat: 'Java', color: 'primary', icon: 'code',
    title: 'Wrapper-Klassen & Autoboxing',
    body: 'Collections brauchen Objekte, keine Primitive. Java wandelt automatisch um: <code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">int → Integer</code> (Autoboxing).',
    code: 'List<Integer> zahlen = new ArrayList<>();\nzahlen.add(42); // Autoboxing' },

  { cat: 'Java', color: 'primary', icon: 'code',
    title: 'equals() statt ==',
    body: 'Bei Strings und Objekten immer <code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">equals()</code> nutzen. <code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">==</code> vergleicht Referenzen, nicht den Inhalt.',
    code: 'String a = new String("hi");\nString b = new String("hi");\na == b       // false (andere Referenz)\na.equals(b)  // true' },

  // ── SQL / Datenbank ───────────────────────────────────────────────────
  { cat: 'SQL', color: 'tertiary', icon: 'database',
    title: 'NULL-Fallstricke',
    body: 'NULL ist kein Wert — Vergleiche mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(173,198,255,0.12);color:#adc6ff">=</code> schlagen immer fehl. Immer <code class="font-mono text-xs px-1 rounded" style="background:rgba(173,198,255,0.12);color:#adc6ff">IS NULL</code> verwenden.',
    code: '-- Falsch:\nWHERE name = NULL\n\n-- Richtig:\nWHERE name IS NULL' },

  { cat: 'SQL', color: 'tertiary', icon: 'database',
    title: 'JOIN vs. Subquery',
    body: 'JOINs sind meist schneller als korrelierte Subqueries, weil der Query-Optimizer sie besser optimieren kann. Subqueries in WHERE können pro Zeile erneut ausgeführt werden.' },

  { cat: 'SQL', color: 'tertiary', icon: 'database',
    title: 'LIKE-Optimierung',
    body: 'Nur ein Präfix-LIKE kann einen Index nutzen. Wildcard am Anfang erzwingt Full Table Scan.',
    code: "-- Index genutzt:\nWHERE name LIKE 'Mül%'\n\n-- Kein Index (Full Scan):\nWHERE name LIKE '%er'" },

  { cat: 'SQL', color: 'tertiary', icon: 'database',
    title: 'COUNT(*) vs. COUNT(col)',
    body: '<code class="font-mono text-xs px-1 rounded" style="background:rgba(173,198,255,0.12);color:#adc6ff">COUNT(*)</code> zählt alle Zeilen. <code class="font-mono text-xs px-1 rounded" style="background:rgba(173,198,255,0.12);color:#adc6ff">COUNT(spalte)</code> zählt nur Zeilen, bei denen die Spalte nicht NULL ist.' },

  { cat: 'SQL', color: 'tertiary', icon: 'database',
    title: 'PRIMARY KEY Wahl',
    body: 'Numerische Auto-Increment-Keys sind meist effizienter als natürliche Keys (wie E-Mail), weil Indizes bei Integers kleiner und schneller sind.' },

  // ── Linux ─────────────────────────────────────────────────────────────
  { cat: 'Linux', color: 'secondary', icon: 'terminal',
    title: 'grep -i und -r',
    body: 'Mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">-i</code> ignorierst du Groß-/Kleinschreibung, mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">-r</code> suchst du rekursiv in Verzeichnissen.',
    code: 'grep -ir "fehler" /var/log/' },

  { cat: 'Linux', color: 'secondary', icon: 'terminal',
    title: 'Pipe |',
    body: 'Das Pipe-Symbol leitet die Ausgabe eines Befehls als Eingabe an den nächsten weiter.',
    code: 'ls -la | grep ".txt" | wc -l' },

  { cat: 'Linux', color: 'secondary', icon: 'terminal',
    title: 'chmod — Oktalnotation',
    body: '7=rwx, 6=rw-, 5=r-x, 4=r--. Die drei Stellen stehen für Besitzer, Gruppe, Andere.',
    code: 'chmod 755 script.sh  # rwxr-xr-x\nchmod 644 datei.txt  # rw-r--r--' },

  { cat: 'Linux', color: 'secondary', icon: 'terminal',
    title: 'history & Wiederholung',
    body: '<code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">history</code> zeigt vergangene Befehle. <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">!42</code> wiederholt Befehl Nr. 42, <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">!!</code> den letzten.',
    code: 'history\n!42    # Befehl Nr. 42 wiederholen\n!!     # letzten Befehl nochmal' },

  { cat: 'Linux', color: 'secondary', icon: 'terminal',
    title: 'find mit -exec',
    body: '<code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">find</code> kombiniert mit <code class="font-mono text-xs px-1 rounded" style="background:rgba(78,222,163,0.12);color:#4edea3">-exec</code> führt Aktionen auf allen gefundenen Dateien aus.',
    code: 'find . -name "*.log" -exec rm {} \\;' },

  // ── ABAP ──────────────────────────────────────────────────────────────
  { cat: 'ABAP', color: 'primary', icon: 'terminal',
    title: 'SELECT SINGLE vs. SELECT',
    body: '<code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">SELECT SINGLE</code> liest genau einen Datensatz. Für mehrere Zeilen immer <code class="font-mono text-xs px-1 rounded" style="background:rgba(221,183,255,0.12);color:#ddb7ff">INTO TABLE</code> mit interner Tabelle nutzen.' },

  { cat: 'ABAP', color: 'primary', icon: 'terminal',
    title: 'Interne Tabellen',
    body: 'STANDARD TABLE: kein eindeutiger Schlüssel, schnelles Anhängen. SORTED TABLE: binäre Suche. HASHED TABLE: O(1)-Zugriff über eindeutigen Schlüssel.' },

  { cat: 'ABAP', color: 'primary', icon: 'terminal',
    title: 'Modern ABAP: INTO @DATA()',
    body: 'Moderne Syntax nutzt explizite Arbeitsbereiche statt veralteter Header-Zeilen — vermeidet unerwartete Seiteneffekte.',
    code: 'SELECT * FROM mara\n  INTO TABLE @DATA(lt_mat).' },

  { cat: 'ABAP', color: 'primary', icon: 'terminal',
    title: 'READ TABLE BINARY SEARCH',
    body: 'Nur bei SORTED TABLEs oder manuell sortierten Tabellen nutzen — sonst sind Ergebnisse falsch.',
    code: 'SORT lt_data BY key.\nREAD TABLE lt_data\n  WITH KEY key = lv_key\n  BINARY SEARCH.' },

  // ── Netzwerk ──────────────────────────────────────────────────────────
  { cat: 'Netzwerk', color: 'tertiary', icon: 'wifi',
    title: 'TCP vs. UDP',
    body: 'TCP garantiert Reihenfolge und Lieferung (Handshake, ACK-Bestätigung). UDP ist schneller, aber unzuverlässig — ideal für Video-Streaming oder Spiele.' },

  { cat: 'Netzwerk', color: 'tertiary', icon: 'wifi',
    title: 'Subnetting — nutzbare Adressen',
    body: 'Netz- und Broadcast-Adresse sind nicht nutzbar. Bei /24: 256 − 2 = 254 Hosts. Bei /25: 128 − 2 = 126 Hosts.' },

  { cat: 'Netzwerk', color: 'tertiary', icon: 'wifi',
    title: 'OSI-Modell Eselsbrücke',
    body: 'Schichten 1–7 (unten→oben): <em>Alle Deutschen Studenten Trinken Verschiedene Sorten Bier</em> (Physical, Data Link, Network, Transport, Session, Presentation, Application).' },

  { cat: 'Netzwerk', color: 'tertiary', icon: 'wifi',
    title: 'DNS-Auflösung',
    body: 'DNS löst Hostnamen → IP auf. Ablauf: Resolver → Root-Nameserver → TLD-Nameserver → Autoritativer Nameserver → IP zurück.' },

  // ── DVT / Allgemein ───────────────────────────────────────────────────
  { cat: 'DVT', color: 'primary', icon: 'developer_board',
    title: 'Zweierkomplement',
    body: 'Negative Zahlen: Bits invertieren + 1 addieren. Damit funktioniert Addition für positive und negative Zahlen mit derselben Hardware.',
    code: '+5 in 8-Bit = 00000101\n-5: invertieren = 11111010\n   + 1         = 11111011' },

  { cat: 'DVT', color: 'primary', icon: 'developer_board',
    title: 'Hex → Dezimal',
    body: 'Jede Hex-Stelle steht für 4 Bit. Nützlich für Farben, Speicheradressen und IP-Masken.',
    code: '0x1A = 1×16 + 10 = 26\n0xFF = 15×16 + 15 = 255' },

  { cat: 'DVT', color: 'primary', icon: 'developer_board',
    title: 'Cache-Lokalität',
    body: 'CPUs laden Speicher in Cache-Zeilen (~64 Byte). Arrays sind cache-freundlich (sequentiell im Speicher), verlinkte Listen nicht — ein Grund warum Arrays oft schneller sind.' },
];

let _idx = -1;

function getDailyIdx(): number {
  return Math.floor(Date.now() / 86400000) % TIPPS.length;
}

function renderTippFull(): void {
  const t = TIPPS[_idx];
  const body = document.getElementById('tipp-body');
  if (!body) return;
  const c = COLOR[t.color] ?? COLOR.primary;

  let html =
    `<div class="flex items-center gap-sm mb-md">` +
      `<span class="material-symbols-outlined p-sm rounded-lg shrink-0" ` +
        `style="font-size:18px;color:${c.text};background:${c.bg};">${t.icon}</span>` +
      `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}">${t.cat}</span>` +
    `</div>` +
    `<p class="text-on-surface font-semibold text-sm mb-sm">${t.title}</p>` +
    `<p class="text-on-surface-variant text-sm leading-relaxed">${t.body}</p>`;

  if (t.code) {
    const esc = t.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += `<pre class="mt-md text-xs rounded-lg p-sm overflow-x-auto font-mono leading-relaxed" style="background:${c.bg};color:${c.text};">${esc}</pre>`;
  }

  body.innerHTML = html;

  const counter = document.getElementById('tipp-counter');
  if (counter) counter.textContent = `${_idx + 1} / ${TIPPS.length}`;

  const badge = document.getElementById('tipp-daily-badge');
  if (badge) badge.style.display = _idx === getDailyIdx() ? '' : 'none';
}

function renderTipp(): void {
  renderTippFull();
}

export function initTipp(): void {
  _idx = getDailyIdx();
  renderTipp();
}

export function nextTipp(): void {
  _idx = (_idx + 1) % TIPPS.length;
  renderTipp();
}

export function prevTipp(): void {
  _idx = (_idx - 1 + TIPPS.length) % TIPPS.length;
  renderTipp();
}
