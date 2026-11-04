const state = {
  lib: null,
  view: (location.hash || "#sources").slice(1),
  kind: "caption",
  modal: null,
  sig: "",
  painted: false,
  pasteOpen: false,
  draft: null,
  drafts: {},
  brandQuery: "",
  error: "",
};

const VIEWS = [
  ["sources", "Sources"],
  ["toolkit", "Toolkit"],
  ["memory", "Memory"],
  ["make", "Make"],
];

const GROUPS = [
  ["Assets", [["sources", "Sources"], ["toolkit", "Toolkit"]]],
  ["Memory", [["memory", "Memory"], ["make", "Make"]]],
];

const KINDS = [
  ["headline", "Headline", "The work, in a few words"],
  ["caption", "Caption", "Name the work, and what it is for"],
  ["about", "About", "Who this telling is for"],
  ["social", "Social", "The occasion of the post"],
  ["letter", "Letter", "Who you are writing to, and why"],
];

const KIND_LABEL = { url: "Link", social: "Social", pdf: "PDF", image: "Image", writing: "Writing", file: "File" };

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children || []) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function lib() {
  return state.lib || { brands: [], workspace: { id: "", name: "New brand" }, paths: {}, activeId: "" };
}

function assets() {
  return (state.lib && state.lib.assets) || {
    sources: [], colors: [], typeStyles: [], spaces: [], principles: [], images: [], content: [],
  };
}

function memoryStore() {
  const memory = (state.lib && state.lib.memory) || {};
  return {
    conversation: memory.conversation || [],
    kept: memory.kept || [],
    portrait: memory.portrait || { summary: [], voice: {}, needs: [], confidence: "early", name: "" },
  };
}

function workspace() {
  return (state.lib && state.lib.workspace) || { id: "", name: "New brand" };
}

function brands() {
  return (state.lib && state.lib.brands) || [];
}

function brandId() {
  return (state.lib && state.lib.activeId) || "";
}

function selectedCount() {
  const data = assets();
  return ["colors", "typeStyles", "spaces", "principles", "images", "content"]
    .reduce((sum, key) => sum + data[key].filter((item) => item.picked).length, 0);
}

async function refresh() {
  const response = await fetch("/api/library");
  const data = await response.json();
  const held = data.assets || {};
  const memory = data.memory || {};
  const sig = JSON.stringify({
    active: data.activeId,
    brands: (data.brands || []).map((item) => [item.id, item.name, item.assetCount, item.memoryCount, item.sourceCount]),
    sources: (held.sources || []).map((item) => [item.id, item.status, item.title, item.words, item.note]),
    counts: ["colors", "typeStyles", "spaces", "principles", "images", "content"].map((key) => (held[key] || []).length),
    summary: memory.portrait && memory.portrait.summary,
    needs: memory.portrait && memory.portrait.needs,
    talk: (memory.conversation || []).length,
    kept: (memory.kept || []).length,
  });
  const changed = sig !== state.sig || !state.painted;
  stashDraft();
  state.lib = data;
  state.draft = state.drafts[data.activeId] || null;
  state.sig = sig;
  if (changed) paint();
  const reading = (held.sources || []).some((item) => item.status === "reading");
  if (reading) watch();
}

let timer = null;
function watch() {
  if (timer) return;
  timer = setInterval(async () => {
    try { await refresh(); } catch (error) { /* server still coming up */ }
    if (!assets().sources.some((item) => item.status === "reading")) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

function stashDraft() {
  const id = brandId();
  if (!id) return;
  state.drafts[id] = state.draft;
}

function adopt(data) {
  stashDraft();
  state.lib = data;
  state.draft = state.drafts[data.activeId] || null;
  state.sig = "";
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ brandId: brandId() }, body || {})),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not do that.");
  if (data.library) {
    adopt(data.library);
    paint();
  }
  return data;
}

