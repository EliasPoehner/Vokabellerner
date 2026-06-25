const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
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
  await page.waitForTimeout(400);
  await page.evaluate(() => window.cbQuest('forest'));
  await page.waitForTimeout(200);

  const before = await page.evaluate(() => document.getElementById('battle-candy-count').textContent);
  console.log('candies before:', before);

  // press 1 -> Kraftstoß (btn-power-strike)
  await page.keyboard.press('1');
  await page.waitForTimeout(150);

  const afterPress1 = await page.evaluate(() => ({
    candies: document.getElementById('battle-candy-count').textContent,
    powerBtnQueuedClass: document.getElementById('btn-power-strike').className,
    powerBtnDisabled: document.getElementById('btn-power-strike').disabled,
    toast: document.querySelector('.toast, #toast-container > div')?.textContent || 'no-toast-el-found',
    badgesNow: Array.from(document.querySelectorAll('.battle-hotkey')).map(b => ({ text: b.textContent, parent: b.closest('button')?.id })),
  }));
  console.log('after pressing 1:', JSON.stringify(afterPress1, null, 2));

  // Now press '1' again -> should now hit Parieren (renumbered), since power-strike button is disabled/excluded
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  const afterSecond1 = await page.evaluate(() => ({
    parryBtnClass: document.getElementById('btn-parry').className,
    parryBtnDisabled: document.getElementById('btn-parry').disabled,
  }));
  console.log('after pressing 1 again (should hit parry now):', JSON.stringify(afterSecond1, null, 2));

  // Press 'e' to heal (Heilen) - check candies drop by 10 and HP logic. First damage player a bit via direct state edit not available; just confirm click happens (toast/candies change)
  const candiesBeforeE = await page.evaluate(() => document.getElementById('battle-candy-count').textContent);
  await page.keyboard.press('e');
  await page.waitForTimeout(150);
  const candiesAfterE = await page.evaluate(() => document.getElementById('battle-candy-count').textContent);
  console.log('candies before E:', candiesBeforeE, 'after E:', candiesAfterE);

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
