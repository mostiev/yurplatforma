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
  // «Нашли ошибку?» — контакт для обратной связи (почта или ссылка на Telegram). Пусто — кнопка не показывается
  var FEEDBACK = "";
  var footEl = document.querySelector("footer.site");
  if (FEEDBACK && footEl) {
    var href = FEEDBACK.indexOf("@") > 0 && FEEDBACK.indexOf("/") < 0 ? "mailto:" + FEEDBACK + "?subject=" + encodeURIComponent("Ошибка: " + spec.code + " " + spec.title) : FEEDBACK;
    var a = document.createElement("a"); a.href = href; a.textContent = "Нашли ошибку или неточность? Напишите нам"; a.className = "feedback";
    if (href.indexOf("http") === 0) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    footEl.appendChild(document.createElement("br")); footEl.appendChild(a);
  }
  // честно говорим, что уходит в сервис подсказок, если он подключён
  var foot = document.querySelector("footer.site");
  if (!calcId && foot && window.Suggest && window.Suggest.token) foot.appendChild(document.createTextNode(" Исключение — подсказки адресов, судов, банков и организаций: текст этих полей (и ИНН организации) уходит в сервис DaData, чтобы показать варианты. ФИО, паспорт и ИНН граждан не отправляются. Подсказки можно выключить в выпадающем списке."));
})();
