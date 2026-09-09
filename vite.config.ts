import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/**
 * What the page is allowed to load, and it is very little: its own bundle,
 * its own pictures, and nothing else at all.
 *
 * This is defence in depth over `ui.ts`, which builds its panels with
 * `innerHTML`. Every value it interpolates today comes from the static maps
 * in `src/shared/`, so none of it is attacker-controlled and none of it is
 * reachable -- the game has no text input, no URL parameters, no storage and
 * no network. But that safety rests on "there is no input" rather than on
 * escaping, and the day a board can be pasted *in*, or a build carries a name
 * its player typed, those calls become live. This is the seatbelt for that
 * day.
 *
 *   default-src 'none'   nothing is permitted that is not named below
 *   script-src  'self'   the bundle; there is no inline script to allow
 *   style-src   unsafe-inline is required: index.html carries a <style>
 *               block, and reserveStatHeight writes element.style.minHeight
 *   img-src     the bundled portraits, plus data: in case a small asset ever
 *               falls under Vite's inline limit
 *   connect-src 'none'   the game never speaks to anything
 *
 * `frame-ancestors` is deliberately absent: it is ignored in a meta tag and
 * only works as a real header, which GitHub Pages will not let us set. Being
 * ignored, it would only log a console warning and read as protection that
 * is not there.
 *
 * Build only. In `npm run dev` Vite talks to a websocket for hot reload,
 * which `connect-src 'none'` would cut off.
 */
const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'seniors-td:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        // Prepended, so the policy is parsed before the markup it governs.
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: POLICY },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [contentSecurityPolicy()],
  test: {
    coverage: {
      provider: 'v8',
      // Reported, not enforced. A percentage target produces tests written for
      // the number rather than for the risk -- the gaps that mattered here were
      // found by reading the code, not by counting lines. Entry points and
      // type-only files are excluded because covering them measures nothing.
      reporter: ['text-summary', 'text'],
      include: ['src/**/*.ts'],
      exclude: ['src/vite-env.d.ts', 'src/headless.ts', 'src/main.ts'],
    },
  },
  /**
   * Relative asset paths, not a hardcoded deploy path.
   *
   * The same build then works served from a domain root, served from a
   * subpath, and opened straight off disk by double-clicking dist/index.html.
   * A hardcoded base would tie the build to one URL and break the other two --
   * and the offline case is genuinely useful, since the game is a single 36KB
   * folder with no backend behind it.
   */
  base: './',
});
