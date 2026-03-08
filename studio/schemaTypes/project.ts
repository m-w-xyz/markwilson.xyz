import { defineField, defineType } from 'sanity'

const CATEGORIES = [
  { title: 'Motion', value: 'motion' },
  { title: '3D', value: '3D' },
  { title: 'Programming', value: 'programming' },
  { title: 'Design', value: 'design' },
  { title: 'web development', value: 'web development' },
  { title: 'Other things', value: 'other things' },
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
