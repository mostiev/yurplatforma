// node tests/d20.test.js
const assert = require("assert");
const { run, spec, allErrors, t, done, writeDocx } = require("./_load")("d20");
const sp = (p, name) => ({ [p + "_name"]: name, [p + "_birth"]: "1990-01-01", [p + "_place"]: "г. Москва", [p + "_citizen"]: "Российская Федерация", [p + "_address"]: "г. Москва, ул. Ленина, д. 5", [p + "_passport"]: "45 12 345678", [p + "_newname"]: name.split(" ")[0] });
const base = { agree: "yes", kids: "no", pregnant: "no", both_come: "yes", zags: "Хамовнический отдел ЗАГС", marriage_date: "2019-06-15", record: "№ 1234 от 15.06.2019", ...sp("m", "Петров Пётр Петрович"), ...sp("w", "Петрова Анна Ивановна") };

t("совместное заявление: п. 1 ст. 19 СК, ст. 33 143-ФЗ, все сведения о каждом", () => {
  const r = run(base, {});
  assert(r.text.includes("п. 1 ст. 19") && r.text.includes("ст. 33") && r.text.includes("Он:\nфамилия, имя, отчество: Петров Пётр Петрович") && r.text.includes("фамилия после расторжения брака: Петрова"));
  assert.deepEqual(allErrors(r.a), []); assert(!r.text.includes("⟨")); assert(!r.stop);
  writeDocx("d20.docx", r.a, r.d);
});

t("дети или несогласие — стоп, отправляем в суд (Д-21)", () => {
  assert(run(base, { kids: "yes" }).stop.text.includes("Д-21")); assert(run(base, { agree: "no" }).stop);
});

t("подсказки: 5000 с каждого; нотариус, если один не может прийти", () => {
  const g = spec.guidance({ ...base, both_come: "no" }, run(base, {}).d).map(x => x.title + x.text).join(" ");
  assert(g.includes("5000 ₽ с каждого") && g.includes("нотариус"));
});

done();
