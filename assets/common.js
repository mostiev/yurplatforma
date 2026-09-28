/*
 * Общие куски текста документов: шапка, подпись, способы возврата денег, приложения.
 * Используется в content/*.js начиная с Д-09.
 */
(function (global) {
  "use strict";
  const { U } = global.Engine;
  const F = U.F;

  const LAW_ZOZPP = "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей», далее — Закон";

  const C = {
    LAW_ZOZPP,
    // шапка: to = {name, inn, address, email}, from = {name, address, phone, email}
    header(to, from, P) {
      P.push({ text: `Кому: ${F(to.name, to.nameLabel || "адресат")}` + (to.inn ? `\nИНН ${to.inn}` : "") + `\nАдрес: ${F(to.address, "адрес")}` + (to.email ? `\nE-mail: ${to.email}` : "") + (to.copy ? `\nКопия: ${to.copy}` : ""), align: "left", leftIndent: 4500, after: 120 });
      P.push({ text: `От: ${F(from.name, "ваши ФИО")}\nАдрес: ${F(from.address, "ваш адрес")}\nТел.: ${F(from.phone, "телефон")}` + (from.email ? `, e-mail: ${from.email}` : ""), align: "left", leftIndent: 4500, after: 360 });
    },
    title(P, word, subtitle) {
      P.push({ text: word, align: "center", bold: true, after: 0 });
      P.push({ text: subtitle, align: "center", after: 240 });
    },
    refundText(method) {
      return { card: "на банковскую карту, с которой производилась оплата", cash: "наличными денежными средствами", same: "тем же способом, которым производилась оплата", requisites: "по реквизитам: ______________________________" }[method] || F(null, "куда вернуть деньги");
    },
    refundQuestion(show) {
      return { id: "refund_method", type: "choice", label: "Куда вернуть деньги?", show, options: [
        { value: "card", label: "На карту, с которой платил(а)" },
        { value: "cash", label: "Наличными" },
        { value: "requisites", label: "По реквизитам", hint: "Оставим пустую строку, впишете от руки" },
      ] };
    },
    innQuestion(id, label) {
      return { id, type: "text", label: label || "ИНН", required: false, placeholder: "10 или 12 цифр",
        validate: v => /^\d{10}(\d{2})?$/.test(String(v).trim()) ? null : "ИНН — это 10 или 12 цифр" };
    },
    personQuestions() {
      return [
        { id: "buyer_name", type: "text", label: "Ваши фамилия, имя и отчество", autocomplete: "name" },
        { id: "buyer_address", type: "text", label: "Ваш адрес для ответа", autocomplete: "street-address" },
        { id: "buyer_phone", type: "tel", label: "Телефон", autocomplete: "tel" },
        { id: "buyer_email", type: "email", label: "Электронная почта", required: false, autocomplete: "email" },
      ];
    },
    from(a) { return { name: a.buyer_name, address: a.buyer_address, phone: a.buyer_phone, email: a.buyer_email }; },
    attachments(P, list) {
      if (list.length) P.push({ text: "Приложения:\n" + list.map((x, i) => `${i + 1}. ${x}`).join("\n"), align: "left", before: 120 });
    },
    sign(P, a) {
      P.push({ text: `«___» ____________ 20__ г.            ____________ / ${F(U.shortName(a.buyer_name), "И. О. Фамилия")}`, align: "left", before: 360 });
    },
    courtThreat(kind) {
      const extra = {
        penalty3: "неустойку в размере 3% цены работы (услуги) за каждый день просрочки (п. 5 ст. 28 Закона), ",
        interest: "проценты за пользование чужими денежными средствами (ст. 395 ГК РФ), ",
        none: "",
      }[kind || "none"];
      return `В случае неудовлетворения требования в установленный срок я буду вынужден(а) обратиться в суд и потребую также взыскать ${extra}компенсацию морального вреда (ст. 15 Закона) и штраф в размере 50% от присуждённой суммы (п. 6 ст. 13 Закона).`;
    },
    guideSend: { title: "Вручите претензию под подпись или отправьте ценным письмом с описью вложения.", text: "На вашем экземпляре должны быть дата, подпись и должность сотрудника. Сохраните квитанцию и трек-номер." },
    guideCourt: { title: "Не выполнили в срок.", text: "Жалоба в Роспотребнадзор и иск в суд по месту вашего жительства; госпошлину потребитель не платит при цене иска до 1 млн ₽." },
  };

  global.Common = C;
})(typeof window !== "undefined" ? window : globalThis);
