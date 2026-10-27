// Copies dist/index.html to every client-side route so the static build works on hosts
// that don't apply SPA rewrites (e.g. anonymous Netlify deploys). Unknown paths get 404.html.
import { copyFileSync, mkdirSync } from 'node:fs';
import { TOPICS } from '../src/local/topics.js';

const routes = ['ask', 'legal-decoder', 'rights', 'complaint-generator', 'about', 'privacy', 'disclaimer',
  ...TOPICS.map((t) => `rights/${t.id}`)];
for (const r of routes) {
  mkdirSync(`dist/${r}`, { recursive: true });
  copyFileSync('dist/index.html', `dist/${r}/index.html`);
}
copyFileSync('dist/index.html', 'dist/404.html');
console.log(`static routes: ${routes.length} + 404.html`);
