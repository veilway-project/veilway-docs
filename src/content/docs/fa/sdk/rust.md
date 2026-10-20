---
title: SDK برای Rust
description: ساختن کلاینت یا سرور سفارشی با crateهای Rust پروژه Veilway.
---

:::caution[هنوز راهنمای کامل نیست]
فعلا مثال کلاینت یا سرور حداقلی در این صفحه نیست و API این crateها پایدار نیست. نسخهٔ آن‌ها `0.2.7` است. هیچ crate ای در crates.io تأیید نشده، پس آن‌ها را به‌صورت وابستگی git یا path به کار ببرید.
:::

crateها در پوشهٔ `crates/` [مخزن](https://github.com/veilway-project/veilway) هستند:

| Crate | مسیر | چه کار می‌کند |
|---|---|---|
| `veilway-proto` | `crates/veilway-proto` | قالب‌های سیمی پروتکل بومی: کلیدها، chunkها، کانال کنترل، اشتراک‌ها. کد خالص، بدون IO. |
| `veilway-transport` | `crates/veilway-transport` | سمت کلاینتِ `udp-obfs`، `tls`، `ws` و `fronted`: نشستی به نود باز می‌کند و دیتاگرام‌های WireGuard را حمل می‌کند. |
| `veilway-engine` | `crates/veilway-engine` | موتور کلاینت بدون لایهٔ سیستم‌عامل: رقابت کاندیداها، حمل نشست، واردکردن اشتراک و وضعیت. |
| `veilway-wg` | `crates/veilway-wg` | لایهٔ WireGuard چندهمتا روی boringtun، با رلهٔ WebSocket. |
| `veilway-core` | `crates/veilway-core` | موتور نود: پیکربندی v1، مسیریابی، سهمیه، خروجی‌های TCP/IP در فضای کاربر و ترنسپورت‌های بومی. |
| `veilway-api` | `crates/veilway-api` | سمت سرورِ [API کنترل](../../reference/api/)، روی سوکت یونیکس. کلاینت نیست. |
| `veilway-linux`، `veilway-macos`، `veilway-windows` | `crates/veilway-*` | لایهٔ کلاینت برای هر سیستم‌عامل: دستگاه TUN، مسیرها، kill switch و DNS. |

برای استفاده از یکی از آن‌ها در پروژهٔ دیگر:

```
veilway-proto = {git = "https://github.com/veilway-project/veilway"}
```

`veilway-transport` BoringSSL را از سورس می‌سازد، پس به `cmake` و یک کامپایلر C نیاز دارد (و در ویندوز NASM و Ninja). برای کلاینت API کنترل [SDK برای TypeScript](../typescript/) را ببینید.
