---
title: WebSocket bridge
description: Carry a stock WireGuard app over WebSocket with veilway bridge, and trust a self-signed relay with --pin.
---

`veilway bridge` carries WireGuard over WebSocket. Use it where UDP is blocked and the peer is a stock WireGuard app.

It has two halves:

- **`bridge relay`** runs on the server. It takes WebSocket connections and forwards each one to a WireGuard UDP port.
- **`bridge client`** runs next to the WireGuard app. The app sends to a local UDP port, and the client carries that over `wss` to the relay.

A node with a `ws` transport on an inbound takes WebSocket itself, so it does not need `bridge relay`. The client works with both.

## Run the relay

With a certificate from a certificate authority:

```
veilway bridge relay --listen 0.0.0.0:443 --path /wg --target 127.0.0.1:51820 \
  --cert /etc/letsencrypt/live/vpn.example.com/fullchain.pem \
  --key /etc/letsencrypt/live/vpn.example.com/privkey.pem
```

Behind a reverse proxy that holds the certificate, leave out `--cert` and `--key` and listen on loopback:

```
veilway bridge relay --listen 127.0.0.1:8443 --path /wg --target 127.0.0.1:51820
```

`--max-conns` (default 1024) caps how many connections the relay holds at once.

## Run the client

```
veilway bridge client --listen 127.0.0.1:51820 --url wss://vpn.example.com/wg
```

Then set `Endpoint = 127.0.0.1:51820` in the WireGuard app's config.

By default the client checks the relay's certificate the way a browser does: it must come from a certificate authority and match the host name.

## A relay with a self-signed certificate

Without a domain, give the relay a self-signed certificate and give the client its pin. The pin is the SHA-256 of the certificate's public key, in base64.

1. Make the certificate on the server:

   ```
   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 \
     -subj /CN=relay -keyout key.pem -out cert.pem
   ```

2. Start the relay with `--cert cert.pem --key key.pem`. It prints the pin when it starts:

   ```
   INFO veilway_wg::ws: relay listening listen=0.0.0.0:443 paths=["/wg"] tls=true pin="3q2+7w...=" max_conns=1024
   ```

   You can also read the pin from the file:

   ```
   openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64
   ```

3. Give the client the pin. Use the server's address in the URL:

   ```
   veilway bridge client --listen 127.0.0.1:51820 --url wss://203.0.113.10/wg --pin 3q2+7w...=
   ```

With `--pin`, the client accepts that key and no other. It does not look at the certificate's issuer, name or dates. The relay still has to prove it holds the key, and the connection must use TLS 1.3.

The pin changes only when the key changes. To move to a new key, give `--pin` twice, the old and the new, until every relay serves the new one.

`--pin` needs a `wss://` URL. A pin on `ws://` is refused, since plain WebSocket has no certificate to check.

`--insecure` accepts any certificate. Use it only for a quick test. It cannot be combined with `--pin`.
