/* Runs Kete in the browser when GitHub Pages is serving the site.
   On port 4787 the Python server keeps the requests. */
(function () {
  if (location.port === "4787") return;

  const ROOT = new URL("./", document.currentScript.src);
  const native = window.fetch.bind(window);
  const MACRON = { "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u", "Ā": "A", "Ē": "E", "Ī": "I", "Ō": "O", "Ū": "U" };
  const STOP = new Set("that this with from have were they their about into your what when which been will would there here also than then them some more only other such each through where while these those because".split(" "));
  const MARKETING = ["leverage", "unlock", "elevate", "seamless", "robust", "cutting-edge", "delve", "empower", "synergy", "holistic", "bespoke", "world-class", "next-gen", "solutions", "utilize", "streamline", "supercharge", "game-changing", "passionate"];
  const SOCIAL = [["instagram.com", "Instagram"], ["tiktok.com", "TikTok"], ["youtube.com", "YouTube"], ["youtu.be", "YouTube"], ["vimeo.com", "Vimeo"], ["x.com", "X"], ["twitter.com", "X"], ["linkedin.com", "LinkedIn"], ["facebook.com", "Facebook"], ["threads.net", "Threads"]];
  const SIZE_VARS = { "--font-body": "Body", "--font-s": "Small", "--font-m": "Medium", "--font-l": "Large", "--font-xl": "Title", "--font-xxl": "Display", "--font-xxxl": "Display" };
  const FAMILIES = { diegroteska: "Die Grotesk A", stellage: "Stellage" };
  const COLLECTIONS = ["colors", "typeStyles", "spaces", "principles", "images", "content"];
  const PATCHABLE = {
    colors: ["name", "role", "picked", "note"],
    typeStyles: ["name", "picked", "sample"],
    spaces: ["name", "use", "picked"],
    principles: ["title", "body", "picked"],
    images: ["name", "picked"],
    content: ["title", "body", "picked", "kind"],
  };

  let db = null;
  let lib = null;
  const texts = {};
  const blobUrls = new Map();
  let chain = Promise.resolve();

  function lock(work) {
    const run = chain.then(work, work);
    chain = run.then(function () {}, function () {});
    return run;
  }

  function newId() {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  }

  function now() {
    const date = new Date();
    const pad = function (value) { return String(value).padStart(2, "0"); };
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = pad(Math.floor(Math.abs(offset) / 60));
    const mins = pad(Math.abs(offset) % 60);
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + sign + hours + ":" + mins;
  }

  function fold(text) {
    return String(text || "").replace(/[āēīōūĀĒĪŌŪ]/g, function (ch) { return MACRON[ch] || ch; }).toLowerCase();
  }

  function wordsOf(text) { return String(text || "").trim().split(/\s+/).filter(Boolean); }

  function sentences(text) {
    const seen = new Set();
    const cleaned = [];
    String(text || "").split("\n").forEach(function (line) {
      line.split(/(?<=[.?!])\s+/).forEach(function (chunk) {
        const sentence = chunk.replace(/\s+/g, " ").replace(/^[\s\-–—]+|[\s\-–—]+$/g, "");
        const count = wordsOf(sentence).length;
        if (count < 6 || count > 48) return;
        if ((sentence.match(/http/g) || []).length || (sentence.match(/@/g) || []).length > 2) return;
        const key = fold(sentence);
        if (seen.has(key)) return;
        seen.add(key);
        cleaned.push(sentence);
      });
    });
    return cleaned;
  }

  function idb(store, mode, work) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, mode);
      const result = work(tx.objectStore(store));
      tx.oncomplete = function () { resolve(result && result.result !== undefined ? result.result : result); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function idbGet(store, key) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(store, key, value) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function idbDelete(store, key) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function idbKeys(store) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function freshBrand(name) {
    return {
      id: newId(),
      name: (name || "").trim() || "New brand",
      createdAt: now(),
      assets: { sources: [], colors: [], typeStyles: [], spaces: [], principles: [], images: [], content: [] },
      memory: { conversation: [], dismissed: [], kept: [] },
    };
  }

  function emptyLib() {
    const brand = freshBrand("New brand");
    return { booted: true, activeId: brand.id, brands: [brand] };
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open("kete", 1);
      req.onupgradeneeded = function () {
        const database = req.result;
        ["kv", "texts", "blobs"].forEach(function (name) {
          if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function boot() {
    db = await openDb();
    lib = await idbGet("kv", "library");
    if (!lib || !Array.isArray(lib.brands)) {
      try {
        const response = await native(new URL("data/library.json", ROOT));
        lib = response.ok ? await response.json() : emptyLib();
      } catch (error) {
        lib = emptyLib();
      }
      if (!Array.isArray(lib.brands) || !lib.brands.length) lib = emptyLib();
      const jobs = [];
      lib.brands.forEach(function (brand) {
        (brand.assets.sources || []).forEach(function (source) {
          jobs.push(native(new URL("data/text/" + source.id + ".txt", ROOT)).then(function (response) {
            return response.ok ? response.text() : "";
          }).then(function (body) {
            if (body) texts[source.id] = body;
          }).catch(function () {}));
        });
      });
      await Promise.all(jobs);
      await idbPut("kv", "library", lib);
      await Promise.all(Object.keys(texts).map(function (id) { return idbPut("texts", id, texts[id]); }));
    } else {
      const keys = await idbKeys("texts");
      await Promise.all(keys.map(function (key) {
        return idbGet("texts", key).then(function (body) { if (body) texts[key] = body; });
      }));
    }
  }

  const ready = boot();

  function brandOf(brandId) {
    const found = lib.brands.find(function (brand) { return brand.id === (brandId || lib.activeId); });
    if (found) return found;
    lib.activeId = lib.brands[0].id;
    return lib.brands[0];
  }

  function brandForSource(sourceId) {
    return lib.brands.find(function (brand) {
      return (brand.assets.sources || []).some(function (source) { return source.id === sourceId; });
    }) || brandOf();
  }

  function closeColor(a, b) {
    const hex = function (value) { return [1, 3, 5].map(function (i) { return parseInt(value.slice(i, i + 2), 16); }); };
    if (!a || !b || a.length < 7 || b.length < 7) return false;
    const left = hex(a);
    const right = hex(b);
    return Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2]) < 42;
  }

  function collapse(assets) {
    const colors = [];
    (assets.colors || []).forEach(function (color) {
      const opacity = color.opacity == null ? 1 : color.opacity;
      if (colors.some(function (other) {
        return closeColor(color.hex, other.hex) && Math.abs(opacity - (other.opacity == null ? 1 : other.opacity)) < 0.12;
      })) return;
      colors.push(color);
    });
    assets.colors = colors;
    const types = [];
    (assets.typeStyles || []).forEach(function (style) {
      if (types.some(function (other) {
        return String(style.family || "").toLowerCase() === String(other.family || "").toLowerCase()
          && Math.round(style.size || 0) === Math.round(other.size || 0)
          && (style.weight || 400) === (other.weight || 400);
      })) return;
      types.push(style);
    });
    assets.typeStyles = types;
    const spaces = [];
    (assets.spaces || []).forEach(function (space) {
      if (spaces.some(function (other) { return Math.abs((space.value || 0) - (other.value || 0)) <= 2 && (space.unit || "px") === (other.unit || "px"); })) return;
      spaces.push(space);
    });
    assets.spaces = spaces;
    const seen = new Set();
    assets.principles = (assets.principles || []).filter(function (item) {
      const key = (item.title || "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return assets;
  }

  function voiceOf(text, name) {
    const sens = sentences(text);
    const lengths = sens.map(function (line) { return wordsOf(line).length; }).filter(function (n) { return n >= 12; });
    const pool = (lengths.length ? lengths : sens.map(function (line) { return wordsOf(line).length; })).sort(function (a, b) { return a - b; });
    const median = pool.length ? pool[Math.floor(pool.length / 2)] : 16;
    const low = text.toLowerCase();
    const count = function (pattern) { return (low.match(pattern) || []).length; };
    const we = count(/\bwe\b/g);
    const they = count(/\bthey\b/g);
    const iCount = count(/\bi\b/g);
    const person = we >= they && we >= iCount && we > 0 ? "we" : iCount > we && iCount > they ? "i" : they > we ? "they" : "neutral";
    const rawWords = text.match(/[A-Za-zĀĒĪŌŪāēīōū][A-Za-zĀĒĪŌŪāēīōū'’-]+/g) || [];
    const counts = {};
    rawWords.forEach(function (word) {
      const key = fold(word);
      counts[key] = (counts[key] || 0) + 1;
    });
    const lexicon = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).filter(function (word) {
      return !STOP.has(word) && word !== fold(name) && counts[word] >= 2;
    }).slice(0, 14).map(function (word) {
      return rawWords.find(function (item) { return fold(item) === word; }) || word;
    });
    const present = new Set(rawWords.map(fold));
    const absent = MARKETING.filter(function (word) { return !word.includes(" ") && !present.has(fold(word)); }).slice(0, 8);
    let titles = 0;
    let prose = 0;
    text.split("\n").forEach(function (line) {
      const bits = line.trim().split(/\s+/);
      if (bits.length >= 2 && bits.length <= 8 && !line.trim().endsWith(".")) titles += 1;
      if (bits.length >= 12 && line.trim().endsWith(".")) prose += 1;
    });
    return {
      person: person, median: median, exclaim: (text.match(/!/g) || []).length > 1,
      lexicon: lexicon, absent: absent, teReo: /[āēīōūĀĒĪŌŪ]/.test(text),
      titles: titles, prose: prose, sentences: sens,
    };
  }

  function macronMap(text) {
    const groups = {};
    (String(text || "").match(/[A-Za-zĀĒĪŌŪāēīōū]{3,}/g) || []).forEach(function (word) {
      const key = fold(word);
      groups[key] = groups[key] || {};
      groups[key][word] = (groups[key][word] || 0) + 1;
    });
    const preferred = {};
    Object.keys(groups).forEach(function (key) {
      const surface = Object.keys(groups[key]).sort(function (a, b) { return groups[key][b] - groups[key][a]; })[0];
      if (fold(surface) !== surface.toLowerCase() || /[āēīōūĀĒĪŌŪ]/.test(surface)) preferred[key] = surface;
    });
    return preferred;
  }

  function applyMacrons(text, preferred) {
    return String(text || "").replace(/[A-Za-zĀĒĪŌŪāēīōū]+/g, function (word) {
      const target = preferred[fold(word)];
      if (!target || fold(word) !== fold(target)) return word;
      return word[0] === word[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target[0].toLowerCase() + target.slice(1);
    });
  }

  function drifts(text) {
    const groups = {};
    (String(text || "").match(/[A-Za-zĀĒĪŌŪāēīōū]{4,}/g) || []).forEach(function (word) {
      const key = fold(word);
      groups[key] = groups[key] || new Set();
      groups[key].add(word);
    });
    const pairs = [];
    Object.values(groups).forEach(function (forms) {
      const list = Array.from(forms);
      const marked = list.filter(function (word) { return /[āēīōūĀĒĪŌŪ]/.test(word); });
      const plain = list.filter(function (word) { return !/[āēīōūĀĒĪŌŪ]/.test(word); });
      if (marked.length && plain.length) pairs.push([plain[0], marked[0]]);
    });
    return pairs.slice(0, 6);
  }

  function brandName(studyLib, textMap) {
    const counts = {};
    const blob = (studyLib.sources || []).map(function (source) { return textMap[source.id] || ""; }).join("\n");
    sentences(blob).forEach(function (sentence) {
      const match = sentence.match(/^((?:[A-ZĀĒĪŌŪ][\wāēīōūĀĒĪŌŪ'’.-]+)(?:\s+(?:[A-ZĀĒĪŌŪ][\wāēīōūĀĒĪŌŪ'’.-]+)){0,4}) is (?:an?|the)\b/);
      if (match) counts[match[1]] = (counts[match[1]] || 0) + 25;
    });
    (studyLib.sources || []).forEach(function (source) {
      const site = (source.siteName || "").trim();
      if (site && !["project manager", "home", "about us"].includes(site.toLowerCase())) counts[site] = (counts[site] || 0) + 12;
    });
    const best = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    return best || "This brand";
  }

  function factsOf(name, parts) {
    const scored = [];
    parts.forEach(function (part) {
      sentences(part[1]).forEach(function (sentence) {
        const low = sentence.toLowerCase();
        let score = 0;
        if (name && low.includes(name.toLowerCase())) score += 3;
        if (/^we\b/i.test(sentence)) score += 3;
        if (/\b(is an|is a|are a)\b/.test(low)) score += 2;
        const count = wordsOf(sentence).length;
        if (count >= 12 && count <= 32) score += 1;
        if (["cookie", "subscribe", "privacy policy", "all rights"].some(function (bad) { return low.includes(bad); })) score -= 4;
        if (score >= 3) scored.push([score, { text: sentence, sourceId: part[0].id, sourceTitle: part[0].title || "Source" }]);
      });
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    const kept = [];
    const seen = new Set();
    scored.forEach(function (item) {
      const key = fold(item[1].text).slice(0, 80);
      if (seen.has(key) || kept.length >= 8) return;
      seen.add(key);
      kept.push(item[1]);
    });
    return kept;
  }

  function study(studyLib, textMap) {
    const parts = [];
    (studyLib.sources || []).forEach(function (source) {
      if (source.status !== "ready") return;
      const body = textMap[source.id] || "";
      if (body.trim()) parts.push([source, body]);
    });
    const kept = (studyLib.content || []).filter(function (item) { return item.kind === "Kept"; }).map(function (item) { return item.body || ""; }).join("\n");
    if (kept.trim()) parts.push([{ id: "kept", title: "Kept writing", status: "ready" }, kept]);
    const full = parts.map(function (part) { return part[1]; }).join("\n");
    const name = brandName(studyLib, textMap);
    const voice = full.trim() ? voiceOf(full, name) : { person: "neutral", median: 16, exclaim: false, lexicon: [], absent: MARKETING.slice(0, 6), teReo: false, titles: 0, prose: 0, sentences: [] };
    const map = macronMap(full);
    const facts = parts.length ? factsOf(name, parts) : [];
    const wordCount = wordsOf(full).length;
    const confidence = wordCount >= 400 && facts.length ? "grounded" : wordCount >= 120 ? "forming" : "early";
    const dismissed = new Set(studyLib.dismissed || []);
    const needs = [];
    if (wordCount < 220) needs.push({ id: "voice-thin", title: "The voice is still thin", detail: "A few hundred words of real writing — an about page, a project text, a PDF — will give the memory something to keep." });
    if (voice.titles > Math.max(6, voice.prose * 2) && voice.prose < 14) needs.push({ id: "captions", title: "The work is named more than it is described", detail: "There are many short titles and few sentences that say what a project is. Captions are the missing piece: the place, the relationship, then stop." });
    if (!(studyLib.colors || []).length) needs.push({ id: "no-colour", title: "No colour has been read", detail: "A live page or a designed PDF will bring the palette in. A screenshot works if a site refuses to be read." });
    if (!(studyLib.images || []).length) needs.push({ id: "no-image", title: "No photographs yet", detail: "The memory can talk about the work, but it has not seen it. Add a project image or a page that carries one." });
    if (!(studyLib.typeStyles || []).length) needs.push({ id: "no-type", title: "No type styles yet", detail: "Load a page and the type styles will be read from its CSS. A PDF will not carry them." });
    if (voice.teReo) needs.push({ id: "te-reo", title: "Keep te reo in human hands", detail: "Macrons in the sources will be preserved, and lines already written can be repeated. New Māori should be written by a person, not generated here." });
    const drift = drifts(full);
    if (drift.length) needs.push({ id: "macrons", title: "Macrons are not consistent yet", detail: "Both forms appear: " + drift.slice(0, 4).map(function (pair) { return pair[0] + " and " + pair[1]; }).join(", ") + ". Keep the macron spelling." });
    if (!(studyLib.sources || []).some(function (source) { return source.kind === "social"; })) needs.push({ id: "no-social", title: "No social link yet", detail: "A public post can be read when the platform allows it. If it does not, drop in a screenshot." });
    if (name === "This brand" && wordCount > 40) needs.push({ id: "unnamed", title: "The brand is not named in the sources", detail: "Add a page or a line that says the name, so new writing does not have to guess it." });
    const summary = [];
    if (!full.trim() && wordCount <= 30) summary.push("Nothing of the voice has been read yet. Add a page, a PDF, or some writing, and this portrait will come from those words.");
    else {
      summary.push(facts[0] ? facts[0].text : name + " is in the kete, but no sentence yet says what it is. The sources name things. They do not define them.");
      const person = { we: "first person plural", i: "first person", they: "third person", neutral: "unmarked" }[voice.person];
      const ban = voice.absent.length ? " It does not use words like " + voice.absent.slice(0, 4).join(", ") + "." : "";
      const samples = Object.values(map).slice(0, 4).join(", ");
      const te = voice.teReo ? " Te reo is in the naming — " + (samples || "the words as written") + " — and it stays quoted, not generated." : "";
      summary.push("The voice is " + person + ". A typical sentence is about " + voice.median + " words, and it states something. " + (voice.exclaim ? "It uses exclamation." : "It does not exclaim.") + te + ban);
      const bits = [];
      if ((studyLib.colors || []).length) bits.push("Colour so far: " + studyLib.colors.slice(0, 4).map(function (color) { return color.name + " " + color.hex; }).join(", "));
      if ((studyLib.typeStyles || []).length) {
        const families = [];
        studyLib.typeStyles.forEach(function (style) { if (!families.includes(style.family)) families.push(style.family); });
        bits.push("Type: " + families.slice(0, 3).join(", "));
      }
      if (bits.length) summary.push(bits.join(". ") + ".");
      if (voice.titles > Math.max(6, voice.prose * 2)) summary.push("What it needs now is description. The work has names. It does not yet have enough sentences.");
    }
    return {
      name: name,
      summary: summary,
      confidence: confidence,
      words: wordCount,
      phrases: { kiaOra: full.toLowerCase().includes("kia ora"), ngaMihi: full.toLowerCase().includes("ngā mihi") || full.toLowerCase().includes("nga mihi") },
      voice: { person: voice.person, median: voice.median, exclaim: voice.exclaim, teReo: voice.teReo, lexicon: voice.lexicon, absent: voice.absent },
      facts: facts,
      needs: needs.filter(function (need) { return !dismissed.has(need.id); }),
      _map: map,
    };
  }

  function studyPack(brand) {
    const assets = brand.assets;
    const studyLib = {
      sources: assets.sources || [],
      colors: assets.colors || [],
      typeStyles: assets.typeStyles || [],
      spaces: assets.spaces || [],
      principles: assets.principles || [],
      images: assets.images || [],
      content: (assets.content || []).concat((brand.memory.kept || []).map(function (item) { return { kind: "Kept", title: item.title || "", body: item.body || "" }; })),
      dismissed: brand.memory.dismissed || [],
    };
    return { studyLib: studyLib, portrait: study(studyLib, texts) };
  }

  function shape(text, memory) {
    let cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (!memory.voice.exclaim) cleaned = cleaned.replace(/!/g, ".");
    const known = new Set((memory.voice.lexicon || []).map(fold));
    (memory.voice.absent || []).forEach(function (banned) {
      if (known.has(fold(banned))) return;
      cleaned = cleaned.replace(new RegExp("\\b" + banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "ig"), "");
    });
    cleaned = cleaned.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
    cleaned = applyMacrons(cleaned, memory._map || {});
    if (cleaned && !".?!".includes(cleaned.slice(-1))) cleaned += ".";
    return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned;
  }

  function compose(memory, kind, brief) {
    brief = (brief || "").trim();
    const name = memory.name || "This brand";
    if (memory.confidence === "early" && !brief) return { text: "It needs a subject, and more of the brand's own writing, before it can make something worth keeping.", why: "The memory is still early." };
    if (!brief && kind !== "about") return { text: "Give it a subject. A name, and what the work is for.", why: "New writing starts from a line you supply. The kete supplies the voice, not the facts." };
    const why = ["Sentences sit near " + (memory.voice.median || 16) + " words."];
    if (memory.voice.teReo) why.push("Macrons follow the sources. No new te reo was written.");
    if (!memory.voice.exclaim) why.push("No exclamation, because the sources don't use it.");
    let subject = brief.replace(/\s+/g, " ").replace(/\.+$/, "");
    let detail = "";
    [" — ", " – ", " - ", ": "].some(function (splitter) {
      if (!subject.includes(splitter)) return false;
      const bits = subject.split(splitter);
      if (bits[0].trim() && bits.slice(1).join(splitter).trim()) {
        detail = bits.slice(1).join(splitter).trim();
        subject = bits[0].trim();
        return true;
      }
      return false;
    });
    if (kind === "headline") {
      let line = detail ? subject + ": " + detail : subject;
      line = applyMacrons(line, memory._map || {}).replace(/\.$/, "");
      return { text: line, why: "A headline kept to your line. " + why.join(" ") };
    }
    if (kind === "about") {
      const chosen = [];
      (memory.facts || []).forEach(function (fact) { if (!chosen.includes(fact.text) && chosen.length < 3) chosen.push(fact.text); });
      if (!chosen.length) return { text: "There is not yet a sentence that says what " + name + " is.", why: "About writing is arranged from lines the brand has already published." };
      let text = chosen.map(function (line) { return shape(line, memory); }).join(" ");
      if (brief) text += " " + shape("Said here for " + brief.replace(/\.+$/, ""), memory);
      return { text: text, why: "Arranged from lines already in the kete, not invented. " + why.join(" ") };
    }
    if (kind === "letter") {
      const greeting = memory.phrases && memory.phrases.kiaOra ? "Kia ora" : "Hello";
      const sign = memory.phrases && memory.phrases.ngaMihi ? "Ngā mihi" : "";
      const belief = (memory.facts || []).find(function (fact) { return /^we\b/i.test(fact.text) && wordsOf(fact.text).length >= 8 && wordsOf(fact.text).length <= 28; });
      const lines = [greeting + ",", "", shape(brief, memory)];
      if (belief) lines.push("", shape(belief.text, memory));
      lines.push("");
      if (sign) lines.push(sign);
      lines.push(name);
      return { text: lines.join("\n"), why: "The greeting and the sign-off are used only if the sources already use them. " + why.join(" ") };
    }
    const sentence = detail ? (detail[0] === detail[0].toLowerCase() ? subject + ", " + detail : subject + " — " + detail) : subject;
    let text = shape(sentence, memory);
    if (kind === "social" && wordsOf(text).length > 40) text = wordsOf(text).slice(0, 40).join(" ").replace(/[,;:]+$/, "") + ".";
    return { text: text, why: (kind === "social" ? "Short enough for a post. Hashtags were left off, unless you put them in the line. " : "Shaped from your line, without adding a claim the sources do not make. ") + why.join(" ") };
  }

  function reply(memory, question, studyLib) {
    question = (question || "").trim();
    if (!question) return { text: "Ask something about the brand.", why: "" };
    const low = question.toLowerCase();
    const name = memory.name || "This brand";
    if (["what does it need", "what do we need", "what's missing", "what is missing", "what next", "what should"].some(function (phrase) { return low.includes(phrase); })) {
      const needs = memory.needs || [];
      if (!needs.length) return { text: name + " has a voice and a system in the kete. Nothing urgent is missing. The next writing can start from a real brief.", why: "Read from the current gaps." };
      return { text: needs.slice(0, 3).map(function (need) { return need.title + ". " + need.detail; }).join(" "), why: "These are the gaps in what has been read, not a strategy invented beside it." };
    }
    if (["colour", "color", "palette", "type", "font", "spacing", "look", "design"].some(function (word) { return low.includes(word); })) {
      const bits = [];
      if (low.includes("type") || low.includes("font")) {
        bits.push((studyLib.typeStyles || []).length ? "Type in the kete: " + studyLib.typeStyles.slice(0, 5).map(function (style) { return style.name + " is " + style.family + " at " + style.size + "px, weight " + style.weight; }).join("; ") + "." : "No type styles have been read yet.");
      }
      if (["colour", "color", "palette"].some(function (word) { return low.includes(word); })) {
        bits.push((studyLib.colors || []).length ? "Colour: " + studyLib.colors.slice(0, 8).map(function (color) { return color.name + " " + color.hex; }).join(", ") + "." : "No colours have been read yet.");
      }
      if (low.includes("spac") && (studyLib.spaces || []).length) bits.push("Spacing: " + studyLib.spaces.slice(0, 6).map(function (space) { return space.name + " " + space.value + (space.unit || "px"); }).join(", ") + ".");
      if (!bits.length) bits.push((studyLib.colors || []).length ? "The system so far is " + studyLib.colors.slice(0, 4).map(function (color) { return color.name; }).join(", ") + "." : "The visual system is not in the kete yet. Load a page.");
      return { text: bits.join(" "), why: "Read from the tokens, not from a guess." };
    }
    if (["how do we sound", "how should we write", "how do we write", "the voice", "how should i write", "tone"].some(function (phrase) { return low.includes(phrase); })) {
      const voice = memory.voice;
      const person = { we: "Say we.", i: "Say I.", they: "Say they.", neutral: "The sources do not settle on a person." }[voice.person];
      let text = person + " Keep a sentence near " + voice.median + " words, and let it state the thing. " + (voice.exclaim ? "" : "Exclamation is not part of this voice. ");
      if (voice.teReo) text += "Where te reo is needed, use a line a person has written. This memory will not compose one. ";
      if ((voice.absent || []).length) text += "Leave out " + voice.absent.slice(0, 5).join(", ") + ".";
      return { text: text.trim(), why: "Taken from the shape of the writing already in the kete." };
    }
    if (["who are we", "who is", "what is the brand", "what are we", "about us", "what do we do"].some(function (phrase) { return low.includes(phrase); })) {
      const facts = memory.facts || [];
      if (!facts.length) return { text: "I can't say what " + name + " is yet. The sources have not defined it.", why: "" };
      return { text: facts.slice(0, 3).map(function (fact) { return fact.text; }).join(" "), why: "From " + facts.slice(0, 3).map(function (fact) { return fact.sourceTitle; }).join(", ") + "." };
    }
    const query = (question.match(/[A-Za-zĀĒĪŌŪāēīōū]{3,}/g) || []).map(fold).filter(function (word) { return !STOP.has(word); });
    const best = [];
    (studyLib.sources || []).forEach(function (source) {
      (texts[source.id] || "").split("\n").forEach(function (line) {
        line = line.replace(/\s+/g, " ").trim();
        const count = wordsOf(line).length;
        if (count < 4 || count > 180) return;
        const folded = fold(line);
        const score = query.reduce(function (sum, word) { return sum + (folded.includes(word) ? 1 : 0); }, 0);
        if (score) best.push([score, line, source]);
      });
    });
    best.sort(function (a, b) { return b[0] - a[0]; });
    if (!best.length) return { text: "That is not in the kete. Add the page, the PDF, or the caption that would answer it.", why: "" };
    const chosen = [];
    const seen = new Set();
    best.forEach(function (item) {
      const key = fold(item[1]).slice(0, 60);
      if (seen.has(key) || chosen.length >= 3) return;
      seen.add(key);
      chosen.push(item);
    });
    const titles = [];
    chosen.forEach(function (item) { if (item[2].title && !titles.includes(item[2].title)) titles.push(item[2].title); });
    return { text: chosen.map(function (item) { return item[1]; }).join(" "), why: titles.length ? "From " + titles.join(", ") + "." : "" };
  }

  async function save() { await idbPut("kv", "library", lib); }

  async function clearSource(assets, sourceId) {
    COLLECTIONS.forEach(function (key) {
      assets[key] = (assets[key] || []).filter(function (item) { return item.sourceId !== sourceId; });
    });
    delete texts[sourceId];
    const keys = await idbKeys("blobs");
    await Promise.all(keys.filter(function (key) { return String(key).startsWith(sourceId + "-") || key === "original:" + sourceId; }).map(function (key) {
      blobUrls.delete(key);
      return idbDelete("blobs", key);
    }));
    await idbDelete("texts", sourceId);
  }

  function hexOf(value) {
    const match = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return "";
    let hex = match[1];
    if (hex.length === 3) hex = hex.split("").map(function (ch) { return ch + ch; }).join("");
    return "#" + hex.toUpperCase();
  }

  function luminance(hex) {
    const rgb = [1, 3, 5].map(function (index) { return parseInt(hex.slice(index, index + 2), 16) / 255; });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function saturation(hex) {
    const rgb = [1, 3, 5].map(function (index) { return parseInt(hex.slice(index, index + 2), 16) / 255; });
    const max = Math.max.apply(null, rgb);
    const min = Math.min.apply(null, rgb);
    if (max === min) return 0;
    const light = (max + min) / 2;
    return (max - min) / (light > 0.5 ? 2 - max - min : max + min);
  }

  function roleFor(hex, opacity) {
    if (opacity < 0.95) return ["Wash", "A translucent fill."];
    const sat = saturation(hex);
    const lum = luminance(hex);
    if (sat < 0.12 && lum > 0.9) return ["Paper", "A light ground."];
    if (sat < 0.12 && lum < 0.2) return ["Ink", "A dark text colour."];
    if (sat < 0.12) return ["Neutral", "A neutral."];
    if (sat > 0.35) return ["Signal", "A saturated colour."];
    return ["Colour", "A repeating colour."];
  }

  function clusterColors(found) {
    const kept = [];
    found.sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
    found.forEach(function (color) {
      if ((color.opacity == null ? 1 : color.opacity) < 0.45) return;
      if (kept.some(function (other) { return closeColor(color.hex, other.hex); })) return;
      const role = roleFor(color.hex, color.opacity == null ? 1 : color.opacity);
      let name = role[0];
      let index = 2;
      while (kept.some(function (item) { return item.name === name; })) { name = role[0] + " " + index; index += 1; }
      kept.push({ name: name, hex: color.hex, opacity: color.opacity == null ? 1 : color.opacity, role: role[0], note: role[1] });
    });
    return kept.slice(0, 16);
  }

  function familyName(raw) {
    const text = String(raw || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const low = text.toLowerCase();
    if (!text || low.includes("fallback") || low.startsWith("var(")) return "";
    if (["inherit", "initial", "unset", "sans-serif", "serif", "monospace", "system-ui", "arial", "helvetica"].includes(low)) return "";
    const key = low.replace(/[\s_-]+/g, "");
    return FAMILIES[key] || text;
  }

  function lengthPx(value) {
    const match = String(value || "").trim().match(/^(-?\d*\.?\d+)px$/);
    return match ? Number(match[1]) : null;
  }

  function readDesign(css) {
    const body = String(css || "").replace(/\/\*[\s\S]*?\*\//g, " ");
    const vars = {};
    body.replace(/(--[a-zA-Z0-9-_]+)\s*:\s*([^;}{]+)/g, function (_, name, value) { vars[name.toLowerCase()] = value.trim(); return _; });
    const resolve = function (value, depth) {
      const match = String(value || "").match(/^var\(\s*(--[a-zA-Z0-9-_]+)\s*\)$/);
      if (match && depth < 5) return resolve(vars[match[1].toLowerCase()] || "", depth + 1);
      return value;
    };
    const counts = {};
    (body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).forEach(function (token) {
      const hex = hexOf(token);
      if (!hex) return;
      counts[hex] = (counts[hex] || 0) + 1;
    });
    const colors = clusterColors(Object.keys(counts).filter(function (hex) { return counts[hex] >= 2; }).map(function (hex) { return { hex: hex, count: counts[hex], opacity: 1 }; }));
    let family = familyName(resolve(vars["--font-family"] || vars["--font-sans"] || "", 0));
    if (!family) {
      const found = body.match(/font-family\s*:\s*([^;}{]+)/i);
      family = found ? familyName(found[1]) : "";
    }
    const styles = [];
    const used = new Set();
    Object.keys(SIZE_VARS).forEach(function (key) {
      const size = lengthPx(resolve(vars[key] || "", 0));
      if (!size || !family) return;
      let label = SIZE_VARS[key];
      if (used.has(label)) label = label + " " + Math.round(size);
      used.add(label);
      styles.push({ name: label, family: family, weight: 400, italic: false, size: size, tracking: 0, trackingUnit: "PERCENT", leading: Math.round(size * 1.2 * 10) / 10, textCase: "ORIGINAL", sample: label });
    });
    const spaces = [];
    Object.keys(vars).forEach(function (key) {
      if (!/space|gap|inset|pad/.test(key)) return;
      const value = lengthPx(resolve(vars[key], 0));
      if (value == null || value < 8 || value > 160) return;
      if (spaces.some(function (space) { return Math.abs(space.value - value) <= 2; })) return;
      spaces.push({ name: key.replace(/^--/, ""), value: value, unit: "px", use: "From the page." });
    });
    const families = [];
    styles.forEach(function (style) { if (!families.includes(style.family)) families.push(style.family); });
    const principles = [];
    if (families.length === 1) principles.push({ title: "One family", body: "The pages set type in " + families[0] + ". Hierarchy comes from size, weight, and tracking." });
    else if (families.length) principles.push({ title: "Typefaces", body: "The pages use " + families.slice(0, 3).join(", ") + "." });
    return { colors: colors, typeStyles: styles, spaces: spaces.slice(0, 8), principles: principles };
  }

  async function remote(url, asBuffer) {
    const pull = async function (target) {
      const response = await native(target);
      if (!response.ok) throw new Error(String(response.status));
      return asBuffer ? new Uint8Array(await response.arrayBuffer()) : await response.text();
    };
    try { return await pull(url); } catch (error) { /* the page did not allow a browser */ }
    return pull("https://corsproxy.io/?" + encodeURIComponent(url));
  }

  function platformFor(url) {
    let host = "";
    try { host = new URL(url).hostname.toLowerCase(); } catch (error) { return ""; }
    const found = SOCIAL.find(function (item) { return host === item[0] || host.endsWith("." + item[0]); });
    return found ? found[1] : "";
  }

  function visible(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const metas = {};
    doc.querySelectorAll("meta").forEach(function (meta) {
      const key = (meta.getAttribute("property") || meta.getAttribute("name") || "").toLowerCase();
      if (key) metas[key] = meta.getAttribute("content") || "";
    });
    const headings = Array.from(doc.querySelectorAll("h1,h2,h3")).map(function (node) { return (node.textContent || "").trim(); }).filter(Boolean);
    doc.querySelectorAll("script,style,noscript").forEach(function (node) { node.remove(); });
    const lines = [];
    const seen = new Set();
    ((doc.body && doc.body.innerText) || "").split("\n").forEach(function (line) {
      line = line.replace(/\s+/g, " ").trim();
      if (!line || seen.has(line)) return;
      seen.add(line);
      lines.push(line);
    });
    return { title: doc.title || "", metas: metas, headings: headings.slice(0, 12), text: lines.join("\n") };
  }

  async function paletteOf(bytes, type) {
    try {
      const blob = new Blob([bytes], { type: type || "image/jpeg" });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      const edge = 48;
      canvas.width = edge;
      canvas.height = edge;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, edge, edge);
      const data = context.getImageData(0, 0, edge, edge).data;
      const buckets = {};
      for (let i = 0; i < data.length; i += 16) {
        const hex = "#" + [data[i], data[i + 1], data[i + 2]].map(function (value) { return value.toString(16).padStart(2, "0"); }).join("").toUpperCase();
        buckets[hex] = (buckets[hex] || 0) + 1;
      }
      return Object.keys(buckets).sort(function (a, b) { return buckets[b] - buckets[a]; }).filter(function (hex) { return saturation(hex) > 0.08; }).slice(0, 4);
    } catch (error) {
      return [];
    }
  }

  async function ingestUrl(url, sourceId) {
    url = (url || "").trim();
    if (!url) throw new Error("Paste a link first.");
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const host = new URL(url).hostname.toLowerCase();
    if (host === "169.254.169.254" || host === "metadata.google.internal") throw new Error("That link is blocked.");
    const html = await remote(url, false);
    const parsed = visible(html);
    const metas = parsed.metas;
    const site = metas["og:site_name"] || "";
    let title = (metas["og:title"] || parsed.title || site || url).replace(/\s+[|–—-]\s+.*$/, "").trim();
    const description = metas["og:description"] || metas.description || "";
    const platform = platformFor(url);
    let text = parsed.text || "";
    if (description && !text.includes(description)) text = description + "\n" + text;
    const sheets = [];
    const hrefs = Array.from(html.matchAll(/href=["']([^"']+\.css[^"']*)["']/gi)).slice(0, 4).map(function (match) { return match[1]; });
    for (const href of hrefs) {
      try { sheets.push(await remote(new URL(href, url).href, false)); } catch (error) { /* a sheet can refuse */ }
    }
    Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).slice(0, 4).forEach(function (match) { sheets.push(match[1]); });
    const design = readDesign(sheets.join("\n"));
    const images = [];
    const imageUrls = [];
    if (metas["og:image"]) imageUrls.push(new URL(metas["og:image"], url).href);
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("img[src]").forEach(function (img) {
      const src = img.getAttribute("src");
      if (src && !src.startsWith("data:")) imageUrls.push(new URL(src, url).href);
    });
    for (const imageUrl of imageUrls) {
      if (images.length >= 5) break;
      try {
        const bytes = await remote(imageUrl, true);
        if (!bytes || bytes.length < 4000 || bytes.length > 8000000) continue;
        const ext = /\.png($|\?)/i.test(imageUrl) ? "png" : /\.svg($|\?)/i.test(imageUrl) ? "svg" : /\.webp($|\?)/i.test(imageUrl) ? "webp" : "jpg";
        images.push({ name: title.slice(0, 48) || "Image", ext: ext, data: new Blob([bytes], { type: ext === "png" ? "image/png" : "image/jpeg" }), palette: ext === "svg" ? [] : await paletteOf(bytes) });
      } catch (error) { /* an image can refuse */ }
    }
    const note = platform && wordsOf(text).length < 40
      ? platform + " does not hand the post to an anonymous reader. The link is kept. A screenshot or an export will bring the caption in."
      : platform ? "Read from " + platform + "." : "";
    const content = [];
    if (description) content.push({ kind: "Description", title: title, body: description });
    return packageSource({
      id: sourceId || newId(),
      kind: platform ? "social" : "url",
      title: title.slice(0, 140),
      origin: url,
      siteName: site,
      platform: platform,
      note: note,
      excerpt: (description || "").slice(0, 240),
      status: "ready",
    }, text, design.colors, design.typeStyles, design.spaces, design.principles, images, content);
  }

  async function ingestFile(filename, data) {
    const name = filename || "file";
    const ext = (name.split(".").pop() || "").toLowerCase();
    const title = name.replace(/\.[a-z0-9]+$/i, "");
    let text = "";
    const images = [];
    let kind = "file";
    if (ext === "pdf" || (data[0] === 0x25 && data[1] === 0x50)) {
      kind = "pdf";
      text = await pdfText(data);
    } else if (ext === "docx") {
      text = await docxText(data);
    } else if (["txt", "md", "markdown", "csv"].includes(ext)) {
      text = new TextDecoder().decode(data);
    }
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
      kind = "image";
      const blob = new Blob([data]);
      images.push({ name: title.slice(0, 48), ext: ext === "jpeg" ? "jpg" : ext, data: blob, palette: ext === "svg" ? [] : await paletteOf(data) });
    }
    const colors = clusterColors((images[0] && images[0].palette || []).map(function (hex) { return { hex: hex, count: 1, opacity: 1 }; }));
    colors.forEach(function (color) { color.role = "Photograph"; color.note = "Sampled from the image."; color.name = "From a photograph"; });
    const content = [];
    const first = text.split("\n").map(function (line) { return line.trim(); }).find(function (line) { return wordsOf(line).length > 6; });
    if (first) content.push({ kind: "From the file", title: title, body: first.slice(0, 500) });
    const result = packageSource({
      id: newId(), kind: kind, title: title.slice(0, 140), origin: name, siteName: "", platform: "",
      note: "Read from the file.", excerpt: "", status: "ready", original: name,
    }, text, colors, [], [], [], images, content);
    result.original = { name: name, data: new Blob([data]) };
    return result;
  }

  async function pdfText(data) {
    const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: data }).promise;
    const pages = [];
    const last = Math.min(pdf.numPages, 20);
    for (let index = 1; index <= last; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages.push(content.items.map(function (item) { return item.str; }).join(" "));
    }
    return pages.join("\n");
  }

  async function docxText(data) {
    const module = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const zip = await module.default.loadAsync(data);
    const file = zip.file("word/document.xml");
    if (!file) return "";
    const xml = await file.async("string");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.getElementsByTagName("*")).filter(function (node) { return node.localName === "p"; }).map(function (para) {
      return Array.from(para.getElementsByTagName("*")).filter(function (node) { return node.localName === "t"; }).map(function (node) { return node.textContent || ""; }).join("");
    }).map(function (line) { return line.trim(); }).filter(Boolean).join("\n");
  }

  function packageSource(source, text, colors, styles, spaces, principles, images, content) {
    source.words = wordsOf(text).length;
    source.status = "ready";
    if (!source.excerpt) {
      const prose = text.split("\n").find(function (line) { return wordsOf(line).length > 8; }) || text;
      source.excerpt = prose.slice(0, 240);
    }
    return { source: source, text: text.slice(0, 80000), colors: colors, typeStyles: styles, spaces: spaces, principles: principles, images: images, content: content };
  }

  async function writeResult(brand, result) {
    const assets = brand.assets;
    const source = result.source;
    const sourceId = source.id;
    const previous = (assets.sources || []).find(function (item) { return item.id === sourceId; }) || {};
    source.addedAt = previous.addedAt || now();
    await clearSource(assets, sourceId);
    if (result.original) await idbPut("blobs", "original:" + sourceId, result.original.data);
    texts[sourceId] = result.text || "";
    await idbPut("texts", sourceId, texts[sourceId]);
    assets.sources = (assets.sources || []).filter(function (item) { return item.id !== sourceId; });
    assets.sources.unshift(source);
    (result.colors || []).forEach(function (color) {
      assets.colors.push({ id: newId(), sourceId: sourceId, picked: color.role !== "Photograph", name: color.name, hex: color.hex, opacity: color.opacity == null ? 1 : color.opacity, role: color.role || "Colour", note: color.note || "" });
    });
    (result.typeStyles || []).forEach(function (style) { assets.typeStyles.push(Object.assign({ id: newId(), sourceId: sourceId, picked: true }, style)); });
    (result.spaces || []).forEach(function (space) { assets.spaces.push(Object.assign({ id: newId(), sourceId: sourceId, picked: true }, space)); });
    (result.principles || []).forEach(function (item) { assets.principles.push(Object.assign({ id: newId(), sourceId: sourceId, picked: true }, item)); });
    for (const image of result.images || []) {
      const fileId = newId();
      const filename = sourceId + "-" + fileId + "." + (image.ext || "jpg");
      await idbPut("blobs", filename, image.data);
      assets.images.push({ id: fileId, sourceId: sourceId, name: image.name || "Image", file: filename, local: true, picked: true });
      let budget = 4;
      for (const hex of image.palette || []) {
        if (budget <= 0) break;
        if ((assets.colors || []).some(function (color) { return closeColor(hex, color.hex); })) continue;
        assets.colors.push({ id: newId(), sourceId: sourceId, name: "From a photograph", hex: hex, opacity: 1, role: "Photograph", note: "Sampled from an image in this source.", picked: false });
        budget -= 1;
      }
    }
    (result.content || []).forEach(function (piece) {
      assets.content.push({ id: newId(), sourceId: sourceId, kind: piece.kind || "Line", title: piece.title || "", body: piece.body || "", picked: piece.kind === "Description" });
    });
    collapse(assets);
  }

  async function imageSrc(image) {
    if (image.local) {
      if (blobUrls.has(image.file)) return blobUrls.get(image.file);
      const blob = await idbGet("blobs", image.file);
      if (!blob) return "";
      const url = URL.createObjectURL(blob);
      blobUrls.set(image.file, url);
      return url;
    }
    return new URL("data/assets/" + image.file, ROOT).href;
  }

  async function publicView() {
    const active = brandOf();
    collapse(active.assets);
    const packed = studyPack(active);
    const images = [];
    for (const image of active.assets.images || []) {
      const item = Object.assign({}, image);
      delete item.data;
      item.src = await imageSrc(image);
      images.push(item);
    }
    const assets = {};
    ["sources"].concat(COLLECTIONS).forEach(function (key) {
      if (key !== "images") assets[key] = (active.assets[key] || []).slice();
    });
    assets.images = images;
    const portrait = packed.portrait;
    delete portrait._map;
    return {
      activeId: active.id,
      brands: lib.brands.map(function (brand) {
        return {
          id: brand.id,
          name: brand.name,
          sourceCount: (brand.assets.sources || []).length,
          assetCount: COLLECTIONS.reduce(function (sum, key) { return sum + (brand.assets[key] || []).length; }, 0),
          memoryCount: (brand.memory.conversation || []).length + (brand.memory.kept || []).length,
        };
      }),
      workspace: { id: active.id, name: active.name },
      assets: assets,
      memory: { conversation: (active.memory.conversation || []).slice(), kept: (active.memory.kept || []).slice(), portrait: portrait },
      paths: { manifest: "", online: true },
    };
  }

  function json(status, body) {
    return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  async function figmaKit(brand) {
    const assets = collapse(brand.assets);
    const name = (brand.name || "Kete").replace(/\//g, " ").trim() || "Kete";
    const picked = function (items) { return (items || []).filter(function (item) { return item.picked; }); };
    const images = [];
    for (const image of picked(assets.images)) {
      images.push({ name: image.name || "Image", url: await imageSrc(image) });
    }
    return {
      preparedAt: now(),
      brand: name,
      online: true,
      colors: picked(assets.colors).map(function (color) { return { name: name + "/Colour/" + color.name, hex: color.hex, opacity: color.opacity == null ? 1 : color.opacity, role: color.role || "", note: color.note || "" }; }),
      textStyles: picked(assets.typeStyles).map(function (style) { return { name: name + "/Type/" + style.name, family: style.family || "Inter", weight: style.weight || 400, italic: !!style.italic, size: style.size || 16, tracking: style.tracking || 0, trackingUnit: style.trackingUnit || "PERCENT", leading: style.leading || Math.round((style.size || 16) * 1.35 * 10) / 10, textCase: style.textCase || "ORIGINAL", sample: style.sample || name }; }),
      spaces: picked(assets.spaces).map(function (space) { return { name: space.name, value: space.value, unit: space.unit || "px", use: space.use || "" }; }),
      principles: picked(assets.principles).map(function (item) { return { title: item.title, body: item.body }; }),
      images: images,
      content: picked(assets.content).filter(function (item) { return (item.body || "").trim(); }).map(function (item) { return { title: item.title || item.kind || "Writing", body: item.body || "", kind: item.kind || "" }; }),
    };
  }

  async function failSource(sourceId, message) {
    const brand = brandForSource(sourceId);
    (brand.assets.sources || []).forEach(function (source) {
      if (source.id === sourceId) {
        source.status = "error";
        source.error = message;
        source.note = message;
      }
    });
    await save();
  }

  async function route(request, url) {
    await ready;
    const path = url.pathname;
    if (request.method === "GET" && path === "/api/library") return json(200, await publicView());
    if (request.method === "GET" && path === "/api/source") {
      return json(200, { id: url.searchParams.get("id") || "", text: (texts[url.searchParams.get("id")] || "").slice(0, 12000) });
    }
    if (request.method === "GET" && path.startsWith("/originals/")) {
      const bits = path.split("/").filter(Boolean);
      const blob = await idbGet("blobs", "original:" + bits[1]);
      if (!blob) return json(404, { error: "Not found" });
      return new Response(blob);
    }
    if (request.method !== "POST") return json(404, { error: "Not found" });
    let payload = {};
    if (path === "/api/ingest/file") {
      const form = await request.formData();
      const brandId = url.searchParams.get("brandId");
      const files = form.getAll("file");
      await lock(async function () {
        const brand = brandOf(brandId);
        lib.activeId = brand.id;
        for (const file of files) {
          const sourceId = newId();
          brand.assets.sources.unshift({ id: sourceId, kind: "file", title: file.name, origin: file.name, note: "Reading.", excerpt: "", status: "reading", words: 0, addedAt: now(), error: "" });
          const bytes = new Uint8Array(await file.arrayBuffer());
          const name = file.name;
          Promise.resolve().then(function () {
            return lock(async function () {
              try {
                const result = await ingestFile(name, bytes);
                result.source.id = sourceId;
                await writeResult(brandForSource(sourceId), result);
                await save();
              } catch (error) {
                await failSource(sourceId, (error && error.message || "Could not read that file.").slice(0, 200));
              }
            });
          });
        }
        await save();
      });
      return json(200, { ok: true, library: await publicView() });
    }
    try { payload = await request.json(); } catch (error) { payload = {}; }
    try {
      if (path === "/api/brand") {
        await lock(async function () {
          const brand = freshBrand(payload.name || "New brand");
          lib.brands.unshift(brand);
          lib.activeId = brand.id;
          await save();
        });
      } else if (path === "/api/brand/open") {
        await lock(async function () {
          const brand = lib.brands.find(function (item) { return item.id === payload.id; });
          if (!brand) throw Object.assign(new Error("That brand is not in the kete."), { status: 404 });
          lib.activeId = brand.id;
          await save();
        });
      } else if (path === "/api/brand/rename") {
        const name = (payload.name || "").trim();
        if (!name) return json(400, { error: "A workspace needs a name." });
        await lock(async function () {
          const brand = lib.brands.find(function (item) { return item.id === payload.id; });
          if (!brand) throw Object.assign(new Error("That brand is not in the kete."), { status: 404 });
          brand.name = name.slice(0, 80);
          lib.activeId = brand.id;
          await save();
        });
      } else if (path === "/api/ingest/url") {
        const sourceId = newId();
        const target = payload.url || "";
        await lock(async function () {
          const brand = brandOf(payload.brandId);
          lib.activeId = brand.id;
          brand.assets.sources.unshift({ id: sourceId, kind: "url", title: target, origin: target, note: "Reading.", excerpt: "", status: "reading", words: 0, addedAt: now(), error: "" });
          await save();
        });
        Promise.resolve().then(function () {
          return lock(async function () {
            try {
              const result = await ingestUrl(target, sourceId);
              await writeResult(brandForSource(sourceId), result);
              await save();
            } catch (error) {
              await failSource(sourceId, (error && error.message || "Could not read that.").slice(0, 200));
            }
          });
        });
      } else if (path === "/api/ingest/writing") {
        const text = (payload.text || "").trim();
        if (wordsOf(text).length < 3) return json(400, { error: "Paste a little more than that." });
        await lock(async function () {
          const brand = brandOf(payload.brandId);
          lib.activeId = brand.id;
          const result = packageSource({
            id: newId(), kind: "writing", title: (payload.title || "Pasted writing").trim().slice(0, 140),
            origin: "Pasted writing", siteName: "", platform: "", note: "Kept from writing you pasted.", excerpt: text.slice(0, 240), status: "ready",
          }, text, [], [], [], [], [], [{ kind: "Description", title: payload.title || "Pasted writing", body: text.slice(0, 500) }]);
          await writeResult(brand, result);
          await save();
        });
      } else if (path === "/api/source/remove") {
        await lock(async function () {
          const brand = brandForSource(payload.id || "");
          await clearSource(brand.assets, payload.id || "");
          brand.assets.sources = brand.assets.sources.filter(function (item) { return item.id !== payload.id; });
          await save();
        });
      } else if (path === "/api/source/reread") {
        const brand = brandForSource(payload.id || "");
        const source = (brand.assets.sources || []).find(function (item) { return item.id === payload.id; });
        if (!source || !String(source.origin || "").startsWith("http")) return json(400, { error: "Only a link can be read again." });
        source.status = "reading";
        source.note = "Reading.";
        await save();
        const sourceId = source.id;
        const origin = source.origin;
        Promise.resolve().then(function () {
          return lock(async function () {
            try {
              await writeResult(brandForSource(sourceId), await ingestUrl(origin, sourceId));
              await save();
            } catch (error) {
              await failSource(sourceId, (error && error.message || "Could not read that.").slice(0, 200));
            }
          });
        });
      } else if (path === "/api/item") {
        if (!PATCHABLE[payload.collection]) return json(400, { error: "Unknown group." });
        await lock(async function () {
          const brand = brandOf(payload.brandId);
          (brand.assets[payload.collection] || []).forEach(function (item) {
            if (item.id !== payload.id) return;
            PATCHABLE[payload.collection].forEach(function (key) {
              if (payload.patch && Object.prototype.hasOwnProperty.call(payload.patch, key)) item[key] = payload.patch[key];
            });
          });
          await save();
        });
      } else if (path === "/api/dismiss") {
        await lock(async function () {
          const brand = brandOf(payload.brandId);
          const dismissed = brand.memory.dismissed || (brand.memory.dismissed = []);
          if (payload.id && !dismissed.includes(payload.id)) dismissed.push(payload.id);
          await save();
        });
      } else if (path === "/api/ask") {
        await lock(async function () {
          const brand = brandOf(payload.brandId);
          const packed = studyPack(brand);
          const answer = reply(packed.portrait, payload.question || "", packed.studyLib);
          brand.memory.conversation = brand.memory.conversation || [];
          brand.memory.conversation.push({ id: newId(), q: (payload.question || "").trim(), text: answer.text, why: answer.why || "", at: now() });
          brand.memory.conversation = brand.memory.conversation.slice(-40);
          await save();
        });
      } else if (path === "/api/make") {
        const brand = brandOf(payload.brandId);
        const packed = studyPack(brand);
        return json(200, compose(packed.portrait, payload.kind || "caption", payload.brief || ""));
      } else if (path === "/api/keep") {
        const body = (payload.text || "").trim();
        if (!body) return json(400, { error: "Nothing to keep." });
        await lock(async function () {
          const brand = brandOf(payload.brandId);
          brand.memory.kept = brand.memory.kept || [];
          brand.memory.kept.unshift({ id: newId(), title: (payload.title || "Kept").trim().slice(0, 80), body: body, at: now() });
          await save();
        });
      } else if (path === "/api/figma/prepare") {
        const kit = await figmaKit(brandOf(payload.brandId));
        return json(200, { ok: true, kit: kit, library: await publicView() });
      } else if (path === "/api/reveal") {
        return json(200, { ok: true, library: await publicView() });
      } else return json(404, { error: "Not found" });
    } catch (error) {
      return json(error.status || 400, { error: error.message || "Something in the kete failed." });
    }
    return json(200, { ok: true, library: await publicView() });
  }

  window.fetch = function (input, init) {
    const request = new Request(input, init);
    const url = new URL(request.url, location.origin);
    if (url.origin === location.origin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/originals/"))) {
      return route(request, url);
    }
    return native(input, init);
  };
})();