function keepFocus() {
  const fields = ["link-input", "ask-input", "brief-input", "paste-input", "paste-title", "brand-filter", "workspace-name"];
  const active = document.activeElement;
  const saved = {};
  if (active && fields.includes(active.id)) {
    saved.id = active.id;
    saved.value = active.value;
    saved.start = active.selectionStart;
  }
  return () => {
    if (!saved.id) return;
    const node = document.getElementById(saved.id);
    if (!node) return;
    node.value = saved.value;
    node.focus();
    if (saved.start != null && node.setSelectionRange) node.setSelectionRange(saved.start, saved.start);
  };
}

function paint() {
  const restore = keepFocus();
  const root = document.getElementById("app");
  root.replaceChildren(sidebar(), main());
  if (state.modal) root.append(modal());
  state.painted = true;
  restore();
}

function go(view) {
  state.view = view;
  history.replaceState(null, "", "#" + view);
  paint();
}

function sidebar() {
  const data = assets();
  const memory = memoryStore();
  const counts = [
    ["sources", "Sources", data.sources.length],
    ["toolkit", "Colour", data.colors.length],
    ["toolkit", "Type", data.typeStyles.length],
    ["toolkit", "Images", data.images.length],
    ["memory", "Remembered", memory.conversation.length + memory.kept.length],
  ];
  return el("aside", { class: "sidebar" }, [
    el("div", { class: "logo", text: "Kete" }),
    brandFilter(),
    el("nav", { class: "nav" }, GROUPS.map(([label, items]) =>
      el("div", { class: "nav-group" }, [
        el("div", { class: "side-label", text: label }),
        ...items.map(([id, name]) =>
          el("button", {
            class: "nav-item" + (state.view === id ? " active" : ""),
            type: "button",
            onclick: () => go(id),
            text: name,
          })
        ),
      ])
    )),
    el("div", { class: "side-block" }, [
      el("div", { class: "side-label", text: "In this workspace" }),
      ...counts.map(([view, label, count]) =>
        el("button", { class: "side-link", type: "button", onclick: () => go(view) }, [
          el("span", { text: label }),
          el("span", { text: String(count) }),
        ])
      ),
    ]),
    el("div", { class: "sidebar-bottom" }, [
      el("p", { class: "quiet", text: "Assets and memory stay in this brand" }),
    ]),
  ]);
}

function brandFilter() {
  const query = state.brandQuery.trim().toLowerCase();
  const list = brands().filter((brand) => !query || brand.name.toLowerCase().includes(query));
  const active = brandId();
  return el("div", { class: "brand-filter" }, [
    el("div", { class: "side-label", text: "Brands" }),
    el("input", {
      id: "brand-filter",
      class: "brand-query",
      placeholder: "Filter brands",
      value: state.brandQuery,
      oninput: (event) => {
        state.brandQuery = event.target.value;
        paint();
      },
    }),
    list.length
      ? el("div", { class: "brand-list" }, list.map((brand) => brandRow(brand, brand.id === active)))
      : el("p", { class: "filter-empty", text: "No brand matches." }),
    el("button", { class: "text-btn brand-new", type: "button", text: "New brand", onclick: newBrand }),
  ]);
}

function brandRow(brand, active) {
  return el("button", {
    class: "brand-row" + (active ? " active" : ""),
    type: "button",
    onclick: () => openBrand(brand.id),
  }, [
    el("strong", { text: brand.name }),
    el("em", { text: brand.assetCount + " assets · " + brand.memoryCount + " memory" }),
  ]);
}

async function openBrand(id) {
  if (!id || id === brandId()) return;
  state.error = "";
  try {
    await post("/api/brand/open", { id });
  } catch (error) {
    state.error = error.message;
    paint();
  }
}

async function newBrand() {
  state.brandQuery = "";
  state.error = "";
  state.view = "sources";
  history.replaceState(null, "", "#sources");
  try {
    await post("/api/brand", { name: "New brand" });
  } catch (error) {
    state.error = error.message;
    paint();
  }
}

async function renameWorkspace(name) {
  const id = workspace().id;
  if (!id) return;
  try {
    await post("/api/brand/rename", { id, name });
  } catch (error) {
    state.error = error.message;
    paint();
  }
}

