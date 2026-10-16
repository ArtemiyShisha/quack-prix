import { copyFile, mkdir, writeFile } from 'node:fs/promises';

// GitHub Pages serves each game route directly, including a page refresh.
await mkdir('dist/pages/3d', { recursive: true });
await copyFile('dist/pages/index.html', 'dist/pages/3d/index.html');
await mkdir('dist/pages/curling', { recursive: true });
await copyFile('dist/pages/index.html', 'dist/pages/curling/index.html');
await mkdir('dist/pages/ice', { recursive: true });
await copyFile('dist/pages/index.html', 'dist/pages/ice/index.html');
await mkdir('dist/pages/pinball', { recursive: true });
await copyFile('dist/pages/index.html', 'dist/pages/pinball/index.html');
await writeFile('dist/pages/.nojekyll', '');
