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
const QUERY = '*[_type == "project"]{ title, studio, link, categories, mediaType, "mediaImageUrl": mediaImage.asset->url, "mediaVideoUrl": mediaVideo.asset->url }';
const API_PATH = '/v2024-01-01/data/query/' + DATASET + '?query=' + encodeURIComponent(QUERY) + '&perspective=published';

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
  const vid = doc.mediaVideoUrl || null;
  const isVideo = doc.mediaType === 'video' && vid;
  return {
    title: doc.title || '',
    studio: doc.studio || '',
    link: doc.link || '',
    categories: Array.isArray(doc.categories) ? doc.categories : [],
    media: isVideo ? vid : (img || vid),
    mediaType: isVideo ? 'video' : 'image',
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
