# النشر

المنصّة تنشر منفذاً واحداً: حاوية `web` (nginx) تقدّم اللوحة وتمرّر `/api` إلى الـAPI.
لا `postgres` ولا `api` يلمس شبكة المضيف.

```yaml
# docker-compose.yml
ports:
  - "${WEB_PORT:-8080}:80"     # web وحدها
```

فكل ما يلزم للنشر هو إيصال الإنترنت إلى ذلك المنفذ. **كيف** تفعلها قرارك، والمشروع
لا يفترض طريقة.

---

## ٠. المحرّك: بودمان أولاً، ودوكر مدعوم

كل أوامر المشروع تمرّ بـ[`scripts/compose.sh`](../scripts/compose.sh)، وهو يختار المحرّك:

```
COMPOSE_ENGINE  ←  إن ضُبط، يُحسم به
podman          ←  الافتراضي (يجرّب `podman compose` ثم `podman-compose`)
docker          ←  حين لا يوجد بودمان
```

بودمان **الافتراضي لا البديل**، لأن افتراضاً لا يُجرَّب إلا على جهاز غيرك افتراضٌ ينكسر
بصمت. ولا شيء في ملفات الـcompose خاصّ بأحد المحرّكين: نفس الملف يعمل على الاثنين.

```bash
npm run up                          # بودمان إن وُجد، وإلّا دوكر
COMPOSE_ENGINE=docker npm run up    # فرضٌ صريح حين يوجد الاثنان
sh scripts/compose.sh ps            # أي أمر compose، بنفس الاختيار
```

**الملفات تبقى باسم `docker-compose*.yml`** — هذا الاسم يقرأه المحرّكان، وتغييره يكسر
الاكتشاف التلقائي في بودمان بلا مقابل.

### ما يختلف فعلاً في بودمان

| البند | ماذا تفعل |
|---|---|
| **البقاء بعد إعادة الإقلاع** | `restart: unless-stopped` وحدها لا تكفي في بودمان rootless: لا شيء يُشغّل الحاويات بعد إقلاع الخادم. اربطها بـsystemd — انظر أدناه |
| **SELinux** (فيدورا/RHEL) | التركيب `./Caddyfile:/etc/caddy/Caddyfile:ro` في تراكب Caddy يحتاج `:ro,Z`. الـcompose الأساسي لا يركّب شيئاً من المضيف، فلا يتأثر |
| **منفذ أقلّ من ١٠٢٤** | rootless لا يربطه. `WEB_PORT` الافتراضي ٨٠٨٠ فلا مشكلة — إلّا إن استعملت تراكب Caddy (٨٠ و٤٤٣) فيلزمه root أو `net.ipv4.ip_unprivileged_port_start` |
| **معمارية الصورة** | صورةٌ بُنيت على arm64 لا تعمل على x86_64. **ابنِ على الخادم** (`npm run up` يبني)، أو ابنِ متعدّد المعمارية |
| **أسماء الصور مؤهَّلة بالكامل** | `docker.io/library/postgres:16-alpine` لا `postgres:16-alpine`. دوكر يفترض Docker Hub صامتاً؛ بودمان يستشير `unqualified-search-registries` في المضيف — وفيدورا تضع ثلاثة، فيتوقّف ويسأل «أي صورة؟». على خادم بلا طرفية هذا تعليقٌ لا سؤال. يحرسه `tests/coverage/images.test.ts` |
| **بناءٌ لا يُستبدَل** | `up -d --build` يبني صورةً جديدة ثم — إن وُجدت حاوية بالاسم — **يشغّل القديمة**. بودمان‑compose يفعل هذا بالضبط: السجلّ أخضر، والصورة جديدة فعلاً، والكود القديم ما زال يخدم. لذلك يمرّر `npm run up` الخيار `--force-recreate`، ويحرسه `tests/coverage/tooling.test.ts` |

### البقاء بعد الإقلاع

```bash
# داخل مجلد المشروع على الخادم
npm run up
podman generate systemd --new --files --name commander-api   # ولكل حاوية

mkdir -p ~/.config/systemd/user && mv container-*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now container-commander-api.service
loginctl enable-linger "$USER"      # ← بدونها تموت الخدمات عند خروجك
```

