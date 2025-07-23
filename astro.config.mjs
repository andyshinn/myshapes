// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  site: 'https://myshapes.andyshinn.as',
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
    envPrefix: 'PUBLIC_',
  },

  env: {
    schema: {
      SITE_NAME: envField.string({
        context: 'server',
        access: 'public',
        default: 'Andy\'s Onshape Models'
      })
    }
  },

  integrations: [icon()]
});
