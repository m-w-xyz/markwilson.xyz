import { defineField, defineType } from 'sanity'

const CATEGORIES = [
  { title: 'Brand Identity', value: 'brand identity' },
  { title: 'Motion Design', value: 'motion design' },
  { title: '3D Rendering', value: '3D rendering' },
  { title: 'Programming', value: 'programming' },
  { title: 'Type Design', value: 'type design' },
  { title: 'Web Development', value: 'web development' },
] as const

export const projectType = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Project title',
      type: 'string',
    }),
    defineField({
      name: 'studio',
      title: 'Studio name',
      type: 'string',
    }),
    defineField({
      name: 'link',
      title: 'Link',
      type: 'url',
      description: 'Optional URL. Clicking the project image will open this link.',
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: CATEGORIES,
      },
    }),
    defineField({
      name: 'mediaType',
      title: 'Media type',
      type: 'string',
      options: {
        list: [
          { title: 'Image', value: 'image' },
          { title: 'Video', value: 'video' },
        ],
        layout: 'radio',
      },
      initialValue: 'image',
    }),
    defineField({
      name: 'mediaImage',
      title: 'Image',
      type: 'image',
      description: 'Optimized on the fly by Sanity (WebP/AVIF, resizing via URL params on your site).',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.mediaType !== 'image',
    }),
    defineField({
      name: 'mediaVideo',
      title: 'Video',
      type: 'file',
      description: "Direct upload. Stores the file on Sanity's CDN.",
      options: { accept: 'video/*' },
      hidden: ({ parent }) => parent?.mediaType !== 'video',
    }),
    defineField({
      name: 'vimeoVideo',
      title: 'Vimeo video',
      type: 'vimeo',
      description: 'Paste a Vimeo video ID (e.g. from vimeo.com/123456789 → 123456789), then click Fetch. Alternative to uploading a video file above.',
      hidden: ({ parent }) => parent?.mediaType !== 'video',
    }),
  ],
  preview: {
    select: { title: 'title', media: 'mediaImage' },
    prepare({ title, media }) {
      return {
        title: title || 'Untitled',
        media,
      }
    },
  },
})
