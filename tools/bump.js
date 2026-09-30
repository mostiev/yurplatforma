// Обновляет версию файлов во всех страницах, чтобы браузер загрузил свежие скрипты и стили, а не старые из кэша.
// Запускать после любых изменений в assets/ или content/: node tools/bump.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const d = new Date();
const V = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
fs.writeFileSync(path.join(__dirname, "version.txt"), V + "\n");
const pages = ["index.html", "chto-delat.html", "proverka.html", ...fs.readdirSync(path.join(root, "d")).filter(f => f.endsWith(".html")).map(f => "d/" + f)];
for (const p of pages) {
  const file = path.join(root, p);
  const html = fs.readFileSync(file, "utf8").replace(/((?:\.\.\/)?(?:assets|content)\/[\w.-]+\.(?:js|css))(\?v=[\w]+)?"/g, `$1?v=${V}"`);
  fs.writeFileSync(file, html);
}
console.log(`версия ${V}, страниц: ${pages.length}`);
