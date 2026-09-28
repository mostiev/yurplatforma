// Общий запуск страницы документа: <body data-doc="d01">
(function () {
  var id = document.body.getAttribute("data-doc");
  var spec = window.DOCS && window.DOCS[id];
  var head = document.getElementById("head");
  if (!spec) { head.innerHTML = "<h1>Документ не найден</h1>"; return; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  head.innerHTML = '<div class="code">' + esc(spec.code) + '</div><h1>' + esc(spec.title) + '</h1><p>' + esc(spec.lead) + '</p>' +
    (spec.status === "draft" ? '<div class="draft">Черновик: документ ещё не проверен юристом</div>' : "");
  Engine.mount(document.getElementById("app"), spec);
})();