`enable-linger` هو السطر الذي يُنسى: بدونه يوقف systemd خدمات المستخدم عند آخر تسجيل خروج،
فتكتشف أن المنصّة متوقّفة منذ يومين. (على بودمان ٤.٤+ تُفضَّل **Quadlet** على
`generate systemd` المتقادم.)

---

## ١. اختر طريق الوصول

| الطريق | متى | ما تضيفه |
|---|---|---|
| **نفق أو بروكسي عندك أصلاً** | عندك `cloudflared` أو nginx أو Traefik يعمل على الخادم | لا شيء. وجّهه على `WEB_PORT` |
| **نفق كحاوية** | تبي كل شيء في نفس الـcompose | `-f docker-compose.tunnel.yml` + `TUNNEL_TOKEN` |
| **Caddy على ٨٠/٤٤٣** | للخادم عنوان عام حقيقي، وتبي Let's Encrypt تلقائية | `-f docker-compose.public.yml` + `PUBLIC_DOMAIN` |

الثلاثة تحلّ **الوصول وTLS** فقط. لا تحلّ الدوام: عملية `api` تحمل العامل الذي
يستطلع الطابور، فمضيف نائم = طابور متوقّف وبرقيات متأخّرة. الدوام يحلّه خادم يعمل
٢٤/٧، لا نوع النفق.

### النفق كحاوية

في لوحة Cloudflare Zero Trust: **Networks ← Tunnels ← Create a tunnel ← Cloudflared**،
انسخ الـTOKEN، ثم **Public Hostname**: نطاقك الفرعي ← **Type** `HTTP` ← **URL** `web:80`.

`web:80` لا `localhost`: حاوية `cloudflared` تنضمّ لشبكة الـcompose، فتحلّ اسم الخدمة
عبر DNS الداخلي وتصلها دون نشرها على المضيف.

```bash
sh scripts/compose.sh -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build --force-recreate
```

انتظر `Registered tunnel connection` في `logs -f cloudflared`.

> **quick tunnel (`trycloudflare.com`) لا يصلح** — رابطه يتغيّر كل تشغيل فينكسر
> الويبهوك. استعمل named tunnel بنطاقك.

### Caddy

يحتاج ٨٠ و٤٤٣ مفتوحين من الإنترنت لتحدّي ACME. ضع `PUBLIC_DOMAIN` (بلا `https://`)
و`WEB_PORT=127.0.0.1:8080` حتى تبقى `web` خلف Caddy وحده.

```bash
sh scripts/compose.sh -f docker-compose.yml -f docker-compose.public.yml up -d --build --force-recreate
```

الشهادات في حجم `caddy-data`؛ حذفه يعني إعادة طلب الشهادة عند كل إقلاع وبلوغ حدّ
Let's Encrypt.

---

## ٢. `PUBLIC_URL` — الإعداد الوحيد الذي لا يُنسى

```
PUBLIC_URL=https://commander.example.com
```

ليس تجميلاً. له ثلاثة قرّاء:

| القارئ | الأثر لو كان خاطئاً |
|---|---|
| [`repositories.controller.ts`](../apps/api/src/modules/repositories/repositories.controller.ts) | اللوحة تبني منه **رابط الويبهوك الذي تلصقه في GitHub** — من `PUBLIC_URL` لا من المضيف الذي فتح منه متصفّحك، بقصد. قيمة خاطئة = رابط لا يصل إليه GitHub أبداً |
| [`app.ts`](../apps/api/src/app.ts) | أصل CORS في الإنتاج. قيمة خاطئة = اللوحة لا تنادي الـAPI |
| `openrouter.client.ts` | ترويسة `HTTP-Referer` — تجميلي وحده |

ولهذا: **تصفّح اللوحة عبر النطاق**، لا عبر `localhost` أو الـIP.

---

## ٣. الأسرار

```bash
cp .env.example .env
chmod 600 .env

openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 24   # GITHUB_WEBHOOK_SECRET
openssl rand -hex 16   # POSTGRES_PASSWORD  (ضعه أيضاً داخل DATABASE_URL)
```

