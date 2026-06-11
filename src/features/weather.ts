const WXICON: Record<number, string> = {
  0: 'wb_sunny', 1: 'partly_cloudy_day', 2: 'partly_cloudy_day', 3: 'cloud',
  45: 'foggy', 48: 'foggy', 51: 'grain', 53: 'grain', 55: 'grain',
  61: 'rainy', 63: 'rainy', 65: 'rainy', 71: 'ac_unit', 73: 'ac_unit', 75: 'ac_unit',
  77: 'grain', 80: 'thunderstorm', 81: 'thunderstorm', 82: 'thunderstorm',
  85: 'cloudy_snowing', 86: 'cloudy_snowing', 95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};
const WXCOL: Record<number, string> = {
  0: '#ddb7ff', 1: '#adc6ff', 2: '#adc6ff', 3: '#988d9f', 45: '#988d9f', 48: '#988d9f',
  51: '#adc6ff', 53: '#adc6ff', 55: '#adc6ff', 61: '#4edea3', 63: '#4edea3', 65: '#4edea3',
  71: '#d8e2ff', 73: '#d8e2ff', 75: '#d8e2ff', 80: '#ffb4ab', 81: '#ffb4ab', 82: '#ffb4ab',
  95: '#ffb4ab', 96: '#ffb4ab', 99: '#ffb4ab',
};
const WXDESC: Record<number, string> = {
  0: 'Sonnig', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt', 45: 'Nebel',
  51: 'Nieselregen', 53: 'Nieselregen', 55: 'Dichter Nieselregen', 61: 'Leichter Regen',
  63: 'Regen', 65: 'Starker Regen', 71: 'Leichter Schnee', 73: 'Schnee', 75: 'Starker Schnee',
  80: 'Regenschauer', 81: 'Regenschauer', 82: 'Starke Schauer', 95: 'Gewitter',
  96: 'Gewitter m. Hagel', 99: 'Schweres Gewitter',
};

export async function loadWeather(): Promise<void> {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=48.7745&longitude=12.8693&current_weather=true&timezone=Europe%2FBerlin');
    const d = await r.json();
    const cw = d.current_weather as { weathercode: number; temperature: number };
    const code = cw.weathercode;
    const iconWrap = document.getElementById('dash-wx-icon-wrap');
    if (iconWrap) iconWrap.innerHTML =
      `<span class="material-symbols-outlined" style="font-size:56px;color:${WXCOL[code] ?? '#988d9f'};font-variation-settings:'FILL' 1,'wght' 300">${WXICON[code] ?? 'device_thermostat'}</span>`;
    const temp = document.getElementById('dash-wx-temp');
    const desc = document.getElementById('dash-wx-desc');
    if (temp) temp.textContent = Math.round(cw.temperature) + '°C';
    if (desc) desc.textContent = WXDESC[code] ?? 'Unbekannt';
  } catch {
    const desc = document.getElementById('dash-wx-desc');
    if (desc) desc.textContent = 'Nicht verfügbar';
  }
}
