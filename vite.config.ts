import { defineConfig } from 'vite';

export default defineConfig({
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
