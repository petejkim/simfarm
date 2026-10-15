import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Sharing crawlers read the response HTML; no React or game startup should be necessary.
test.use({ javaScriptEnabled: false });

test('sharing metadata and the supplied JPEG are accessible without JavaScript', async ({ page, request }) => {
  await page.goto('/');
  const canonical='https://simfarm.petekim.xyz/';
  const image=canonical+'assets/share.jpg';
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',canonical);
  for(const [name,content] of Object.entries({
    'og:type':'website','og:url':canonical,'og:image':image,'og:image:type':'image/jpeg',
    'og:image:width':'1200','og:image:height':'630',
  }))await expect(page.locator(`meta[property="${name}"]`)).toHaveAttribute('content',content);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content','summary_large_image');
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content',image);
  for(const name of ['title','description','image:alt']){
    const content=await page.locator(`meta[property="og:${name}"]`).getAttribute('content');
    expect(content).toBeTruthy();
    await expect(page.locator(`meta[name="twitter:${name}"]`)).toHaveAttribute('content',content!);
  }
  const response=await request.get('/assets/share.jpg');
  expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/jpeg');
  expect(await response.body()).toEqual(readFileSync('docs/share.jpg'));
  // Browser image decoding verifies the real dimensions rather than trusting the meta tags.
  const dimensions=await page.evaluate(async()=>{
    const bitmap=await createImageBitmap(await (await fetch('/assets/share.jpg')).blob());
    const result=[bitmap.width,bitmap.height];bitmap.close();return result;
  });
  expect(dimensions).toEqual([1200,630]);
});
