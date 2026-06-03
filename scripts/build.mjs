import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/src', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('src/main.js', 'dist/src/main.js');
cpSync('src/styles.css', 'dist/src/styles.css');
writeFileSync('dist/.nojekyll', '');
console.log('Static build created in dist/');
