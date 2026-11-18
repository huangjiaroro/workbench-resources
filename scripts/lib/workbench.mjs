import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Reuse the application's authoritative resource formats and verification code.
export const workbenchRoot = resolve(process.env.WORKBENCH_APP_ROOT ||
  fileURLToPath(new URL('../../../zero-point-workbench/', import.meta.url)));
export const workbenchRequire = createRequire(join(workbenchRoot, 'package.json'));
export function importWorkbenchModule(relativePath) {
  return import(pathToFileURL(join(workbenchRoot, relativePath)).href);
}
