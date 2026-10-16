import { copyFile, mkdir, writeFile } from 'node:fs/promises';

// Keep /pinball/ working alongside the home page, including a direct refresh.
await mkdir('dist/pages/pinball', { recursive: true });
await copyFile('dist/pages/index.html', 'dist/pages/pinball/index.html');
await writeFile('dist/pages/.nojekyll', '');
