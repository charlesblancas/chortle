import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  compilerOptions: {
    // The app still uses Svelte 4's `new App({ target })` bootstrap while
    // components migrate incrementally to Svelte 5.
    compatibility: { componentApi: 4 },
  },
}