function viewLine() {
  const titles = Object.fromEntries(VIEWS);
  const title = titles[state.view] || "Kete";
  const section = state.view === "memory" || state.view === "make" ? "Memory" : "Assets";
  if (section === title) return title;
  return section + "  ·  " + title;
}

function subtitle() {
  const name = workspace().name;
  if (state.view === "toolkit") return "Colour, type, space, image, and writing for " + name + ". Tick what should become a style or a component.";
  if (state.view === "memory") return "What " + name + " has learned. This memory is not shared with another brand.";
  if (state.view === "make") return "New writing from the memory of " + name + ".";
  return "Files, pages, and links for " + name + ". They stay in this workspace.";
}

function main() {
  const place = workspace();
  const learned = memoryStore().portrait.name;
  const suggest = learned && learned !== "This brand" && learned !== place.name;
  const count = selectedCount();
  return el("div", { class: "main" }, [
    el("header", { class: "main-header" }, [
      el("div", { class: "workspace-head" }, [
        el("div", { class: "kicker", text: "Workspace" }),
        el("input", {
          id: "workspace-name",
          class: "workspace-name",
          value: place.name,
          "aria-label": "Workspace name",
          onchange: (event) => renameWorkspace(event.target.value),
        }),
        el("p", { class: "page-title", text: viewLine() }),
        el("p", { class: "page-subtitle", text: subtitle() }),
        suggest
          ? el("button", {
            class: "text-btn name-suggest",
            type: "button",
            text: "Memory knows this as " + learned + ". Use that name.",
            onclick: () => renameWorkspace(learned),
          })
          : null,
      ]),
      el("div", { class: "trailing" }, [
        el("span", { class: "sel-count", text: count ? count + " selected" : "Nothing selected" }),
        el("button", { class: "primary", type: "button", onclick: openImport, text: "Import to Figma" }),
      ]),
    ]),
    el("div", { class: "main-content" }, [view()]),
  ]);
}

function view() {
  if (state.view === "toolkit") return toolkit();
  if (state.view === "memory") return memoryView();
  if (state.view === "make") return makeView();
  return sourcesView();
}

function sourcesView() {
  const data = assets();
  const file = el("input", { type: "file", multiple: "true", accept: ".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.docx,image/*", hidden: "true" });
  file.addEventListener("change", () => { if (file.files.length) upload(file.files); file.value = ""; });
  return el("div", {}, [
    el("div", { class: "composer" }, [
      el("div", { class: "composer-row" }, [
        el("input", {
          id: "link-input", class: "field", type: "url",
          placeholder: "A site, a PDF link, or a social post",
          onkeydown: (event) => { if (event.key === "Enter") addUrl(); },
        }),
        el("button", { class: "primary", type: "button", onclick: addUrl, text: "Add" }),
        el("button", { class: "bubble", type: "button", onclick: () => file.click(), text: "File" }),
      ]),
      file,
      el("p", { class: "helper", text: "Kete reads the words, the type, the colour, and the images it is allowed to see, and keeps them with this brand. Instagram and the like often keep the caption back — a screenshot still works." }),
      el("button", {
        class: "text-btn", type: "button",
        onclick: () => { state.pasteOpen = !state.pasteOpen; paint(); },
        text: state.pasteOpen ? "Close writing" : "Paste writing",
      }),
      state.pasteOpen ? el("div", { class: "stack" }, [
        el("input", { id: "paste-title", class: "field", placeholder: "A title" }),
        el("textarea", { id: "paste-input", class: "area", placeholder: "Writing the brand has already made" }),
        el("div", {}, [el("button", { class: "primary", type: "button", onclick: addWriting, text: "Keep" })]),
      ]) : null,
      state.error ? el("p", { class: "error-line", text: state.error }) : null,
    ]),
    data.sources.length
      ? el("div", { class: "stack" }, data.sources.map(sourceCard))
      : el("p", { class: "empty", text: "Nothing in this workspace yet." }),
  ]);
}

