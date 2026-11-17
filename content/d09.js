/*
 * Д-09. Претензия туроператору: отказ от тура, изменение обстоятельств, угроза безопасности, плохой тур.
 * Основа: ст. 9, 10, 14 Федерального закона от 24.11.1996 № 132-ФЗ «Об основах туристской деятельности»;
 * ст. 29, 31, 32 Закона РФ № 2300-1; п. 1 ст. 782 ГК РФ.
 * Ответственность перед туристом по договору о реализации турпродукта несёт туроператор.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  const SITUATIONS = {
    refuse: "Я передумал(а) ехать — хочу отказаться от тура",
    circumstances: "Я не могу поехать по независящим от меня причинам",
    operator_changed: "Туроператор изменил даты, отель или другие условия тура",
    safety: "В стране поездки возникла угроза безопасности",
    bad_trip: "Тур состоялся, но условия были хуже, чем в договоре",
  };
  const CIRCUMSTANCES = {
    illness: "болезнь туриста",
    visa: "отказ в выдаче визы",
    military: "призыв на военную службу по мобилизации или заключение контракта о прохождении военной службы",
    other: "иные обстоятельства, не зависящие от туриста",
  };

  function derive(a) {
    const start = U.date(a.trip_start);
    const today = U.today();
    const started = !!(start && today >= start);
    const price = typeof a.price === "number" ? a.price : null;
    // полный возврат без удержаний: изменение условий туроператором, угроза безопасности
    const full = a.situation === "operator_changed" || a.situation === "safety";
    return { start, today, started, price, full };
  }

  const spec = {
    id: "d09",
    code: "Д-09",
    title: "Претензия туроператору",
    lead: "Отказались от тура, не можете поехать, туроператор поменял условия или отдых оказался хуже обещанного. Займёт около 7 минут.",
    status: "draft",
    actual: "30.10.2026",

    steps: [
      {
        id: "situation", title: "Ситуация",
        questions: [
          { id: "situation", type: "choice", label: "Что случилось?", options: Object.entries(SITUATIONS).map(([value, label]) => ({ value, label })) },
          { id: "circumstance", type: "choice", label: "Какая причина?", show: a => a.situation === "circumstances",
            options: Object.entries(CIRCUMSTANCES).map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) })) },
          { id: "circumstance_desc", type: "text", label: "Коротко опишите причину и чем она подтверждается", placeholder: "Больничный лист № 123 от 10.09.2026", show: a => a.situation === "circumstances" },
          { id: "change_desc", type: "textarea", label: "Что изменил туроператор?", placeholder: "Перенёс вылет с 12 на 15 октября, заменил отель «Солнце» 5* на «Море» 4*", show: a => a.situation === "operator_changed" },
          { id: "safety_desc", type: "text", label: "Что за угроза и кто о ней сообщил?", hint: "Например, рекомендация Ростуризма или МИД не посещать страну", placeholder: "Рекомендация Ростуризма от 20.09.2026 воздержаться от поездок в …", show: a => a.situation === "safety" },
          { id: "bad_desc", type: "textarea", label: "Что было не так?", placeholder: "Вместо отеля 5* с видом на море поселили в 3* без вида; не было трансфера из аэропорта", show: a => a.situation === "bad_trip" },
          { id: "amount", type: "money", label: "На сколько, по-вашему, нужно уменьшить цену?", hint: "Например, разница в стоимости отелей за все ночи", suffix: "₽", min: 1, show: a => a.situation === "bad_trip",
            validate: (v, a) => a.price && v > a.price ? "Не больше цены тура" : null },
          { id: "expenses", type: "money", label: "Были дополнительные расходы?", hint: "Такси вместо трансфера, доплаты и т. п. Оставьте пустым, если нет", suffix: "₽", required: false, show: a => a.situation === "bad_trip" || a.situation === "operator_changed" },
        ],
      },
      {
        id: "tour", title: "Тур",
        questions: [
          { id: "contract_no", type: "text", label: "Номер договора или заявки", required: false },
          { id: "contract_date", type: "date", label: "Дата договора" },
          { id: "destination", type: "text", label: "Куда тур", placeholder: "Турция, Анталья, отель «Солнце» 5*" },
          { id: "trip_start", type: "date", future: true, label: "Дата начала тура" },
          { id: "trip_end", type: "date", future: true, label: "Дата окончания тура", validate: (v, a) => a.trip_start && v < a.trip_start ? "Не раньше начала" : null },
          { id: "price", type: "money", label: "Сколько вы заплатили за тур?", suffix: "₽", min: 1 },
          C.refundQuestion(),
        ],
      },
      {
        id: "parties", title: "Стороны",
        lead: "Отвечает перед вами туроператор — его название есть в договоре и в едином федеральном реестре туроператоров на сайте Ростуризма. Копию претензии отправим и турагенту.",
        questions: [
          { id: "operator_name", type: "text", label: "Туроператор", placeholder: "ООО «Турцентр»" },
          C.innQuestion("operator_inn", "ИНН туроператора"),
          { id: "operator_address", type: "text", label: "Адрес туроператора" },
          { id: "agent_name", type: "text", label: "Турагент (агентство, где покупали)", required: false, placeholder: "ООО «Горящие туры»" },
          ...C.personQuestions(),
        ],
      },
    ],

    derive,

    stop(a, d) {
      if (d.started && ["refuse", "circumstances"].includes(a.situation)) return { title: "Тур уже начался", text: "Отказ от тура после его начала — сложная ситуация, возврат зависит от того, какие услуги уже оказаны. Покажите её юристу." };
      return null;
    },

    render(a, d) {
      const law132 = "Федерального закона от 24.11.1996 № 132-ФЗ «Об основах туристской деятельности в Российской Федерации», далее — Закон о туризме";
      const P = [];
      C.header({ name: a.operator_name, nameLabel: "туроператор", inn: a.operator_inn, address: a.operator_address, copy: a.agent_name ? `${a.agent_name} (турагент)` : "" }, C.from(a), P);
      C.title(P, a.situation === "bad_trip" ? "ПРЕТЕНЗИЯ" : "ЗАЯВЛЕНИЕ", a.situation === "bad_trip" ? "о недостатках туристского продукта" : "о расторжении договора о реализации туристского продукта и возврате денежных средств");

      P.push({ text: `${F(U.fmtDate(U.date(a.contract_date)), "дата")} ${a.contract_no ? `заключён договор № ${a.contract_no}` : "заключён договор"} о реализации туристского продукта: ${F(a.destination, "направление")}, с ${F(U.fmtDate(d.start), "дата")} по ${F(U.fmtDate(U.date(a.trip_end)), "дата")}` + (a.agent_name ? `, через турагента ${a.agent_name}` : "") + `. Стоимость тура оплачена в размере ${F(U.money(a.price), "сумма")} руб. Туроператором по договору являетесь вы, и в соответствии со ст. 9 ${law132}, вы несёте ответственность за оказание туристу услуг, входящих в туристский продукт.`, indent: true });

      const refund = C.refundText(a.refund_method);
      if (a.situation === "refuse") {
        P.push({ text: `На основании ст. 32 ${C.LAW_ZOZPP}, п. 1 ст. 782 ГК РФ и ст. 10 Закона о туризме, отказываюсь от исполнения договора.`, indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: `вернуть мне уплаченную за тур денежную сумму за вычетом фактически понесённых вами расходов, подтверждённых документально, ${refund} в течение 10 дней со дня получения настоящего заявления, а также предоставить мне расчёт удержанных сумм с копиями подтверждающих документов.`, indent: true });
        P.push({ text: C.courtThreat("interest"), indent: true });
      }
      if (a.situation === "circumstances") {
        P.push({ text: `Совершить поездку я не могу по независящим от меня обстоятельствам: ${CIRCUMSTANCES[a.circumstance] || F(null, "причина")} (${F(a.circumstance_desc, "подтверждение")}). В соответствии со ст. 10 Закона о туризме, невозможность совершения туристом поездки по независящим от него обстоятельствам является существенным изменением обстоятельств, из которых стороны исходили при заключении договора, и основанием для его расторжения.`, indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: `расторгнуть договор и вернуть уплаченную денежную сумму за вычетом фактически понесённых вами расходов, подтверждённых документально, ${refund} в течение 10 дней со дня получения настоящего заявления, а также предоставить расчёт удержанных сумм с копиями подтверждающих документов.`, indent: true });
        P.push({ text: C.courtThreat("interest").replace(/Закона\)/g, "Закона РФ «О защите прав потребителей»)"), indent: true });
      }
      if (a.situation === "operator_changed") {
        P.push({ text: `Вы в одностороннем порядке изменили условия тура: ${F(a.change_desc, "что изменилось")}. Изменение сроков путешествия и ухудшение условий путешествия, указанных в договоре, являются существенным изменением обстоятельств (ст. 10 Закона о туризме). С изменёнными условиями я не согласен(на) и отказываюсь от договора.`, indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: `вернуть уплаченную денежную сумму ${F(U.money(a.price), "сумма")} руб. в полном объёме` + (typeof a.expenses === "number" && a.expenses > 0 ? `, а также возместить убытки в размере ${U.money(a.expenses)} руб.` : "") + ` ${refund} в течение 10 дней со дня получения настоящего заявления. Изменение условий произошло не по моей вине, поэтому оснований для удержаний нет.`, indent: true });
        P.push({ text: C.courtThreat("interest").replace(/Закона\)/g, "Закона РФ «О защите прав потребителей»)"), indent: true });
      }
      if (a.situation === "safety") {
        P.push({ text: `В стране (месте) временного пребывания возникла угроза безопасности жизни и здоровья туристов: ${F(a.safety_desc, "что за угроза")}. В соответствии со ст. 14 Закона о туризме, в этом случае турист вправе потребовать расторжения договора, а туроператор обязан вернуть денежную сумму, равную общей цене туристского продукта.`, indent: true });
        P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
        P.push({ text: `расторгнуть договор и вернуть уплаченную денежную сумму ${F(U.money(a.price), "сумма")} руб. в полном объёме ${refund} в течение 10 дней со дня получения настоящего заявления.`, indent: true });
        P.push({ text: C.courtThreat("interest").replace(/Закона\)/g, "Закона РФ «О защите прав потребителей»)"), indent: true });
      }
      if (a.situation === "bad_trip") {
        P.push({ text: `Во время путешествия услуги были оказаны с недостатками: ${F(a.bad_desc, "что было не так")}. Это не соответствует условиям договора.`, indent: true });
        P.push({ text: `На основании ст. 29 ${C.LAW_ZOZPP}, ТРЕБУЮ:`, indent: true, keepNext: true });
        P.push({ text: `соразмерно уменьшить цену туристского продукта на ${F(U.money(a.amount), "сумма")} руб.` + (typeof a.expenses === "number" && a.expenses > 0 ? ` и возместить убытки в размере ${U.money(a.expenses)} руб.` : "") + ` ${refund} в течение 10 дней со дня предъявления настоящего требования (п. 1 ст. 31 Закона).`, indent: true });
        P.push({ text: C.courtThreat("penalty3"), indent: true });
      }

      const att = ["Копия договора о реализации туристского продукта.", "Копия документа об оплате."];
      if (a.situation === "circumstances") att.push("Копия документа, подтверждающего причину.");
      if (a.situation === "bad_trip") att.push("Фотографии, переписка и другие доказательства недостатков.");
      if ((a.situation === "bad_trip" || a.situation === "operator_changed") && a.expenses > 0) att.push("Документы о дополнительных расходах.");
      C.attachments(P, att);
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Отправьте претензию туроператору, копию — турагенту.", text: "Адрес туроператора — в договоре и в реестре туроператоров на сайте Ростуризма. Лучше ценным письмом с описью и по электронной почте из договора." },
      ];
      if (a.situation === "refuse" || a.situation === "circumstances") g.push({ title: "Туроператор вправе удержать только подтверждённые расходы.", text: "Требуйте расчёт и документы: счета отеля, штрафы авиакомпании. «Штраф за аннуляцию» без документов — не расход." });
      if (a.situation === "safety") g.push({ title: "Сохраните официальное сообщение об угрозе.", text: "Скриншот рекомендации Ростуризма или МИД с датой — главное доказательство." });
      if (a.situation === "bad_trip") g.push({ title: "Подайте претензию как можно скорее после возвращения.", text: "Проверьте, нет ли в договоре срока для претензий. Приложите фото, переписку с гидом или отелем, чеки — всё, что показывает разницу между обещанным и полученным." });
      g.push({ title: "Если туроператор не платит или обанкротился.", text: "Можно получить деньги из фонда персональной ответственности туроператора или по его финансовому обеспечению — это отдельная процедура, тут поможет юрист." });
      g.push(C.guideCourt);
      return g;
    },

    fileName(a) { return "Претензия туроператору" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d09 = spec;
})(typeof window !== "undefined" ? window : globalThis);
