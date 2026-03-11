#!/usr/bin/env node
/**
 * Fetches projects from Sanity and writes projects.embed.js so the carousel
 * works without CORS (e.g. when opening home-new.html as a file or from any host).
 * Run from repo root: node scripts/fetch-projects.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'k9k1qhrl';
const DATASET = 'production';
const QUERY = '*[_type == "project"]{ title, studio, link, categories, mediaType, "mediaImageUrl": mediaImage.asset->url, "mediaVideoUrl": mediaVideo.asset->url, "vimeoId": coalesce(vimeoVideo.id, vimeoVideo.vimeoData.id) }';
const API_PATH = '/v2024-01-01/data/query/' + DATASET + '?query=' + encodeURIComponent(QUERY) + '&perspective=published';

const CATEGORY_MAP = {
  // Motion
  motion: 'motion design',
  Motion: 'motion design',
  'Motion Design': 'motion design',
  'motion design': 'motion design',
  // 3D
  '3D': '3D rendering',
  '3d': '3D rendering',
  '3D Rendering': '3D rendering',
  '3D rendering': '3D rendering',
  // Programming
  programming: 'programming',
  Programming: 'programming',
  'programming': 'programming',
  // Brand identity / design
  design: 'brand identity',
  Design: 'brand identity',
  'Brand Identity': 'brand identity',
  'brand identity': 'brand identity',
  // Type design
  'type design': 'type design',
  'Type Design': 'type design',
  // Web dev
  'web development': 'web development',
  'Web Development': 'web development',
};

function normalizeCategories(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach((c) => {
    if (!c) return;
    const key = String(c);
    const mapped = CATEGORY_MAP[key] || CATEGORY_MAP[key.toLowerCase()];
    if (!mapped) return;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  });
  return out;
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + body.slice(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function normalize(doc) {
  const img = doc.mediaImageUrl || null;
  const fileVid = doc.mediaVideoUrl || null;
  const vimeoId = doc.vimeoId || null;
  const vid = vimeoId ? ('https://player.vimeo.com/video/' + vimeoId) : fileVid;
  const isVideo = doc.mediaType === 'video' && vid;
  return {
    title: doc.title || '',
    studio: doc.studio || '',
    link: doc.link || '',
    categories: normalizeCategories(doc.categories),
    media: isVideo ? vid : (img || vid),
    mediaType: isVideo ? 'video' : 'image',
    isVimeoEmbed: !!vimeoId,
  };
}

async function main() {
  const url = 'https://' + PROJECT_ID + '.api.sanity.io' + API_PATH;
  console.log('Fetching from Sanity (k9k1qhrl)...');
  const data = await fetch(url);
  if (data.error) {
    console.error('Sanity error:', data.error.description || data.error);
    process.exit(1);
  }
  const list = data.result;
  if (!Array.isArray(list)) {
    console.error('Unexpected response:', data);
    process.exit(1);
  }
  const projects = list.map(normalize);
  console.log('Got', projects.length, 'project(s)');

  const outPath = path.join(__dirname, '..', 'projects.embed.js');
  const content = 'window.__SANITY_PROJECTS = ' + JSON.stringify(projects) + ';\n';
  fs.writeFileSync(outPath, content, 'utf8');
  console.log('Wrote', outPath);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
