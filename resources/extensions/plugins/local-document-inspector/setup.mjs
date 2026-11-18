import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

let text = ''; for await (const chunk of process.stdin) text += chunk;
const { packageRoot, targetRoot } = JSON.parse(text);
mkdirSync(targetRoot, { recursive: true });
cpSync(join(packageRoot, 'dependencies'), join(targetRoot, 'dependencies'), { recursive: true });
cpSync(join(packageRoot, 'workbench-cli.mjs'), join(targetRoot, 'workbench-cli.mjs'));
const { prepareBrowser } = await import(pathToFileURL(join(targetRoot, 'dependencies/runtime.mjs')).href);
const browser = await prepareBrowser(join(targetRoot, 'browser'));
if (!existsSync(browser.executablePath)) throw new Error('Prepared document browser not found at ' + browser.executablePath);
writeFileSync(join(targetRoot, 'browser.json'), JSON.stringify({ ...browser, executablePath: relative(targetRoot, browser.executablePath) }));
console.log(JSON.stringify({ ready: true, browserVersion: browser.version, platform: browser.platform, commands: ['wb-document'] }));
