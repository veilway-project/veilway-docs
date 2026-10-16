---
title: SDK برای TypeScript
description: استفاده از کلاینت تایپ‌دار API کنترل Veilway در TypeScript.
---

`@veilway/sdk` یک کلاینت تایپ‌دار برای [API کنترل](../../reference/api/) گره Veilway است. به Node نسخهٔ 20 یا بالاتر نیاز دارد و وابستگی زمان اجرا ندارد. نسخهٔ آن `0.1.0-alpha` است.

```
npm install @veilway/sdk
```

اگر هنوز نسخه‌ای از آن در رجیستری نیست، آن را از `packages/sdk` در [مخزن](https://github.com/veilway-project/veilway) با `npm ci && npm run build` بسازید.

## چه کار می‌کند

- همهٔ مسیرهای API کنترل را صدا می‌زند: `status`، `getConfig`، `validateConfig`، `diffConfig`، `applyConfig`، `listUsers`، `getUser`، `resetUsage`، `resetReplay`، `stats`، `listSessions`، `listExits`، `listInbounds`، `listLinks` و `events`.
- یک تابع `fetch` و یک آدرس پایه می‌گیرد. گره API را فقط روی سوکت یونیکس ارائه می‌دهد، پس راه رسیدن بایت‌ها به سوکت با شماست.
- هر شکستی به شکل `VeilwayError` با `status`، `code`، `message` و `details` پرتاب می‌شود.
- `events` یک async iterator روی جریان رویدادهاست. به خواننده‌ای که کند است می‌گوید چند رویداد را از دست داده.

## چه کار نمی‌کند

- پروتکل Veilway را نمی‌گوید. WireGuard، ترنسپورت و تونل ندارد، پس نمی‌تواند به‌عنوان کلاینت وصل شود.
- از راه شبکه به گره نمی‌رسد. دسترسی از راه دور به API وجود ندارد، فقط سوکت یونیکس.

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

`getConfig` پیکربندی را با `"<redacted>"` به‌جای هر راز برمی‌گرداند. همان را عیناً پس بفرستید تا گره مقدارهای واقعی را نگه دارد. ریویژنی که برمی‌گردد همان است که `applyConfig` لازم دارد، و ریویژن کهنه با کد `stale_revision` رد می‌شود.

## نوع‌ها

نوع‌های `src/schema.ts` از `crates/veilway-api/openapi.json` ساخته می‌شوند، یعنی همان سند OpenAPI که گره در `GET /v1/openapi.json` هم ارائه می‌دهد. `src/index.ts` دستی نوشته شده است. این نوع‌ها API کنترل را توصیف می‌کنند، نه قالب‌های سیمی پروتکل بومی که در صفحه‌های پروتکل آمده‌اند.
