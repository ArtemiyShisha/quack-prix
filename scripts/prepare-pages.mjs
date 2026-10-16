import { copyFile, mkdir, writeFile } from 'node:fs/promises';

// GitHub Pages serves each game route directly, including a page refresh.
for (const route of ['3d', 'pinball']) {
  await mkdir(`dist/pages/${route}`, { recursive: true });
  await copyFile('dist/pages/index.html', `dist/pages/${route}/index.html`);
}
await writeFile('dist/pages/.nojekyll', '');
