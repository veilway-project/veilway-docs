---
title: SDK برای TypeScript
description: استفاده از کلاینت‌های تایپ‌دار API کنترل Veilway و API مدیریتی پنل در TypeScript.
---

`@veilway/sdk` یک کلاینت تایپ‌دار برای [API کنترل](../../reference/api/) نود Veilway است. به Node نسخهٔ 20 یا بالاتر نیاز دارد و وابستگی زمان اجرا ندارد. نسخهٔ آن `0.2.3-alpha` است.

```
npm install @veilway/sdk
```

اگر هنوز نسخه‌ای از آن در رجیستری نیست، آن را از `packages/sdk` در [مخزن](https://github.com/veilway-project/veilway) با `npm ci && npm run build` بسازید.

## چه کار می‌کند

- همهٔ مسیرهای API کنترل را صدا می‌زند: `status`، `getConfig`، `validateConfig`، `diffConfig`، `applyConfig`، `listUsers`، `getUser`، `resetUsage`، `resetReplay`، `stats`، `listSessions`، `listExits`، `listInbounds`، `listLinks` و `events`.
- یک تابع `fetch` و یک آدرس پایه می‌گیرد. نود API را فقط روی سوکت یونیکس ارائه می‌دهد، پس راه رسیدن بایت‌ها به سوکت با شماست.
- هر شکستی به شکل `VeilwayError` با `status`، `code`، `message` و `details` پرتاب می‌شود.
- `events` یک async iterator روی جریان رویدادهاست. به خواننده‌ای که کند است می‌گوید چند رویداد را از دست داده.

## چه کار نمی‌کند

- پروتکل Veilway را نمی‌گوید. WireGuard، ترنسپورت و تونل ندارد، پس نمی‌تواند به‌عنوان کلاینت وصل شود.
- از راه شبکه به نود نمی‌رسد. دسترسی از راه دور به API وجود ندارد، فقط سوکت یونیکس.

## مثال

```ts
import {Agent, fetch as undiciFetch} from "undici";
import {Client, VeilwayError, type Fetch} from "@veilway/sdk";

const dispatcher = new Agent({connect: {socketPath: "/srv/veilway/veilway.sock"}});
const fetch: Fetch = (url, init) => undiciFetch(url, {...init, dispatcher}) as unknown as ReturnType<Fetch>;
const client = new Client(fetch, "http://veilway");
const running = await client.getConfig();
try {
	await client.applyConfig({...running.document, log: {level: "debug"}}, running.revision);
} catch (e) {
	if (e instanceof VeilwayError) console.log(e.status, e.code, e.details);
}
```

`getConfig` پیکربندی را با `"<redacted>"` به‌جای هر راز برمی‌گرداند. همان را عیناً پس بفرستید تا نود مقدارهای واقعی را نگه دارد. ریویژنی که برمی‌گردد همان است که `applyConfig` لازم دارد، و ریویژن کهنه با کد `stale_revision` رد می‌شود.

## نوع‌ها

نوع‌های `src/schema.ts` از `crates/veilway-api/openapi.json` ساخته می‌شوند، یعنی همان سند OpenAPI که نود در `GET /v1/openapi.json` هم ارائه می‌دهد. `src/index.ts` دستی نوشته شده است. این نوع‌ها API کنترل را توصیف می‌کنند، نه قالب‌های سیمی پروتکل بومی که در صفحه‌های پروتکل آمده‌اند.

## SDK پنل

`@veilway/panel-sdk` یک کلاینت تایپ‌دار برای [API مدیریتی](../../manuals/panel/#api-مدیریتی) پنل Veilway است، برای اسکریپت‌هایی که یک توکن API دارند. به Node نسخهٔ 20 یا بالاتر نیاز دارد و وابستگی زمان اجرا ندارد. نسخهٔ آن `0.1.0` است.

```
npm install @veilway/panel-sdk
```

اگر هنوز نسخه‌ای از آن در رجیستری نیست، آن را از `sdk/` در [مخزن پنل](https://github.com/veilway-project/veilway-panel) با `npm ci && npm run build` بسازید.

کلاینت یک تابع `fetch`، نشانی API پنل و یک توکن می‌گیرد. نشانی، `prefix` پنل و سپس `/api` است، مثل `https://panel.example.com/<prefix>/api`. توکن را زیر **توکن‌های API** در پنل بسازید. دامنهٔ آن تعیین می‌کند چه فراخوانی‌هایی مجازند، و فراخوانی بیرون از دامنه با `forbidden` شکست می‌خورد. [توکن‌های API](../../manuals/panel/#توکنهای-api) را ببینید.

- کاربران: `listUsers`، `getUser`، `createUser`، `updateUser` و `deleteUser`.
- دستگاه‌ها: `listDevices`، `createDevice` و `removeDevice`.
- لینک و مصرف: `getSubscription`، `resetSubscription`، `resetUsage`، `getExits`، `statsNow`، `statsUsage` و `statsHistory`.

هر فراخوانی ناموفق `VeilwayError` با `status`، `code` و `message` پرتاب می‌کند. `code` کد پنل است، مثل `forbidden` یا `unauthorized`. پاسخی که JSON نباشد، یا سند خطا نباشد، با `bad_response` پرتاب می‌شود.

### فهرست کاربران

```ts
import {Client} from "@veilway/panel-sdk";

const client = new Client(fetch, "https://panel.example.com/<prefix>/api", process.env.VEILWAY_TOKEN ?? "");
const users = await client.listUsers({group: "family", enabled: true});
for (const user of users) console.log(user.id, user.name);
```

### ساختن کاربر و دستگاه

```ts
import {Client, VeilwayError} from "@veilway/panel-sdk";

const client = new Client(fetch, "https://panel.example.com/<prefix>/api", process.env.VEILWAY_TOKEN ?? "");
try {
	const created = await client.createUser({name: "ana", groups: ["family"]});
	const {device, weaker} = await client.createDevice(created.user.id, "ana-phone");
	console.log(created.user.id, device.id, weaker);
} catch (e) {
	if (e instanceof VeilwayError) console.log(e.status, e.code, e.message);
}
```

`created.link` وقتی پنل بتواند لینک اشتراک را بسازد آن را دارد، و `created.link_error` می‌گوید چرا نتوانسته. هر کسی که لینک را داشته باشد می‌تواند دستگاه ثبت کند، پس آن را از راهی که به آن اعتماد دارید بفرستید.

`createDevice` کلید دستگاه را روی پنل می‌سازد. این انتخاب ضعیف‌تر است، و `weaker` در پاسخ `true` است. دستگاهی که از برنامهٔ خودش ثبت می‌شود کلیدش را همان‌جا نگه می‌دارد، و SDK این مرحله را انجام نمی‌دهد.

### نوع‌ها

نوع‌های SDK پنل از سند OpenAPI پنل ساخته می‌شوند که پنل آن را در `{prefix}/api/openapi.json` ارائه می‌دهد. `sdk/src/schema.ts` از `server/openapi.json` در مخزن پنل ساخته می‌شود، و `npm run generate` در `sdk/` آن را بعد از تغییر مسیرهای پنل دوباره می‌سازد. `sdk/src/index.ts` دستی نوشته شده است.
