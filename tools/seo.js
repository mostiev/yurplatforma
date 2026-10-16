// Делает страницы видимыми для поисковиков: статический заголовок и описание документа в HTML (без JS),
// блок «О документе» с правовой основой и вопросами анкеты, OpenGraph-теги, список документов на главной,
// robots.txt и sitemap.xml. Повторный запуск заменяет старые вставки (метки <!--seo-->).
// Запуск: node tools/seo.js   (адрес сайта для sitemap — tools/site.json, поле url, без «/» в конце)
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const site = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "site.json"), "utf8")).url || ""; } catch (e) { return ""; } })();
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const put = (html, tag, block, where) => {
  const re = new RegExp(`<!--seo:${tag}-->[\\s\\S]*?<!--/seo:${tag}-->\\n?`, "g");
  html = html.replace(re, "");
  return where(html, `<!--seo:${tag}-->${block}<!--/seo:${tag}-->\n`);
};

// правовая основа — из комментария в начале файла документа
function basis(file) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/^\/\*([\s\S]*?)\*\//);
  if (!m) return "";
  let t = m[1].split("\n").map(l => l.replace(/^\s*\*\s?/, "")).join(" ").replace(/\s+/g, " ").replace(/Статус:.*$/, "");
  const m2 = t.match(/[Оо]снова:\s*/);
  t = m2 ? t.slice(m2.index + m2[0].length) : t.replace(/^[^.]*?\.\s*/, "");
  // предложения-заметки для разработчиков убираем
  t = t.split(/(?<=\.)\s+(?=[А-ЯA-Z])/).filter(x => !/content\/|\.js\b|Спецификаци|Меняя|меняйте|движ|тест|ЧЕРНОВИК|обновлять|При смене|мониторинг|сверен|не цитируем|не нашли|уточнить|юрист/i.test(x)).join(" ");
  // служебные пометки не показываем
  t = t.replace(/\([^()]*(?:сверен|СВЕРИТЬ|юрист|не сверено)[^()]*\)/gi, "")
    .replace(/[^.;]*(?:СВЕРИТЬ|не сверено|вопрос юристу|в сети встречаются)[^.;]*[.;]/gi, "")
    .replace(/\s+([,.;])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return t;
}

function loadSpec(htmlFile) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const id = (html.match(/data-(?:doc|calc)="(\w+)"/) || [])[1];
  if (!id) return null;
  const ctx = { TextEncoder, console, Date, window: null };
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  const srcs = [...html.matchAll(/<script src="\.\.\/((?:assets|content)\/[\w.-]+\.js)/g)].map(m => m[1]).filter(f => !/page\.js|docx\.js/.test(f));
  for (const f of srcs) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  const spec = (ctx.DOCS && ctx.DOCS[id]) || (ctx.CALCS && ctx.CALCS[id]);
  return spec ? { id, spec, calc: !!(ctx.CALCS && ctx.CALCS[id]), file: path.join(root, "content", id + ".js") } : null;
}

const pages = fs.readdirSync(path.join(root, "d")).filter(f => f.endsWith(".html"));

// приватность: никаких запросов к сторонним серверам (Google Fonts убраны), ссылки на соглашение и политику в подвале
for (const rel of ["index.html", "chto-delat.html", "proverka.html", "usloviya.html", "privacy.html", ...pages.map(f => "d/" + f)]) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const up = rel.startsWith("d/") ? "../" : "";
  let html = fs.readFileSync(file, "utf8")
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/g, "")
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n/g, "");
  html = put(html, "legal", `<nav class="legal"><a href="${up}usloviya.html">Условия использования</a> · <a href="${up}privacy.html">Политика конфиденциальности</a></nav>`, (h, b) => h.replace(/<\/footer>/, b + "</footer>"));
  fs.writeFileSync(file, html);
}
const urls = ["index.html", "chto-delat.html", "proverka.html", "usloviya.html", "privacy.html"];
let n = 0;
for (const f of pages) {
  const file = path.join(root, "d", f);
  const info = loadSpec(file);
  if (!info) continue;
  const { spec, calc } = info;
  let html = fs.readFileSync(file, "utf8");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || spec.title;
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || spec.lead;
  // OpenGraph
  const og = `\n<meta property="og:type" content="website">\n<meta property="og:locale" content="ru_RU">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${desc}">` +
    (site ? `\n<meta property="og:url" content="${site}/d/${f}">\n<link rel="canonical" href="${site}/d/${f}">` : "") + "\n";
  html = put(html, "og", og, (h, b) => h.replace(/(<meta name="description"[^>]*>\n)/, `$1${b}`));
  // заголовок без JS (page.js перерисует то же самое)
  const head = `<div class="code">${esc(spec.code)}</div><h1>${esc(spec.title)}</h1><p>${esc(spec.lead || "")}</p>`;
  html = html.replace(/<div class="doc-head" id="head">[\s\S]*?<\/div>\n  <div id="app">/, `<div class="doc-head" id="head">${head}</div>\n  <div id="app">`);
  // «О документе»: вопросы анкеты и правовая основа
  const qs = calc
    ? (spec.fields || []).filter(q => typeof q.label === "string" && q.type !== "heading").map(q => q.label.replace(/[?:]$/, ""))
    : (spec.steps || []).flatMap(s => s.questions).filter(q => typeof q.label === "string").map(q => q.label.replace(/[?:]$/, ""));
  const uniq = [...new Set(qs)].slice(0, 14);
  const law = basis(info.file);
  const about = `\n  <details class="seo-about"><summary>${calc ? "О калькуляторе" : "О документе"}: что спросим и на чём основан</summary>` +
    (uniq.length ? `<p><strong>${calc ? "Что нужно ввести" : "Что спросим"}:</strong> ${esc(uniq.join("; "))}.</p>` : "") +
    (law ? `<p><strong>Правовая основа:</strong> ${esc(law)}</p>` : "") +
    `<p>${calc ? "Расчёт выполняется" : "Документ собирается"} в браузере, ответы никуда не отправляются. ${spec.status === "draft" ? "Черновик: ещё не проверен юристом." : ""}</p></details>\n`;
  html = put(html, "about", about, (h, b) => h.replace(/(  <div id="app"><\/div>\n)/, `$1${b}`));
  fs.writeFileSync(file, html);
  urls.push("d/" + f);
  n++;
}

// главная: статический список документов внутри #sections (скрипт его заменит)
{
  const ctx = { console }; ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "content/catalog.js"), "utf8"), ctx);
  const C = ctx.CATALOG;
  const list = C.sections.map(s => {
    const items = C.items.filter(i => i.section === s.key && i.live);
    return items.length ? `<section class="sec"><h2>${esc(s.name)}</h2><ul>${items.map(i => `<li><a href="d/${i.id}.html">${esc(i.title)}</a></li>`).join("")}</ul></section>` : "";
  }).join("");
  const file = path.join(root, "index.html");
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<main class="sections" id="sections">[\s\S]*?<\/main>/, `<main class="sections" id="sections">${list}</main>`);
  fs.writeFileSync(file, html);
}

// robots.txt и sitemap.xml
fs.writeFileSync(path.join(root, "robots.txt"), "User-agent: *\nAllow: /\n" + (site ? `Sitemap: ${site}/sitemap.xml\n` : ""));
if (site) {
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${site}/${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") + "\n</urlset>\n");
}
console.log(`страниц: ${n}; sitemap: ${site ? "да" : "нет — укажите адрес сайта в tools/site.json"}`);
