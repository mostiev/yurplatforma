// Создаёт страницу документа или калькулятора (id вида k1): node tools/make-page.js d02 "Заголовок для поисковиков" "Описание для поисковиков"
const fs = require("fs");
const path = require("path");
const [id, title, description] = process.argv.slice(2);
if (!id || !title || !description) { console.error('Использование: node tools/make-page.js d02 "Title" "Description"'); process.exit(1); }
const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const calc = /^k\d+$/.test(id);
// версия файлов: меняется при обновлении, чтобы браузер не брал старые скрипты из кэша (node tools/bump.js)
const V = fs.readFileSync(path.join(__dirname, "version.txt"), "utf8").trim();
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">
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
${calc ? `<script src="../assets/calc.js?v=${V}"></script>\n` : ""}<script src="../content/${id}.js?v=${V}"></script>
<script src="../assets/page.js?v=${V}"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "..", "d", id + ".html"), html);
console.log("d/" + id + ".html");
