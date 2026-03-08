# Portfolio Studio

Sanity Studio for managing **Projects** (portfolio items) used on the homepage carousel.

## Setup

### Step 1: Get your Project ID

Sanity needs a **project ID** that contains **only** lowercase letters (a–z), numbers (0–9), and dashes. No spaces, no underscores, no uppercase.

1. Open **[sanity.io/manage](https://www.sanity.io/manage)** in your browser.
2. Click your **Portfolio** project.
3. Find the Project ID in one of these places:
   - **In the URL** after you open the project:  
     `https://www.sanity.io/manage/project/abc12xyz`  
     The part after `/project/` (e.g. `abc12xyz`) is your project ID.
   - **Or** open **Project settings** (gear icon) → **API** → **Project ID**.

Copy that ID (it might look like `k5j2x1ab` or `my-portfolio-2024`).

### Step 2: Put the Project ID into the Studio

**Option A – Edit the config files (simplest)**  
In both `sanity.config.ts` and `sanity.cli.ts`, replace:

- `'your-portfolio-project-id'` with your actual project ID (in quotes).

Example: if your ID is `k5j2x1ab`, the line should be:

```ts
const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'k5j2x1ab'
```

**Option B – Use environment variables**  
Before running the studio:

```bash
export SANITY_STUDIO_PROJECT_ID=k5j2x1ab
export SANITY_STUDIO_DATASET=production
```

(Use your real project ID instead of `k5j2x1ab`.)

### Step 3: Install and run
   ```bash
   cd studio
   npm install
   npm run dev
   ```
   Studio runs at http://localhost:3333 (or the port shown).

## Document type: Project

Each **Project** has:

- **Project title** (required)
- **Studio name**
- **Categories** (multi-select): Motion, 3D, Web, Programming, Design, Web development, Other things
- **Media type**: Image or Video
- **Image** or **Video** (shown depending on media type)

These match the fields used by `home-new.html` to drive the carousel and lightbox.

---

## Images & video: optimization for web

### Images

Sanity **does not** change your image file on upload. It optimizes **when the image is requested** on your site:

- Use the [Image URL API](https://www.sanity.io/docs/apis-and-sdks/image-urls): add query params to the image URL for size and format.
- Examples: `?w=800&h=600&auto=format&q=75` (width, height, auto WebP/AVIF, quality).
- Base URL form: `https://cdn.sanity.io/images/{projectId}/{dataset}/{imageAssetId}.{ext}` then add params.
- So: upload full-res images in Studio; on the frontend, build URLs with `w`, `h`, `auto=format`, `q` as needed.

### Video

Choosing **Video** stores the file on Sanity's CDN. Playback uses the file as uploaded.

---

## Studio loads forever / never finishes loading

Try these in order:

1. **Add CORS origin for localhost**  
   Sanity blocks requests from origins it doesn’t know.  
   - Go to [sanity.io/manage](https://www.sanity.io/manage) → your **Portfolio** project.  
   - Open **Project settings** (gear) → **API** → **CORS origins**.  
   - Add: `http://localhost:3333` (or the exact URL and port your Studio uses).  
   - Turn **on** “Allow credentials” for that origin.  
   - Save.

2. **Log in to Sanity in the same browser**  
   Open [sanity.io](https://www.sanity.io) in the same browser, log in, then reload your Studio tab.

3. **Use the default port 3333**  
   Run `npm run dev` and open the URL it prints (usually `http://localhost:3333`). If you use a different port, add that exact origin (e.g. `http://localhost:3000`) in CORS with credentials allowed.

4. **Check the terminal**  
   When you run `npm run dev`, look for errors. Fix any build or runtime errors shown there.

5. **Hard refresh or incognito**  
   Try a hard refresh (Cmd+Shift+R / Ctrl+Shift+R) or an incognito/private window in case cache or extensions are interfering.
