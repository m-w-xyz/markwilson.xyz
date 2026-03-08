# Sanity Portfolio project setup

Use this with your **Portfolio** project in Sanity so the homepage carousel can load projects.

## 1. Authenticate Sanity MCP (if you use Cursor MCP)

```bash
npx sanity@latest mcp configure
```

Then in Cursor, list your projects to get the **Portfolio** project ID and dataset (e.g. `production`).

## 2. Deploy the schema

In the Sanity project (or via MCP `deploy_schema`), add a document type **Portfolio Project** with:

- **title** (string, required) – Project title
- **studio** (string) – Studio name
- **categories** (array of strings) – Options: `motion`, `3D`, `web`, `programming`, `design`, `Web development`, `other things` (multiple allowed)
- **mediaType** (string) – `image` or `video`
- **mediaImage** (image) – Shown when mediaType is `image`
- **mediaVideo** (file, accept video) – Shown when mediaType is `video`

## 3. In Sanity Studio

Create a new document type with the fields above. For **categories**, use a multi-select with list values:

- Motion → `motion`
- 3D → `3D`
- Web → `web`
- Programming → `programming`
- Design → `design`
- Web development → `Web development`
- Other things → `other things`

## 4. Connect the homepage

In `home-new.html`, replace the placeholder `projects` array with a fetch to the Sanity API (GROQ), e.g.:

```js
const query = `*[_type == "portfolioProject"]{ title, studio, categories, mediaType, "mediaImageUrl": mediaImage.asset->url, "mediaVideoUrl": mediaVideo.asset->url }`;
// Fetch from https://<projectId>.api.sanity.io/v2021-10-21/data/query/<dataset>?query=...
// Map to { title, studio, categories, media: mediaImageUrl || mediaVideoUrl, mediaType } and set allProjects = result; then renderCarousel().
```

Use your project ID and dataset in the request URL; use the project’s API token if the dataset is private.
