// Создаёт страницу документа или калькулятора (id вида k1); вариант документа — с --base=dNN: node tools/make-page.js d02 "Заголовок для поисковиков" "Описание для поисковиков"
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2).filter(x => !x.startsWith("--"));
const [id, title, description] = args;
// --base=d12: вариант документа поверх другого (content/m03.js дополняет content/d12.js)
const base = (process.argv.find(x => x.startsWith("--base=")) || "").slice(7);
if (!id || !title || !description) { console.error('Использование: node tools/make-page.js d02 "Title" "Description"'); process.exit(1); }
const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// калькулятор — если файл регистрирует себя в window.CALCS (k1…k5, m05)
const calc = /global\.CALCS\.\w+\s*=/.test(fs.readFileSync(path.join(__dirname, "..", "content", id + ".js"), "utf8"));
// версия файлов: меняется при обновлении, чтобы браузер не брал старые скрипты из кэша (node tools/bump.js)
const V = fs.readFileSync(path.join(__dirname, "version.txt"), "utf8").trim();
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="../assets/site.css?v=${V}">
</head>
<body data-${calc ? "calc" : "doc"}="${id}">
<div class="wrap">
  <header class="top">
    <a class="logo" href="../index.html">юр<span>платформа</span></a>
    <nav><a href="../index.html">Все документы</a></nav>
  </header>
  <div class="doc-head" id="head"></div>
  <div id="app"></div>
  <footer class="site">${calc ? "Расчёт выполняется в вашем браузере" : "Документ собирается в вашем браузере"}. Мы не получаем и не храним ваши ответы.</footer>
</div>
${calc ? "" : `<script src="../assets/docx.js?v=${V}"></script>\n`}<script src="../assets/engine.js?v=${V}"></script>
<script src="../assets/keyrate.js?v=${V}"></script>
<script src="../assets/calendar.js?v=${V}"></script>
<script src="../assets/common.js?v=${V}"></script>
${calc ? "" : `<script src="../assets/suggest.js?v=${V}"></script>\n`}${calc ? `<script src="../assets/calc.js?v=${V}"></script>\n` : ""}${base ? `<script src="../content/${base}.js?v=${V}"></script>\n` : ""}<script src="../content/${id}.js?v=${V}"></script>
<script src="../assets/pro.js?v=${V}"></script>
<script src="../assets/page.js?v=${V}"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "..", "d", id + ".html"), html);
console.log("d/" + id + ".html");
