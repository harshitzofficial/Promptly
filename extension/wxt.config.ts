import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['storage', 'contextMenus'],
    host_permissions: [
      '*://chatgpt.com/*',
      '*://claude.ai/*',
      '*://gemini.google.com/*',
      'http://localhost:3005/*'
    ]
  },
  vite: () => ({
    plugins: [tailwindcss()],
  })
});
