import { copyFile, mkdir, writeFile } from 'node:fs/promises';

// GitHub Pages serves both routes directly, including a refresh on /3d/.
await mkdir('dist/pages/3d', { recursive: true });
await copyFile('dist/pages/index.html', 'dist/pages/3d/index.html');
await writeFile('dist/pages/.nojekyll', '');