| المتغيّر | ملاحظة |
|---|---|
| `DATABASE_URL` | `postgresql://commander:<POSTGRES_PASSWORD>@postgres:5432/commander?schema=public` |
| `DASHBOARD_PASSWORD` | اللوحة محميّة بكلمة واحدة وحدّ محاولات — اجعلها قويّة، فالعنوان صار عاماً |
| `GITHUB_WEBHOOK_SECRET` | نفس القيمة تُلصق في حقل **Secret** عند GitHub |
| `TUNNEL_TOKEN` | **سرّ كامل الصلاحية على النفق**: من يملكه يوجّه نطاقك لأي مكان |

الأسرار **لا تُخزَّن في قاعدة البيانات** — تُقرأ من البيئة عند كل طلب. تغييرها يحتاج
تعديل `.env` وإعادة تشغيل. أمّا `OPENROUTER_MODEL` و`DEFAULT_LOCALE` وأخواتهما فهي
**بذور إقلاع أولى فقط**؛ بعد أول تشغيل القاعدة هي المرجع واللوحة هي طريق التغيير.

---

## ٤. اربط GitHub

**الويبهوك** — Settings ← Webhooks ← Add webhook:

| الحقل | القيمة |
|---|---|
| Payload URL | `<PUBLIC_URL>/api/webhook` |
| Content type | `application/json` |
| Secret | نفس `GITHUB_WEBHOOK_SECRET` |
| Events | Just the push event |

**GitHub App** (اختياري، للإثراء) — لا يحتاج رابطاً عاماً؛ ألغِ تفعيل الـWebhook فيه.
الخطوات في [README](../README.md#connecting-the-github-app).

بلا رابط عام يصل، تبقى المصالحة ([`reconciler.ts`](../apps/api/src/queue/reconciler.ts))
تسحب الكوميتات عبر الـApp وتعوّض الفجوة — لكنها `best-effort`: لا ترى فرعاً حُذف
أثناء الانقطاع ولا تاريخاً محاه force push.

---

## ٥. التشغيل اللاحق

```bash
npm run up                     # يبني ويستبدل الحاويات، على المحرّك المتاح

mkdir -p backups
sh scripts/compose.sh exec -T postgres pg_dump -U commander commander > backups/$(date +%F).sql
```

البيانات في حجم `postgres-data`. **لا تستعمل `down -v`** — يحذف الحجم ومعه كل شيء.

النسخة الاحتياطية ليست مُجدوَلة؛ ضعها في cron:

```
0 3 * * *  cd /srv/commander && sh scripts/compose.sh exec -T postgres \
           pg_dump -U commander commander > backups/$(date +\%F).sql
```

> **`backups/` متجاهَل في git، والمسار ليس تفصيلاً.** النسخة تحمل كل رسالة كوميت وكل
> اسم عضو وكل قيد في السجلّ؛ ملفٌّ واحد منها في ريبو عام يسرّب النظام كلّه. اكتبها
> داخل `backups/` أو خارج المشروع تماماً — لا باسم عشوائي في الجذر.

الهجرات (`prisma migrate deploy`) تعمل تلقائياً عند إقلاع `api`، لا عند بناء الصورة:
القاعدة غير موجودة وقت البناء، والصورة المُعاد بناؤها يجب أن تقدر تهاجر للأمام. وعميل
Prisma وملفات الهجرة **داخل الصورة**، فالإقلاع لا يحتاج شبكة إلى npm.

---

## ملاحظات صادقة

- **بناء `web` + `api` قد يتجاوز ١ غيغا ذاكرة.** على خادم صغير أضف swap أو ابنِ الصور
  في مكان آخر وادفعها.
- **صورة الإنتاج لا تحمل كود اختبار** — `tsconfig.json` يستثنيه عمداً، وفحص أنواعه
  يجري عبر `tsconfig.test.json` بلا إصدار.
- **`COMPOSE_FILE=docker-compose.yml:docker-compose.tunnel.yml`** في `.env` يغنيك عن
  كتابة `-f` في كل أمر.
