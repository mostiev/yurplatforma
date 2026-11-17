// Ключи тарифа «Бизнес». Подпись ECDSA P-256; проверка — в браузере (assets/pro.js), сервер не нужен.
//   node tools/pro-keys.js init                      — создать пару ключей (один раз). Закрытый ключ: tools/keys/private.jwk
//   node tools/pro-keys.js issue "кому" 30           — выпустить ключ на 30 дней (365 — на год); «кому» — почта или имя из чека
//   node tools/pro-keys.js check YP-…                — проверить ключ
// ЗАКРЫТЫЙ КЛЮЧ НИКОМУ НЕ ПЕРЕДАВАЙТЕ И НЕ ВЫКЛАДЫВАЙТЕ: с ним любой выпустит себе тариф. Сделайте копию (например, на флешку):
// если он потеряется, придётся создать новую пару, и старые ключи перестанут работать.
const fs = require("fs");
const path = require("path");
const { subtle } = require("crypto").webcrypto;
const DIR = path.join(__dirname, "keys");
const PRIV = path.join(DIR, "private.jwk");
const PRO = path.join(__dirname, "..", "assets", "pro.js");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const iso = d => d.toISOString().slice(0, 10);

async function init() {
  if (fs.existsSync(PRIV)) { console.error("Ключ уже есть: " + PRIV + ". Чтобы создать новый, удалите его (старые ключи тарифа перестанут работать)."); process.exit(1); }
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = await subtle.exportKey("jwk", kp.privateKey);
  const pub = await subtle.exportKey("jwk", kp.publicKey);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(PRIV, JSON.stringify(priv), { mode: 0o600 });
  const pubShort = { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y };
  let src = fs.readFileSync(PRO, "utf8");
  src = src.replace(/const PUBLIC_JWK = .*; \/\/ pro-keys:public/, `const PUBLIC_JWK = ${JSON.stringify(pubShort)}; // pro-keys:public`);
  fs.writeFileSync(PRO, src);
  console.log("Готово. Закрытый ключ: " + PRIV + " (в git не попадёт). Открытый записан в assets/pro.js. Запустите node tools/bump.js.");
}

async function sign(payload, privJwk) {
  const k = await subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const data = b64u(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, Buffer.from(data, "utf8"));
  return `YP-${data}.${b64u(new Uint8Array(sig))}`;
}

async function issue(who, days) {
  if (!fs.existsSync(PRIV)) { console.error("Сначала: node tools/pro-keys.js init"); process.exit(1); }
  const n = Math.max(1, Math.floor(Number(days) || 30));
  const now = new Date(), exp = new Date(now.getTime() + n * 864e5);
  const key = await sign({ n: String(who || "").slice(0, 60), e: iso(exp), i: iso(now) }, JSON.parse(fs.readFileSync(PRIV, "utf8")));
  fs.appendFileSync(path.join(DIR, "issued.log"), `${iso(now)}\t${who}\t${n} дн.\tдо ${iso(exp)}\n`);
  console.log(key);
  console.log(`\nДействует по ${iso(exp)} включительно. Отправьте покупателю: «Ваш ключ тарифа „Бизнес“: … Вставьте его на странице yurplatform.ru/pro.html».`);
}

async function check(key) {
  global.window = global;
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  require(PRO);
  const r = await global.Pro.verify(key);
  console.log(r.ok ? `Ключ действует до ${iso(r.exp)} — ${r.name}` : r.why);
}

module.exports = { sign };
if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  ({ init, issue: () => issue(a, b), check: () => check(a) }[cmd] || (() => console.log("Команды: init | issue \"кому\" 30 | check YP-…")))();
}
