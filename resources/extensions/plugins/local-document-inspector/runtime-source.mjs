import MarkdownIt from 'markdown-it';
import { launch, PUPPETEER_REVISIONS } from 'puppeteer-core';
import { install, detectBrowserPlatform, Browser } from '@puppeteer/browsers';

export const markdown = new MarkdownIt({ html: false });
export const launchBrowser = launch;
export async function prepareBrowser(cacheDir) {
  const platform = detectBrowserPlatform();
  if (!platform) throw new Error('Document rendering browser is unavailable for this platform');
  const browser = await install({ browser: Browser.CHROME, buildId: PUPPETEER_REVISIONS.chrome, cacheDir, platform });
  return { executablePath: browser.executablePath, version: PUPPETEER_REVISIONS.chrome, platform };
}
