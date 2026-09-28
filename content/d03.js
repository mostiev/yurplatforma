/*
 * Д-03. Возврат денег за онлайн-курс (отказ от договора об оказании услуг).
 * Основа: ст. 32, пп. 3 п. 2 ст. 16 Закона РФ № 2300-1 «О защите прав потребителей»; п. 1 ст. 782, п. 2 ст. 314, ст. 395 ГК РФ.
 * Практика: при отказе по ст. 32 законной неустойки нет — проценты по ст. 395 ГК (п. 10 Обзора ВС РФ от 19.10.2022);
 * срок возврата — по договору, иначе 7 дней (п. 2 ст. 314 ГК).
 * Спорно: считать ли доступ к непройденным урокам оказанной услугой. Определение ВС РФ № 4-КГ24-57-К1
 * в пользу потребителя, но дело было о существенных недостатках услуги, а не о простом отказе. Для юриста.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;

  function derive(a) {
    const total = typeof a.lessons_total === "number" && a.lessons_total > 0 ? a.lessons_total : null;
    const done = typeof a.lessons_done === "number" && a.lessons_done >= 0 ? a.lessons_done : null;
    const price = typeof a.price === "number" ? a.price : null;
    let refund = null, rendered = null;
    if (price != null) {
      if (a.progress === "none") { refund = price; rendered = 0; }
      else if (a.progress === "partial" && total && done != null && done <= total) {
        rendered = Math.round(price * done / total * 100) / 100;
        refund = Math.round((price - rendered) * 100) / 100;
      }
    }
    const paid = U.date(a.paid_date);
    const refundDays = typeof a.contract_days === "number" && a.contract_days > 0 && a.contract_term === "yes" ? a.contract_days : 7;
    return { total, done, price, refund, rendered, paid, refundDays };
  }

  const spec = {
    id: "d03",
    code: "Д-03",
    title: "Возврат денег за онлайн-курс",
    lead: "Вы передумали учиться или курс не понравился — закон позволяет отказаться в любой момент и вернуть деньги за непройденное. Займёт около 5 минут.",
    status: "draft",

    steps: [
      {
        id: "course", title: "Курс",
        questions: [
          { id: "course_name", type: "text", label: "Как называется курс?", placeholder: "«Профессия: Python-разработчик»" },
          { id: "school_name", type: "text", label: "Кто продал курс?", hint: "Юридическое название — ищите в договоре-оферте или внизу сайта школы", placeholder: "ООО «Онлайн-школа»" },
          { id: "school_inn", type: "text", label: "ИНН школы", required: false, placeholder: "10 или 12 цифр",
            validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" },
          { id: "school_address", type: "text", label: "Адрес школы", hint: "Тоже есть в оферте, в разделе «Реквизиты»" },
          { id: "school_email", type: "email", label: "Электронная почта школы для претензий", required: false },
          { id: "paid_date", type: "date", label: "Когда вы оплатили курс?" },
          { id: "price", type: "money", label: "Сколько стоил курс?", hint: "Полная цена по договору, даже если платили частями", suffix: "₽", min: 1 },
          { id: "payment", type: "choice", label: "Как вы платили?", options: [
            { value: "full", label: "Сразу всю сумму" },
            { value: "credit", label: "В кредит или рассрочку через банк", hint: "Деньги школе перечислил банк, а вы платите банку" },
            { value: "installments", label: "Частями напрямую школе" },
          ] },
          { id: "paid_amount", type: "money", label: "Сколько вы уже успели заплатить школе?", suffix: "₽", min: 1, show: a => a.payment === "installments",
            validate: (v, a) => a.price && v > a.price ? "Не больше цены курса" : null },
          { id: "bank_name", type: "text", label: "Какой банк выдал кредит?", placeholder: "АО «Тинькофф Банк»", show: a => a.payment === "credit" },
        ],
      },
      {
        id: "progress", title: "Сколько пройдено",
        lead: "Школа может удержать только фактические расходы. Мы считаем сумму по урокам, которые вы реально прошли: школы часто спорят и считают весь открытый доступ, но это позиция, которую можно оспорить.",
        questions: [
          { id: "progress", type: "choice", label: "Вы успели учиться?", options: [
            { value: "none", label: "Нет, не начинал(а) или посмотрел(а) только вводные материалы" },
            { value: "partial", label: "Да, прошёл(ла) часть курса" },
          ] },
          { id: "lessons_total", type: "number", label: "Сколько всего уроков или модулей в курсе?", hint: "По программе курса", min: 1, show: a => a.progress === "partial" },
          { id: "lessons_done", type: "number", label: "Сколько из них вы реально прошли?", hint: "Считайте то, что смотрели и сдавали, а не то, к чему был открыт доступ", min: 0,
            show: a => a.progress === "partial",
            validate: (v, a) => a.lessons_total && v > a.lessons_total ? "Не больше, чем уроков в курсе" : null },
          { id: "contract_term", type: "choice", label: "В договоре-оферте указан срок возврата денег?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не знаю" },
          ] },
          { id: "contract_days", type: "number", label: "Сколько дней?", suffix: "дн.", min: 1, show: a => a.contract_term === "yes" },
          { id: "refund_rules", type: "choice", label: "В оферте есть условия вроде «деньги не возвращаются после N дней» или штраф за отказ?", options: [
            { value: "yes", label: "Да" }, { value: "no", label: "Нет" }, { value: "unknown", label: "Не знаю" },
          ] },
        ],
      },
      {
        id: "refund", title: "Возврат",
        questions: [
          { id: "refund_method", type: "choice", label: "Куда вернуть деньги?", options: [
            { value: "card", label: "На карту, с которой платил(а)" },
            { value: "loan", label: "На кредитный счёт в банке", hint: "Тогда кредит закроется или уменьшится", disabled: a => a.payment === "credit" ? null : "Только если платили в кредит" },
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
          { id: "buyer_email", type: "email", label: "Электронная почта", hint: "Та, на которую зарегистрирован аккаунт на курсе", autocomplete: "email" },
        ],
      },
    ],

    derive,

    render(a, d) {
      const base = a.payment === "installments" && typeof a.paid_amount === "number" ? a.paid_amount : d.price;
      const refundAmount = d.refund == null ? null : Math.max(0, Math.round((base - (d.rendered || 0)) * 100) / 100);
      const methodText = {
        card: "на банковскую карту, с которой производилась оплата",
        loan: `на счёт по кредитному договору в ${F(a.bank_name, "банк")}, из средств которого был оплачен курс`,
        requisites: "по реквизитам: ______________________________",
      }[a.refund_method] || F(null, "куда вернуть деньги");
      const law = "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон";
      const P = [];

      P.push({ text: `Кому: ${F(a.school_name, "школа")}` + (a.school_inn ? `\nИНН ${a.school_inn}` : "") + `\nАдрес: ${F(a.school_address, "адрес школы")}` + (a.school_email ? `\nE-mail: ${a.school_email}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(a.buyer_name, "ваши ФИО")}\nАдрес: ${F(a.buyer_address, "ваш адрес")}\nТел.: ${F(a.buyer_phone, "телефон")}, e-mail: ${F(a.buyer_email, "почта")}`, align: "left", leftIndent: 4500, after: 360 });

      P.push({ text: "ЗАЯВЛЕНИЕ", align: "center", bold: true, after: 0 });
      P.push({ text: "об отказе от исполнения договора и возврате денежных средств", align: "center", after: 240 });

      const payText = { full: "", credit: ` Оплата произведена за счёт кредитных средств ${F(a.bank_name, "банк")}.`, installments: ` На сегодняшний день мной оплачено ${F(U.money(a.paid_amount), "сколько оплачено")} руб.` }[a.payment] || "";
      P.push({ text: `${F(U.fmtDate(d.paid), "дата оплаты")} между мной и ${F(a.school_name, "школа")} заключён договор об оказании услуг по предоставлению доступа к онлайн-курсу ${F(a.course_name, "курс")} стоимостью ${F(U.money(a.price), "цена")} руб.${payText} Регистрационный e-mail: ${F(a.buyer_email, "почта")}.`, indent: true });

      P.push({ text: `На основании ст. 32 ${law}, и п. 1 ст. 782 Гражданского кодекса РФ, отказываюсь от исполнения договора с даты получения вами настоящего заявления. Прошу прекратить оказание услуг и не начислять какие-либо платежи по договору.`, indent: true });

      if (a.progress === "none") {
        P.push({ text: "Услуги по договору мне фактически не оказывались: к обучению я не приступал(а).", indent: true });
      } else if (a.progress === "partial") {
        P.push({ text: `Из ${F(d.total, "всего уроков")} уроков (модулей) курса мной фактически пройдено ${F(d.done, "пройдено")}. Стоимость фактически оказанных услуг пропорционально составляет ${F(U.money(d.rendered), "сумма")} руб. Сам по себе доступ к урокам, которые я не проходил(а), не свидетельствует о фактическом оказании услуг.`, indent: true });
      }
      P.push({ text: "Удержанию подлежат только фактически понесённые вами расходы, связанные с исполнением обязательств по договору, при условии их документального подтверждения (ст. 32 Закона).", indent: true });
      if (a.refund_rules === "yes") P.push({ text: "Условия договора, устанавливающие ограничения на возврат денежных средств или штрафные санкции за отказ от договора, препятствуют свободной реализации моего права, установленного ст. 32 Закона, являются недопустимыми (пп. 3 п. 2 ст. 16 Закона) и применению не подлежат.", indent: true });

      const term = a.contract_term === "yes" ? `в течение ${d.refundDays} дней со дня получения настоящего заявления, как предусмотрено договором` : "в течение 7 дней со дня предъявления настоящего требования (п. 2 ст. 314 ГК РФ)";
      P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
      P.push({ text: `вернуть мне денежные средства в размере ${F(U.money(refundAmount), "сумма возврата")} руб. ${methodText} ${term}.`, indent: true });
      P.push({ text: "В случае невозврата денежных средств в указанный срок я буду вынужден(а) обратиться в суд и потребую также взыскать проценты за пользование чужими денежными средствами (ст. 395 ГК РФ), компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона), а также направить жалобу в Роспотребнадзор.", indent: true });
      P.push({ text: "Приложения:\n1. Копия документа об оплате." + (a.payment === "credit" ? "\n2. Копия кредитного договора." : ""), align: "left", before: 120 });
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Отправьте заявление двумя способами.", text: "На почту школы для претензий (сохраните письмо) и Почтой России ценным письмом с описью вложения на юридический адрес. Срок пойдёт с того дня, когда школа получит заявление." },
        { title: "Не удаляйте аккаунт и сохраните доказательства.", text: "Скриншоты личного кабинета с прогрессом, чек или выписку, текст оферты на дату покупки (страницу можно сохранить через «Печать → Сохранить как PDF»)." },
      ];
      if (a.payment === "credit") g.push({ title: "Продолжайте платить банку, пока школа не вернёт деньги.", text: "Кредит — отдельный договор. Если перестать платить, пойдут просрочки и испортится кредитная история. Сообщите банку, что отказались от курса, и попросите учесть возврат в счёт досрочного погашения." });
      if (a.payment === "installments") g.push({ title: "Остальные платежи школе больше не нужны.", text: "Вы отказались от договора — дальше платить за курс не обязаны." });
      g.push({ title: "Школа может предложить вернуть меньше.", text: "Удержать можно только подтверждённые документами фактические расходы. Просите расчёт письменно." });
      g.push({ title: "Не вернули в срок.", text: "Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства. Госпошлину потребитель не платит, если цена иска не больше 1 млн ₽." });
      return g;
    },

    fileName(a) { return "Заявление о возврате денег за курс" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d03 = spec;
})(typeof window !== "undefined" ? window : globalThis);
