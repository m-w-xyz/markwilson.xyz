const WEIGHTS = {
  100: ["Thin", "Hairline"],
  200: ["Extra Light", "ExtraLight", "Thin"],
  300: ["Light"],
  400: ["Regular", "Roman", "Book"],
  500: ["Medium"],
  600: ["Semibold", "Semi Bold", "SemiBold", "Medium"],
  700: ["Bold"],
  800: ["Extra Bold", "ExtraBold", "Heavy"],
  900: ["Black", "Heavy"],
};

function nearest(weight) {
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  return steps.reduce((best, step) => Math.abs(step - weight) < Math.abs(best - weight) ? step : best, 400);
}

function rgb(hex) {
  const raw = String(hex || "#000000").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw.slice(0, 6);
  const value = parseInt(full, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function styleNames(weight, italic) {
  const styles = (WEIGHTS[nearest(weight || 400)] || WEIGHTS[400]).map((style) => italic ? style + " Italic" : style);
  if (italic) styles.push("Italic");
  styles.push(italic ? "Italic" : "Regular");
  return styles.filter((style, index) => styles.indexOf(style) === index);
}

async function exactFace(family, weight, italic) {
  if (!family) return null;
  for (const style of styleNames(weight, italic)) {
    try {
      await figma.loadFontAsync({ family, style });
      return { family, style };
    } catch (error) { /* the next style name */ }
  }
  return null;
}

async function face(family, weight, italic) {
  const loaded = await exactFace(family, weight, italic);
  if (loaded) return loaded;
  const fallback = italic ? "Italic" : "Regular";
  await figma.loadFontAsync({ family: "Inter", style: fallback });
  return { family: "Inter", style: fallback };
}

async function missingFaces(kit) {
  const seen = new Set();
  const missing = [];
  for (const style of kit.textStyles || []) {
    const family = style.family || "";
    if (!family || seen.has(family)) continue;
    seen.add(family);
    const loaded = await exactFace(family, style.weight, style.italic);
    if (!loaded) missing.push({ family, weight: style.weight || 400, italic: !!style.italic });
  }
  return missing;
}

function row() {
  const frame = figma.createFrame();
  frame.name = "Row";
  frame.layoutMode = "HORIZONTAL";
  frame.layoutWrap = "WRAP";
  frame.itemSpacing = 12;
  frame.counterAxisSpacing = 12;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "AUTO";
  frame.resize(1072, 80);
  frame.fills = [];
  return frame;
}

let pendingKit = null;

async function build(kit) {
  if (!kit.fontChoice) {
    const missing = await missingFaces(kit);
    if (missing.length) {
      pendingKit = kit;
      figma.ui.resize(360, 300);
      figma.ui.postMessage({ type: "missing-fonts", faces: missing });
      return;
    }
  }

  const names = figma.root.children.map((page) => page.name);
  let pageName = "Kete";
  let index = 2;
  while (names.includes(pageName)) {
    pageName = "Kete " + index;
    index += 1;
  }
  const page = figma.createPage();
  page.name = pageName;
  await figma.setCurrentPageAsync(page);

  const paper = (kit.colors || []).find((color) => /paper|surface|ground/i.test(color.name));
  const root = figma.createFrame();
  root.name = kit.brand || "Kete";
  page.appendChild(root);
  root.layoutMode = "VERTICAL";
  root.primaryAxisSizingMode = "AUTO";
  root.counterAxisSizingMode = "FIXED";
  root.resize(1200, 200);
  root.paddingTop = 64;
  root.paddingBottom = 64;
  root.paddingLeft = 64;
  root.paddingRight = 64;
  root.itemSpacing = 28;
  root.fills = [{ type: "SOLID", color: paper ? rgb(paper.hex) : { r: 1, g: 1, b: 1 } }];

  const labelFace = await face("Inter", 500, false);
  const bodyFace = await face((kit.textStyles && kit.textStyles[0] && kit.textStyles[0].family) || "Inter", 400, false);

  async function kicker(text) {
    const node = figma.createText();
    node.fontName = labelFace;
    node.characters = text;
    node.fontSize = 11;
    node.letterSpacing = { unit: "PERCENT", value: 8 };
    node.textCase = "UPPER";
    node.fills = [{ type: "SOLID", color: rgb("#888888") }];
    return node;
  }

  let paints = 0;
  let texts = 0;
  let components = 0;
  const made = [];
  const substituted = [];

  if ((kit.colors || []).length) {
    root.appendChild(await kicker("Colour"));
    const line = row();
    for (const color of kit.colors) {
      const paint = { type: "SOLID", color: rgb(color.hex), opacity: color.opacity == null ? 1 : color.opacity };
      try {
        const style = figma.createPaintStyle();
        style.name = color.name;
        style.paints = [paint];
        paints += 1;
      } catch (error) { /* a style with this name may already exist */ }
      const component = figma.createComponent();
      component.name = color.name;
      component.layoutMode = "VERTICAL";
      component.primaryAxisSizingMode = "AUTO";
      component.counterAxisSizingMode = "FIXED";
      component.resize(180, 120);
      component.itemSpacing = 8;
      component.paddingBottom = 12;
      component.paddingLeft = 12;
      component.paddingRight = 12;
      component.cornerRadius = 8;
      component.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
      const swatch = figma.createRectangle();
      swatch.resize(156, 72);
      swatch.cornerRadius = 6;
      swatch.fills = [paint];
      swatch.layoutAlign = "STRETCH";
      component.appendChild(swatch);
      const caption = figma.createText();
      caption.fontName = bodyFace;
      caption.characters = color.name.split("/").pop() + "  " + color.hex;
      caption.fontSize = 12;
      caption.layoutAlign = "STRETCH";
      component.appendChild(caption);
      line.appendChild(component);
      components += 1;
    }
    root.appendChild(line);
  }

  if ((kit.textStyles || []).length) {
    root.appendChild(await kicker("Type"));
    const line = row();
    for (const style of kit.textStyles) {
      const loaded = await face(style.family, style.weight, style.italic);
      if (style.family && loaded.family !== style.family && !substituted.includes(style.family)) substituted.push(style.family);
      let textStyle = null;
      try {
        textStyle = figma.createTextStyle();
        textStyle.name = style.name;
        textStyle.fontName = loaded;
        textStyle.fontSize = Number(style.size) || 16;
        textStyle.letterSpacing = {
          unit: style.trackingUnit === "PIXELS" ? "PIXELS" : "PERCENT",
          value: Number(style.tracking) || 0,
        };
        textStyle.lineHeight = { unit: "PIXELS", value: Number(style.leading) || Math.round((Number(style.size) || 16) * 1.35) };
        textStyle.textCase = style.textCase === "UPPER" ? "UPPER" : "ORIGINAL";
        texts += 1;
      } catch (error) { textStyle = null; }
      const component = figma.createComponent();
      component.name = style.name;
      component.layoutMode = "VERTICAL";
      component.primaryAxisSizingMode = "AUTO";
      component.counterAxisSizingMode = "FIXED";
      component.resize(320, 80);
      component.paddingTop = 16;
      component.paddingBottom = 16;
      component.paddingLeft = 16;
      component.paddingRight = 16;
      component.itemSpacing = 6;
      component.cornerRadius = 8;
      component.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      const sample = figma.createText();
      sample.fontName = loaded;
      sample.characters = style.sample || style.name.split("/").pop();
      if (textStyle) sample.textStyleId = textStyle.id;
      sample.layoutAlign = "STRETCH";
      component.appendChild(sample);
      const meta = figma.createText();
      meta.fontName = bodyFace;
      meta.characters = style.name.split("/").pop() + "  ·  " + (style.family || loaded.family);
      meta.fontSize = 11;
      meta.fills = [{ type: "SOLID", color: rgb("#888888") }];
      meta.layoutAlign = "STRETCH";
      component.appendChild(meta);
      line.appendChild(component);
      components += 1;
      made.push({
        size: Number(style.size) || 16,
        font: loaded,
        styleId: textStyle ? textStyle.id : "",
      });
    }
    root.appendChild(line);
  }

  if ((kit.copy || []).length) {
    root.appendChild(await kicker("Placeholder"));
    const frame = figma.createFrame();
    frame.name = "Placeholder";
    frame.layoutMode = "VERTICAL";
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = "FIXED";
    frame.resize(720, 80);
    frame.itemSpacing = 16;
    frame.paddingTop = 28;
    frame.paddingBottom = 28;
    frame.paddingLeft = 28;
    frame.paddingRight = 28;
    const ground = paper ? rgb(paper.hex) : { r: 1, g: 1, b: 1 };
    frame.fills = [{ type: "SOLID", color: ground }];
    const light = (0.2126 * ground.r) + (0.7152 * ground.g) + (0.0722 * ground.b) > 0.6;
    const sorted = made.slice().sort((a, b) => b.size - a.size);
    for (const block of kit.copy) {
      let match = null;
      if (sorted.length) {
        if (block.role === "Display") match = sorted[0];
        else if (block.role === "Caption") match = sorted[sorted.length - 1];
        else if (block.role === "Title") match = sorted[Math.min(1, sorted.length - 1)];
        else match = made.slice().sort((a, b) => Math.abs(a.size - 17) - Math.abs(b.size - 17))[0];
      }
      const node = figma.createText();
      node.fontName = match ? match.font : bodyFace;
      node.characters = String(block.text || "").slice(0, 800);
      if (match && match.styleId) node.textStyleId = match.styleId;
      else node.fontSize = match ? match.size : (block.role === "Display" ? 40 : 16);
      node.fills = [{ type: "SOLID", color: light ? rgb("#1A1A1A") : rgb("#F7F6F4") }];
      node.layoutAlign = "STRETCH";
      frame.appendChild(node);
    }
    root.appendChild(frame);
    components += 1;
  }

  if ((kit.spaces || []).length) {
    root.appendChild(await kicker("Space"));
    const line = row();
    for (const space of kit.spaces) {
      const component = figma.createComponent();
      component.name = (kit.brand || "Kete") + "/Space/" + space.name;
      component.layoutMode = "VERTICAL";
      component.primaryAxisSizingMode = "AUTO";
      component.counterAxisSizingMode = "AUTO";
      component.itemSpacing = 8;
      component.paddingTop = 12;
      component.paddingBottom = 12;
      component.paddingLeft = 12;
      component.paddingRight = 12;
      component.cornerRadius = 8;
      component.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
      const bar = figma.createRectangle();
      const amount = Math.max(8, Math.min(Number(space.value) || 8, 240));
      bar.resize(amount, 8);
      bar.cornerRadius = 4;
      bar.fills = [{ type: "SOLID", color: rgb("#1A1A1A") }];
      component.appendChild(bar);
      const meta = figma.createText();
      meta.fontName = bodyFace;
      meta.characters = space.name + "  " + space.value + (space.unit || "px");
      meta.fontSize = 12;
      component.appendChild(meta);
      line.appendChild(component);
      components += 1;
    }
    root.appendChild(line);
  }

  async function textBlock(name, title, body) {
    const component = figma.createComponent();
    component.name = (kit.brand || "Kete") + "/" + name;
    component.layoutMode = "VERTICAL";
    component.primaryAxisSizingMode = "AUTO";
    component.counterAxisSizingMode = "FIXED";
    component.resize(420, 80);
    component.itemSpacing = 6;
    component.paddingTop = 16;
    component.paddingBottom = 16;
    component.paddingLeft = 16;
    component.paddingRight = 16;
    component.cornerRadius = 8;
    component.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    const heading = figma.createText();
    heading.fontName = labelFace;
    heading.characters = title || name;
    heading.fontSize = 15;
    heading.layoutAlign = "STRETCH";
    component.appendChild(heading);
    if (body) {
      const copy = figma.createText();
      copy.fontName = bodyFace;
      copy.characters = body.slice(0, 800);
      copy.fontSize = 14;
      copy.layoutAlign = "STRETCH";
      component.appendChild(copy);
    }
    return component;
  }

  if ((kit.principles || []).length || (kit.content || []).length) {
    root.appendChild(await kicker("Writing"));
    const line = row();
    for (const principle of kit.principles || []) {
      line.appendChild(await textBlock("Principle/" + principle.title, principle.title, principle.body));
      components += 1;
    }
    for (const piece of kit.content || []) {
      line.appendChild(await textBlock("Content/" + (piece.title || piece.kind || "Writing"), piece.title || piece.kind, piece.body));
      components += 1;
    }
    root.appendChild(line);
  }

  if ((kit.images || []).some((image) => image.bytes)) {
    root.appendChild(await kicker("Image"));
    const line = row();
    for (const image of kit.images || []) {
      if (!image.bytes) continue;
      try {
        const component = figma.createComponent();
        component.name = (kit.brand || "Kete") + "/Image/" + (image.name || "Image");
        component.resize(240, 180);
        component.clipsContent = true;
        component.cornerRadius = 8;
        const fill = figma.createRectangle();
        fill.resize(240, 180);
        const created = figma.createImage(new Uint8Array(image.bytes));
        fill.fills = [{ type: "IMAGE", imageHash: created.hash, scaleMode: "FILL" }];
        component.appendChild(fill);
        line.appendChild(component);
        components += 1;
      } catch (error) { /* a picture the file cannot place */ }
    }
    root.appendChild(line);
  }

  figma.viewport.scrollAndZoomIntoView([root]);
  let note = "Kete · " + paints + " paint styles, " + texts + " text styles, " + components + " components";
  if (substituted.length) {
    note += ". " + substituted.join(", ") + (kit.fontChoice === "install"
      ? " is in Fonts. Quit Figma and open it again to use it."
      : " was not on this Mac, so Inter was used.");
  } else if (kit.fontNote) {
    note += ". " + kit.fontNote;
  }
  figma.notify(note);
  figma.closePlugin();
}

figma.showUI(__html__, { width: 340, height: 230, themeColors: true });
figma.ui.onmessage = async (message) => {
  if (!message) return;
  try {
    if (message.type === "import") await build(message.kit || {});
    else if (message.type === "fonts" && pendingKit) {
      pendingKit.fontChoice = message.choice || "skip";
      pendingKit.fontNote = message.note || "";
      await build(pendingKit);
    }
  } catch (error) {
    figma.notify(String(error && error.message ? error.message : error));
    figma.closePlugin();
  }
};
