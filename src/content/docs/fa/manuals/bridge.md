---
title: بریج WebSocket
description: بردن یک برنامهٔ استاندارد WireGuard روی WebSocket با veilway bridge، و اعتماد به رلهٔ خودامضا با --pin.
---

`veilway bridge` ترافیک WireGuard را روی WebSocket می‌برد. جایی از آن استفاده کنید که UDP بسته است و برنامهٔ طرف مقابل یک برنامهٔ استاندارد WireGuard است.

دو نیمه دارد:

- **`bridge relay`** روی سرور اجرا می‌شود. اتصال‌های WebSocket را می‌گیرد و هرکدام را به یک درگاه UDP وایرگارد می‌فرستد.
- **`bridge client`** کنار برنامهٔ WireGuard اجرا می‌شود. برنامه به یک درگاه UDP محلی می‌فرستد و کلاینت آن را روی `wss` به رله می‌برد.

نودی که روی یک ورودی‌اش ترابری `ws` دارد خودش WebSocket را می‌گیرد و به `bridge relay` نیاز ندارد. کلاینت با هر دو کار می‌کند.

## اجرای رله

با گواهی از یک مرجع صدور گواهی:

```
veilway bridge relay --listen 0.0.0.0:443 --path /wg --target 127.0.0.1:51820 \
  --cert /etc/letsencrypt/live/vpn.example.com/fullchain.pem \
  --key /etc/letsencrypt/live/vpn.example.com/privkey.pem
```

پشت یک پراکسی معکوس که گواهی را نگه می‌دارد، `--cert` و `--key` را نگذارید و روی loopback گوش دهید:

```
veilway bridge relay --listen 127.0.0.1:8443 --path /wg --target 127.0.0.1:51820
```

`--max-conns` (پیش‌فرض ۱۰۲۴) سقف اتصال‌های هم‌زمان رله است.

## اجرای کلاینت

```
veilway bridge client --listen 127.0.0.1:51820 --url wss://vpn.example.com/wg
```

بعد در پیکربندی برنامهٔ WireGuard بنویسید `Endpoint = 127.0.0.1:51820`.

کلاینت به‌طور پیش‌فرض گواهی رله را مثل مرورگر بررسی می‌کند: باید از یک مرجع صدور گواهی باشد و با نام میزبان بخواند.

## رله با گواهی خودامضا

اگر دامنه ندارید، به رله یک گواهی خودامضا بدهید و پین آن را به کلاینت. پین، SHA-256 کلید عمومی گواهی است، به base64.

1. گواهی را روی سرور بسازید:

   ```
   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 \
     -subj /CN=relay -keyout key.pem -out cert.pem
   ```

2. رله را با `--cert cert.pem --key key.pem` اجرا کنید. هنگام شروع پین را چاپ می‌کند:

   ```
   INFO veilway_wg::ws: relay listening listen=0.0.0.0:443 paths=["/wg"] tls=true pin="3q2+7w...=" max_conns=1024
   ```

   پین را از خود فایل هم می‌توانید بخوانید:

   ```
   openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64
   ```

3. پین را به کلاینت بدهید. در نشانی، آدرس سرور را بگذارید:

   ```
   veilway bridge client --listen 127.0.0.1:51820 --url wss://203.0.113.10/wg --pin 3q2+7w...=
   ```

با `--pin`، کلاینت فقط همان کلید را می‌پذیرد. صادرکننده، نام و تاریخ‌های گواهی را نگاه نمی‌کند. رله باید همچنان ثابت کند کلید را دارد، و اتصال باید TLS 1.3 باشد.

پین فقط وقتی کلید عوض شود تغییر می‌کند. برای رفتن به کلید تازه، `--pin` را دو بار بدهید، قدیمی و تازه، تا همهٔ رله‌ها کلید تازه را داشته باشند.

`--pin` نشانی `wss://` می‌خواهد. پین روی `ws://` پذیرفته نمی‌شود، چون WebSocket ساده گواهی‌ای ندارد که بررسی شود.

`--insecure` هر گواهی‌ای را می‌پذیرد. فقط برای یک آزمایش سریع از آن استفاده کنید. با `--pin` با هم به کار نمی‌رود.
