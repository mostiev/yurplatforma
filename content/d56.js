/*
 * Д-56. Объяснительная записка работника.
 * Основа: ТК РФ — ч. 1 ст. 193 (до взыскания работодатель обязан затребовать письменное объяснение; если за 2 рабочих
 * дня его нет — составляется акт), ч. 2 (непредоставление объяснения не препятствует взысканию), ч. 3–4 (сроки: месяц со
 * дня обнаружения, 6 месяцев со дня совершения), ч. 5 (одно взыскание за проступок), ч. 6 (ознакомление под роспись за
 * 3 рабочих дня), ч. 7 (обжалование в ГИТ и суд); ст. 192 (замечание, выговор, увольнение); пп. «а» п. 6 ч. 1 ст. 81
 * (прогул — весь день или более 4 часов подряд без уважительных причин). Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const WHAT = {
    late: "опоздание на работу",
    absent: "отсутствие на рабочем месте",
    task: "невыполнение (несвоевременное выполнение) поручения",
    other: null,
  };
  const REASON = {
    ill: "болезнь (моя или близкого родственника)",
    family: "семейные обстоятельства",
    transport: "задержка транспорта или авария на дороге",
    emergency: "аварийная ситуация дома (залив, отключение, взлом)",
    work: "причина на стороне работодателя (не дали доступ, материалы, указания)",
    other: null,
  };

  function derive(a) {
    const when = U.date(a.event_date);
    const req = U.date(a.request_date);
    const minutes = typeof a.late_minutes === "number" ? a.late_minutes : null;
    const hours = typeof a.absent_hours === "number" ? a.absent_hours : null;
    const risky = a.what === "absent" && (a.absent_full === "yes" || (hours != null && hours > 4));
    return { when, req, minutes, hours, risky, deadline: req ? C.addWorkdays(req, 2) : null };
  }

  const spec = {
    id: "d56",
    code: "Д-56",
    title: "Объяснительная записка",
    lead: "Работодатель просит объяснить опоздание, отсутствие или невыполненное поручение. Составим объяснительную, которая защищает вас, а не признаёт вину без нужды. Займёт около 5 минут.",
    status: "draft",

    steps: [
      {
        id: "what", title: "Что случилось",
        questions: [
          { id: "what", type: "choice", label: "Что от вас просят объяснить?", options: Object.entries(WHAT).map(([value, label]) => ({ value, label: label ? label[0].toUpperCase() + label.slice(1) : "Другое" })) },
          { id: "what_other", type: "text", label: "Что именно", show: a => a.what === "other", placeholder: "нарушение порядка оформления отчёта" },
          { id: "event_date", type: "date", label: "Когда это было" },
          { id: "late_minutes", type: "number", label: "На сколько минут опоздали", min: 1, show: a => a.what === "late" },
          { id: "absent_full", type: "choice", label: "Отсутствовали весь рабочий день?", show: a => a.what === "absent", options: [
            { value: "yes", label: "Да, весь день" },
            { value: "no", label: "Нет, часть дня" },
          ] },
          { id: "absent_hours", type: "number", label: "Сколько часов отсутствовали", min: 0.5, step: "0.5", show: a => a.what === "absent" && a.absent_full === "no" },
          { id: "task_desc", type: "text", label: "Какое поручение и какой был срок", show: a => a.what === "task", placeholder: "подготовить квартальный отчёт до 25.09.2026" },
          { id: "request_date", type: "date", label: "Когда у вас потребовали объяснение", hint: "На ответ закон даёт 2 рабочих дня" },
          { id: "reason", type: "choice", label: "Причина", options: Object.entries(REASON).map(([value, label]) => ({ value, label: label ? label[0].toUpperCase() + label.slice(1) : "Другая" })) },
          { id: "reason_text", type: "textarea", label: "Опишите коротко и по фактам", hint: "Что произошло, во сколько, кого вы предупредили. Без эмоций и оценок",
            placeholder: "В 8:10 на станции «Выхино» остановилось движение поездов, о чём было объявление. Я предупредил руководителя по телефону в 8:40 и прибыл на работу в 9:35." },
          { id: "warned", type: "choice", label: "Вы предупредили руководителя?", options: [
            { value: "yes", label: "Да" },
            { value: "no", label: "Нет" },
          ] },
          { id: "warned_how", type: "text", label: "Как и когда предупредили", show: a => a.warned === "yes", placeholder: "звонок руководителю в 8:40, сообщение в рабочем чате" },
          { id: "proof", type: "text", label: "Чем можете подтвердить", required: false, hint: "Больничный, справка, скриншот, чек такси, справка перевозчика", placeholder: "справка ГУП «Московский метрополитен» о задержке движения" },
          { id: "position_on_guilt", type: "choice", label: "Как вы оцениваете ситуацию?", options: [
            { value: "valid", label: "Причина уважительная — вины нет", hint: "Рекомендуем, если есть подтверждение" },
            { value: "partly", label: "Признаю, но прошу учесть обстоятельства", hint: "Если впервые и без последствий" },
          ] },
        ],
      },
      { id: "job", title: "Работа", questions: C.jobQuestions() },
    ],

    derive,

    render(a, d) {
      const P = [];
      const T = t => P.push({ text: t, indent: true });
      C.jobHeader(P, a);
      P.push({ text: "ОБЪЯСНИТЕЛЬНАЯ ЗАПИСКА", align: "center", bold: true, after: 240 });
      const what = a.what === "other" ? F(a.what_other, "что именно") : WHAT[a.what] || F(null, "что случилось");
      let fact = `${F(U.fmtDate(d.when), "дата")} — ${what}`;
      if (a.what === "late" && d.minutes) fact += ` на ${d.minutes} ${C.plural(d.minutes, "минуту", "минуты", "минут")}`;
      if (a.what === "absent") fact += a.absent_full === "yes" ? " в течение рабочего дня" : d.hours ? ` в течение ${String(d.hours).replace(".", ",")} ${Number.isInteger(d.hours) ? C.plural(d.hours, "часа", "часов", "часов") : "часа"}` : "";
      if (a.what === "task") fact += `: ${F(a.task_desc, "поручение и срок")}`;
      T(`${F(U.fmtDate(d.req), "дата")} у меня затребовано письменное объяснение по факту: ${fact}. Даю следующие объяснения.`);
      const reason = a.reason === "other" ? "" : `Причина — ${REASON[a.reason] || F(null, "причина")}. `;
      T(reason + F(a.reason_text ? String(a.reason_text).trim() : null, "что произошло"));
      if (a.warned === "yes") T(`О случившемся я сообщил(а) непосредственному руководителю: ${F(a.warned_how, "как и когда")}.`);
      if (a.proof) T(`Обстоятельства подтверждаются: ${a.proof}. Копию прилагаю.`);
      T(a.position_on_guilt === "valid"
        ? "Считаю, что причина была уважительной, а моя вина в нарушении трудовой дисциплины отсутствует. Прошу не применять ко мне дисциплинарное взыскание."
        : "Признаю допущенное нарушение и прошу учесть обстоятельства, при которых оно произошло, моё предшествующее отношение к работе и то, что нарушение не повлекло негативных последствий, и не применять ко мне дисциплинарное взыскание.");
      if (a.proof) C.attachments(P, [`Копия: ${a.proof}.`]);
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: `Отдайте объяснительную в течение 2 рабочих дней${d.deadline ? ` — до ${U.fmtDate(d.deadline)} включительно` : ""}.`, text: "Сделайте копию и попросите поставить на ней отметку о получении: дату, подпись, должность. Если отказываются — отправьте на рабочую почту руководителю и в отдел кадров." },
        { title: "Можно не писать, но лучше написать.", text: "Без объяснения составят акт, а взыскание всё равно могут применить (ч. 2 ст. 193 ТК). Объяснение — ваш шанс записать свою версию до решения." },
        { title: "Пишите только факты.", text: "Не извиняйтесь лишний раз и не признавайте того, чего не было: объяснительная может стать доказательством в споре." },
        { title: "Если наказали несправедливо — обжалуйте.", text: "Приказ о взыскании должны показать под роспись в течение 3 рабочих дней. Обжаловать можно в трудовой инспекции (Д-26) или в суде. За один проступок — только одно взыскание; срок применения — месяц со дня обнаружения." },
      ];
      if (d.risky) g.unshift({ title: "Отсутствие больше 4 часов подряд без уважительной причины — это прогул.", text: "За прогул могут уволить (пп. «а» п. 6 ч. 1 ст. 81 ТК). Обязательно приложите документы, подтверждающие причину: больничный, справку, переписку." });
      return g;
    },

    reminders(a, d) { return [{ date: d.deadline, title: "Последний день, чтобы сдать объяснительную", text: "2 рабочих дня с момента, когда её затребовали (ст. 193 ТК)." }]; },

    fileName(a) { return "Объяснительная" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d56 = spec;
})(typeof window !== "undefined" ? window : globalThis);
