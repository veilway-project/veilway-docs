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
<a href="LICENSE"><img alt="licence" src="https://img.shields.io/badge/licence-Apache--2.0-blue"></a>
</p>

<div dir="rtl">

## این مخزن چیست

کد منبع سایت مستندات [Veilway](https://github.com/veilway-project/veilway)، یک پلتفرم VPN متن‌باز برای کسانی که پشت شبکه‌های سانسورشده هستند. این پلتفرم هنوز در حال ساخت است. سایت به دو زبان انگلیسی و فارسی نوشته می‌شود.

## وضعیت

بخشی از سایت نوشته شده و بخشی هنوز خالی است. هیچ چیز در اینجا هنوز نرم‌افزار منتشرشده‌ای را توصیف نمی‌کند.

- نوشته‌شده به انگلیسی: پیش‌نویس مشخصات پروتکل (نمای کلی، ترنسپورت‌ها، کانال کنترل، قالب اشتراک، لینک بین نودها)، صفحهٔ وضعیت لایهٔ مبهم‌سازی، مرجع پیکربندی و مرجع API کنترل.
- نوشته‌شده به فارسی: مرجع پیکربندی و مرجع API کنترل.
- هنوز خالی: صفحه‌های فارسی پروتکل، شروع کار، خلاصهٔ مدل تهدید، راهنمای پنل و کلاینت و راهنماهای SDK.

صفحه‌های پروتکل پیش‌نویس هستند. فقط درون خود پروژه بازبینی شده‌اند و هر صفحه می‌گوید کدام بخش‌ها ساخته شده‌اند. سمت نود ترنسپورت‌های بومی و کانال کنترل ساخته شده است، اما هنوز هیچ کلاینتی با آن‌ها کار نمی‌کند. پنل، کلاینت‌های چندسکویی و کلاینت اندروید هنوز ساخته نشده‌اند.

## ساختار

| مسیر | محتوا |
|---|---|
| `src/content/docs/` | صفحه‌های انگلیسی |
| `src/content/docs/fa/` | صفحه‌های فارسی، با همان نام فایل |
| `astro.config.mjs` | تنظیمات سایت، زبان‌ها و نوار کناری |

سایت با [Starlight](https://starlight.astro.build) و قالب پیش‌فرض آن ساخته می‌شود.

## ساخت

به Node.js نسخه 22.12 یا جدیدتر نیاز دارد.

</div>

```
npm install
npm run dev
npm run build
```

<div dir="rtl">

دستور `npm run dev` سایت را روی سیستم خودتان اجرا می‌کند. دستور `npm run build` سایت ایستا را در پوشه `dist/` می‌سازد.

## مخزن‌ها

- [veilway](https://github.com/veilway-project/veilway): هسته، API کنترل و SDK آن، و برنامهٔ دسکتاپ.
- [veilway-ui](https://github.com/veilway-project/veilway-ui): سیستم طراحی و ترجمه‌ها برای پنل و برنامه‌ها.
- veilway-docs: همین مخزن، که در [veilway-project.github.io/veilway-docs](https://veilway-project.github.io/veilway-docs/fa/) منتشر می‌شود.

## مشارکت

هر صفحه را در یک تغییر و در هر دو زبان اضافه یا ویرایش کنید. مثال‌ها فقط باید از نام‌ها و آدرس‌های نمونه استفاده کنند (`example.com`، `192.0.2.0/24`) و هرگز سرور یا کلید واقعی در آن‌ها نباشد.

## مجوز

Apache-2.0. فایل‌های [LICENSE](LICENSE) و [NOTICE](NOTICE) را ببینید.

</div>
