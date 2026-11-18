import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), action = argv.shift();
if (!action || ['help', '--help', '-h'].includes(action)) {
  console.log(JSON.stringify({ commands: {
    'document.inspect': { usage: 'wb-document document.inspect --input params.json [--output result.json]', input: { path: 'Readable UTF-8 file', artifactId: 'Optional identity', version: 'Optional version' } },
    'document.render': { usage: 'wb-document document.render --input params.json [--output result.json]', input: { paths: ['Exact Markdown file paths'], outputDirectory: 'Current Run work/outputs directory' } },
  } }, null, 2));
} else {
  if (!['document.inspect', 'document.render'].includes(action)) throw new Error('Unknown document command');
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input', '--output', '--payload'].includes(argv[i]) || argv[i + 1] === undefined) throw new Error('Use --input file.json and optional --output result.json');
    options[argv[i].slice(2)] = argv[i + 1];
  }
  const input = options.input ? JSON.parse(readFileSync(resolve(options.input), 'utf8')) : JSON.parse(options.payload ?? '{}');
  const read = path => {
    if (typeof path !== 'string' || !path) throw new Error('A readable file path is required');
    const absolute = resolve(path), bytes = readFileSync(absolute);
    if (bytes.includes(0) || bytes.subarray(0, 5).toString() === '%PDF-')
      throw new Error('Binary and PDF documents are unsupported; provide UTF-8 text or Markdown');
    return { path: absolute, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes), contentHash: createHash('sha256').update(bytes).digest('hex') };
  };
  let result;
  if (action === 'document.inspect') {
    const file = read(input.path);
    result = { path: file.path, ...(input.artifactId ? { artifactId: input.artifactId } : {}), ...(input.version ? { version: input.version } : {}),
      contentHash: file.contentHash, characterCount: [...file.content].length, wordCount: (file.content.match(/[\p{L}\p{N}]+/gu) ?? []).length,
      lineCount: file.content.split(/\r?\n/).length, headings: file.content.split(/\r?\n/).flatMap(line => {
        const match = /^(#{1,6})\s+(.+)$/.exec(line); return match ? [{ level: match[1].length, text: match[2].trim() }] : [];
      }) };
  } else {
    if (!Array.isArray(input.paths) || !input.paths.length || typeof input.outputDirectory !== 'string' || !input.outputDirectory)
      throw new Error('document.render requires paths and outputDirectory');
    const files = input.paths.map(read), output = resolve(input.outputDirectory);
    const config = JSON.parse(readFileSync(join(root, 'browser.json'), 'utf8'));
    const { markdown, launchBrowser } = await import(pathToFileURL(join(root, 'dependencies/runtime.mjs')).href);
    const fence = markdown.renderer.rules.fence;
    markdown.renderer.rules.fence = (tokens, index, ...args) => tokens[index].info.trim() === 'mermaid'
      ? '<pre class="mermaid">' + markdown.utils.escapeHtml(tokens[index].content) + '</pre>' : fence(tokens, index, ...args);
    mkdirSync(output, { recursive: true });
    const browser = await launchBrowser({ executablePath: join(root, config.executablePath), headless: true,
      userDataDir: join(output, 'browser-profile'), args: ['--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check'] });
    const documents = [];
    try {
      for (const [index, file] of files.entries()) {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(String(error)));
        await page.setRequestInterception(true);
        page.on('request', request => request.abort());
        const htmlPath = join(output, `${index + 1}.html`);
        let diagrams = 0;
        try {
          const tokens = markdown.parse(file.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ''), {});
          diagrams = tokens.filter(token => token.type === 'fence' && token.info.trim() === 'mermaid').length;
          await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body>' + markdown.renderer.render(tokens, markdown.options, {}) + '</body></html>');
          if (diagrams) {
            await page.addScriptTag({ content: gunzipSync(readFileSync(join(root, 'dependencies/mermaid.min.js.gz'))).toString('utf8') });
            const render = await page.evaluate(async () => {
              try {
                window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
                await window.mermaid.run({ querySelector: '.mermaid' });
                return { ok: true };
              } catch (error) { return { ok: false, error: String(error?.message ?? error?.str ?? JSON.stringify(error)) }; }
            });
            if (!render.ok) throw new Error(render.error);
            // A resolved renderer promise alone does not prove every diagram produced an SVG.
            const count = await page.evaluate(() => document.querySelectorAll('.mermaid > svg').length);
            if (count !== diagrams) throw new Error(`Expected ${diagrams} diagrams, rendered ${count}`);
          }
          writeFileSync(htmlPath, await page.content());
        } catch (error) { errors.push(String(error)); }
        finally { await page.close(); }
        documents.push({ path: file.path, contentHash: file.contentHash, diagrams, status: errors.length ? 'failed' : 'passed', errors, ...(errors.length ? {} : { htmlPath }) });
      }
      result = { status: documents.some(document => document.status === 'failed') ? 'failed' : 'passed', browserVersion: await browser.version(), documents };
      writeFileSync(join(output, 'render-result.json'), JSON.stringify(result, null, 2));
    } finally { await browser.close(); }
    if (result.status === 'failed') process.exitCode = 1;
  }
  if (options.output) writeFileSync(resolve(options.output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
