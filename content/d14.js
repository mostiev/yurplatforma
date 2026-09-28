/*
 * Д-14. Претензия о возврате залога (обеспечительного платежа) за квартиру.
 * Основа: п. 2 ст. 381.1 ГК РФ (возврат при прекращении обеспеченного обязательства), п. 2 ст. 314 (7 дней, если срок
 * не установлен), ст. 395 (проценты), ст. 1102 ГК (неосновательное обогащение). Наймодатель — физлицо, ЗоЗПП не применяем.
 * Статус: ЧЕРНОВИК, не проверен юристом.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const C = global.Common;
  const F = U.F;

  function derive(a) {
    const deposit = typeof a.deposit === "number" ? a.deposit : null;
    const agreed = a.deductions === "agreed" && typeof a.agreed_sum === "number" ? a.agreed_sum : 0;
    const claim = deposit != null ? Math.max(0, Math.round((deposit - agreed) * 100) / 100) : null;
    const moved = U.date(a.moved_date);
    return { deposit, agreed, claim, moved };
  }

  const spec = {
    id: "d14",
    code: "Д-14",
    title: "Претензия о возврате залога за квартиру",
    lead: "Съехали, а собственник не возвращает залог или удерживает его без оснований. Займёт около 5 минут.",
    status: "draft",

    steps: [
      {
        id: "deal", title: "Договор и выезд",
        questions: [
          { id: "contract_date", type: "date", label: "Дата договора найма" },
          { id: "address", type: "text", label: "Адрес квартиры" },
          { id: "deposit", type: "money", label: "Сколько был залог?", suffix: "₽", min: 1 },
          { id: "deposit_proof", type: "choice", label: "Чем подтверждается, что вы внесли залог?", options: [
            { value: "contract", label: "Указан в договоре" },
            { value: "receipt", label: "Расписка собственника" },
            { value: "transfer", label: "Банковский перевод" },
            { value: "none", label: "Ничем", hint: "Тогда пригодится переписка, где собственник упоминает залог" },
          ] },
          { id: "moved_date", type: "date", label: "Когда вы съехали и вернули ключи?" },
          { id: "act", type: "choice", label: "При выезде подписали акт возврата?", options: [
            { value: "clean", label: "Да, без претензий к состоянию" },
            { value: "claims", label: "Да, но с претензиями собственника" },
            { value: "no", label: "Нет" },
          ] },
          { id: "notice", type: "choice", label: "Вы предупредили собственника о выезде заранее?", hint: "Как требует договор или закон — обычно за 3 месяца, если договор не устанавливает иное", options: [
            { value: "yes", label: "Да, как требует договор" },
            { value: "term_end", label: "Договор закончился по сроку" },
            { value: "no", label: "Нет или позже положенного" },
          ] },
        ],
      },
      {
        id: "dispute", title: "Удержания",
        questions: [
          { id: "deductions", type: "choice", label: "Собственник что-то удерживает?", options: [
            { value: "all", label: "Не возвращает ничего" },
            { value: "claims", label: "Удерживает часть, с чем я не согласен(на)" },
            { value: "agreed", label: "Удерживает часть, с этой частью я согласен(на)" },
          ] },
          { id: "landlord_reason", type: "text", label: "Чем собственник объясняет удержание?", required: false, placeholder: "«Нужна покраска стен» / не объясняет", show: a => a.deductions !== "agreed" },
          { id: "my_position", type: "textarea", label: "Почему вы не согласны?", placeholder: "Стены выгорели от солнца — это обычный износ; повреждений в акте нет", show: a => a.deductions === "claims" || (a.deductions === "all" && !!a.landlord_reason) },
          { id: "agreed_sum", type: "money", label: "Какую сумму вы согласны оставить?", suffix: "₽", min: 0, show: a => a.deductions === "agreed",
            validate: (v, a) => a.deposit != null && v >= a.deposit ? "Меньше суммы залога" : null },
          { id: "agreed_reason", type: "text", label: "За что?", placeholder: "Разбитая чашка из сервиза", show: a => a.deductions === "agreed" },
          { id: "contract_days", type: "number", label: "В договоре указан срок возврата залога? Сколько дней", hint: "Оставьте пустым, если не указан", suffix: "дн.", min: 1, required: false },
          C.refundQuestion(),
        ],
      },
      {
        id: "parties", title: "Стороны",
        questions: [
          { id: "ll_name", type: "text", label: "ФИО собственника" },
          { id: "ll_address", type: "text", label: "Адрес собственника для писем", hint: "Из договора; если нет — адрес квартиры" },
          ...C.personQuestions(),
        ],
      },
    ],

    derive,

    render(a, d) {
      const P = [];
      C.header({ name: a.ll_name, nameLabel: "собственник", address: a.ll_address }, C.from(a), P);
      C.title(P, "ПРЕТЕНЗИЯ", "о возврате обеспечительного платежа (залога)");
      const proof = { contract: "что предусмотрено договором", receipt: "что подтверждается вашей распиской", transfer: "что подтверждается банковским переводом", none: "что подтверждается нашей перепиской" }[a.deposit_proof] || F(null, "чем подтверждается");
      P.push({ text: `${F(U.fmtDate(U.date(a.contract_date)), "дата договора")} между нами заключён договор найма жилого помещения по адресу: ${F(a.address, "адрес")}. При заключении договора я внёс(ла) обеспечительный платёж (залог) в размере ${F(U.money(d.deposit), "сумма")} руб., ${proof}.`, indent: true });
      const ending = { term_end: " по окончании срока его действия", yes: " с соблюдением порядка, установленного договором" }[a.notice] || "";
      const actText = a.act === "clean" ? " по акту без претензий к состоянию помещения и имущества" : a.act === "claims" ? " по акту" : "";
      P.push({ text: `${F(U.fmtDate(d.moved), "дата выезда")} договор прекращён${ending}, помещение и ключи возвращены вам${actText}.`, indent: true });

      P.push({ text: "В соответствии с п. 2 ст. 381.1 Гражданского кодекса РФ, при прекращении обеспеченного обязательства обеспечительный платёж подлежит возврату. Удержание из него возможно только в счёт реально возникших и подтверждённых обязательств нанимателя; обычный износ помещения и имущества основанием для удержания не является.", indent: true });
      if (a.deductions === "all" && !a.landlord_reason) P.push({ text: "До настоящего времени залог не возвращён, основания удержания мне не сообщены.", indent: true });
      if (a.landlord_reason && a.deductions !== "agreed") P.push({ text: `Вы ссылаетесь на следующее: ${a.landlord_reason}. С этим я не согласен(на): ${F(a.my_position, "ваша позиция")}. Документов, подтверждающих размер ущерба (актов, смет, чеков), вы не представили.`, indent: true });
      if (a.deductions === "agreed") P.push({ text: `Я согласен(на) с удержанием ${U.money(d.agreed)} руб. (${F(a.agreed_reason, "за что")}). Оставшаяся сумма удерживается вами без оснований.`, indent: true });
      P.push({ text: "Денежные средства, удерживаемые без законных оснований, являются неосновательным обогащением и подлежат возврату (ст. 1102 ГК РФ).", indent: true });

      const term = typeof a.contract_days === "number" ? `в течение ${a.contract_days} дней, как предусмотрено договором` : "в течение 7 дней со дня получения настоящей претензии (п. 2 ст. 314 ГК РФ)";
      P.push({ text: "ТРЕБУЮ:", indent: true, keepNext: true });
      P.push({ text: `вернуть мне обеспечительный платёж в размере ${F(U.money(d.claim), "сумма")} руб. ${C.refundText(a.refund_method)} ${term}.`, indent: true });
      P.push({ text: "В противном случае я обращусь в суд с иском о взыскании указанной суммы, процентов за пользование чужими денежными средствами (ст. 395 ГК РФ) и судебных расходов.", indent: true });

      const att = [];
      if (a.deposit_proof === "contract") att.push("Копия договора найма.");
      if (a.deposit_proof === "receipt") att.push("Копия расписки о получении залога.");
      if (a.deposit_proof === "transfer") att.push("Копия документа о переводе залога.");
      if (a.act !== "no") att.push("Копия акта возврата помещения.");
      C.attachments(P, att);
      C.sign(P, a);
      return P;
    },

    guidance(a, d) {
      const g = [
        { title: "Отправьте претензию так, чтобы было подтверждение.", text: "Ценным письмом с описью на адрес собственника и дублем в мессенджер. Сохраните квитанцию." },
        { title: "Соберите доказательства состояния квартиры.", text: "Акт приёма при заселении, фото и видео при выезде. Если акта не было, подойдут фото с датой и переписка." },
      ];
      if (a.notice === "no") g.push({ title: "Если вы съехали без положенного предупреждения, собственник может требовать плату за период предупреждения.", text: "Посмотрите, что сказано в договоре. Это не значит, что залог пропадает целиком — удержание должно быть обоснованным." });
      g.push({ title: "Не вернули — иск в суд.", text: "Небольшие суммы рассматривает мировой судья. Госпошлину придётся заплатить, но если вы выиграете, суд взыщет её с собственника." });
      return g;
    },

    fileName(a) { return "Претензия о возврате залога" + (a.buyer_name ? " — " + U.shortName(a.buyer_name) : ""); },
  };

  global.DOCS = global.DOCS || {};
  global.DOCS.d14 = spec;
})(typeof window !== "undefined" ? window : globalThis);
