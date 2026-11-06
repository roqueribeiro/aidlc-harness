// Site de documentação do aidlc-harness. O conteúdo vem de docs/ pelo scripts/sync-docs.mjs;
// nada em src/content/docs é editado à mão (a pasta nem é versionada).
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { barraLateral } from './scripts/sync-docs.mjs'

export default defineConfig({
  site: 'https://roqueribeiro.github.io',
  base: '/aidlc-harness',
  integrations: [
    starlight({
      title: 'aidlc-harness',
      description: 'Quality kit for building software with AI agents in the AI-DLC cycle, in 15 AI tools.',
      logo: { src: './src/assets/marca.svg', alt: 'aidlc-harness' },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' },
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/roqueribeiro/aidlc-harness' }],
      editLink: { baseUrl: 'https://github.com/roqueribeiro/aidlc-harness/edit/main/' },
      lastUpdated: false,
      sidebar: barraLateral(),
    }),
  ],
})
