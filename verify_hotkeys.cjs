const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('[console]', msg.text()));
  page.on('pageerror', err => console.log('[pageerror]', err.message));

  await page.goto('http://localhost:3000/Hub/Sammlung/CandyBox/candybox.html');

  await page.evaluate(() => {
    localStorage.setItem('candybox_save_v1', JSON.stringify({
      candies: 9999, gold: 9999,
      inventory: ['sword','hat','shield','potion','heal_herbs','strength_potion','iron_potion'],
      unlocked: ['throw','lollipopField','sell','shop','upgrades','quests'],
      hp: 50, maxHp: 50, defense: 0,
      activeQuest: null, activeEvent: null, eventCooldown: 0, completedQuests: [],
      autoHeal: false, fightSpeed: 1, lastSaved: Date.now(),
      stats: { candiesEaten:0, candiesThrown:0, questsWon:0, lollipopsSold:0, totalCandiesProduced:0, goldEarned:0 },
      lollipops: 0, lollipopQueue: 0, lollipopCooldown: 0, candyPerSec: 1, upgrades: [],
    }));
  });
  await page.reload();
  await page.waitForTimeout(500);

  // Start the forest quest
  const startResult = await page.evaluate(() => {
    try { window.cbQuest('forest'); return 'ok'; } catch (e) { return 'err: ' + e.message; }
  });
  console.log('start quest:', startResult);
  await page.waitForTimeout(200);

  const battleVisible = await page.evaluate(() => {
    const sec = document.getElementById('sec-battle');
    return sec ? !sec.classList.contains('cb-hidden') : 'no-sec';
  });
  console.log('battle visible:', battleVisible);

  // dump hotkey badges currently shown
  const badges = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.battle-hotkey').forEach(b => {
      out.push({ text: b.textContent, parent: b.closest('button')?.id || b.closest('button')?.textContent?.trim().slice(0,20) });
    });
    return out;
  });
  console.log('badges:', JSON.stringify(badges, null, 2));

  // Press '1' -> should trigger power strike (Kraftstoß)
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  let state = await page.evaluate(() => ({ powerStrikeQueued: window.__S?.activeQuest?.powerStrikeQueued }));
  console.log('after pressing 1 (no __S exposed, expect undefined):', JSON.stringify(state));

  // Check log entries instead, and toast messages
  const log1 = await page.evaluate(() => Array.from(document.querySelectorAll('#battle-log .log-entry')).map(e=>e.textContent));
  console.log('battle log after "1":', JSON.stringify(log1.slice(-5)));

  await page.screenshot({ path: '/tmp/candybox_battle.png' });

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