function sourceCard(source) {
  const bits = [];
  const id = source.id;
  const data = assets();
  const count = (key, label) => {
    const number = data[key].filter((item) => item.sourceId === id).length;
    if (number) bits.push(number + " " + label);
  };
  count("colors", "colours");
  count("typeStyles", "type");
  count("images", "images");
  if (source.words) bits.push(source.words + " words");
  const kicker = source.platform || KIND_LABEL[source.kind] || "Source";
  return el("button", { class: "source", type: "button", onclick: () => openSource(source.id) }, [
    el("div", { class: "kicker", text: source.status === "reading" ? "Reading" : kicker }),
    el("div", {}, [
      el("h3", { text: source.title || source.origin || "Untitled" }),
      source.excerpt ? el("p", { text: source.excerpt }) : null,
      source.status === "error" ? el("p", { text: source.note || "Could not read this." }) : null,
    ]),
    el("div", { class: "meta", text: source.status === "reading" ? "" : bits.join(" · ") }),
  ]);
}

async function addUrl() {
  const input = document.getElementById("link-input");
  const url = (input.value || "").trim();
  if (!url) return;
  input.value = "";
  state.error = "";
  try {
    await post("/api/ingest/url", { url });
    watch();
  } catch (error) {
    state.error = error.message;
    const field = document.getElementById("link-input");
    if (field) field.value = url;
    paint();
  }
}

async function addWriting() {
  const text = document.getElementById("paste-input").value;
  const title = document.getElementById("paste-title").value;
  state.error = "";
  try {
    await post("/api/ingest/writing", { title, text });
    state.pasteOpen = false;
    paint();
  } catch (error) {
    state.error = error.message;
    paint();
  }
}

