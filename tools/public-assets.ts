import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { runtimePublicFiles } from './runtime-assets.ts';

/** Vite normally copies public/ verbatim, including local dotfiles and preservation leftovers. */
export function publicAssets(): Plugin {
  let publicDir: string;
  return {
    name: 'simfarm-public-assets', apply: 'build',
    configResolved(config) { publicDir = config.publicDir; },
    async generateBundle() {
      const visit = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          if (entry.name.startsWith('.')) continue;
          const path = join(directory, entry.name);
          const fileName = relative(publicDir, path).split(sep).join('/');
          if (entry.isDirectory()) { await visit(path); continue; }
          if (!entry.isFile() || !runtimePublicFiles.has(fileName)) continue;
          this.emitFile({ type: 'asset', fileName, source: await readFile(path) });
        }
      };
      await visit(publicDir);
    },
  };
}
