/*
 * Д-07. Расторжение договора с фитнес-клубом, салоном, секцией — возврат денег за абонемент.
 * Основа: ст. 32, пп. 3 п. 2 ст. 16 Закона РФ № 2300-1 «О защите прав потребителей»; п. 1 ст. 782, п. 2 ст. 314, ст. 395 ГК РФ.
 * Расчёт: срочный абонемент — пропорционально неиспользованному сроку действия (практика: пересчёт по «цене
 * разового занятия» суды не применяют); пакет посещений — по неиспользованным посещениям.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;
  const r2 = x => Math.round(x * 100) / 100;

  function derive(a) {
    const today = U.today();
    const start = U.date(a.start_date), end = U.date(a.end_date);
    const price = typeof a.price === "number" ? a.price : null;
    let refund = null, used = null, calc = "";
    if (price != null) {
      if (a.activated === "no") { refund = price; used = 0; calc = "none"; }
      else if (a.kind === "time" && start && end && end > start) {
        const total = U.daysBetween(start, end);
        const left = Math.max(0, Math.min(total, U.daysBetween(today, end)));
        refund = r2(price * left / total); used = r2(price - refund); calc = "time";
        return { today, start, end, price, refund, used, calc, total, left };
      } else if (a.kind === "visits" && typeof a.visits_total === "number" && a.visits_total > 0 && typeof a.visits_used === "number" && a.visits_used <= a.visits_total) {
        const left = a.visits_total - a.visits_used;
        refund = r2(price * left / a.visits_total); used = r2(price - refund); calc = "visits";
        return { today, start, end, price, refund, used, calc, left };
      }
    }
    return { today, start, end, price, refund, used, calc };
  }

  const spec = {
    id: "d07",
    code: "Д-07",
    title: "Возврат денег за абонемент в фитнес-клуб или салон",
    lead: "Абонемент в зал, бассейн, салон красоты или секцию больше не нужен — закон позволяет отказаться и вернуть деньги за неиспользованное. Займёт около 5 минут.",
    status: "draft",
    actual: "30.10.2026",

    steps: [
      {
        id: "club", title: "Абонемент",
        questions: [
          { id: "place", type: "choice", label: "Куда абонемент?", options: [
            { value: "fitness", label: "Фитнес-клуб, бассейн, спортзал" },
            { value: "beauty", label: "Салон красоты, массаж, СПА" },
            { value: "classes", label: "Секция, танцы, студия, языковые курсы офлайн" },
            { value: "other", label: "Другое" },
          ] },
          { id: "org_name", type: "text", label: "Кто продал абонемент?", hint: "Юридическое название из договора или чека", placeholder: "ООО «Фитнес-Плюс»" },
          { id: "org_inn", type: "text", label: "ИНН", required: false, placeholder: "10 или 12 цифр",
            validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" },
          { id: "org_address", type: "text", label: "Адрес" },
          { id: "contract_no", type: "text", label: "Номер договора или карты клиента", required: false },
          { id: "buy_date", type: "date", label: "Когда купили абонемент?" },
          { id: "price", type: "money", label: "Сколько заплатили?", suffix: "₽", min: 1 },
        ],
      },
      {
        id: "usage", title: "Сколько использовано",
        lead: "Вернуть можно деньги за неиспользованную часть. Суды считают по сроку абонемента, а не по «цене разового занятия», которую клубы любят подставлять.",
        questions: [
          { id: "kind", type: "choice", label: "Какой у вас абонемент?", options: [
            { value: "time", label: "На срок", hint: "Например, на год или на 3 месяца" },
            { value: "visits", label: "На количество посещений", hint: "Например, 10 процедур или 8 занятий" },
          ] },
          { id: "activated", type: "choice", label: "Абонемент уже начал действовать?", options: [
            { value: "yes", label: "Да" },
            { value: "no", label: "Нет, я им ещё не пользовался(ась) и срок не начался" },
          ] },
          { id: "start_date", type: "date", future: true, label: "С какого дня действует абонемент?", show: a => a.kind === "time" && a.activated === "yes" },
          { id: "end_date", type: "date", future: true, label: "До какого дня?", hint: "С учётом заморозок, если они были", show: a => a.kind === "time" && a.activated === "yes",
            validate: (v, a) => a.start_date && v <= a.start_date ? "Позже даты начала" : null },
          { id: "visits_total", type: "number", label: "Сколько посещений в абонементе?", min: 1, show: a => a.kind === "visits" && a.activated === "yes" },
          { id: "visits_used", type: "number", label: "Сколько вы уже использовали?", min: 0, show: a => a.kind === "visits" && a.activated === "yes",
            validate: (v, a) => a.visits_total && v > a.visits_total ? "Не больше, чем в абонементе" : null },
          { id: "bad_rules", type: "choice", label: "В договоре или правилах клуба есть «абонемент не возвращается», штраф за расторжение или пересчёт по разовой цене?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не знаю" },
          ] },
          { id: "contract_term", type: "choice", label: "В договоре указан срок возврата денег?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не знаю" },
          ] },
          { id: "contract_days", type: "number", label: "Сколько дней?", suffix: "дн.", min: 1, show: a => a.contract_term === "yes" },
          { id: "refund_method", type: "choice", label: "Куда вернуть деньги?", options: [
            { value: "card", label: "На карту, с которой платил(а)" },
            { value: "cash", label: "Наличными" },
            { value: "requisites", label: "По реквизитам", hint: "Оставим пустую строку, впишете от руки" },
          ] },
        ],
      },
      {
        id: "parties", title: "Ваши данные",
        questions: [
          { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
          { id: "buyer_address", type: "text", label: "Ваш адрес для ответа", autocomplete: "street-address" },
          { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
          { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (a.kind === "time" && a.activated === "yes" && d.end && d.today >= d.end) return { title: "Срок абонемента уже закончился", text: "Вернуть деньги за неиспользованное время можно, пока абонемент действует. Если клуб не пускал вас на занятия или закрывался — это другая ситуация, нужен юрист." };
      return null;
    },

    render(a, d) {
      const refundText = { card: "на банковскую карту, с которой производилась оплата", cash: "наличными денежными средствами", requisites: "по реквизитам: ______________________________" }[a.refund_method] || F(null, "куда вернуть деньги");
      const law = "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон";
      const P = [];
      P.push({ text: `Кому: ${F(a.org_name, "организация")}` + (a.org_inn ? `\nИНН ${a.org_inn}` : "") + `\nАдрес: ${F(a.org_address, "адрес")}`, align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(a.buyer_name, "ваши ФИО")}\nАдрес: ${F(a.buyer_address, "ваш адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}` + (a.buyer_email ? `, e-mail: ${a.buyer_email}` : ""), align: "left", leftIndent: 4500, after: 360 });
      P.push({ text: "ЗАЯВЛЕНИЕ", align: "center", bold: true, after: 0 });
      P.push({ text: "об отказе от исполнения договора и возврате денежных средств", align: "center", after: 240 });

      const kindText = a.kind === "visits" ? `на ${F(a.visits_total, "количество")} посещений` : a.kind === "time" && a.activated === "yes" ? `со сроком действия с ${F(U.fmtDate(d.start), "дата")} по ${F(U.fmtDate(d.end), "дата")}` : "";
      P.push({ text: `${F(U.fmtDate(U.date(a.buy_date)), "дата покупки")} я приобрёл(а) у вас абонемент ${kindText}`.trim() + (a.contract_no ? ` (договор / карта № ${a.contract_no})` : "") + `, стоимостью ${F(U.money(a.price), "цена")} руб.`, indent: true });
      P.push({ text: `На основании ст. 32 ${law}, и п. 1 ст. 782 Гражданского кодекса РФ, отказываюсь от исполнения договора с даты получения вами настоящего заявления.`, indent: true });

      if (d.calc === "none") P.push({ text: "Абонементом я не пользовался(ась), срок его действия не начался, услуги мне не оказывались.", indent: true });
      if (d.calc === "time") P.push({ text: `Из ${d.total} дней действия абонемента неиспользованными остаются ${d.left} дн. Стоимость неиспользованной части, рассчитанная пропорционально сроку действия абонемента, составляет ${U.money(d.refund)} руб.`, indent: true });
      if (d.calc === "visits") P.push({ text: `Из ${a.visits_total} посещений мной использовано ${a.visits_used}, неиспользованными остаются ${d.left}. Стоимость неиспользованных посещений пропорционально цене абонемента составляет ${U.money(d.refund)} руб.`, indent: true });
      P.push({ text: "Удержанию подлежат только фактически понесённые вами расходы, связанные с исполнением обязательств по договору, при условии их документального подтверждения (ст. 32 Закона).", indent: true });
      if (a.bad_rules === "yes") P.push({ text: "Условия договора и правил, устанавливающие невозвратность абонемента, штрафные санкции за отказ от договора или перерасчёт стоимости использованных услуг по повышенной цене, препятствуют свободной реализации моего права, установленного ст. 32 Закона, являются недопустимыми (пп. 3 п. 2 ст. 16 Закона) и применению не подлежат.", indent: true });

      const term = a.contract_term === "yes" ? `в течение ${F(a.contract_days, "срок")} дней со дня получения настоящего заявления, как предусмотрено договором` : "в течение 7 дней со дня предъявления настоящего требования (п. 2 ст. 314 ГК РФ)";
      P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
      P.push({ text: `вернуть мне денежные средства в размере ${F(U.money(d.refund), "сумма возврата")} руб. ${refundText} ${term}.`, indent: true });
      P.push({ text: "В случае невозврата денежных средств в указанный срок я буду вынужден(а) обратиться в суд и потребую также взыскать проценты за пользование чужими денежными средствами (ст. 395 ГК РФ), компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона).", indent: true });
      P.push({ text: "Приложения:\n1. Копия договора (документа об оплате).", align: "left", before: 120 });
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      return [
        { title: "Отдайте заявление на ресепшен и попросите отметку о принятии.", text: "Дата, подпись, должность. Не принимают — отправьте ценным письмом с описью на юридический адрес." },
        { title: "Сумма считается на сегодняшний день.", text: "Для абонемента на срок важна дата, когда клуб получит заявление: чем раньше, тем больше вернут. Не тяните с отправкой." },
        { title: "Клуб предложит вернуть меньше или «перевести абонемент».", text: "Вы не обязаны соглашаться. Удержать можно только расходы, подтверждённые документами." },
        { title: "Не вернули в срок.", text: "Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства; госпошлину потребитель не платит при цене иска до 1 млн ₽." },
      ];
    },

    fileName(a) { return "Заявление о возврате денег за абонемент" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d07 = spec;
})(typeof window !== "undefined" ? window : globalThis);