async function upload(files) {
  const body = new FormData();
  for (const file of files) body.append("file", file);
  state.error = "";
  const response = await fetch("/api/ingest/file?brandId=" + encodeURIComponent(brandId()), { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    state.error = data.error || "Could not read that file.";
    paint();
    return;
  }
  if (data.library) adopt(data.library);
  state.sig = "";
  paint();
  watch();
}

function toolkit() {
  const data = assets();
  const columns = [
    ["Colour", data.colors, colourCard],
    ["Type", data.typeStyles, typeCard],
    ["Space", data.spaces, spaceCard],
    ["Principles", data.principles, principleCard],
    ["Image", data.images, imageCard],
    ["Content", data.content, contentCard],
  ];
  return el("div", { class: "board" }, columns.map(([label, items, render]) =>
    el("section", { class: "col" }, [
      el("div", { class: "col-h" }, [
        el("span", { text: label }),
        el("em", { text: String(items.length) }),
      ]),
      items.length ? null : el("p", { class: "empty", text: "None yet." }),
      ...items.map(render),
    ])
  ));
}

function tick(collection, item) {
  return el("button", {
    class: "tick" + (item.picked ? " on" : ""),
    type: "button",
    "aria-pressed": item.picked ? "true" : "false",
    "aria-label": item.picked ? "Selected" : "Not selected",
    onclick: (event) => {
      event.stopPropagation();
      post("/api/item", { collection, id: item.id, patch: { picked: !item.picked } }).catch((error) => {
        state.error = error.message;
        paint();
      });
    },
  });
}

function ghost(collection, item, field) {
  const input = el("input", { class: "ghost", value: item[field] || "" });
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("change", () => {
    post("/api/item", { collection, id: item.id, patch: { [field]: input.value } });
  });
  return input;
}

function colourCard(item) {
  const swatch = el("div", { class: "swatch" });
  swatch.style.background = item.hex;
  swatch.style.opacity = String(item.opacity == null ? 1 : item.opacity);
  return el("article", { class: "card" }, [
    swatch,
    el("div", { class: "card-top" }, [ghost("colors", item, "name"), tick("colors", item)]),
    el("div", { class: "hex", text: item.hex + (item.opacity < 1 ? "  " + Math.round(item.opacity * 100) + "%" : "") }),
    el("div", { class: "use", text: [item.role, item.note].filter(Boolean).join(" · ") }),
  ]);
}

function typeCard(item) {
  const sample = el("div", { class: "specimen", text: item.sample || item.name });
  sample.style.fontFamily = `"${item.family}", "Kete Sans", "Founders Grotesk", sans-serif`;
  sample.style.fontWeight = String(item.weight || 400);
  sample.style.fontSize = Math.min(item.size || 16, 32) + "px";
  if (item.trackingUnit === "PIXELS") sample.style.letterSpacing = (item.tracking || 0) + "px";
  else sample.style.letterSpacing = ((item.tracking || 0) / 100) + "em";
  if (item.textCase === "UPPER") sample.style.textTransform = "uppercase";
  const size = Number(item.size) === item.size ? item.size : item.size;
  const pretty = Number.isInteger(size) ? String(size) : String(size);
  return el("article", { class: "card" }, [
    sample,
    el("div", { class: "card-top" }, [ghost("typeStyles", item, "name"), tick("typeStyles", item)]),
    el("div", { class: "use", text: item.family }),
    el("div", { class: "hex", text: `${pretty} / ${item.weight} / ${item.tracking > 0 ? "+" : ""}${item.tracking}${item.trackingUnit === "PIXELS" ? "px" : "%"}` }),
  ]);
}

function spaceCard(item) {
  const value = Number(item.value);
  const pretty = Number.isInteger(value) ? String(value) : String(value);
  return el("article", { class: "card" }, [
    el("div", { class: "card-top" }, [
      el("div", { class: "card-title", text: pretty + (item.unit || "px") }),
      tick("spaces", item),
    ]),
    ghost("spaces", item, "name"),
    el("div", { class: "use", text: item.use || "" }),
  ]);
}

function principleCard(item) {
  return el("article", { class: "card" }, [
    el("div", { class: "card-top" }, [ghost("principles", item, "title"), tick("principles", item)]),
    el("p", { class: "meta", text: item.body || "" }),
  ]);
}

function imageCard(item) {
  const image = el("img", { class: "shot", src: item.src, alt: item.name || "" });
  return el("article", { class: "card" }, [
    image,
    el("div", { class: "card-top" }, [ghost("images", item, "name"), tick("images", item)]),
  ]);
}

function contentCard(item) {
  const body = item.body || "";
  return el("article", { class: "card" }, [
    el("div", { class: "card-top" }, [
      el("div", { class: "kicker", text: item.kind || "Content" }),
      tick("content", item),
    ]),
    el("div", { class: "card-title", text: item.title || "" }),
    body && body !== item.title ? el("p", { class: "meta", text: body.length > 220 ? body.slice(0, 220) + "…" : body }) : null,
  ]);
}

function memoryView() {
  const stored = memoryStore();
  const memory = stored.portrait;
  const voice = memory.voice || {};
  const person = { we: "We", i: "I", they: "They", neutral: "Unmarked" }[voice.person] || "";
  const line = [memory.confidence, person, voice.median ? voice.median + " words" : ""].filter(Boolean).join(" · ");
  const asks = el("div", { class: "ask" }, [
    el("input", {
      id: "ask-input", class: "field", placeholder: "Ask what the brand is, how it sounds, what it needs",
      onkeydown: (event) => { if (event.key === "Enter") ask(); },
    }),
    el("button", { class: "primary", type: "button", onclick: ask, text: "Ask" }),
  ]);
  return el("div", { class: "memory" }, [
    el("div", {}, [
      line ? el("p", { class: "voice-line", text: line }) : null,
      el("div", { class: "portrait" }, (memory.summary || []).map((paragraph) => el("p", { text: paragraph }))),
      (voice.lexicon || []).length
        ? el("div", { class: "lex" }, voice.lexicon.map((word) => el("span", { text: word })))
        : null,
      stored.kept.length
        ? el("div", { class: "kept-block" }, [
          el("div", { class: "side-label", text: "Kept in memory" }),
          ...stored.kept.map((item) =>
            el("article", { class: "answer" }, [
              el("div", { class: "q", text: item.title || "Kept" }),
              el("div", { class: "a", text: item.body || "" }),
            ])
          ),
        ])
        : null,
      ...(stored.conversation || []).slice().reverse().slice(0, 8).reverse().map((turn) =>
        el("article", { class: "answer" }, [
          el("div", { class: "q", text: turn.q }),
          el("div", { class: "a", text: turn.text }),
          turn.why ? el("div", { class: "why", text: turn.why }) : null,
        ])
      ),
      asks,
    ]),
    el("div", {}, [
      el("div", { class: "side-label", style: "padding-left: 4px", text: "What it needs" }),
      (memory.needs || []).length
        ? el("div", {}, memory.needs.map((need) =>
          el("article", { class: "need" }, [
            el("strong", { text: need.title }),
            el("p", { text: need.detail }),
            el("button", {
              class: "text-btn", type: "button", text: "Understood",
              onclick: () => post("/api/dismiss", { id: need.id }),
            }),
          ])
        ))
        : el("p", { class: "empty", text: "Nothing pressing." }),
    ]),
  ]);
}

async function ask() {
  const input = document.getElementById("ask-input");
  const question = (input.value || "").trim();
  if (!question) return;
  input.value = "";
  try { await post("/api/ask", { question }); }
  catch (error) { state.error = error.message; paint(); }
}

function makeView() {
  const kind = KINDS.find((item) => item[0] === state.kind) || KINDS[1];
  return el("div", { class: "make" }, [
    el("div", { class: "pills" }, KINDS.map(([id, label]) =>
      el("button", {
        class: "pill" + (state.kind === id ? " on" : ""),
        type: "button",
        text: label,
        onclick: () => { state.kind = id; paint(); },
      })
    )),
    el("textarea", { id: "brief-input", class: "area", placeholder: kind[2] }),
    el("div", {}, [
      el("button", { class: "primary", type: "button", onclick: writePiece, text: "Write" }),
    ]),
    state.draft ? el("article", { class: "output" }, [
      el("div", { class: "a", text: state.draft.text }),
      state.draft.why ? el("div", { class: "why", text: state.draft.why }) : null,
      el("div", { class: "output-actions" }, [
        el("button", {
          class: "text-btn", type: "button",
          text: state.draft.kept ? "Kept in memory" : "Keep in memory",
          onclick: keepDraft,
        }),
        el("button", { class: "text-btn", type: "button", text: "Write again", onclick: writePiece }),
      ]),
    ]) : el("p", { class: "helper", text: "Writing comes from this brand's memory. It will not invent a client, a place, or a line of te reo." }),
  ]);
}

async function writePiece() {
  const brief = (document.getElementById("brief-input") || {}).value || "";
  try {
    const made = await post("/api/make", { kind: state.kind, brief });
    state.draft = { text: made.text, why: made.why, kind: state.kind, kept: false };
    paint();
    const field = document.getElementById("brief-input");
    if (field) field.value = brief;
  } catch (error) {
    state.error = error.message;
    paint();
  }
}

async function keepDraft() {
  if (!state.draft || state.draft.kept) return;
  const label = (KINDS.find((item) => item[0] === state.draft.kind) || [])[1] || "Kept";
  await post("/api/keep", { text: state.draft.text, title: label });
  state.draft.kept = true;
  paint();
}

async function openImport() {
  state.modal = { type: "import", loading: true };
  paint();
  try {
    const data = await post("/api/figma/prepare");
    state.modal = { type: "import", kit: data.kit };
    paint();
  } catch (error) {
    state.modal = { type: "import", error: error.message };
    paint();
  }
}

async function openSource(id) {
  state.modal = { type: "source", id, text: "Reading." };
  paint();
  const response = await fetch("/api/source?id=" + encodeURIComponent(id));
  const data = await response.json();
  if (state.modal && state.modal.type === "source" && state.modal.id === id) {
    state.modal.text = data.text || "Nothing was read from this one.";
    paint();
  }
}

function modal() {
  const close = () => { state.modal = null; paint(); };
  const back = el("div", { class: "modal-back", onclick: (event) => { if (event.target === back) close(); } });
  back.append(state.modal.type === "import" ? importModal(close) : sourceModal(close));
  return back;
}

function importModal(close) {
  const kit = (state.modal && state.modal.kit) || {};
  const manifest = (lib().paths || {}).manifest || "";
  const counts = [
    kit.colors && kit.colors.length && kit.colors.length + " paint styles",
    kit.textStyles && kit.textStyles.length && kit.textStyles.length + " text styles",
    (kit.principles || []).length + (kit.content || []).length + (kit.images || []).length
      ? ((kit.principles || []).length + (kit.content || []).length + (kit.images || []).length) + " components of writing and image"
      : "",
  ].filter(Boolean);
  const online = Boolean((lib().paths || {}).online || kit.online);
  const box = el("div", { class: "modal", onclick: (event) => event.stopPropagation() }, [
    el("h2", { text: "Import to Figma" }),
    state.modal.loading ? el("p", { text: "Preparing the selection." }) : null,
    state.modal.error ? el("p", { text: state.modal.error }) : null,
    kit.brand ? el("p", { text: "From the " + kit.brand + " workspace. " + (counts.join(", ") || "Nothing is ticked") + ". Memory stays in Kete." }) : null,
    online
      ? el("p", { text: "Copy the kit. In Figma, run Kete Import and paste it into the box. It builds a page called Kete, with styles and components from the ticks." })
      : el("p", { text: "Open the file you want these in. In Figma: Plugins, Development, Import plugin from manifest." }),
    !online && manifest ? el("div", { class: "path", text: manifest }) : null,
    online ? null : el("ol", {}, [
      el("li", { text: "Choose the manifest above." }),
      el("li", { text: "Run Kete Import. It builds a page called Kete, with styles and components from the ticks." }),
    ]),
    el("div", { class: "modal-actions" }, [
      online ? null : el("button", { class: "primary", type: "button", text: "Show the file", onclick: () => post("/api/reveal") }),
      el("button", {
        class: online ? "primary" : "text-btn", type: "button", text: "Copy kit",
        onclick: () => navigator.clipboard.writeText(JSON.stringify(kit, null, 2)),
      }),
      el("button", { class: "text-btn", type: "button", text: "Close", onclick: close }),
    ]),
  ]);
  return box;
}

function sourceModal(close) {
  const source = (assets().sources || []).find((item) => item.id === state.modal.id) || {};
  const box = el("div", { class: "modal", onclick: (event) => event.stopPropagation() }, [
    el("div", { class: "kicker", text: source.platform || KIND_LABEL[source.kind] || "Source" }),
    el("h2", { text: source.title || "Source" }),
    source.origin ? el("p", { class: "meta", text: source.origin }) : null,
    source.note ? el("p", { text: source.note }) : null,
    el("div", { class: "reading", text: state.modal.text || "" }),
    el("div", { class: "modal-actions" }, [
      String(source.origin || "").startsWith("http")
        ? el("button", {
          class: "text-btn", type: "button", text: "Read again",
          onclick: async () => { await post("/api/source/reread", { id: source.id }); close(); watch(); },
        })
        : null,
      source.original
        ? el("a", { class: "text-btn", href: "/originals/" + source.id + "/" + encodeURIComponent(source.original), text: "Original file" })
        : null,
      el("button", {
        class: "text-btn", type: "button", text: "Remove",
        onclick: async () => { await post("/api/source/remove", { id: source.id }); close(); },
      }),
      el("button", { class: "text-btn", type: "button", text: "Close", onclick: close }),
    ]),
  ]);
  return box;
}

document.addEventListener("dragover", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  document.body.classList.add("dropping");
});
document.addEventListener("dragleave", (event) => {
  if (event.clientX === 0 && event.clientY === 0) document.body.classList.remove("dropping");
});
document.addEventListener("drop", (event) => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  document.body.classList.remove("dropping");
  upload(event.dataTransfer.files);
});
window.addEventListener("hashchange", () => {
  const next = (location.hash || "#sources").replace("#", "");
  if (VIEWS.some(([id]) => id === next) && next !== state.view) {
    state.view = next;
    paint();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.modal) {
    state.modal = null;
    paint();
  }
});

refresh().catch(() => {
  document.getElementById("app").append(el("p", { class: "empty", text: "Kete is not running." }));
});
