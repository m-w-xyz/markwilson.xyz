# Vimeo field plugin – setup guide

Your Studio already uses `sanity-plugin-vimeo-field`. Follow these steps so editors can paste a Vimeo video ID and have metadata (title, thumbnails, play link) stored in Sanity.

---

## 1. Get a Vimeo API access token

1. Go to **[developer.vimeo.com/apps](https://developer.vimeo.com/apps)** and sign in.
2. Click **Create app** (or use an existing app).
3. After the app exists, open it → **Authentication** → **Generate Access Token**.
4. Choose:
   - **Authenticated (you)** – if you need private/unlisted videos.
   - **Unauthenticated** – read-only for **public** videos (simplest).
5. Select the scopes you need (e.g. **Video** → read access). For private videos, include the **private** scope.
6. Generate the token and copy it (you won’t see it again).

---

## 2. Add the token to the Studio

1. In the `studio` folder, copy the env example and add your token:

   ```bash
   cp .env.example .env
   ```

2. Edit `studio/.env` and set:

   ```env
   SANITY_STUDIO_VIMEO_ACCESS_TOKEN=your_token_here
   ```

3. Restart the dev server (`npm run dev`). The plugin reads this at runtime; without it, the field will show “No SANITY_STUDIO_VIMEO_ACCESS_TOKEN found!”.

---

## 3. How it’s wired in this project

- **Config** – `sanity.config.ts` already registers the plugin and passes the token:

  ```ts
  vimeoField({
    accessToken: process.env.SANITY_STUDIO_VIMEO_ACCESS_TOKEN,
  }),
  ```

- **Schema** – The **Project** type has a `vimeoVideo` field of type `vimeo`. It’s shown when **Media type** is **Video** (alongside the optional direct file upload).

- **In Studio** – On a project with **Media type** = Video, open **Vimeo video**, paste the **Vimeo video ID** (e.g. from `https://vimeo.com/123456789` → `123456789`), click **Fetch**. The plugin stores: `id`, `name`, `pictures`, `files`, `play`.

- **Optional extra fields** – To request more from the Vimeo API (e.g. `metadata`), you can pass `fields` in the plugin config or in the field options; see the [plugin README](https://github.com/marco-land/sanity-plugin-vimeo-field) and [Vimeo API video response](https://developer.vimeo.com/api/reference/response/video).

---

## 4. Using the data on the frontend

The stored value is an object under `vimeoVideo` (and its nested `vimeoData`). For the carousel we only need the ID to build the embed URL.

- **GROQ** – Include the Vimeo id in your project query, e.g.:

  ```groq
  *[_type == "project"]{
    title,
    studio,
    link,
    categories,
    mediaType,
    "mediaImageUrl": mediaImage.asset->url,
    "mediaVideoUrl": mediaVideo.asset->url,
    "vimeoId": vimeoVideo.vimeoData.id
  }
  ```

- **Embed URL** – If `vimeoId` is set, use:

  ```text
  https://player.vimeo.com/video/{vimeoId}
  ```

  Use that as the `src` of an `<iframe>` (or your frontend’s Vimeo embed component). The site’s carousel can prefer this over `mediaVideoUrl` when `mediaType === 'video'` and `vimeoId` is present.

---

## 5. Checklist

- [ ] Vimeo app created at [developer.vimeo.com/apps](https://developer.vimeo.com/apps)
- [ ] Access token generated and copied
- [ ] `studio/.env` contains `SANITY_STUDIO_VIMEO_ACCESS_TOKEN=...`
- [ ] Studio restarted (`npm run dev`)
- [ ] In a Project document: Media type = Video → Vimeo video → paste ID → Fetch
- [ ] Frontend query includes `vimeoVideo.vimeoData.id` and uses it for the embed URL when present
