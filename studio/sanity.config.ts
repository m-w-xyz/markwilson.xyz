import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemaTypes'

// Mark Wilson > Portfolio — fixed to this project so studio always uses the correct account
const projectId = 'k9k1qhrl'
const dataset = 'production'

export default defineConfig({
  name: 'portfolio-studio',
  title: 'Portfolio Studio (Mark Wilson > Portfolio)',
  projectId,
  dataset,
  plugins: [structureTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
})
