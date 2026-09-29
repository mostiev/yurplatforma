// Общий запуск страницы документа <body data-doc="d01"> или калькулятора <body data-calc="k1">
(function () {
  var calcId = document.body.getAttribute("data-calc");
  var id = calcId || document.body.getAttribute("data-doc");
  var spec = calcId ? window.CALCS && window.CALCS[id] : window.DOCS && window.DOCS[id];
  var head = document.getElementById("head");
  if (!spec) { head.innerHTML = "<h1>" + (calcId ? "Калькулятор" : "Документ") + " не найден</h1>"; return; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  head.innerHTML = '<div class="code">' + esc(spec.code) + '</div><h1>' + esc(spec.title) + '</h1><p>' + esc(spec.lead) + '</p>' +
    (spec.status === "draft" ? '<div class="draft">Черновик: ' + (calcId ? "расчёт" : "документ") + ' ещё не проверен юристом</div>' : "");
  if (calcId) Calc.mount(document.getElementById("app"), spec);
  else Engine.mount(document.getElementById("app"), spec);
})();
