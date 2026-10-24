---
title: میزبانی یک آینهٔ انتشارها
description: نگه‌داشتن رونوشتی از انتشارهای Veilway روی سروری که مردم بتوانند به آن برسند، تا نصب و به‌روزرسانی در جاهایی که GitHub مسدود است کار کند.
---

آینهٔ انتشارها پوشه‌ای از فایل‌های انتشار Veilway روی وب‌سرور شماست، برای کسانی که شبکه‌شان GitHub را مسدود می‌کند و از آن نصب و به‌روزرسانی می‌کنند. هر کس می‌تواند یکی داشته باشد و لازم نیست کسی به شما اعتماد کند: کلید انتشار Veilway هر فایل را امضا می‌کند و اسکریپت نصب و برنامه‌ها خودشان آن را بررسی می‌کنند.

```text
 GitHub  ---- sync (hourly) ---->  mirror folder  ---- web server ---->  users
 (or another mirror)               (checked files)                       (installer, apps)
```

## چه وقت آینه بسازیم

اگر کسانی را می‌شناسید که به GitHub نمی‌رسند (مسدود یا کند) اما به یکی از نشانی‌های شما می‌رسند، آینه بسازید: یک VPS کوچک، یک سطل ابری، یا سرور دانشگاه یا دفتر. چند گیگابایت دیسک و تقریباً هیچ پردازنده‌ای لازم دارد. اگر کاربرانتان به GitHub می‌رسند، آینه لازم نیست.

## آینه چه می‌تواند و چه نمی‌تواند

- **نمی‌تواند چیزی را عوض کند.** فایل تغییرکرده امضایش را از دست می‌دهد. امضا نام محصول، برچسب انتشار و نام فایل را هم دارد، پس فایل واقعی با نام یا برچسب اشتباه هم رد می‌شود.
- **نمی‌تواند کسی را به عقب برگرداند.** اشارگر `latest` امضا شده است. برنامهٔ آینه اشارگر قدیمی‌تر از اشارگر فعلی‌اش را رد می‌کند و کلاینت‌ها اشارگر قدیمی‌تر از نسخهٔ در حال اجرایشان را رد می‌کنند.
- **می‌تواند از کار بیفتد یا کند باشد.** آینهٔ بد فقط همین کار را می‌تواند، پس کلاینت‌ها می‌توانند چند آینه بشناسند.
- **می‌فهمد چه کسی دانلود می‌کند.** وب‌سرور شما می‌بیند کدام نشانی‌ها کدام فایل‌ها را و کی می‌خواهند. برنامهٔ آینه گزارش دسترسی نگه نمی‌دارد. nginx و Caddy به‌طور پیش‌فرض نگه می‌دارند، پس مثال‌ها آن را خاموش می‌کنند. CDN طبق قاعدهٔ خودش ثبت می‌کند. به کاربرانتان بگویید چه نگه می‌دارید.

## راه‌اندازی آینه

