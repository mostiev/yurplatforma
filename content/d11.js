/*
 * Д-11. Платные медицинские и стоматологические услуги: отказ до оказания и недостатки качества.
 * Основа: ст. 29, 31, 32 Закона РФ № 2300-1; ст. 84 Федерального закона от 21.11.2011 № 323-ФЗ (к платным медуслугам
 * применяется законодательство о защите прав потребителей); ч. 5 ст. 22 323-ФЗ (копии медицинских документов);
 * Правила предоставления платных медицинских услуг, утв. ПП РФ от 11.05.2023 № 736 (пункты не цитируем — не сверены).
 * Вред здоровью — вне документа: только юрист.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  function derive(a) {
    const paid = typeof a.paid === "number" ? a.paid : null;
    const rendered = typeof a.rendered === "number" ? a.rendered : 0;
    const refundRefuse = paid != null ? Math.max(0, Math.round((paid - rendered) * 100) / 100) : null;
    const refundOk = a.essential === "yes" || a.fix_failed === "yes";
    return { paid, rendered, refundRefuse, refundOk };
  }

  const spec = {
    id: "d11",
    code: "Д-11",
    title: "Претензия в платную клинику или стоматологию",
    lead: "Передумали лечиться и хотите вернуть деньги за неоказанные услуги, или лечение сделали некачественно — пломба выпала, коронка не держится. Займёт около 7 минут.",
    status: "draft",
    actual: "30.10.2026",

    steps: [
      {
        id: "what", title: "Ситуация",
        questions: [
          { id: "situation", type: "choice", label: "Что случилось?", options: [
            { value: "refuse", label: "Отказываюсь от лечения — верните деньги за то, что не сделано", hint: "Например, оплатили курс процедур или план лечения целиком" },
            { value: "quality", label: "Услугу оказали некачественно" },
            { value: "harm", label: "После лечения серьёзно ухудшилось здоровье" },
          ] },
          { id: "rendered", type: "money", label: "Сколько стоят услуги, которые уже успели оказать?", hint: "По прейскуранту клиники. Если ничего не оказали — 0", suffix: "₽", min: 0, show: a => a.situation === "refuse" },
          { id: "defect", type: "textarea", label: "Что не так?", placeholder: "Через две недели после установки выпала пломба на зубе 36, боль при накусывании", show: a => a.situation === "quality" },
          { id: "fix_failed", type: "choice", label: "Вы уже просили исправить, а клиника не исправила?", show: a => a.situation === "quality",
            options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет, обращаюсь впервые" }] },
          { id: "essential", type: "choice", label: "Недостаток серьёзный?", hint: "Нельзя исправить, исправление слишком дорогое или долгое, либо проблема вернулась после исправления", show: a => a.situation === "quality",
            options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не уверен(а)" }] },
          { id: "demand", type: "choice", label: "Чего вы хотите?", show: a => a.situation === "quality", options: [
            { value: "fix", label: "Бесплатно исправить или переделать" },
            { value: "price_cut", label: "Уменьшить цену" },
            { value: "costs", label: "Возместить расходы на исправление в другой клинике" },
            { value: "refund", label: "Вернуть деньги за эту услугу", disabled: (a, d) => d.refundOk ? null : "Можно, если недостаток серьёзный или клиника уже не исправила" },
          ] },
          { id: "fix_days", type: "number", label: "За сколько дней исправить?", suffix: "дн.", min: 1, show: a => a.demand === "fix" && a.situation === "quality" },
          { id: "amount", type: "money", label: "На сколько уменьшить цену?", suffix: "₽", min: 1, show: a => a.demand === "price_cut" && a.situation === "quality" },
          { id: "amount", type: "money", label: "Сколько заплатили другой клинике?", suffix: "₽", min: 1, show: a => a.demand === "costs" && a.situation === "quality" },
          { id: "want_docs", type: "choice", label: "Запросить копии медицинской карты и документов?", hint: "Они пригодятся, если дойдёт до спора или экспертизы", options: [{ value: "yes", label: "Да" }, { value: "no", label: "Нет" }] },
        ],
      },
      {
        id: "service", title: "Услуга",
        questions: [
          { id: "service_desc", type: "text", label: "Какие услуги?", placeholder: "Лечение кариеса зуба 36, установка пломбы" },
          { id: "contract_no", type: "text", label: "Номер договора", required: false },
          { id: "contract_date", type: "date", label: "Дата договора или первого приёма" },
          { id: "paid", type: "money", label: "Сколько вы заплатили?", suffix: "₽", min: 1,
            validate: (v, a) => typeof a.rendered === "number" && a.rendered > v ? "Меньше, чем стоимость оказанных услуг" : null },
          { id: "patient", type: "text", label: "ФИО пациента, если это не вы", required: false, hint: "Например, если лечили ребёнка" },
          C.refundQuestion(a => a.situation === "refuse" || (a.situation === "quality" && ["price_cut", "costs", "refund"].includes(a.demand))),
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "org_name", type: "text", label: "Клиника", hint: "Юридическое название — в договоре или на сайте клиники", placeholder: "ООО «Дента-Люкс»" },
          C.innQuestion("org_inn"),
          { id: "org_address", type: "text", label: "Адрес клиники" },
          ...C.personQuestions(),
        ],
      },
    ],

    derive,

    stop(a) {
      if (a.situation === "harm") return { title: "При вреде здоровью нужен юрист", text: "Такие споры требуют медицинской экспертизы и расчёта компенсации, шаблоном тут можно навредить. Сохраните все документы, выписки и чеки и обратитесь к юристу. Копии медицинских документов клиника обязана выдать по вашему запросу." };
      return null;
    },

    render(a, d) {
      const refund = C.refundText(a.refund_method);
      const P = [];
      C.header({ name: a.org_name, nameLabel: "клиника", inn: a.org_inn, address: a.org_address }, C.from(a), P);
      C.title(P, a.situation === "refuse" ? "ЗАЯВЛЕНИЕ" : "ПРЕТЕНЗИЯ", a.situation === "refuse" ? "об отказе от исполнения договора и возврате денежных средств" : "о недостатках оказанной медицинской услуги");

      P.push({ text: `${F(U.fmtDate(U.date(a.contract_date)), "дата")} ${a.contract_no ? `между мной и вами заключён договор № ${a.contract_no}` : "между мной и вами заключён договор"} на оказание платных медицинских услуг: ${F(a.service_desc, "услуги")}` + (a.patient ? `; пациент — ${a.patient}` : "") + `. Мной оплачено ${F(U.money(a.paid), "сумма")} руб. К отношениям сторон применяется законодательство о защите прав потребителей (ст. 84 Федерального закона от 21.11.2011 № 323-ФЗ «Об основах охраны здоровья граждан в Российской Федерации»).`, indent: true });

      if (a.situation === "refuse") {
        P.push({ text: `На основании ст. 32 ${C.LAW_ZOZPP}, и п. 1 ст. 782 ГК РФ, отказываюсь от исполнения договора в части услуг, которые ещё не оказаны.` + (d.rendered > 0 ? ` Стоимость фактически оказанных услуг составляет ${U.money(d.rendered)} руб.` : " Услуги по договору мне не оказывались."), indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: `вернуть денежные средства в размере ${F(U.money(d.refundRefuse), "сумма")} руб. ${refund} в течение 7 дней со дня предъявления настоящего требования (п. 2 ст. 314 ГК РФ). Иные фактически понесённые вами расходы могут быть удержаны только при их документальном подтверждении (ст. 32 Закона).`, indent: true });
      } else if (a.situation === "quality") {
        P.push({ text: `Услуга оказана с недостатками: ${F(a.defect, "недостатки")}.` + (a.fix_failed === "yes" ? " Ранее я просил(а) их устранить, но они не были устранены." : "") + (a.essential === "yes" && a.demand === "refund" ? " Недостатки являются существенными." : ""), indent: true });
        P.push({ text: `На основании ст. 29 ${C.LAW_ZOZPP}, ТРЕБУЮ:`, indent: true, keepNext: true });
        P.push({ text: {
          fix: `безвозмездно устранить недостатки оказанной услуги (повторно оказать услугу) в течение ${F(a.fix_days, "срок")} дней со дня получения претензии (ст. 30 Закона).`,
          price_cut: `уменьшить цену оказанной услуги на ${F(U.money(a.amount), "сумма")} руб. и вернуть эту сумму ${refund} в течение 10 дней (п. 1 ст. 31 Закона).`,
          costs: `возместить расходы на устранение недостатков третьими лицами в сумме ${F(U.money(a.amount), "сумма")} руб. ${refund} в течение 10 дней (п. 1 ст. 31 Закона).`,
          refund: `принять мой отказ от исполнения договора и вернуть уплаченную сумму ${F(U.money(a.paid), "сумма")} руб. ${refund} в течение 10 дней (п. 1 ст. 31 Закона).`,
        }[a.demand] || F(null, "требование"), indent: true });
      }
      if (a.want_docs === "yes") P.push({ text: "Также прошу выдать мне копии медицинских документов (медицинской карты пациента, договора, актов об оказании услуг) в соответствии с ч. 5 ст. 22 Федерального закона № 323-ФЗ.", indent: true });
      P.push({ text: C.courtThreat(a.situation === "quality" ? "penalty3" : "interest"), indent: true });

      const att = ["Копия договора.", "Копия документа об оплате."];
      if (a.situation === "quality" && a.demand === "costs") att.push("Документы об оплате лечения в другой клинике.");
      C.attachments(P, att);
      C.sign(P, a);
      return P;
    },

    guidance(a) {
      const g = [C.guideSend];
      if (a.situation === "quality") g.push({ title: "Сходите на осмотр в другую клинику до исправлений.", text: "Заключение другого врача о том, что сделано не так, — сильное доказательство. Сохраните его и снимки." });
      g.push({ title: "Можно пожаловаться и в контролирующие органы.", text: "По качеству медпомощи — в территориальный орган Росздравнадзора, по нарушению прав потребителя — в Роспотребнадзор." });
      g.push(C.guideCourt);
      return g;
    },

    fileName(a) { return "Претензия в клинику" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d11 = spec;
})(typeof window !== "undefined" ? window : globalThis);
