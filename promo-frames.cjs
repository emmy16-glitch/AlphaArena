const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const videoPath = '/home/azureuser/AlphaArena/alphaarena-promo.mp4';
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.setContent(`<body style="margin:0;background:#111"><video id="v" src="file://${videoPath}" style="display:block;width:1360px" muted preload="auto"></video></body>`);
  try {
    await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, null, { timeout: 20000 });
  } catch {
    console.log('VIDEO_CODEC_FAIL: readyState never advanced');
    await browser.close();
    process.exit(2);
  }
  const info = await page.evaluate(() => { const v = document.getElementById('v'); return { duration: v.duration, w: v.videoWidth, h: v.videoHeight }; });
  console.log('video info:', JSON.stringify(info));
  fs.mkdirSync('/tmp/promo-frames', { recursive: true });
  const el = await page.$('#v');
  const N = 10;
  for (let i = 0; i < N; i++) {
    const t = Math.min((info.duration * i) / N + 0.05, info.duration - 0.1);
    await page.evaluate((t) => new Promise((res) => { const v = document.getElementById('v'); v.onseeked = () => res(); v.currentTime = t; }), t);
    await page.waitForTimeout(150);
    await el.screenshot({ path: `/tmp/promo-frames/frame-${String(i).padStart(2, '0')}.png` });
    console.log(`frame ${i} @ ${t.toFixed(1)}s`);
  }
  await browser.close();
  console.log('frames done');
})().catch((e) => { console.error(e); process.exit(1); });