به برنامهٔ `veilway-release-mirror` از [مخزن پروژه](https://github.com/veilway-project/veilway-release-mirror)، یک سرور لینوکسی با systemd و یک نام دامنه که به آن اشاره می‌کند نیاز دارید.

1. برنامه را بگیرید: فایل اجرایی انتشار برای لینوکس x86_64 یا aarch64، یا تصویر Docker از `Dockerfile` مخزن. فایل اجرایی را در `/usr/local/bin/veilway-release-mirror` بگذارید.
2. یک کاربر و یک پوشه بسازید: `useradd --system veilway-mirror`، سپس `install -d -o veilway-mirror /var/lib/veilway-mirror`.
3. پوشه را یک بار پر کنید: `sudo -u veilway-mirror veilway-release-mirror sync --out /var/lib/veilway-mirror`. برای هر فایل ذخیره‌شده یک خط چاپ می‌کند. سه انتشار تازهٔ نود و پنل را نگه می‌دارد، به‌علاوهٔ انتشاری که اشارگر امضاشده نام می‌برد.
4. تازه نگهش دارید. پوشهٔ `examples/` مخزن `veilway-release-mirror-sync.service` و `.timer` را دارد که هر ساعت همگام‌سازی می‌کنند. هر دو را به `/etc/systemd/system/` کپی کنید و `systemctl enable --now veilway-release-mirror-sync.timer` را اجرا کنید.
5. پوشه را به یکی از دو راه سرو کنید:
   - `veilway-release-mirror serve --dir /var/lib/veilway-mirror --listen 127.0.0.1:8080` (`veilway-release-mirror.service` نمونه آن را اجرا می‌کند)، با nginx یا Caddy جلویش برای TLS. `examples/nginx.conf` و `examples/Caddyfile` را ببینید.
   - یا پوشه را دست‌نخورده به‌صورت فایل ایستا از هر وب‌سرور یا CDN سرو کنید، با پشتیبانی range برای فایل‌های بزرگ و بدون پوشهٔ `.partial`.
6. `https://your-domain/` را در مرورگر باز کنید. صفحه هر انتشار و فایل را فهرست می‌کند.

با Docker سه دستور بس است: `docker build -t veilway-release-mirror .`، سپس `docker run --rm -v veilway-mirror:/data veilway-release-mirror sync --out /data` (از یک تایمر)، و `docker run -d -p 127.0.0.1:8080:8080 -v veilway-mirror:/data:ro veilway-release-mirror` برای سرور.

## آینه از آینه

`sync --from https://other-mirror.example.org` فایل‌ها را به‌جای GitHub از آینهٔ دیگری می‌گیرد. `--from` را برای چند منبع تکرار کنید. برای هر فایل به ترتیب امتحان می‌شوند. `--from github` را آخر بگذارید تا به GitHub برگردد. لازم نیست به منبع اعتماد کنید: برنامه هر فایل را پیش از ذخیره با کلید تعبیه‌شده‌اش بررسی می‌کند.

برای پوشه‌ای روی فلش، `veilway-release-mirror verify --dir <folder>` همه را بررسی می‌کند و هر فایل ردشده را فهرست می‌کند. با `minisign` ساده:

```sh
minisign -V -m veilway.sh -x veilway.sh.minisig -P RWQiodKlFCiJ3bkZD3ojKV7AYyTYf3F5x/XY8upWvpSFTVm3O2cNRbrV
```

خط `Trusted comment:` در خروجی باید `veilway <tag> veilway.sh` باشد، با برچسب انتشار پوشهٔ شما.

## مردم از آینهٔ شما چطور استفاده می‌کنند

نشانی‌تان را بدهید. `veilway.sh` گزینهٔ `--mirror <url>` را می‌گیرد تا از آن نصب و به‌روزرسانی کند ([نصب از یک آینه](../../getting-started/#نصب-از-یک-آینه)):

```sh
curl -fsSL https://your-domain/veilway.sh | sudo bash -s -- --mirror https://your-domain
```

اسکریپت نصب هر فایل را، از هر جا که آمده باشد، با کلید تعبیه‌شده‌اش بررسی می‌کند. `veilway.sh mirror-sync <folder>` همان پوشه را بدون برنامهٔ آینه می‌سازد، برای فلش.

## چه چیزی در پوشه است

```text
veilway-project/veilway/releases/download/<tag>/<file> and <file>.minisig
veilway-project/veilway-panel/releases/download/<tag>/<file> and <file>.minisig
veilway-project/<repo>/releases/latest/download/latest-<repo>.txt and .minisig
latest-veilway.txt, latest-veilway-panel.txt (copies of the two pointers)
veilway.sh and veilway.sh.minisig (the installer of the newest release)
index.html, index.json
```

طرح فایل‌ها همان طرح GitHub است، پس نشانی آینه هر جا که نشانی پایهٔ انتشار GitHub کار کند، کار می‌کند.

## محدودیت‌ها

- فایل‌های بدون `.minisig` آینه نمی‌شوند. `latest.json` به‌روزرسان دسکتاپ یکی از آن‌هاست، پس برنامه‌های دسکتاپ هنوز از GitHub به‌روز می‌شوند.
- انتشار بدون اشارگر امضاشدهٔ `latest` از فهرست API گیت‌هاب آینه می‌شود و آینه اشارگر خودش را ندارد. برنامه این را می‌گوید.
- دو همگام‌سازی را هم‌زمان روی یک پوشه اجرا نکنید.
- اگر نشانی‌تان مسدود شود، آینه هم مسدود است. یک آینهٔ دوم داشته باشید.
