import { defineCliConfig } from 'sanity/cli'

// Mark Wilson > Portfolio — same project ID as sanity.config.ts
const projectId = 'k9k1qhrl'
const dataset = 'production'

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  studioHost: 'markwilson-portfolio',
})
