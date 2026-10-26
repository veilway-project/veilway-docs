<p align="center">
<img src="public/favicon.svg" width="96" height="96" alt="Veilway">
</p>

<h1 align="center">مستندات Veilway</h1>

<p align="center" dir="rtl">
کد منبع سایت مستندات Veilway، به فارسی و انگلیسی.
</p>

<p align="center" dir="rtl">
<b><a href="https://veilway-project.github.io/veilway-docs/fa/">خواندن مستندات: veilway-project.github.io/veilway-docs</a></b>
</p>

<p align="center">
<a href="README.md">English</a> | <b>فارسی</b>
</p>

<p align="center">
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
<a href="https://t.me/VeilwayGroup"><img alt="Telegram" src="https://img.shields.io/badge/Telegram-VeilwayGroup-26A5E4?logo=telegram&logoColor=white"></a>
</p>

<div dir="rtl">

## این مخزن چیست

کد منبع سایت مستندات [Veilway](https://github.com/veilway-project/veilway)، یک پلتفرم VPN متن‌باز برای کسانی که پشت شبکه‌های سانسورشده هستند. این پلتفرم هنوز در حال ساخت است. سایت به دو زبان انگلیسی و فارسی نوشته می‌شود.

## وضعیت

این سایت آلفای `v0.3.6-alpha` را توصیف می‌کند که در مخزن هسته برچسب خورده و منتشر شده است. بخشی از سایت هنوز جای‌نگهدار است.

- به انگلیسی نوشته شده: صفحهٔ نسخهٔ آلفا، راهنمای نصب، راهنماها (گرهٔ ورودی، اولین ورودی و کاربر، آینهٔ انتشارها، بسته‌های آفلاین، پروفایل‌های Xray)، شرایط اپراتور، حریم خصوصی برنامه، الگوهای ارائه‌دهنده، راهنمای پنل، کلاینت، برنامهٔ اندروید، شبکهٔ خانگی و افزونهٔ Xray، مرجع پیکربندی، مرجع API کنترل، راهنمای SDK تایپ‌اسکریپت، خلاصهٔ مدل تهدید، صفحهٔ وضعیت لایهٔ مبهم‌سازی، و پیش‌نویس مشخصات پروتکل. مشخصات شامل این بخش‌هاست: نمای کلی، ترنسپورت‌ها، HTTP/2، شکل‌های fronted، سایت قرضی، کانال کنترل، قالب اشتراک، پیوند نودها، بستهٔ آفلاین، و Xray در برنامه‌های دسکتاپ.
- به فارسی نوشته شده: صفحهٔ نسخهٔ آلفا، راهنمای نصب، راهنماها، صفحه‌های حقوقی، راهنمای برنامه‌ها (افزونهٔ Xray هم)، مرجع پیکربندی و API کنترل، راهنمای SDK تایپ‌اسکریپت، و خلاصهٔ مدل تهدید.
- هنوز جای‌نگهدار: راهنمای SDK راست. این راهنما کریت‌ها را فهرست می‌کند اما هنوز مثالی ندارد. صفحه‌های فارسی پروتکل هم هنوز نیستند: HTTP/2، شکل‌های fronted، سایت قرضی، پیوند نودها، بستهٔ آفلاین، و Xray در برنامه‌های دسکتاپ. صفحهٔ فارسی وضعیت لایهٔ مبهم‌سازی هم فقط تا حدی ترجمه شده است.

صفحه‌های پروتکل پیش‌نویس هستند. فقط درون خود پروژه بازبینی شده‌اند، و هر صفحه می‌گوید کدام بخش‌ها ساخته شده‌اند. صفحهٔ نسخهٔ آلفا می‌گوید هر بخش روی چه چیزهایی آزموده شده و چه چیزهایی آزموده نشده است.

## ساختار

| مسیر | محتوا |
|---|---|
| `src/content/docs/` | صفحه‌های انگلیسی |
| `src/content/docs/fa/` | صفحه‌های فارسی، با همان نام فایل |
| `astro.config.mjs` | تنظیمات سایت، زبان‌ها و نوار کناری |

سایت با [Starlight](https://starlight.astro.build) و قالب پیش‌فرض آن ساخته می‌شود.

## ساخت

به Node.js نسخهٔ 22.12 یا جدیدتر نیاز دارد.

</div>

```
npm install
npm run dev
npm run build
```

<div dir="rtl">

دستور `npm run dev` سایت را روی سیستم خودتان اجرا می‌کند. دستور `npm run build` سایت ایستا را در پوشهٔ `dist/` می‌سازد.

## مخزن‌ها

- [veilway](https://github.com/veilway-project/veilway): هسته، API کنترل و SDK آن، و برنامه‌های دسکتاپ و اندروید.
- [veilway-panel](https://github.com/veilway-project/veilway-panel): پنل، بخش مدیریتی یک گره.
- [veilway-ui](https://github.com/veilway-project/veilway-ui): سیستم طراحی و ترجمه‌ها برای پنل و برنامه‌ها.
- veilway-docs: همین مخزن. این مخزن در [veilway-project.github.io/veilway-docs](https://veilway-project.github.io/veilway-docs/fa/) منتشر می‌شود.

## مشارکت

هر صفحه را در یک تغییر و در هر دو زبان اضافه یا ویرایش کنید. مثال‌ها فقط باید از نام‌ها و نشانی‌های نمونه استفاده کنند (`example.com`، `192.0.2.0/24`). هرگز سرور یا کلید واقعی در آن‌ها نگذارید.

## مجوز

Apache-2.0. فایل‌های [LICENSE](LICENSE) و [NOTICE](NOTICE) را ببینید.

</div>
