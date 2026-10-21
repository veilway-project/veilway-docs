---
title: Subscription format
description: The signed document in which a provider delivers profiles to a client, the link that leads to it, how it is fetched, imported and checked, and what a client refuses.
---

:::caution[Draft]
This page is a draft specification. Most of it is built and runs: the link, the signed document, the encrypted exchange, gateway keys, named endpoints and moves, relay mirrors, static mirrors and sealed files exist in the protocol code (`veilway-proto`), in the client engine and apps, and in the panel, and the test vectors below are checked by tests in the code. Still only drafted or open: a handshake for the subscription fetch and for static mirrors that looks like a browser's, fetching a subscription through the fronting options of the transports, and Encrypted Client Hello. The Windows and macOS clients have not yet connected to a node. No one outside the project has reviewed it. Do not rely on any property described here.
:::

A subscription is how a provider gives a user what the app needs to connect: one or more profiles, the list of exits, and a little content of the provider's own. Read [Protocol overview](../overview/) first for the terms. This page defines every profile field that [Transports](../transports/) and [Control channel](../control-channel/) rely on.

Four rules shape the page:

- **Everything in a subscription is hostile input.** A provider can be malicious, and so can a link on a wall. Every byte is checked against a limit before it is used.
- **The link carries the provider's key.** A document is verified against a key the user already holds, from the first fetch on. No key is ever accepted because a server sent it.
- **A subscription is data inside a box.** It can describe how to reach the provider's nodes and what to show in the provider's area of the screen. It cannot run anything, open anything, change a setting of the app, or touch another subscription.
- **A document that fails any check changes nothing.** The last good document stays in force.

A related thing that is not a subscription: a pairing code that links two nodes is exchanged between panels and is never imported into a client.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends. None of these numbers has a measurement behind it. A limit on display text is in characters unless it says bytes, and a character is one Unicode code point after the filter of the control channel page.

| Name | Value |
|---|---|
| Link token | 16 bytes, 22 base64url characters |
| Device secret | 16 bytes, 22 base64url characters |
| Gateway key in a link | 33 bytes: a 1-byte key id and a 32-byte X25519 public key, 44 base64url characters |
| Link pin | 32 bytes, 43 base64url characters. A link with a pin has a fragment of 158 characters, one without has 114. |
| Pins held for one endpoint | 1 or 2 |
| Stored token lookup value | 32 bytes: HMAC-SHA-256 under the panel's lookup key over the label `"veilway v1 sub token"` and the 16 token bytes |
| Stored encrypted token copy | ChaCha20-Poly1305 under the panel's copy key: a random 12-byte nonce, the 16-byte token sealed, a 16-byte tag, 44 bytes in all. A nonce is drawn at each creation or reset of a token, which is few enough writes for random nonces. |
| Panel keys for stored secrets | three keys of 32 random bytes: the lookup key, the copy key and the secret key. No key serves two purposes. |
| Notice of a new endpoint pin | The operator lists a new pin in the endpoint's settings at least 120 days before the web server presents it. That is the longest document lifetime plus the grace after expiry. A standby pin is listed from the first document, so the notice has long run when it is needed. |
| Key ids in a request | 1 or 2 |
| Subscription URL without its fragment | at most 256 characters, counted on the `https` form for both TLS forms and on the `http` form for both plain forms. The same limit holds for a refresh URL and the URL of a move. |
| Encapsulated request | exactly 1,073 bytes: a 1-byte key id, a 32-byte `enc`, and 1,040 bytes of ciphertext with its tag |
| Request plaintext | exactly 1,024 bytes: a 2-byte length, the request JSON of at most 1,022 bytes, and zero bytes |
| Encapsulated answer | 9,413, 36,979, 140,867, 538,201 or 1,089,437 bytes, the sizes of a static file, with the same time limits |
| A document in an answer, a static file or a file | at most 1,048,576 bytes |
| Gateway keys in a document | 1 or 2. A panel lists 2: the active key and the next one. |
| Request time window | `t` within 300 s of the gateway's clock, either way |
| Replay memory of the gateway | in memory: the `enc` of every request that opened inside the window, until the gateway's clock passes that request's `t` plus 300 s. After a start, any `t` earlier than the start is refused. |
| Endpoint moves a client holds pending | at most 1 |
| A retired gateway key kept | 120 days after a routine switch by default, settable from 30 to 365 days. Destroyed at once after a theft. |
| Document in a link or a QR code | at most 2,048 bytes |
| JSON nesting depth | at most 8 |
| JSON values in a document | at most 20,000 |
| Any string without its own limit | at most 1,024 bytes |
| Languages of one text | the default and at most 8 more |
| A language tag | at most 11 characters |
| Notices of one profile, for translating what its node sends | at most 4 |
| Profiles | 1 to 64 |
| Transports per profile | 1 to 8 |
| Candidates or endpoints per transport | 1 to 16 |
| Pins per candidate | at most 4 |
| Exits per profile | at most 256 |
| Devices listed | at most 64 |
| Signing keys listed | 1 or 2 |
| Refresh URLs | at most 4 |
| Support links | at most 4 |
| Cards | at most 6 |
| Notices | at most 4 |
| Logo | at most 65,536 bytes, at most 512 by 512 pixels |
| `update_interval` | 900 to 604,800 s, default 3,600. Each wait is multiplied by a number drawn uniformly from 0.8 to 1.2. |
| Refresh by the user's request | at most 1 in 60 s, held by the client |
| Endpoint limit for an enrolled device | 1 request in 60 s per token and device |
| Endpoint limit for device keys it has not seen | 1 request in 600 s per token, counted apart from enrolled devices |
| Pending device places per account | at most 2 |
| A retired signing key kept for signed refusals | 365 days after it was retired, then destroyed |
| Refresh after a failure | the interval, doubled per failure up to 86,400 s, and never shorter than the interval |
| Document lifetime (`expires_at` minus `issued_at`) | at most 90 days |
| Clock tolerance for `issued_at` | 300 s into the future |
| Age of a signed refusal | at most 86,400 s |
| Grace after expiry | 30 days |
| An enrollment the user has not confirmed | released by the provider after 600 s |
| Width of the keepalive range in `padding` | at least 10 s |
| Fetch timeouts | 10 s to connect. 30 s in all for a legacy fetch. A native answer and a static file take the time limit of their size. |
| Redirects | none |
| Legacy list | at most 256 links, each at most 4,096 bytes. Every line that is not empty counts toward the 256, also one that is skipped. |
| Static mirrors | at most 4 |
| Static mirror base URL | at most 216 characters, ending in `/`, so that the base with a file name stays within 256 |
| Mirror lookup id | 16 bytes, written as 32 lowercase hexadecimal characters |
| Mirror period `P` | 604,800 s, fixed |
| Overlap of mirror periods `W` | 86,400 s, fixed. No static file lives longer than `P + 2W`. |
| Size of a static file | 9,413, 36,979, 140,867, 538,201 or 1,089,437 bytes. Every file of one folder has the same size. |
| Static fetch time limit in all | 30 s up to 36,979 bytes, 60 s for 140,867, 120 s for 538,201, 240 s for 1,089,437 |
| A folder moves to a smaller size | after 8 rounds in a row in which the smaller size held every envelope |
| Publishing round | 1 to 12 hours, default 6 |
| Decoy files in one period of one folder | at least 32 and at least one per 4 real files, at most 64 or one per 2 real files, whichever is larger |
| Decoy birth and death | in each round, each with probability 1/4, drawn independently |
| Cache lifetime asked of a static host | at most 600 s |

The limits cannot all be reached at once. A large provider meets the limit on JSON values first: 64 profiles with a handful of transports and a few dozen exits each fit, 64 profiles with 256 exits each do not.

## The link

### Form

A native subscription link has one of four forms, two over TLS and two over plain HTTP, and its fragment has one of two kinds. With three fields the endpoint has a certificate from an authority, or has no TLS at all. With four it has a self-signed certificate, and the fourth field is its pin:

```
veilway://sub/sub.example.com/s#v1.<key>.<gateway>.<token>
https://sub.example.com/s#v1.<key>.<gateway>.<token>
veilway://sub/sub.example.com/s#v1.<key>.<gateway>.<token>.<pin>
https://203.0.113.7:8443/s#v1.<key>.<gateway>.<token>.<pin>
veilway://sub-plain/sub.example.com/s#v1.<key>.<gateway>.<token>
http://203.0.113.7:8080/s#v1.<key>.<gateway>.<token>
```

| Part | Meaning |
|---|---|
| `sub.example.com/s` | The provider's subscription endpoint: a host, an optional port, and a path. It is the same for all of a provider's users and holds no secret. `veilway://sub/` and `https://` reach it over `https`. `veilway://sub-plain/` and `http://` reach it over plain HTTP. Plain HTTP is chosen only by a link, an entry of `refresh_urls` or a confirmed move, never by an answer. |
| `v1` | The form of the fragment. Anything else is not a native link. |
| `<key>` | The provider's Ed25519 public key, 32 bytes, base64url without padding, 43 characters |
| `<gateway>` | The provider's gateway key: a 1-byte key id followed by the 32-byte X25519 public key, 33 bytes, base64url without padding, 44 characters. Every request is sealed to it. See "The encrypted exchange". |
| `<token>` | The user's token, 16 bytes, base64url without padding, 22 characters |
| `<pin>` | Optional. The SHA-256 of the SubjectPublicKeyInfo of the endpoint's certificate, 32 bytes, base64url without padding, 43 characters, with the unused trailing bits zero. It is the same hash as a `pins` entry of a transport candidate, in the encoding of a link. Present only when the endpoint serves a self-signed certificate, and never in a plain HTTP form. See "A pinned endpoint". |

The exact grammar, which the client checks before it does anything else:

- The `veilway` form is `veilway://sub/`, then a host with an optional `:` and port, then `/` and a path, then `#v1.`, 43 base64url characters, `.`, 44 base64url characters, `.`, and 22 base64url characters, and then either nothing or `.` and 43 base64url characters, which are the pin. Nothing else, and no query: no fifth field, no empty field, and no pin of any other length. The fragment is therefore exactly 114 or exactly 158 characters. The gateway key's first byte is its key id, any value from 0 to 255, and its other 32 bytes are an X25519 public key. A key that is all zero, or one of the encodings of a point of small order that the gateway swaps for the base point (see "What the gateway does"), refuses the link. The host is a lowercase host name. An IP literal is written in one spelling only. An IPv4 address is four decimal numbers with no leading zeros. An IPv6 address is in brackets in its compressed form of RFC 5952: lowercase, the longest run of zero groups written ::, and no :: for a single group. A link whose address is written any other way is refused, so that two spellings of one address are never two hosts. It is an IP literal (a dotted IPv4 address, or an IPv6 address in brackets, lowercase, with no zone) only in a link that has a pin or a plain HTTP link, since a provider with no domain has nothing else to put there. Such a literal is held to the refusals of a profile's dial address when the link is parsed, and to the address check of "How a fetch is made" at each fetch. The path is `/` followed by characters that RFC 3986 allows in a path.
- The `https` form is the same with `https://` in place of `veilway://sub/`.
- The plain forms are the same with `veilway://sub-plain/` or `http://` in place of `veilway://sub/`, and never have a pin. A plain link with four fields is refused.
- A whole document is `veilway://doc#v1.`, 43 base64url characters, `.`, and the document, or in a file the same without `veilway://doc#`. The content is split at the first two dots, because the document has two dots of its own.
- Anything that begins with `veilway://` and matches none of these is refused at once.
- An `https` or `http` text that holds `v1.`, 43 base64url characters, a dot and 44 base64url characters anywhere in it, and is not exactly one of the native forms, is refused. That covers a pinned link as well, and so a pin that was cut short, or something put behind it, never turns a link into one without a pin. So is an `https` or `http` URL whose fragment is `v`, digits, and then a dot or the end, and does not fit the native grammar. Neither is ever read as a legacy link: a damaged native link must not turn into a `GET` that carries the key and the token. A legacy link stays `https` only.
- A URL the token is sent to (the endpoint, a refresh URL, the URL of a move) and a legacy link hold no percent-encoded control character (`%00` to `%1f`, `%7f`), no `%2f` or `%5c`, and no `.` or `..` path segment in any spelling, the `%2e` forms and a segment with a parameter included.

The fragment is 115 characters with its `#`, or 159 with a pin. A link to a short host name is about 146 characters, and about 190 with a pin. The first fits a QR code of version 7 (45 by 45 modules) at the lowest error correction level, or version 8 (49 by 49) at the medium level. The second needs version 9 (53 by 53) at the lowest level, or version 10 (57 by 57) at the medium level, and the code is denser for it. The gateway key costs 45 characters of every link. It is what lets the request be sealed before the first answer, so it cannot come from a server.

A web server and a proxy never receive the fragment of a URL. That is why the key, the gateway key and the token are there. The token is not in the path, so it does not land in access logs, and it never leaves the device outside a sealed request.

**Providers hand out the `veilway` form.** It is what a panel shows for copying and puts in a QR code. The app also reads the `https` form when a user pastes or scans it, because links get rewritten on the way. The difference matters when a link is tapped:

- A tapped `https` link opens in a browser, not in the app. The browser looks up the host and requests the endpoint from the user's own network, before the app has shown anything. The link, fragment included, lands in the browser's history and in its history sync. A messenger may fetch a preview of the link, sometimes from its own servers. None of these send the fragment to the endpoint, and all of them show the host to someone.
- A tapped `http` link does the same over plain HTTP, so the network also sees the host, the path and the browser's request in the clear. A provider with a plain endpoint hands out the `veilway://sub-plain/` form only.
- The endpoint answers a `GET` exactly as an unknown path and never serves a page, so no script of the provider's or anyone else's ever runs with the fragment in reach.
- The app is never tied to the `https` host by an app link or universal link. The file such a tie needs would sit on the host and name it as a subscription host.
- A tapped `veilway` link opens whichever app has claimed the scheme. On a platform where another app can claim it, that app receives the key and the token. The app cannot prevent this. It says so in its help, and pasting the link or scanning the code inside the app are the ways in that no other app sees. An app that took a token this way could enroll a device, which the user would see in the device list.

**The form of the link decides what it is.** A link with a `v1` fragment is native. Any other `https` URL is a legacy link (see "Native and legacy"). The answer of a server never changes which of the two a link is. A link is never upgraded or downgraded without the user importing another link.

**The link decides how the endpoint is reached.** A TLS link with three fields is validated by chain, whatever the server presents, a link with four trusts exactly the certificates its pin names, whatever else the server presents, and a plain link uses no TLS. No answer and no setting moves a link from one to another. The one thing that can is a signed move to another endpoint, which the user confirms (see "Moving the main endpoint"). A pinned link that loses its pin on the way (a messenger that cuts the end of a text) reads as a link without one and fails closed at its first fetch, because a self-signed certificate has no chain, and the app says what may have happened (see "A pinned endpoint"). A plain link is safe for the content of the exchange, which is sealed end to end, and gives up hiding: see "What each party sees". `http` is refused for every legacy link, which has nothing sealed. A legacy link has no pin field and cannot name a self-signed server.

**An `https` pinned link opens badly in a browser.** A browser that is sent to a self-signed endpoint shows its own certificate warning, and a user must not be taught to click through it. A provider with a self-signed endpoint hands out the `veilway` form only.

### What the key in the link means

The client verifies every document of a subscription, the first one included, against keys it holds, and the first of those came with the link. So whoever answers the fetch, be it the provider's host, a relay mirror, a content delivery network in front of it, or someone who holds a certificate the device trusts, can refuse to answer. It cannot make the client accept a document of its own. Since every answer is sealed to the one request it answers, it cannot serve an older document either, unless it holds the gateway's private key. A static mirror can, see "Static mirrors".

The gateway key in the link is trusted the same way: whoever gave the link chose it. A link whose gateway key is not the provider's makes every request readable to whoever holds that key's private half and sees the request, and the endpoint cannot open it at all. The app cannot tell, and this is the same trust as for the signing key.

The limit, stated plainly: **whoever gave the user the link is trusted for the key.** A link from the provider's own channel is the provider's. A link from a stranger is a stranger's provider, with the stranger's key in it, and everything about it will verify. The app cannot tell these apart. It shows the host and the key's fingerprint before it does anything, and the user's check is where the link came from.

The fingerprint of a key is the first 16 bytes of its SHA-256, shown as 8 groups of 4 hexadecimal digits.

### The token is a bearer secret

Whoever has the link is that user to the provider, until the provider resets it. There is no second factor in the format. What follows:

- The client stores the link, the documents and its device keys in the operating system's secret storage where the platform has one, and otherwise in a file encrypted under a key kept there. It never shows the token after import, writes it to a log or includes it in a diagnostic report. What is stored is trusted as the link is: whoever can write the client's storage chooses the keys. A stored document that still verifies but that the app can no longer read, for example after an update that tightened a rule, is not thrown away with its subscription: the link, the device key and secret and the keys held stay, and the user refreshes.
- The token is sent only inside a request sealed to a gateway key the client holds for the subscription (see "The encrypted exchange"), to the main endpoint, to a confirmed endpoint of a pending move, or to an endpoint in `refresh_urls` of an accepted document, which the provider signed. It is never put in a URL or a header, never sent in the clear, and never sent to a URL from provider content or to anything the project runs. The project runs no service that sees subscription links.
- Only the gateway sees the token: the part of the panel that holds the gateway's private key. Whoever ends TLS for the endpoint (the provider's web server, a content delivery network or a reverse proxy in front of it), a relay mirror, and anyone on a plain HTTP path see a sealed request of one fixed size and a sealed answer of one of five sizes, and none of them is a holder of the link. Whoever holds the gateway's private key and a recording of requests reads them, see "Gateway keys".
- The panel does not keep the token as it stands to find an account by. See "Storing the token".
- A request carries no cookie, no referrer and no identifier of the device other than what "Fetching" lists.

**Reset.** A provider resets a user's link in the panel. From then on the old token is unknown: its lookup value and its encrypted copy are deleted at once. The provider gives the user a new link. Importing it replaces the stored token when the key and the subscription id are the same. A link shown again by the panel always carries the gateway key that is active then and the account's current main endpoint.

## The signed document

### Envelope

A native subscription document is one JWS in compact serialization (RFC 7515) with the EdDSA algorithm over Ed25519 (RFC 8037, RFC 8032). It is three base64url parts joined by dots:

```
BASE64URL(header) . BASE64URL(payload) . BASE64URL(signature)
```

The signature covers the ASCII bytes of the first two parts and the dot between them, exactly as they were delivered. Nothing is re-serialized, so no rule for a canonical form of JSON is needed and none is invented.

**The header is one exact byte string per key.** For a key with key id `<kid>` it is these bytes, with the members in this order and no white space:

```
{"alg":"EdDSA","typ":"veilway-sub+jws","kid":"<kid>"}
```

`<kid>` is the first 8 bytes of the SHA-256 of the public key, in base64url, 11 characters. The client does not parse the header. It computes this string for each key it holds for the subscription and compares the first part of the document with the base64url of each. No match refuses the document. Nothing named in a header is ever fetched, and no JOSE library is needed.

**Encoding.** Every base64url part has no padding and no white space, and its unused trailing bits are zero. A part that breaks this refuses the document. The signature part is 86 characters.

**Verification.** The strict rule of RFC 8032: the second half of the signature must be below the group order, encodings of points must be canonical, and a public key of small order is refused. A key of small order is also refused in a link and in `signing_keys`. In detail, for a signing key: a public key of small order is refused, and so is one whose y coordinate is not below the field prime. A key of mixed order is not refused. Bytes that are no point on the curve are a key under which nothing verifies, so a link with such a key fails at its first fetch.

### What is checked, in order

1. The body is within the size limit and has exactly three parts, each well encoded.
2. The first part equals the header for a key held for this subscription. On a first import the only key held is the one from the link.
3. The signature verifies under that key. No byte of the payload has been parsed before this point.
4. The payload is strict JSON within the parsing limits.
5. `v`, `critical`, `subscription_id`, `serial`, `issued_at` and `expires_at` pass "Versioning", "Identity" and "Rollback and expiry".
6. Every field passes its own rule in "Contents".

A failure at any step refuses the whole document. The client keeps the last good one, shows that the refresh failed and why, and tries again as the table of numbers says.

### Identity

A subscription is identified by two things together: the provider's signing key and `subscription_id`, a required signed member that is stable for one account at that provider.

- A document replaces a stored subscription only when it verifies under a key held for that subscription and has the same `subscription_id`.
- The same key with another id is a second subscription beside the first, which is how two accounts at one provider live side by side. A document of someone else's account can therefore never replace the user's own, even though the same provider signed both.
- Another key is always another subscription, whatever name or id it carries.
- A whole document (see "Import") does not replace a stored subscription that has a link. The user removes the stored one first. A link may replace a stored whole document.

### Keys held for a subscription

- **At import** the client holds the key from the link.
- **Rotation.** Each accepted document has `signing_keys`, a list of 1 or 2 keys, which must include the key that signed it. After accepting a document the client holds exactly the keys in that list. A provider that wants a new key first lists both, signed with the old one, and later signs with the new one and lists only that. This is how The Update Framework rotates a root key: the new key is introduced by a document that the old key signed. The client notes "the provider renewed its signing key" with the date in the subscription's details. It does not ask the user anything.
- **An unknown key.** A document that verifies under no key held is a failed refresh and nothing more. There is no button that accepts it. The client keeps the last good document and shows: "The answer was not signed by this provider's key. If your provider has changed its key, ask it for a new link. If not, something between you and your provider answered in its place." A client that was offline through a whole rotation is in this state and needs a new link.
- **A new link.** A link with another key is a new subscription. The user imports it and removes the old one.
- **Which key the endpoint signs with.** A request names the key ids the client holds (`kids`, see "The request"). The endpoint signs with a current key that is among them. During an overlap the provider has two current keys, so a client that holds only the old one and a user who imports a new link, which carries only the new one, are both served. A client that holds only a key the provider has retired gets the signed refusal `"key_retired"`, signed with that retired key, and is told plainly that it needs a new link.
- **Retired keys.** A provider keeps a retired signing key for the time in the table of numbers, for the single purpose of signing that refusal, and then destroys it. This is unlike a retired transport key, which is destroyed at once. If the provider no longer has the key, it signs with a current one, and the client shows the unknown-key message above.

A routine rotation and an interception therefore look different: the first is a quiet note, the second is a failed refresh with no way to say yes.

A signing key that is stolen cannot be revoked for clients that still hold it. The provider can only rotate, and get a document that drops the stolen key to each client before the thief gets one to it.

### Rollback and expiry

| Field | Type | Rule |
|---|---|---|
| `serial` | integer, 1 to 9007199254740991 | Must be greater than the serial of the last accepted document of this subscription. An equal serial is accepted only when the body is byte for byte the same, and then changes nothing. A lower one is refused. Providers should use the time of signing as the serial, so that a lost counter cannot go backwards. An endpoint signs one serial once: the same payload under another key, or with another signature, is another body, and a client that holds one of them refuses the other. |
| `issued_at` | integer, 0 to 9007199254740991, Unix seconds | Refused when it is more than the clock tolerance ahead of the device's clock. On a refresh it must not be lower than the stored document's. |
| `expires_at` | integer, 0 to 9007199254740991, Unix seconds | Must be later than `issued_at` by no more than the document lifetime. A document is expired when the clock is at or past `expires_at`. A freshly fetched document that is already expired is refused. |

The serial stops an old document from being served over a newer one. The expiry bounds how long that can be tried at all: whoever can answer the fetch can hold a client on its current document until that document expires, and no longer without the warnings below.

**A fresh import by the user** of a link for a subscription that is already stored takes a different rule. "Already stored" means the link's key is among the keys held for a stored subscription and the document carries that subscription's id. The document is accepted when its `issued_at` is later than the stored document's, whatever its serial, and the stored serial is set to the new one. This lets a provider that lost its counter recover, through an action only the user can take. The identical document is also accepted again, which is how a link with a new token replaces an old one. The rule is checked when the confirmation is shown and again when the user accepts, against what is stored at that moment. If it no longer holds then, the client sends `"release"` and stores nothing.

The client cannot know before the fetch that a pasted link belongs to a stored subscription, because the id is in the document. When the link's key is one held for a stored subscription with the same endpoint, the app sends that subscription's device key and secret, so that importing a known link again reuses the device. Otherwise it makes a new key.

### Offline, and when a refresh fails

A subscription host that is blocked must not take the user's connection away. So:

- The last good document stays in force when a refresh fails for any reason.
- The client shows the time of the last successful refresh at all times.
- When the last good document has passed `expires_at`, the client shows "this subscription is out of date" on the profile list and on the connect screen, and keeps working.
- When it is more than 30 days past `expires_at`, every connect needs one explicit confirmation, because the addresses, keys and fronts in it may no longer belong to the provider. A device set to connect when it starts stays disconnected until the user has confirmed.
- A new document takes effect for a profile at its next connect. A refresh never disconnects a tunnel that is up, also when it removes or changes the profile in use.
- The kill switch is not affected by any of this.

## Fetching

### The request

A native fetch is one sealed exchange with the provider's gateway (see "The encrypted exchange"). Everything the request says is inside the seal, in this JSON object, and the outer request carries nothing but the sealed bytes:

| Member | Type | Rule |
|---|---|---|
| `v` | integer | 1 |
| `t` | integer, Unix seconds | The device's clock when the request was sealed. See "Replays and clocks". |
| `token` | string | The token from the link |
| `kids` | list of 1 or 2 strings | The key ids of the signing keys the client holds for this subscription. On a first import, the id of the key in the link. |
| `device_public_key` | key | The public half of the WireGuard key the client made for this subscription |
| `device_secret` | string, 22 base64url characters | 16 random bytes the client made together with the device key. Sent on every request. |
| `op` | string | `"fetch"`, `"confirm"`, `"release"` or `"leave"` |
| `device_name` | display text, at most 32 characters | Only with `"confirm"`, and only what the user typed. The client never fills it from the system. Absent when the user typed nothing. A name that is empty after the filter is not sent. |

A legacy fetch is a plain `GET` and carries none of this.

The JSON is at most 1,022 bytes, which leaves room in a plaintext of 1,024. A request with a member this table does not list, or with a `device_name` that is empty after the filter, is malformed: the gateway answers `"bad_request"`, sealed, when the token in it is valid and `t` is in the window, and as an unknown path otherwise.

**The device secret.** A WireGuard public key is not a secret: it is in the provider's panel, and users paste it into support chats. Without something more, anyone with the link and that public key could fetch that device's document, transport secrets included. So the client makes a random secret with the device key and sends both at its first fetch. The provider stores the secret with the device and requires it on every later request for that device key. It is a stored random value compared in constant time, not a cryptographic construction. The client keeps it where it keeps the link. A client that loses it cannot fetch that device's document again: it gets `"device_mismatch"`, makes a new key and a new secret, and enrolls as a new device, which takes a new place.

**What `kids` reveals.** The gateway sees which of the provider's own keys this client holds, which says roughly how recently it refreshed. It is at most two ids of 8 bytes, and they name the provider's keys, not the device. Nobody on the way sees them. The key id of the gateway key, which is outside the seal, says the same about the gateway key to anyone on the way, see "What each party sees".

### The answer

| Request | Answer |
|---|---|
| A body of another size, an unknown key id, a request that does not open, a plaintext that is not this JSON object, an unknown or reset token, a `t` outside the window, a replay, a `GET`, or a source over its limit | Exactly what the host answers on any path it does not serve: the same status, header fields and body, byte for byte, after the same work. What difference in time remains is measured and stated, see "Open questions". A prober who guesses tokens learns nothing, and a host cannot be recognized as a subscription host by asking it. |
| A valid token, in the window, not seen before | Always a signed document, sealed to this request: the subscription, or a signed refusal that says why there is none. |

What each `op` does, for a valid token:

| `op` | The device key is | Result |
|---|---|---|
| `"fetch"` | Enrolled, with the right secret | The document. |
| `"fetch"` | Not seen before | Takes a pending place and answers the document, or `"device_limit"` or `"rate_limited"`. |
| `"confirm"` | Pending or enrolled, with the right secret | Makes the place permanent, stores the name if one is sent (a later `"confirm"` with another name replaces it), and answers the document. |
| `"confirm"` | Not known, because the pending place has lapsed | Enrolls again as a `"fetch"` and a `"confirm"` in one, if a place is free. |
| `"release"` | Pending, with the right secret | Frees the place and answers `"released"`. |
| `"release"` | Enrolled | Changes nothing and answers the document. `"release"` never removes a confirmed device. |
| `"release"` | Not known | Answers `"released"`. |
| `"leave"` | Pending or enrolled, with the right secret | Removes the device, frees its place and answers `"released"`. |
| `"leave"` | Not known | Answers `"released"`. |
| any | Known, with a wrong or missing secret | `"device_mismatch"`. Nothing about the device is released. |

A **signed refusal** is a document in the same envelope whose payload has `v`, `subscription_id`, `issued_at` and `refusal`. Its `v` and `critical` are checked as in any document, and every other member is ignored.

| `refusal` | Meaning | What the client shows |
|---|---|---|
| `"device_limit"` | Every device place of this account is taken, or its pending places are, and this device has none. | The limit, and that a device must be removed in the provider's panel or the link reset. |
| `"disabled"` | The account is switched off. | That the provider has switched the account off. |
| `"expired"` | The account's time is over. | That the account has expired. |
| `"rate_limited"` | This device, or this token for new devices, has asked too often. | That it will try again later. It counts as a failed refresh with the ordinary backoff. |
| `"device_mismatch"` | The device key is known and the secret is not the stored one. | That this device has to be enrolled again. |
| `"key_retired"` | The client holds only a signing key the provider has retired. | That the provider has renewed its key and a new link is needed. |
| `"released"` | A pending place was freed, a device left, or there was none. | Nothing. |
| `"bad_request"` | A member was missing or malformed, or the device key was all zero or of small order. | A fault in the app. |

A refusal is verified like any document. On a refresh it must carry the stored `subscription_id`, or it is a failed refresh. On a first import it may carry any id, and its age is still checked. It is never stored as the last good document and changes no profile. One that is older than the limit in the table of numbers is treated as a failed refresh, so that an old refusal cannot be replayed for long. The requester has already shown a valid token, so naming the state protects nobody's secret, and the real user needs to know.

**When the answer is not a subscription at all.** A native fetch that gets anything but a sealed answer that opens and holds a signed document (the host's not-found answer, a page, an error, bytes that do not open) is a failed fetch. The client shows "the endpoint did not answer as a subscription: the link may have been reset, or something else answered in its place", keeps the last good document, and backs off as after any failure.

### The encrypted exchange

Every native request and its answer are sealed end to end between the device and the provider's gateway: the part of the panel that holds the gateway's private key. A web server that ends TLS for the endpoint, a content delivery network or reverse proxy in front of it, a relay mirror, and anyone on a plain HTTP path carry bytes they cannot read, and cannot change without the fetch failing. TLS is still recommended: it hides the path, the sizes inside it and the role of the host from the network, and makes the endpoint harder to block.

**What it is built from.** Oblivious HTTP (RFC 9458) over HPKE (RFC 9180) in base mode, with the suite of the stream proof: DHKEM(X25519, HKDF-SHA256) (KEM `0x0020`), HKDF-SHA256 (KDF `0x0001`) and ChaCha20Poly1305 (AEAD `0x0003`), from the same `hpke` crate. The suite is fixed by `v1` and is never negotiated. There are three departures from RFC 9458:

| Part | RFC 9458 | This page | Why |
|---|---|---|---|
| What is sealed | A Binary HTTP message (RFC 9292) | The request JSON, or the signed envelope, with a length in front and zero bytes after | Section 4.6 of RFC 9458 lets another specification reuse the encapsulation for other content, with strings of its own. Binary HTTP would carry a method, a target and header fields that nothing here needs, and would be a second HTTP parser of hostile input on the panel and on the client. The request's JSON reader exists and is fuzzed already. The padding is ours either way. |
| The header on the wire | `key_id`, `kem_id`, `kdf_id`, `aead_id`, 7 bytes | `key_id` alone, 1 byte. The whole 7-byte header still enters `info`. | With the suite fixed by `v1`, the other 6 bytes have nothing to carry. Left out, they also make no fixed pattern at a fixed offset of every request. |
| Strings | `"message/bhttp request"` and `"message/bhttp response"` | `veilway v1 sub request` and `veilway v1 sub response` | Required by section 4.6 for other content. |

Everything else is RFC 9458 step by step: the key schedule, the exporter, and the key and nonce of the answer. No part of HPKE is written by hand.

**A gateway key** is `key_id` (1 byte) followed by `pkR` (32 bytes, the X25519 public key as HPKE serializes it). The link carries these 33 bytes in base64url. A document carries them in `gateway_keys`.

**Sealing a request.** `||` joins byte strings.

1. `hdr` = `key_id || 00 20 || 00 01 || 00 03`, 7 bytes.
2. `info` = the ASCII bytes of `veilway v1 sub request`, one zero byte, and `hdr`. In this page's notation, `"veilway v1 sub request" || hdr`.
3. The plaintext is exactly 1,024 bytes: `n`, the length of the JSON, 2 bytes big-endian, from 1 to 1,022; the JSON; zero bytes to the end.
4. `enc, sctxt = SetupBaseS(pkR, info)`, with an ephemeral key from the system's secure random source. `ct = sctxt.Seal("", plaintext)`, 1,040 bytes.
5. The top bit of the last byte of `enc`, which X25519 never sets, is set to a random bit for the wire, so that no bit of a request is fixed. The gateway clears it again before anything else reads `enc`.
6. The encapsulated request is `key_id || enc || ct`, 1 + 32 + 1,040 = 1,073 bytes.

Every request has a new ephemeral key, retries included, and a client never sends the same bytes twice. A recording of a request therefore opens only with the gateway's private key: a token that leaks later opens nothing that was recorded.

**Sealing an answer.** The gateway holds the receiver context `rctxt` of the request it answers.

1. The plaintext: `m`, the length of the envelope, 4 bytes big-endian, from 1 to 1,048,576; the envelope, the signed document or refusal exactly as signed; zero bytes up to the answer's size minus 48. The size is the smallest of the five in the table of "The file" under "Static mirrors" whose plaintext holds the envelope.
2. `secret = rctxt.Export("veilway v1 sub response", 32)`, the exporter context being the ASCII bytes of that string with no zero byte, as RFC 9458 does. 32 is `max(Nn, Nk)` for ChaCha20Poly1305.
3. `response_nonce` is 32 bytes from the secure random source.
4. `prk = Extract(enc || response_nonce, secret)`, `key = Expand(prk, "key", 32)`, `nonce = Expand(prk, "nonce", 12)`, with HKDF-SHA-256 and RFC 9458's labels, ASCII with no zero byte.
5. `ct = Seal(key, nonce, "", plaintext)` with ChaCha20-Poly1305. The encapsulated answer is `response_nonce || ct`.

An answer is 52 bytes larger than the space for its envelope, exactly as a static file is, so the two share the five sizes, the largest envelope of each, and the time limit of each. The smallest size, 9,413, holds every refusal and most documents with a few profiles: a refusal and a small document look the same.

**How the client opens an answer**, in order. Any step that fails is a failed fetch:

1. The status is 200, and the body is exactly one of the five sizes. The client reads at most 1,089,437 bytes, within the time limit of the size, as for a static file.
2. It derives `key` and `nonce` from its own context and the first 32 bytes, and opens the rest. A tag that does not verify is a failure.
3. `m` is at least 1 and at most the smaller of 1,048,576 and the size minus 52, and every byte after the envelope is zero.
4. The envelope goes through "What is checked, in order", by the same path as every other answer.

**The outer request.**

| Part | Value |
|---|---|
| Method and target | `POST` to the endpoint's path. No query. |
| `Host` | The endpoint's host, with its port when the URL has one |
| `Content-Type` | `application/octet-stream` |
| `Content-Length` | `1073` |
| `Accept-Encoding` | `identity` |
| Other header fields | Only those the fingerprint pack fixes for a browser's request, such as `User-Agent` and `Accept`, with the pack's fixed values. No cookie, `Referer`, `Origin`, `Authorization` or `Accept-Language`, and no field that names Veilway, the provider or the device. |
| Body | The 1,073 bytes |

The gateway's answer is status 200 with `Content-Type: application/octet-stream`, `Cache-Control: no-store` and the length, plus whatever fields the web server adds to every answer. `message/ohttp-req` and `message/ohttp-res` are not used: they name Binary HTTP content, which this is not, and a media type of the project's own would tell everyone on the way that this is a Veilway fetch.

**What the gateway does.** For every `POST` to the path, the body is read up to 1,073 bytes and no further, and the work up to the answer costs the same whatever the request holds, in the way a node opens a stream proof:

1. A body of any other length is replaced by a fixed request that never opens.
2. The key id picks the private key. An unknown key id picks a fixed dummy key.
3. The top bit of the last byte of `enc` is cleared, which restores the `enc` the client's HPKE made. An `enc` that is then one of the encodings of a point of small order, for which HPKE would stop before its key schedule, is replaced by the base point, and the request is refused at the end.
4. One HPKE receiver setup and one open. A request that did not open gives a plaintext of zero bytes.
5. The JSON is read. A `t` or a token that cannot be read is replaced by a dummy one.
6. `t` is checked against the window and the restored `enc` against the replay memory, for every request, with dummy values when the request did not open, so that the check costs the same either way. A request that opened and is inside the window is recorded now, before the token is looked at (see "Replays and clocks").
7. One HMAC for the lookup value, one lookup in a table the gateway holds in memory, and one comparison in constant time, against a dummy value when nothing was found (see "The endpoint").
8. The results of the steps are combined at the end, without leaving early.

A body that does not open, a `t` outside the window, a replay and a token that is unknown therefore get the same answer after the same work: the unknown-path answer, having changed nothing. Only a request that opened, inside the window, not seen before and with a known token goes on. The gateway keeps a counter for each kind of failure, which the panel shows, and logs no byte of a request.

### Replays and clocks

- **The window.** The gateway acts on a request only when its `t` is within 300 s of the gateway's clock, either way. The clock it judges by is the highest value its clock has shown since it started, so a clock that steps back does not reopen the window, and a step back is logged at warning level. The gateway needs a synchronized clock, as the publisher of static files does (see "Periods and clocks"): the panel's setup says it requires NTP, and the panel says so on every page while the system reports its clock as not synchronized.
- **The memory.** For each request that opened inside the window, the gateway records the 32 bytes of the restored `enc` (its top bit cleared) until its clock passes that request's `t` plus 300 s, and acts on no second request with the same `enc`. It records before the token is looked at, and before it acts, so two copies that arrive together act once, and a replay costs the same as a first request. The restored `enc` names one request: it enters the key schedule, so a request whose `enc` differs in any other bit opens under another key or not at all, and the random top bit cannot make one request into two. Anyone can seal a request to the public gateway key, so each entry is counted against the limit of its source, and one source cannot fill the memory. Many sources can, so the memory also has a hard cap of 200,000 entries (an entry lives at most 600 s, so the cap is about 333 recorded requests a second): past it the gateway answers a request that would be recorded as an unknown path and records nothing, until entries expire, and it logs this at warning level at most once a minute. It fails closed, since a memory that stopped recording would let replays act. The memory is kept in memory only. In its place across a restart, the gateway refuses after a start any `t` earlier than the time it started, so a request captured before a restart is never accepted after it. A device whose clock is behind gets the unknown-path answer for at most 300 s after a restart, and its next refresh works.
- **Why it matters, although the answer is sealed.** Someone on the way who replays a captured request gets an answer it cannot open. Without the memory the request would still act (a `"confirm"`, a `"release"`, a use of the device's allowance that leaves the real device with `"rate_limited"`), and the size and timing of the answer would tell whether the token was still valid. Both are refused.
- **The client's clock.** The client puts its own clock in `t`, and never a time taken from an answer. A `Date` field is not authenticated, and a client that took `t` from one could be led to seal a request for a later time, which whoever kept it could use once that time came. When a fetch gets an answer that is not sealed and the answer's `Date` field differs from the device's clock by more than 300 s, the app says: "the server's clock and this device's clock differ by about N minutes. Check this device's time against a source you trust, then refresh." in place of the message that the link may have been reset. Over TLS it shows this as it is. Over plain HTTP, where anyone on the way can write the field, it marks the message "unverified". It changes nothing else. A clock that far off already refuses fresh documents by their `issued_at`.
- **Retries.** A request that timed out is never sent again. A retry is a new request, with a new `t` and a new context.

### Gateway keys

- **What the key is.** An X25519 key pair of the panel, made by the panel, kept on its host with mode 600, outside its database, and apart from the signing key, the panel keys of "Storing the token" and the key of a pinned endpoint's certificate. It opens requests and seals answers, and nothing else. It is not the signing key because it must be online at the public endpoint while the signing key may be kept offline (threat model Q9), and a stolen gateway key must not sign documents.
- **In a document.** `gateway_keys` lists 1 or 2 gateway keys. The first is the active key, and the second the next one. After accepting a document the client holds exactly that list, and on a first import the key of the link. The list is signed, so it needs no tie to the keys the client held before: the signing key is the root of trust.
- **How a client uses them.** It seals to the first key. When an HTTP answer arrived and it was not a sealed answer that opens, it tries the second key once, in the same refresh, with a new request. A timeout, a failed TLS handshake or pin, or a failed lookup is no reason to try the second key: it says nothing about the key. Never more than one retry.
- **The next key is kept off the host.** The panel makes it at setup and shows its private half once for the operator to put away. It writes that half to a file named in its configuration and reports the file as still on the host until the operator has moved it away. It lists the next key second in every document, so that every client holds it from its first refresh. A next key left on the server is taken with the active one. The next key helps when the active key is lost, or stolen with no recordings. It does not help after a theft with recordings, below.
- **A routine switch.** The operator loads the next key. The panel makes it active, makes a new next key, and signs documents that list the two. It keeps the old key as retired, and opens requests sealed to it for the time in the table of numbers, 120 days by default, then destroys it. Clients that refresh move to the new key. One that has not refreshed is served under the old key while the panel keeps it, and falls back to its second key once the old one is gone. A link made before the switch carries the old key and works while the panel keeps it. After that, its first import gets the unknown-path answer, and the user needs the link shown again, which carries the active key. Before it destroys a retired key, the panel shows how many accounts sent a request under it in the last 30 days, and how many accounts have no device yet.
- **Key ids.** Each new key takes the id after that of the last key the panel made, counting modulo 256. The panel never holds or lists two keys with one id.
- **How often.** The panel reminds the operator to switch every 180 days. A recording made under a key that has been destroyed can no longer be opened by anyone.
- **A stolen key.** The operator switches, and the old key is destroyed at once, not kept. Clients move to the next key by their fallback. If the thief has, or can get, recordings of requests, from a content delivery network, a proxy that ends TLS, a relay mirror or a plain HTTP path, it opens every recorded request sealed to the stolen key since that key was listed, with the answers to them: tokens, device keys and secrets, and documents. The switch cannot take that back. Every account that sent a request under that key then needs its token reset and a new link, as after the theft of a pinned endpoint's key, and the panel offers that reset for all of them in one action. Only a theft known to come with no recordings is answered by the switch alone.
- **A lost key.** A panel that has accounts and finds no readable active gateway key does not serve subscriptions: the endpoint answers every request as an unknown path, and the panel says so loudly, as when its key file is missing. It never makes a gateway key by itself. With the next key in hand, the operator loads it, which is a switch, and clients follow by their fallback without a question. Without it, the operator makes new keys by an explicit action, and clients learn the new key only from a newer document on a static mirror, or from the link shown again. Tokens and devices stay valid, so a client that imports the new link keeps its subscription and its device. That is a smaller loss than the signing key's, after which every user needs a new subscription.

### What each party sees

| Who | Sees | Does not see | Can do |
|---|---|---|---|
| The network, with a TLS endpoint | The host name in the TLS handshake, the handshake's fingerprint, the endpoint's address, the times, and inside TLS one request of a fixed size and an answer of one of five sizes | The path, the key id, the request, the answer, which `op` it was | Block the host. Learn over time, from the fixed sizes and the timing, that this host serves a pattern of fixed requests. |
| The network, with a plain HTTP endpoint | The host and port, the path, every outer header field, the key id, the times, and the exact sizes: 1,073 bytes out, one of five sizes back, or the host's unknown-path answer | The token, the device key and secret, `kids`, `op`, a device name, the document | Block the host, the path, or any `POST` of 1,073 bytes, which a filter can match on every request and every user. Change or drop bytes, which makes the fetch fail. Replay a request, which the gateway refuses. Tell which addresses fetch from this endpoint, and when, now and later from its records, and so that they use this app. |
| Whoever ends TLS: the operator's web server, a content delivery network or a reverse proxy in front of the panel | The client's address, or the relay mirror's, the times, the path, the key id, the sizes, and whether the answer was sealed or the unknown-path answer, which says whether a request was valid | The token, the device key and secret, `kids`, `op`, the document | Refuse, delay or drop. Replay a request, which the gateway refuses. |
| A relay mirror | The same, and it forwards the sealed bytes unchanged | The same | The same |
| The gateway | Everything in the request, and the document | Nothing of it is hidden | It is the provider |

- **The key id** is the one byte outside the seal. It says which gateway key a client sealed to, so roughly how recently it refreshed, and it is the same for every request to one provider while a key is active.
- **Sealed bytes are not random bytes.** `enc` is an X25519 public key, even with its top bit drawn at random, and the sizes are fixed, so a request can be recognized as this kind of request by its shape. Hiding that is TLS's work and a shared host's, not the seal's.
- **Plain HTTP gives up hiding, not secrecy.** The exchange is as secret over `http` as over `https`. What is lost is everything in the first row that TLS hides, and the fixed size makes a plain endpoint easy to match on every request. A provider uses `http` where it has no domain and wants no certificate, or where a TLS handshake is itself what gets blocked. Wherever a plain link, a plain entry of `refresh_urls` or a move to a plain endpoint is confirmed, the app says, as it does for `ws-plain`: "the network can tell that you use this app, now and later in its records."

### The endpoint

What the endpoint owes, as the threat model requires of it:

- Tokens of at least 128 bits from a secure random source. The request is matched by the token's lookup value (see "Storing the token"), never by the token itself, and the values are compared in constant time. The check costs the same whether the token is known or not: one HMAC, one lookup, and one comparison, against a dummy value when nothing was found. A token that is not in the one encoding of the link grammar is an unknown token.
- No session cookie read or set, and nothing else served at that path.
- **One answer for everything that is not a valid request.** Each named endpoint is one path behind the operator's own web server. For an unknown token it does not compose a not-found answer of its own, which would differ from the web server's. Either the web server is set up so that the endpoint hands the request back and the web server answers as it does for any unknown path, or the endpoint learns that answer by one request to the web server for a path that does not exist, at start and on reload, and repeats its status, header fields and body, in the way the transports page has a listener learn its decoy's header fields. The first way is exact and is preferred. The bytes must be identical. What difference in time remains between an unknown path and each kind of refused request is measured, and the method and the result are to be stated on this page.
- **Limits per source** are applied by the web server to every path alike, so that reaching one says nothing about this path.
- **Limits that a link holder cannot turn on the user.** An enrolled device is recognized by its key and secret and has its own allowance, per token and device. Requests with device keys the endpoint has not seen share a separate, tighter allowance per token, and an account has at most 2 pending places. A holder of the link can use up those two things. It cannot use up the allowance of the user's enrolled device, so the user's refreshes go on.
- The request body is hostile input to the panel, before the seal is opened and after. `device_name` is stored and shown as text only, after the same filter the client applies to display text.
- A signed refusal is signed once per account and reason and reused while it is within its age limit, so that a holder of a valid token cannot make the panel sign at will. The lookup values are held in memory, so a random body is never a read of the database.
- The work of "What the gateway does" is done for every `POST` to the path, so that a request that does not open, an unknown key id and an unknown token cost the same.

### Storing the token

The panel keeps each token in two forms, keeps the other secrets of its accounts sealed, and keeps the keys for all of it where a copy of the database does not reach. The threat model requires secrets at rest to be encrypted under a key that is not in the database file. This is how the panel meets that for subscriptions. A label in double quotes is written as on the transports page.

- **To find the account.** The panel stores the lookup value `HMAC-SHA-256(lookup_key, "veilway v1 sub token" || token_bytes)`, where `token_bytes` are the 16 decoded bytes of the token. A fast keyed hash is enough, because the token is 128 bits from a random source and cannot be searched for. The key is used so that a database alone holds nothing derived from a token that can be tested against a guess, and the label so that the value cannot be mistaken for another use of the same key. A plain hash would be as strong against guessing, and was passed over because the panel has a key file for the next items anyway.
- **To show the link again.** So that an operator can copy a user's link again later, the panel also stores the token sealed with ChaCha20-Poly1305 (RFC 8439), the AEAD the rest of the protocol uses, under `copy_key`, with a random 12-byte nonce and the associated data `"veilway v1 sub token copy" || record_id`. The record id is 16 random bytes made when the account is created, kept in the record and never reused, so it is not a row number that a database could hand to a new account. A copy moved to another record does not open. A reset makes a new token, a new lookup value, a new nonce and a new copy, and deletes the old ones.
- **The other secrets of an account.** The device's transport secrets, any preshared key and any provider-issued private key are sealed in the same way under `secret_key`, with the associated data `"veilway v1 sub secret" || record_id || name`, where `name` is the field's own name. They are opened only to build a document. The device secret is not stored at all: the panel stores `HMAC-SHA-256(lookup_key, "veilway v1 sub device secret" || secret_bytes)` and compares it in constant time, since it only has to be recognized.
- **Where the keys are.** `lookup_key`, `copy_key` and `secret_key` are three keys of 32 random bytes. They live in one file with mode 600 next to the panel's other secrets, outside the database. A backup of the database does not include that file unless the operator chooses to include it, and the panel says what that costs when they do. The file is kept apart from the subscription signing key: not in the database, not in the same file, not in the same backup. The panel's setup and its backup page tell the operator to back the key file up on its own, apart from the database, because a copy of the database does not hold it and a copy of the file alone gives nothing.
- **When the key file is missing.** A panel that has stored accounts and finds no readable key file, or a file that does not open a record it holds, does not serve subscriptions. Its endpoint answers every request as it answers an unknown path, which is the one answer the endpoint has, and the panel says so loudly: in the administrator's interface on every page, and in its log at error level at start and then once an hour. It never makes new keys by itself, since that would silently break every link. A panel with no accounts makes the keys at its first start, which is setup. Making new keys on a panel that has accounts is an explicit action by the operator, which states before it runs that every token becomes unknown and every sealed secret is lost. What a lost key costs: with `lookup_key`, every token and every device secret is unknown, and every link must be reset and every device enrolled again. With `copy_key`, only the copying of links again. With `secret_key`, every transport secret, preshared key and provider-issued private key, so every device needs new secrets and a new document, and a device with a provider-issued key is lost.
- **Showing a link.** Opening a copy is an export of a secret, so it needs recent re-authentication, as the threat model requires of an export. The token is in memory only for that request. It travels in no URL of the panel, so it is in no browser history, and the answer is sent with `Cache-Control: no-store`. The token is written to no log and no audit log, and the audit log records that a link was shown and by whom, not the link. A QR code of the link on the screen is the same secret as the link and is shown in the same way, never stored as an image. What is not secret in a link (the endpoint, the key, the pin) the panel can show at any time.
- **"Show links once."** An operator setting, off by default. When it is on, the panel stores the lookup value only and no copy. It shows a link at creation or at reset, and never again: a lost link is replaced by "reset link". Switching it on deletes the copies that exist. Switching it off does not bring them back: tokens made while it was on have no copy, and the operator resets a link to get one.

**What a stolen database gives.** The lookup values and the sealed copies and secrets, and the names, addresses and times in its records. No secret: no working token, because a lookup value cannot be turned back into a token or used in its place, and nothing sealed opens without its key. A stolen database plus the key file gives every token and every sealed secret: every user's account, with their devices' transport secrets, and any provider-issued private key. With "show links once" on, the same theft still gives the sealed secrets, though no token, since there are no copies and the lookup values cannot be inverted. Neither gives the signing key, which is a separate secret: with the tokens alone an attacker can read documents but cannot sign one. An attacker who also had the signing key could sign documents for every client, and that is why the signing key is kept apart. Sealing does not help against an attacker who can read the running panel, which holds the keys in memory.

The trade-off: with copies, a stolen database and its key file together give every link, which is the cost of links that can be copied again. With "show links once", an operator cannot copy a link again, and a user who lost theirs gets a reset, which stops the old token and every device that has not yet imported the new link from refreshing until it does.

### Devices and their places

The same device key and secret always name the same device, so a fetch is idempotent. A key the provider has not seen takes a pending place, which becomes permanent with `"confirm"` and is freed by `"release"` or when the time in the table of numbers passes.

A holder of a leaked link can enroll devices of its own while places are free. The format does not stop that with a second secret in the link. It makes it visible and recoverable:

- Every document lists the account's devices in `devices`, pending ones included and marked, with the name the user gave each, when it was enrolled, and which one is this device. A device the user does not know is a sign that the link has leaked, and the app says so when the list grows.
- A device that finds every place taken gets `"device_limit"`, not silence.
- A device is removed in the provider's panel. The format has no request that removes a confirmed device, because a bare link would then let its holder remove the user's devices. A provider that resets a link should offer to remove the devices that were enrolled with it.
- The client keeps its device key and secret where a reinstall can find them again, where the platform allows, so that reinstalling the app does not take a new place. That makes them an identifier that outlives the app's removal. Removing a subscription in the app first sends `"leave"`, so that the provider removes the device and its place is free, and then deletes its key, secret and link. `"leave"` goes to the endpoints a refresh tries, never to a static mirror, and the app waits for it 10 s at most: a provider that did not take it keeps the device until its operator or its own cleanup of idle devices removes it. A panel before v0.2.11 answers `"leave"` as a request it cannot read. The app has one action that deletes everything it has stored.
- A name typed for a device is shown to anyone who holds the link, in the device list. The app says so where the name is typed.

The cost: recovery from a filled account needs the provider.

### How a fetch is made

- A native fetch is the sealed exchange of "The encrypted exchange", over `https` or, where the link, an entry of `refresh_urls` or a confirmed move says so, plain `http`. A legacy link is `https` only. How the endpoint is reached:
  - **A TLS link with three fields, no pin:** normal certificate validation, TLS 1.2 or later, and the client's browser-like TLS where the build has it. The certificate hides the exchange's shape and the path from the network. The token is protected by the seal, and the document by its signature.
  - **Four fields, or a pinned entry:** the rules of "A pinned endpoint", and no chain validation.
  - **A plain link, or a plain entry:** HTTP/1.1 over TCP, nothing else. The seal and the signature protect everything, and nothing hides the host, the path or the sizes.
- No `Accept-Language` field.
- `Accept-Encoding: identity`. An answer with a `Content-Encoding` field is refused, which removes the decompression bomb as a case.
- No redirect is followed. A request that is redirected is a failed fetch.
- The timeout to connect in the table of numbers, and the size rule and time limits of "How the client opens an answer". The body is read up to its limit and no further.
- The endpoint's host name is looked up once per fetch, by the resolver in force: the tunnel's when the fetch goes through a tunnel, the system's when it does not. The address that was checked is the address that is dialed. An address that is loopback, link-local (169.254.0.0/16, which holds the cloud metadata addresses, and fe80::/10), unspecified (all of `0.0.0.0/8`), multicast or broadcast, or an IPv6 address that carries an IPv4 address (the forms the profile rules refuse, "Transports of a profile"), is refused, for the endpoint, for the endpoint of a move and for every entry of `refresh_urls`, and no question is asked about it.
- **A private address is asked about.** "Private" is the list of the profile rules ("Asked about once per profile"). When the endpoint's host, an IP literal or a name, gives no address that may be dialed except private ones, and at least one of those, the fetch stops before anything is sent, and the app says: "This subscription is on a private address (192.168.1.20). Only continue if you run this server yourself, for example at home." It shows every private address the host gave, and a yes goes on with exactly those. A host that gives a public address beside a private one is dialed at the public one and asked nothing; the private one is never dialed without a yes.
- **The yes is to the addresses, and is kept with the subscription.** It names the IP addresses that were shown and never the host name, so a name that later comes to another private address (DNS rebinding) is asked about again. It is kept with the held subscription, so that the refreshes after it need no question, and it is dropped with the subscription. Only an address that is private and may be dialed can be in it. A subscription stored before this rule has none. What is stored is read as untrusted: an address in it that the rules refuse is ignored, and at most 16 are kept. A refresh host or the endpoint of a move that a later document adds and the user confirms is held to the same rule.

### A pinned endpoint

An endpoint is pinned when its link has a fourth field, or when it is an entry of `refresh_urls` given as an object with `pins`. A provider with no domain and no certificate from an authority serves its endpoint with a self-signed certificate, and the link carries the pin of that certificate, so the app trusts exactly that server and no other. What the client does on a pinned endpoint is what the `tls` transport does on a candidate with `self_signed` (see "`tls`" on the [transports](../transports/) page), with these particulars:

1. **TLS 1.3 only.** An endpoint that does not negotiate it fails the fetch. The client uses no early data and no resumed session, so that every fetch shows its certificate.
2. **The check.** The SHA-256 of the SubjectPublicKeyInfo of the end-entity certificate must equal one of the endpoint's pins (1 or 2 are held). The TLS 1.3 handshake's signature is still verified against that key, by the TLS library's own verification, so that a server which shows the pinned certificate without its key fails. The chain, the name and the dates are not checked, and any other certificate the server sends is ignored. There is no fallback to chain validation, no "trust this certificate" button, and no way for the server to name a pin.
3. **The name sent.** A host name is sent as the server name. An IP literal is not sent, so a pinned link with an address in it makes no lookup and shows the network only a connection to that address.
4. **Nothing is sent before the check passes.** The sealed request is written only after the handshake has finished and the pin matched.
5. **A mismatch** (no pin matches, the signature fails, or TLS 1.3 is not negotiated) is a failed fetch. It is never a signed refusal and never a refusal by the endpoint, since nothing was authenticated, and nothing was sent. Whatever the server then writes is not read. The client shows: "the subscription server's certificate does not match this link. If your provider has changed it, ask for a new link. If not, something between you and your provider answered in its place." It keeps the last good document and backs off as after any failure, and it goes on to the next entry of the list of endpoints.
6. **A link without a pin that meets a self-signed certificate** fails chain validation like any other, and the app adds: "this link has no certificate part. If your provider uses its own certificate, part of the link was lost on the way."
7. **The pins held** change in two ways only: the user imports a link, which replaces them with the link's pin, and an accepted document changes them, as "Pins, and a standby" says.

**Pins, and a standby.** A client learns a new pin only from a document, and gets a document only from an endpoint it can reach with a pin it holds. So a pinned endpoint is never left with one pin. The operator makes a second key, the standby, and lists both pins for the endpoint in the panel's endpoint settings. Every document the panel signs for that endpoint carries both in `endpoint_pins`: the pin of the certificate the web server presents, and the pin of the standby. Every client holds both from its first document. A client that accepts a document holds exactly the pins in its list, as it holds exactly the signing keys of a document, and accepts a certificate that matches either.

- **The standby key is kept off the server.** The operator keeps its private half away from the host that presents the active certificate. If the standby stays on that server, whoever takes the active key from it takes the standby with it, and then a stolen key means a new link for every user.
- **A switch.** To change the key, planned or after a theft, the operator puts the standby key on the web server, makes a new standby, and saves the endpoint's pins as the new active pin and the new standby. The list includes a pin the client holds, which is the former standby, so clients accept it. The user is asked nothing. The client notes "the provider renewed the certificate of its subscription server" with the date in the subscription's details. A new certificate for the same key needs no step, since the dates are not checked.
- **A list must include a pin the client holds for that endpoint,** or the document is refused, so a pin set cannot jump to keys the client has no tie to. The first pins of a refresh entry that a document adds have nothing to include, and are taken on the signed document's word and the user's confirmation of the host. The signing key is the root of trust, so this is no new trust. The same holds, at import and when stored state is read back, for an entry of `refresh_urls` on the main endpoint's host and port. A document fetched from the endpoint of a pending move is held to the move's `pins` in place of the main endpoint's, see "Moving the main endpoint". Pins stored for the endpoint are exactly the `endpoint_pins` of the last accepted document when it had that list, and stored pins that differ from it are treated as damaged storage.
- **What the client cannot enforce, the panel and the operator must.** The client cannot tell a standby that was listed long ago from one listed yesterday. The operator lists a pin for the time in the table of numbers before the web server presents it. The panel refuses to save a pin list for an endpoint that keeps none of the endpoint's current pins, and says why. A list saved without one would lock every refreshing client out of its endpoint, with new links as the only way back.
- **A second pinned entry of `refresh_urls` on another host** does the same for a stolen key, and a pinned entry follows the same rule with the list in its `pins`.

The other choice would be a new link at every key change. It was not taken because a link on a wall or in a chat cannot be recalled. What the rule costs is a client that was offline through the whole notice time: its pins are those of an endpoint that no longer exists, and it shows the mismatch message above and needs a new link. This is the same state as a client that missed a rotation of the signing key. When the endpoint's key was stolen and the standby is not lost with it, the switch above answers it. Without a standby, the panel cannot recall the pin from clients that hold it, and every user needs a new link. In both cases the operator resets the tokens in the panel, since whoever holds the key and the network can have received them. A client that imports an old link sets its pins back to that link's pin, which is covered by the same reset, since the old link's token is then unknown.

**What the endpoint's certificate is.** The panel listens on loopback only, so the certificate of a pinned endpoint is presented by the operator's web server, not by the panel. It is made for that endpoint, with a key of its own, apart from the signing key and from the panel keys of "Storing the token". It is never the certificate of a node's `tls` listener, and the two never share a key. What it says about itself follows "What the node writes into its own certificate" and the validity row for a self-signed certificate on the transports page: no fixed placeholder name, a random serial, a normal validity renewed with the same key before it ends, an ECDSA key on P-256, and the common extensions of a server certificate, with the host (a name, or the IP address) as its subject alternative name.

### Moving the main endpoint

A provider may need to move users to another endpoint: a host that was blocked, a new domain, a panel that moves to another server. Without a move, a document can only add `refresh_urls`, and a new endpoint means a new link for every user. `main_endpoint` is the signed way to move them.

The **main endpoint** of a subscription is the link's endpoint until a move completes, and the endpoint of the last completed move after that. It has a URL and a kind: checked by chain, pinned, or plain.

**The member.** `main_endpoint` is an object:

| Member | Type | Rule |
|---|---|---|
| `url` | string | The endpoint, `https` or `http`, at most 256 characters, with no fragment, under the rules for a URL the token is sent to. An IP literal only with `pins` or with `http`, in the one spelling of the link. |
| `pins` | list of 1 or 2 pins, standard base64 | For an `https` endpoint with a self-signed certificate, as the `pins` of a pinned entry of `refresh_urls`. Not allowed with `http`. Absent: the certificate is validated by its chain. |
| `gateway_keys` | list of 1 or 2 gateway keys | The keys of the gateway behind that endpoint, in the form of the top-level `gateway_keys` |

A `main_endpoint` that breaks a rule refuses the document. It is ignored in a whole document and in a refusal. A document whose `main_endpoint` names the URL and the kind of the client's main endpoint asks for nothing. One that names another asks for a move.

**A move, step by step.**

1. A document that asks for a move is accepted and takes effect as any document does. The move is held as pending, and nothing is sent to its endpoint yet. The app notes "the provider is moving this subscription to <host>" in the subscription's details, and asks at the next refresh the user starts, as it asks about a refresh host a document added. An automatic refresh asks nothing and goes to the main endpoint.
2. The question shows the new host with its registrable domain marked, the old host, and how the new one is checked: a certificate from an authority, the provider's own certificate named in the document, or plain HTTP, with the words "the network can tell that you use this app, now and later in its records." The yes is the move's one confirmation. A no keeps the main endpoint, and the move stays in the details, where the user can still say yes for as long as documents name it.
3. After the yes, a refresh goes first to the new endpoint, sealed to the move's `gateway_keys`, then to the main endpoint as a fallback, then to the confirmed `refresh_urls` and static mirrors as before.
4. A document fetched from the new endpoint is checked against the move, not against the main endpoint: its `main_endpoint` must name that endpoint, URL and kind; its `endpoint_pins`, when the endpoint is pinned, must include a pin of the move's `pins`; and its top-level `gateway_keys` must include a key of the move's `gateway_keys`. One that fails any of this is a failure of that endpoint. One that passes completes the move when it is accepted, before any later document is checked: the client then holds that endpoint, its kind and its pins as its main endpoint, holds that document's `gateway_keys`, and drops the old endpoint. From then on `endpoint_pins` describes the new endpoint, under the rules of "Pins, and a standby".
5. Until it completes, each accepted document decides the pending move again: one that names the same move keeps it, one that names another move replaces it and is asked about anew, and one that names the main endpoint or leaves the member out cancels it.

**The rules.**

1. **Only a signed move.** A move comes only from an accepted document: verified under a key held, with the subscription's `subscription_id` and a serial above the one held. No answer, header field or redirect moves anything.
2. **The same subscription.** A document from the new endpoint is held to every rule of a refresh: a key held, the same `subscription_id`, a higher serial. One that fails is a failure of that endpoint, and the old endpoint is tried after it.
3. **Any change of kind.** A move may change how the endpoint is checked: chain to pins, pins to chain, TLS to plain HTTP and back. It is the one way the kind changes without a new link, and it is allowed only because the signing key signed it and the user confirmed it. The question says what changes.
4. **No new trust.** Whoever holds the signing key can already sign any profile, so a move gives it nothing it lacked. The pins and gateway keys of a move are taken on the document's word, as the first pins of a refresh entry are.
5. **Chains of moves.** A document from the new endpoint may name a further move, which is confirmed and completes on its own. The fallback is always the main endpoint, the last one the client completed a move to or took from a link. A client holds one main endpoint and at most one pending move, never a list.
6. **Rollback.** Moves are under the serial like everything signed: an older document is refused, so it can neither undo a completed move nor bring back a cancelled one. Importing a link sets the main endpoint back to the link's, as it sets the pins back, and the next document asks for the move again.
7. **One host, one role.** The endpoint of a move is not the host of a static mirror. It may be the host and port of an entry of `refresh_urls` of the same kind, which is how a relay mirror becomes the main endpoint. The address rules of "How a fetch is made" hold for it.
8. **Which gateway.** A request to the main endpoint is sealed to the top-level `gateway_keys`, and a request to the endpoint of a pending move to the move's. An entry of `refresh_urls` follows the panel that signed it: while a move is pending, the client keeps the entries and the `gateway_keys` of the last document from the main endpoint for them, and a request to such an entry is sealed to those keys. Once the move completes, the entries and keys of the new endpoint's document apply.

**What the panel does.** An operator names the endpoints a panel answers on, each with its URL and its pins if it has a self-signed certificate (up to 16 endpoints, each on its own host and port). All endpoints of one panel share its gateway keys. The operator's web server passes each public URL to the panel at the panel's `sub_path` followed by `/` and the endpoint's name, for example `/sub/main`, and the panel tells which endpoint a request reached by that path alone, never by the `Host` field. An account uses the endpoint set for it, else the endpoint set for the first of its groups that has one, else the default endpoint. The operator moves a user, a group or a selection of users to another named endpoint: their documents then name it in `main_endpoint`, and a link shown again carries it. The panel keeps answering on the old endpoint, so an old link, which names it, keeps working there, and its first document asks for the move: on an import that question is part of the confirmation, and its yes covers the move. The panel shows how many moved accounts still refresh on the old endpoint, and the operator retires it when that is none, or accepts that the rest need their link shown again.

### When a fetch happens

A fetch outside a tunnel tells the local network that this device talks to this provider's subscription host. On a hostile network that marks the user even while they are not connected. So:

| Situation | What the client does |
|---|---|
| A tunnel of one of this subscription's own profiles is up | Refreshes automatically, on the interval, through that tunnel. |
| No tunnel is up | Does not refresh by itself. The user can ask for a refresh. Before it goes out, the app names every host it may contact (the endpoint and the accepted `refresh_urls`) and says what the network will see: a lookup of each name and a connection to it, over TLS or, for a plain host, over HTTP with the host and path in the clear. |
| A tunnel of another subscription is up | Does not refresh this subscription by itself. When the user asks, the app offers the two ways below. |
| First import | The request leaves only after the user's first yes, by the same choice of ways. When the endpoint is on a private address, that is a second question after this yes and before any request, see "How a fetch is made". |

**When another subscription's tunnel is up,** a request for this subscription can go two ways, and each shows something to someone. The app shows both and lets the user choose:

| Way | Who sees what |
|---|---|
| Disconnect, and fetch from the device's own address. This is the default. | The local network sees a lookup of this provider's host and a connection to it. The other provider sees nothing. With the kill switch on, the user has to disconnect or switch it off first. |
| Fetch through the tunnel that is up. Only when the user chooses it, each time. | The other provider sees a lookup of this provider's host and a connection to it. The local network sees nothing new. This provider's host sees the other provider's exit address, not the user's. |

On a network the user is hiding from, the second way is often the safer one, and the app says that in plain words. It is never taken without the user choosing it.

Automatic refresh can be switched off per subscription. A provider cannot ask for refreshes more often than every 15 minutes, and it still sees the time of every refresh and the node address it came from.

### When nothing works

A user whose profiles have all stopped working can refresh only by asking. With the kill switch on, nothing leaves the device outside a tunnel, the fetch included: the user has to switch the kill switch off, or disconnect, to refresh from the device's own address. The fetch is not an exception to the kill switch.

If the subscription host is blocked as well, the format has three partial answers and no complete one:

- `refresh_urls`: the provider can list other endpoints for the same subscription. The client tries them in order after the first fails. Because every request is sealed to the gateway and every document is verified against a key held, a relay mirror needs no trust: it carries sealed bytes.
- A whole document can be carried in a link, a QR code or a file (see "Import"), so a provider can send a new one over any channel the user still has.
- `static_mirrors`: the provider can publish each device's recent document, sealed, on plain file hosting, ideally on a host name that is costly to block, and the client fetches it there with a plain `GET` when the endpoint and the relay mirrors fail. See "Static mirrors".

Fetching a subscription through the fronting options of the transports is not specified in this draft. See "Open questions".

## Static mirrors

A static mirror is plain file hosting that holds, for each device, a recent signed document of that device, sealed so that only that device can open it. A cloud storage bucket, a content delivery network, a code host's raw file service or anyone's web server will do, and "Choosing a host" says which of them a censor can block cheaply. The host runs no Veilway code, receives no request body and never sees a token. The client fetches its file with a plain `GET` when the endpoint and the relay mirrors have failed, opens it, and checks what is inside exactly as it checks an answer from the endpoint.

On this page a **relay mirror** is an entry of `refresh_urls`. It receives the sealed request, forwards it unchanged to the panel's gateway with its own signed header (which names the address the request came from and covers a hash of the sealed bytes), and hands back the sealed answer unchanged. It sees no token, no device secret and no document. The hop from the mirror to the panel is `https`, always, so that the mirror's header and the visitor's address are not on the network in the clear. To a request that carries a valid mirror header, the gateway answers anything it would answer as an unknown path with status 599, and the mirror passes on only a 200 with a body of one of the five sizes of an answer. Everything else it hands back to its own web server, which answers as on any path it does not serve. The signed header and its hash of the body stay as they are. A static mirror is the other kind: it receives no request at all, and it can only hand back a file the panel wrote earlier.

| | Relay mirror | Static mirror |
|---|---|---|
| What the host runs | A server that forwards the `POST` to the panel's gateway and its sealed answer back | Anything that serves files over `https` |
| Sees the token and the device secret | No. It carries them sealed. | Never |
| Sees documents | No. Answers are sealed to the request and come in five sizes. | No. It holds sealed files that all have one size. |
| Can enroll devices, fill places, fetch any device's document | No. It can replay a request it carried, which the gateway refuses. | No |
| How fresh its answer is | As fresh as the panel. It cannot serve an older answer, since an answer opens only for the request it answers. | Up to one publishing round, plus the host's cache, behind the panel, and without usage numbers |
| Serves a first import | No. A first import goes to the link's endpoint only, since `refresh_urls` comes with a document. | No |
| Serves `"confirm"`, `"release"`, a new device name | Yes | No |
| Trust the client gives its answer | None beyond the seal and the signature | None beyond the signature |
| What it learns | The address of each device that fetches through it, the times, the key id, the sizes, and whether an answer was sealed | The file names of a period, and the address and time of each fetch |

### Keys of a static mirror

A document is made for one device: it names the device's key, carries that device's transport secrets and marks it with `this`. So a static mirror holds one file per device, not one per account, and the keys of that file come from the token and the device secret together. Keys from the token alone would let anyone who holds the link read every device's document, transport secrets included, which is exactly what the device secret exists to prevent (see "The request"). The device secret is never sent to a static mirror. It only goes into the derivation.

The notation is the transports page's: a label in double quotes is its ASCII bytes followed by one zero byte, `||` joins byte strings, and `HKDF(salt, ikm, info, n)` is HKDF-Extract with `salt` and `ikm`, then HKDF-Expand with `info` to `n` bytes, all with SHA-256. `token_bytes` are the 16 decoded bytes of the token and `secret_bytes` the 16 decoded bytes of the device secret.

| Value | Derivation | Used for |
|---|---|---|
| `prk_m` | HKDF-Extract(salt `"veilway v1 sub mirror"`, ikm `token_bytes \|\| secret_bytes`) | Deriving the next two keys, nothing else |
| `k_name` | HKDF-Expand(`prk_m`, `"veilway v1 sub mirror name" \|\| device_pub`, 32) | Deriving file names, nothing else |
| `k_mirror` | HKDF-Expand(`prk_m`, `"veilway v1 sub mirror key" \|\| device_pub`, 32) | Deriving the key of each file, nothing else |
| `mirror_id` | HKDF-Expand(`k_name`, `"veilway v1 sub mirror id" \|\| be64(e) \|\| base_url`, 16) | The name of the device's file for period `e` on one static mirror |
| `k_file` | HKDF-Expand(`k_mirror`, `"veilway v1 sub mirror seal" \|\| salt`, 32) | Sealing one file, once |

- **`device_pub`** is the `device_public_key` of the device's requests: the 32 bytes of the WireGuard public key the client made and sends. It is never a key taken from a document, which with a provider-issued key names another one. The panel takes it from the request it derives from, and the client from its own key.
- **`e`** is the period number, `floor(unix_time / P)` with `P` = 604,800 s, and `be64(e)` is it as 8 bytes, big-endian. Period `e` starts at `start(e)` = `e × P`. See "Periods and clocks".
- **`base_url`** is the base URL exactly as the document's string holds it, after JSON decoding, which the URL rules limit to ASCII. Nothing is normalized: two base URLs that differ in any byte give different names. So every static mirror has names of its own, and files on two hosts cannot be matched by their names.
- **The file name** is `mirror_id` in lowercase hexadecimal, 32 characters, followed by `.bin`. One case only, because some storage folds the case of names. `.bin` because every host serves it as plain bytes, compresses nothing of that type, and it names no app.
- **Domain separation.** The six labels of this section (the five above and `"veilway v1 sub mirror file"` below) are used nowhere else. The token and the device secret enter no other HKDF: their other uses are the HMACs under the panel's `lookup_key`, the sealed copy of the token, and the sealed plaintext of a request. Nothing derived here can be taken for a lookup value, a stored copy, a transport key or a control key, and none of those can be taken for these.
- **The client holds everything it needs:** the link, its device key, its device secret and its clock. It stores nothing new.
- **What changes them.** A reset of the token, a new device key or a new device secret gives a new `k_name` and a new `k_mirror`. The name changes in every period and differs per static mirror. `k_mirror` is fixed for the life of one token and one device, which is what "What the host keeps" is about.

### Periods and clocks

The client computes `e` from its own clock and asks each static mirror, in one refresh, for exactly one name: the name for `e`. It never asks for the names of `e - 1` and `e + 1` as well, in the same refresh or as a retry, since two names asked together would tie two periods of the device together for the host.

The publisher covers clocks that are off instead. With `W` = 86,400 s, in a round at time `t` in period `e`, it:

1. writes the files of `e`;
2. from `start(e + 1) - W` on, also writes the files of `e + 1`;
3. until `start(e) + W`, also writes the files of `e - 1`, and deletes them in the first round after.

So the files of one period exist from `W` before it begins to `W` after it ends. No file lives longer than `P + 2W`, 9 days, and a client whose clock is off by less than a day finds its file.

The format already needs a correct clock, and a day is far looser than what it asks. A device whose clock is more than 300 s behind refuses every fresh document by its `issued_at`, and expiry is judged by the same clock, so a clock off by a day has broken refreshes before it misses a static file. The panel needs a synchronized clock as well: its setup says it requires NTP, and it says so on every page while the system reports its clock as not synchronized, because a panel whose clock is off by more than `W` writes names that no client asks for.

### The file

| Offset | Length | Content |
|---|---|---|
| 0 | 32 | `salt`: 32 bytes from a secure random source, drawn for this write and never used for another |
| 32 | size minus 48 | The sealed plaintext |
| size minus 16 | 16 | The Poly1305 tag |

The plaintext is sealed with ChaCha20-Poly1305 (RFC 8439) under `k_file`, with a nonce of 12 zero bytes and the associated data `"veilway v1 sub mirror file" || mirror_id`, where `mirror_id` is the 16 bytes, not the hexadecimal. The plaintext, size minus 48 bytes long, is:

| Offset | Length | Content |
|---|---|---|
| 0 | 4 | `n`, the length of the envelope in bytes, big-endian |
| 4 | `n` | The envelope: a signed document, as "Which files exist" says, with nothing added or removed |
| 4 + `n` | the rest | Zero bytes |

The sizes a file may have, the largest envelope each holds (the size minus 52), and the time a client allows for fetching it:

| Size of the file | Largest envelope | Time limit in all |
|---|---|---|
| 9,413 | 9,361 | 30 s |
| 36,979 | 36,927 | 30 s |
| 140,867 | 140,815 | 60 s |
| 538,201 | 538,149 | 120 s |
| 1,089,437 | 1,048,576, the response body limit. The space would hold 1,089,385. | 240 s |

The time limit is the one of the size the answer's `Content-Length` names, and of the largest size when it names none or names another number. The limit to connect is 10 s, as for any fetch.

**One size per folder.** Every file the publisher writes into a folder, decoys included, has the same size: the smallest size in the table that holds the largest envelope the publisher puts in that folder. When a larger size is needed, every file of the folder moves to it in that round. A folder moves to a smaller size only after 8 rounds in a row in which the smaller one held every envelope, so that a document that grows and shrinks around a border does not make the folder change size round after round. A file's size says nothing about its own document, and the folder's size says only the bracket of its largest one. A provider with many profiles pays for it in bytes: up to four times the size of a document per fetch, and in every round.

Decisions behind the layout:

- **No magic and no version byte.** The client knows what it asked for, since it built the URL. A magic number would let a host or a scanner find Veilway files by their first bytes. Without one, a file is a random salt and ciphertext, which look like random bytes to anyone without the key. The version is in the labels: the associated data and every derivation begin with `"veilway v1"`. A later version has other labels, so other names and other keys, and a client never opens a file of another version. There is nothing on the wire to downgrade.
- **A key per file instead of a random nonce.** The protocol's AEAD is ChaCha20-Poly1305 through `ring`, which has no XChaCha20-Poly1305. A device's files are rewritten every round for the life of its token, which can be years. A random 12-byte nonce under one key would be safe at those numbers, but it puts a limit on how often one key may be used, which someone would have to keep. A salt that is never used twice gives every write its own key, so the zero nonce is used once per key, and nothing needs counting. A random source that repeated a salt would repeat a key and a nonce: the publisher draws salts from the same source as every key of the panel.
- **The id in the associated data** binds a file to its name and its period. A host that copies one file over another, or keeps a file under its name into another period, makes it fail.
- **The length inside the seal** keeps the size of the document out of sight, and the zero bytes after it are checked so that a file has exactly one valid form.
- **Sizes that are not powers of two.** A body of exactly 32,768 bytes is a more distinctive thing to look for than one of an odd size. The difference is small: any fixed set of sizes can be looked for.

**How the client opens a file**, in order. Any step that fails is a failure of this static mirror, and changes nothing:

1. The body is exactly one of the five sizes. The client reads at most 1,089,437 bytes, and a body with more is a failure without reading further.
2. It derives `k_file` from the first 32 bytes and `k_mirror`, and opens the rest with the associated data above. A tag that does not verify is a failure.
3. `n` is at least 1 and at most the smaller of 1,048,576 and the size minus 52, and every byte after the envelope is zero.
4. The `n` bytes of the envelope go into the same refresh as an answer from the endpoint, with every check of "What is checked, in order", "Identity", "Keys held for a subscription" and "Rollback and expiry". The client keeps one path for both: the static path hands over bytes, and nothing about where they came from is passed on or trusted. What it does with the result is in "Order and rate".

Opening proves only that the file was made by someone who knows `k_mirror`: the panel, the device itself, or anyone who has seen one of the device's requests in the clear. Requests are sealed to the gateway, so that is whoever holds the gateway's private key and a recording of a request, or a copy of the device's storage. It proves nothing about the provider. Only the signature does.

### Listing static mirrors

A document lists static mirrors in a top-level member of its own:

| Member | Type | Required | Rule and default |
|---|---|---|---|
| `static_mirrors` | list of at most 4 strings | no | Base URLs of static mirrors. Default empty. |

A base URL:

- is `https`, with a host name, no user or password part, no query and no fragment, at most 216 characters, and its path ends in `/`. The file URL is the base followed by the file name, with nothing between.
- follows the rules for a URL the token is sent to, although the token is never sent there: no percent-encoded control character, no `%2f` or `%5c`, no `.` or `..` segment in any spelling. One rule set keeps one parser.
- has no IP literal and no pins in version 1. Its certificate is validated by its chain, always. Static hosting with a certificate of its own has little use, and pins would bring the standby and notice rules of "A pinned endpoint" to hosts the panel does not run.
- does not have the host and port of the main endpoint, of the endpoint of a move, or of an entry of `refresh_urls`, and is not listed twice. One host has one role, so a yes to a static host never has to be told apart from a yes to send it the token.

A `static_mirrors` that breaks a rule refuses the document, as a bad `refresh_urls` does. A whole document has no static mirrors, whatever it lists, since it has no link to derive keys from.

**Why a member of its own, and not a new kind of entry in `refresh_urls`.** A client of this version refuses a document whose `refresh_urls` holds an entry of a shape it does not know, so a new kind of entry there would make every older client refuse every document of a provider that uses it. An unknown top-level member is ignored. It is also a different promise: a host in `refresh_urls` is one the user agreed to send the token to, and a static host is not.

**Confirmation.** The hosts of `static_mirrors` are shown on the import confirmation with the refresh hosts, marked as places that receive no secret. A static host that a later document adds is confirmed as a refresh host is: noted in the subscription's details, asked about at the next refresh the user starts, and not contacted before. What is confirmed is the host and port as a static mirror. A confirmed static host stays confirmed only while documents list it. The client keeps these confirmations in a form of their own, such as `host:port#static`, apart from the refresh hosts, so that a confirmed static host is not dropped for lack of an entry in `refresh_urls`.

### Choosing a host

What a censor sees of a static fetch is the host name in the TLS handshake. A host name that only this provider uses can be blocked at no cost to anyone else: its own domain, a name of its own under a hosting service such as `name.github.io`, a bucket addressed by its own host name, or a content delivery network's name for one customer. Once the censor learns such a name, the mirror is gone for every user.

Blocking costs the censor something only when the host name is shared by many unrelated sites and what identifies the provider's folder is in the path, which TLS hides. Examples are storage addressed by path, `https://<shared storage host>/<bucket>/<folder>/`, and a code host's raw file service, `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<folder>/`. Even then, a censor that can read the handshake's fingerprint or the sizes of answers has more to go on, see "What each party learns".

The panel carries a list of shared host names and warns about every base URL whose host is not on it: "only you use this host name. A censor that learns it can block it without blocking anything else."

Every host is to be taken as one that keeps every version of every file and lists the files to anyone: a code host keeps every commit and shows the tree, and storage may keep versions and list its keys. See "What the host keeps".

### How a client fetches a static mirror

The rules of "How a fetch is made" hold, with these differences:

- **A `GET` of the file URL, and nothing else.** No body, no token, no device key or secret, no `kids`, no cookie, no `Referer`, no `Accept-Language`, `Accept-Encoding: identity`, no `Range`, and no conditional field (`If-None-Match`, `If-Modified-Since`). The client stores no `ETag` or `Last-Modified` from a static host, because sending one back would give the host an identifier of the device that outlives the period.
- **Status 200 only.** Any other status, a 404 included, is a failure of this mirror. The content type is not checked, since hosts differ, and an answer with a `Content-Encoding` field is refused as for any fetch.
- **No redirect is followed.** The base URL in the document must be the address that serves the file, not one that redirects to it.
- **The time limits and the size rule of "The file"** in place of the fetch timeouts and the response body limit.
- **The certificate is validated by its chain,** with the client's browser-like TLS. Once the client has a browser's full fingerprint from its fingerprint pack, ALPN `h2` and the HTTP/2 settings included, a static fetch uses all of it. Until then a static fetch is not a browser's, see "What each party learns".
- **The same address rules.** The host name is looked up once per fetch by the resolver in force. A refused address is refused, and a private address is asked about, with the yes kept per subscription as for the endpoint.

**A failure is never a revocation.** A 404, a file of the wrong size, a file that does not open, padding that is not zero, and a document that fails a check are each a failure of that mirror and nothing more. The client goes on to the next place. It never takes a missing file to mean that the token was reset, the device removed or the subscription ended, since nothing about a missing file is authenticated. A static mirror can tell the client that the account is switched off or has expired only through a signed refusal, which is checked like any other.

### Order and rate

One refresh tries the places it may go in this order:

1. The endpoint of a confirmed pending move, when there is one.
2. The main endpoint: the link's, or that of the last completed move.
3. The confirmed entries of `refresh_urls`, in the document's order.
4. The confirmed entries of `static_mirrors`, in the document's order.

From an endpoint or a relay mirror, the refresh ends at the first accepted document, a newer one or the same bytes again, or at a signed refusal that verifies. A static mirror is tried only after every place before it failed in the same refresh, and from it the refresh ends only at a newer document that is accepted, or at a signed refusal that verifies:

- **The document the client already holds** means only that this mirror has nothing newer. The client tries the remaining static mirrors. If none has a newer document, the refresh is not a successful one: the time of the last successful refresh stays as it was, the reason shown is the endpoint's, and the backoff goes on as after a failure.
- **An older document**, which a stale cache gives, is refused by its serial, a failure of that mirror, and the next is tried.

When every place has failed, the refresh has failed: the client keeps the last good document, shows the reason the endpoint failed and that no mirror had a newer document, and backs off as after any failure.

The static mirrors add no fetches of their own. One refresh makes at most one `GET` per static mirror, for one name, and refreshes follow the interval, the backoff and the limit on refreshes by the user's request, as before. "When a fetch happens" holds unchanged: there is no automatic refresh outside the subscription's own tunnel, a refresh the user asks for outside a tunnel names the static hosts with the others before it goes out, and when another subscription's tunnel is up the user chooses the way. An automatic refresh inside the subscription's own tunnel reaches a static mirror through that tunnel when the endpoint has failed, and the host then sees the addresses of the provider's exits, see "What each party learns". A static mirror is never used for a first import, `"confirm"`, `"release"` or a new device name, which only the endpoint and the relay mirrors can serve.

### Publishing

The panel's publisher writes one folder for each base URL that its documents list, since the names depend on the base URL, and labels each folder in its interface by the host. The operator copies each folder to the host of its base URL, with any tool that also deletes what the folder no longer holds, such as a sync that deletes, or a git branch replaced in each round. A built-in upload may follow later. It would follow the same rules.

**What the panel stores.** The panel never stores the token in the clear or the device secret, so it derives a device's `k_name` and `k_mirror` at a moment it has both: at each request from an enrolled device that carries the current token and the right secret, which includes the device's `"confirm"`. `device_pub` is the request's `device_public_key`. It stores the two keys sealed with the account's other secrets (see "Storing the token"), under `secret_key` with the associated data `"veilway v1 sub secret" || record_id || name`, where `name` is `mirror_name` or `mirror_key` followed by the 32 bytes of `device_pub`, so that a key moved to another device's row does not open. The names of each period it computes from `k_name` when it writes them. Neither key gives a way back to the token or the secret. This works with "show links once", since the derivation needs no stored copy of the token. A device that enrolled before the provider switched static mirrors on gets files after its next request to the endpoint or a relay mirror, and a client learns the base URLs from a document, so a device needs one successful refresh after the switch before a static mirror can help it.

**Which files exist.** In each folder, for each period the round writes (see "Periods and clocks"):

- One file per confirmed device of each account whose token is current. A pending device has none.
- The document in it is the one the endpoint could answer to a `"fetch"` of that device, without its `usage` member. Usage is left out because a host may keep every version for good, and a record of a user's usage over time is what such a history would give whoever later opens it. While two signing keys are current, it is signed with the older of them, because a static fetch cannot say which keys the client holds, and every client that refreshed since the overlap began holds the older one. When nothing in the document has changed and more than half of its lifetime is left, the publisher may use the last one it signed for that device.
- **Serials.** The panel keeps the last serial it signed for each device, for the endpoint and the publisher alike, and signs each new document of that device with the larger of the current time and that serial plus 1. A document without `usage` is another body than the endpoint's, so it takes its own serial, and no serial is ever signed for two bodies.
- An account that is switched off or has expired: the signed refusal `"disabled"` or `"expired"`, signed afresh in every round so that it stays within the age limit of a refusal. No other refusal is ever put in a file.
- A reset of the token, the removal of a device or the deletion of an account deletes the files concerned, of every period, in the next round, not at once, so that the moment of the deletion does not mark the moment of the action. The new token's files appear after each device's first request with it.

**Rounds.** The publisher writes in rounds, every 1 to 12 hours as the operator sets, 6 by default. In every round it rewrites every file of every folder, real or decoy, with a fresh salt, whether its document changed or not, and writes nothing between rounds. So the host sees every file change in every round, and learns nothing about which documents changed or when. A round is at most 12 hours so that a refusal in a file is never older than its limit of a day, even behind a cache. Each round is written into a new directory, complete, and then put in place of the previous one in one step, a rename or a link that is switched, so that a copy made during a round never takes half of it. The operator's copy tool reads from the directory in place.

**Decoys.** Each folder also holds decoy files: random bytes from a secure source, of the folder's size, under names of 16 random bytes in the same hexadecimal form. A decoy belongs to one period of one folder, is written in the same window as the real files of that period, and is gone with them. The rules, for one period of one folder:

- With `R` real files, the number of decoys is at least the larger of 32 and `R / 4`, rounded up, and at most the larger of 64 and `R / 2`, rounded up.
- When the period's files are first written, the number of decoys is drawn uniformly from that range.
- In each round, the publisher draws, independently of each other and of every real change, whether one new decoy is born, with probability 1/4, and whether one decoy chosen at random dies, with probability 1/4. A birth and a death are never paired. When the count is then below the range, new decoys are drawn until it is inside. When it is above, decoys chosen at random are deleted.
- Decoys are rewritten in every round, like real files.
- A name the folder already holds is never chosen, by the publisher's own check, though at 16 random bytes that does not happen.

Decoys hide something only from those who have no record of fetches: a reader of the host's file list, a scanner, anyone who reads the host's history. To them the number of files gives the number of devices only within a range, and a new or vanished file may be a decoy. The host and anyone with its logs see that no client ever fetches a decoy, and can tell decoys from real files within a period.

**What a folder holds.** Only the files, named as above: no index, no listing, no manifest, no file that names the panel, the provider or the app. An operator's own web server serves the folder with directory listing off. A folder is never inside a path the panel serves.

**Caching.** The operator sets the host to send `Cache-Control: max-age=600` or less where the host allows it. A cache that holds a file longer costs only freshness: a client gets an older document, which its serial check refuses or which is the one it holds, and goes on to the next mirror. A cache that holds a 404 for a new file costs that device the mirror until the cache lets it go.

**What the host keeps.** Every host is taken to keep every version of every file, as a code host keeps every commit, and to list the files. A device's files open with `k_mirror`, which is fixed for the life of its token, so whoever later gets the link and the device secret, by a copy of the device's storage, or from a recorded request and the gateway's private key, can open every version that a host still keeps, of every period: the transport secrets, the profiles and the device list of their time. That is why published documents carry no `usage`. A key that moves forward with each period, so that a later key opens no earlier file, is an open question and not part of version 1.

**When the panel cannot publish.** A panel whose key file is missing or does not open its records publishes nothing and deletes nothing: it leaves the folders as they are and says so, as it does for the endpoint.

### What each party learns

| Who | Learns | Does not learn | Can do |
|---|---|---|---|
| The static host, its content delivery network, and anyone with its logs | The file names of each period, the folder's one size, the number of files, the time of each round, files that come and go. From its logs, for each file of a period: every fetch, with the address it came from and its time, and so which files are decoys. | A token, a device secret, a document, the size of any document, which files belong to one account, which file belongs to whom, which name of one period is which name of the next | Refuse to serve, delete files, serve an older version it kept, serve bytes that fail to open. Each of these is a failure of that mirror, or a document the serial check refuses. |
| A network observer between the device and the host | The host's name in the TLS handshake, the handshake's fingerprint, the time of the fetch, and an answer close to one of five sizes | The file, the document, and whether the file is real | Block the host. That costs it nothing when the host name is the provider's alone, see "Choosing a host". |
| Anyone who reads the host's file list or history (on public hosting, everyone) | Every file name and every version, when files come and go, and when they are rewritten, which is every round | Their contents, their owners, which are decoys, which files of two periods belong to one device | Fetch them, watch them, keep them, and report them to the host to have them taken down |
| A holder of the leaked link, without the device secret | Nothing about static files | Any file name or key | Nothing here. It can still use the endpoint, see "What a provider can and cannot do". |
| Someone with the link and the device secret: a copy of the device's storage, or whoever holds the gateway's private key and recorded a request of the device | The device's file names and its key | Other devices' files | Open every version of that device's files that a host still keeps |

**A file name is a pseudonym for one period.** Within a period, the host's logs tie every fetch of one device to one name: the addresses it fetched from, and when. A fetch from the device's own address gives the host that address, so a host that can tie an address to a person can tie the name to the person. At the change of period, every name of a folder changes in the same round, so the change marks nobody. Across periods, the host can still follow a device by what it saw in both: the same address, or the same habits of time. Names differ on every static mirror, so two hosts cannot match their files by name. A reset of the link gives the device new keys and so new names.

**Fetches say when other paths fail.** A static mirror is tried only after the endpoint and the relay mirrors failed. A host that sees many of its files fetched in one hour learns that many users of this provider could not reach the endpoint then, and from where.

**A fetch through the tunnel shows the provider's exits.** An automatic refresh that reaches a static mirror through the subscription's own tunnel comes from the address of one of the provider's exits. Over time the host learns which addresses are this provider's exits, and that the folder belongs to the provider who runs them.

**The handshake is not yet a browser's.** Until the client's TLS offers `h2` and a browser's HTTP/2 settings, it offers ALPN `http/1.1` alone, where a browser offers `h2` (threat model G61), and the subscription fetch has gaps of its own in what it sends (G63). Until both are closed, a host or a network observer that reads the handshake can tell a static fetch from a browser's request to the same host. On a shared host that is what separates these fetches from the other traffic to it.

**Replay.** The host can serve any version of a file it kept, and the cache can serve an old one. An old document passes the seal and the signature, and then meets the serial: lower than the one held is refused, the same bytes are no newer document. So a static host can hold a client on its current document until that document expires, exactly as anyone who answers a fetch can, and no further. It cannot serve one device's file as another's, or one period's as another's: the key and the id in the associated data differ.

**Deletion as a signal.** A file that goes away can be a reset, a removed device, a deleted account or a decoy that died, to those who see only the file list. The host's logs tell more: a real file was fetched and a decoy never was. Decoys do not hide a mass event either: a provider that resets every link deletes every real file in one round.

**Against a relay mirror.** A relay mirror sees no token, no device secret and no document: it carries sealed bytes, and learns the address of each device that fetches through it, when, and the sizes. It is fresher than a static mirror and serves every request, and it cannot serve an older answer. A static host holds no secret and sees no request, and can do nothing with what it holds but serve it or not. What a static mirror costs instead: its answers are older and carry no usage, it cannot serve a first import or enroll, its logs give each device a pseudonym for a period, and a host that keeps history keeps sealed documents that a later leak of the device's secrets opens.

**What stays visible.** A folder of files with random names and one size, all rewritten at once on a schedule, is itself a pattern that a host scanning for it could find, even though no file names the app. A host that bans such folders takes the mirror down. That is a failure of the mirror, and the endpoint, the relay mirrors and a whole document remain.

### Rules a static mirror keeps

1. **Nothing secret goes to a static host.** A static fetch is a `GET` of the file URL and carries no token, device secret, device key, `kids`, cookie, conditional field or other identifier of the device.
2. **A static mirror adds no trust.** The opened envelope goes through exactly the checks of an answer from the endpoint, by the same code. A file that opens is not trusted for having opened.
3. **A static answer changes nothing unless a newer document is accepted.** A missing file, any status but 200, a wrong size, a file that does not open, padding that is not zero and a refused document are each a failure of that mirror. None of them is a revocation, removes anything or warns of more than a failed refresh. The document already held is no newer document and no successful refresh.
4. **The order is fixed.** A static mirror is tried only after the endpoint and every confirmed relay mirror failed in the same refresh, and it is never used for a first import, `"confirm"`, `"release"` or a device name.
5. **No new fetches, one name.** A static host is confirmed by the user before it is contacted, a refresh makes at most one `GET` per static mirror, for the name of the period of the client's clock, and every rule of "When a fetch happens" holds.
6. **A file looks random.** It has no magic, no version and no length in the clear, and every file of a folder, decoys included, has the same size.
7. **One key, one seal.** Every write of a file uses a salt that was never used before, and so a new `k_file`.
8. **Every round rewrites every file,** real or decoy, into a new directory that takes the place of the old one in one step, and nothing writes a file between rounds.
9. **The panel keeps no extra secret to publish.** It never stores the token in the clear or the device secret for this. It stores `k_name` and `k_mirror`, sealed under `secret_key`, derived from the key of the device's requests.
10. **A file exists only for a confirmed device of an account whose token is current,** and holds only the endpoint's document for that device without `usage`, or the refusal `"disabled"` or `"expired"`. A reset, a removed device or a deleted account removes its files in the next round.
11. **Names are per period and per mirror.** The files of a period exist from `W` before it to `W` after it, no file lives longer than `P + 2W`, and each base URL has its own folder and its own names.
12. **Decoys belong to one period of one folder,** stay in their range, and are born and die independently, never in pairs, as "Publishing" says.
13. **One serial, one body.** The endpoint and the publisher sign each device's documents from one counter, each serial the larger of the current time and the last one plus 1.

### Test vectors

Computed by `crates/veilway-proto/tests/vectors.py` in the `veilway` repository, which uses only Python's `hmac` and `hashlib` and a ChaCha20-Poly1305 written out from RFC 8439 (checked against the RFC's vector first), and nothing of the implementation. The Rust tests of `veilway-proto` check the same bytes, and a panel is to check them too. Bytes are written in hexadecimal. `a..b` is the run of bytes from `a` to `b`, each one more than the last.

Inputs:

| Name | Value |
|---|---|
| `token_bytes` | `01..10` (16 bytes) |
| `secret_bytes` | `21..30` (16 bytes) |
| `device_pub` | `41..60` (32 bytes) |
| `base_url` | `https://files.example.net/vw/` |
| `e` | 2000 |
| `salt` | `80..9f` (32 bytes) |
| envelope | the 33 ASCII bytes `veilway static mirror test vector` |
| size of the file | 9,413 |

Derived values:

| Name | Value |
|---|---|
| `k_name` | `e51da8f1ac5e86f8e82d38263a9be4d9e5475244df049ccc8d883f76fdb485c4` |
| `k_mirror` | `b8ff922d98c7e74b613574b516f1b36aa7ed924c2ad698ddfb9661e52ab62278` |
| `mirror_id` for `e` = 2000 | `41061aa1ae12d729f9dd2f2d5f715408` |
| file name | `41061aa1ae12d729f9dd2f2d5f715408.bin` |
| `mirror_id` for `e` = 2001, same base URL | `4e83a838a81e0da8089cde74f331fac2` |
| `mirror_id` for `e` = 2000, base URL `https://files.example.net/vx/` | `95641ef2aeed852ee6b08ce9e5799da6` |
| `k_file` | `2c16da7ccf3ee68002c007c50179e1b9b5a0c15f668c795b0bef7694c1afce71` |

The file for these inputs is 9,413 bytes. The plaintext, 9,365 bytes, is `00000021`, the 33 envelope bytes, and 9,328 zero bytes. The associated data is `"veilway v1 sub mirror file"` (with its zero byte) followed by the 16 bytes of `mirror_id`. Its first 48 bytes are the salt `808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f` and the first 16 bytes of the ciphertext, `6698f3e5d7ee42a2fc67ad5a1154bbfb`. Its last 16 bytes, the tag, are `f297f77add1830549d7d8d6715fe435e`. The SHA-256 of the whole file is `863389c734cb351fa2456037c58716e7d40cc6cfd6be326f242a56f6fdb829a1`.

### Test vectors of the exchange

Computed by the same script, `crates/veilway-proto/tests/vectors.py`, with its X25519 and its HPKE written out in plain Python (RFC 7748 and RFC 9180, each checked against the RFC's own vectors before it is used), the HKDF and HMAC of Python's `hmac` and `hashlib`, and its ChaCha20-Poly1305 written out from RFC 8439. The Rust tests of `veilway-proto` (`tests/exchange.rs`) check the same bytes on both sides: the client seals the request, the gateway opens it and seals the answer, and the client opens that. A panel is to check them too. Bytes are written in hexadecimal. `a..b` is the run of bytes from `a` to `b`, each one more than the last.

Inputs:

| Name | Value |
|---|---|
| Gateway private key | `40..5f` (32 bytes) |
| Gateway key id | `01` |
| Gateway public key `pkR` | `79a631eede1bf9c98f12032cdeadd0e7a079398fc786b88cc846ec89af85a51a`, which is `AXmmMe7eG_nJjxIDLN6t0OegeTmPx4a4jMhG7ImvhaUa` in a link after the id byte |
| Input of the ephemeral key (`ikmE` of `DeriveKeyPair`) | `a0..bf` (32 bytes) |
| The random bit of `enc` | 1 for the first request, 0 for the second |
| Request JSON | `{"v":1,"t":1700000100,"token":"VVVVVVVVVVVVVVVVVVVVVQ","kids":["ELpoLIrRNRM"],"device_public_key":"ew1H2TQn+DERYHgcfHM/2J+IlwrvSQ2KoO4ZpMuKGxQ=","device_secret":"RERERERERERERERERERERA","op":"fetch"}` |
| `response_nonce` | `c0..df` (32 bytes) |
| Envelope | the 39 ASCII bytes `veilway subscription answer test vector` |

The request. Its `info` is the bytes of `veilway v1 sub request`, a zero byte, and `01 0020 0001 0003`. Its plaintext is `00c7` (the length, 199), the JSON and 823 zero bytes.

| Name | Value |
|---|---|
| `enc` as HPKE makes it | `1045e1e902b78d7f74c668716b022bd513378d552a526d6533ef16e286749c3d` |
| `enc` on the wire, random bit 1 | `1045e1e902b78d7f74c668716b022bd513378d552a526d6533ef16e286749cbd` |
| The first 48 bytes of the request, random bit 1 | `011045e1e902b78d7f74c668716b022bd513378d552a526d6533ef16e286749cbdb23d68a7db76c65c7fa2b4873582ac` |
| The last 16 bytes of the request, the tag | `5919face06bf87f3baf7b3436b1bab8e` |
| SHA-256 of the 1,073 bytes, random bit 1 | `3f4a8d548a24a091edd13f1c3d4e777a7755668f696d7105c51a095abfa104b5` |
| SHA-256 of the 1,073 bytes, random bit 0 | `88c526db39dac9c17a93ea98b7c6e947bd60fad0f01e172985503a2f23884f3a` |

The two requests differ in the top bit of byte 32 and nowhere else, and a gateway that clears it opens both.

The answer. `Export("veilway v1 sub response", 32)` is `secret`, the salt of the extract is `enc || response_nonce` with the `enc` of the table above (the one HPKE made, whatever the random bit was), and the answer has the smallest size, 9,413 bytes. Its plaintext is `00000027` (the length, 39), the envelope and 9,322 zero bytes.

| Name | Value |
|---|---|
| `secret` | `63495e5e79f4e1d49925ea4c6ca15f9d387160bc28100026f168507e0696a234` |
| `key` | `31eddf8685e3d142c7a04c8a00159af8ab53d79bab1cbab4a103bdda64d30017` |
| `nonce` | `0a66b19620d7948d6ee78af4` |
| The first 48 bytes of the answer | `c0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedf5e2e77735c3342367415ea647066d0f1` |
| The last 16 bytes of the answer, the tag | `319513ffde70016d7dcc39bb4a5a1c83` |
| SHA-256 of the 9,413 bytes | `bee78ddfa6c10b65336b2d29651dfc0515e1c46aa40f6604a1fdaee368e16824` |

## Contents

The payload is one JSON object. JSON is strict, as in the [config reference](../../reference/config/): duplicate keys, a byte order mark, data after the document, invalid UTF-8 and a NUL inside a string are errors, and where an integer is expected only an integer token is accepted.

**Unknown members.** A client ignores a member it does not know, at any level, so that the format can grow. Three things are never ignored, because guessing at them would be unsafe:

- A name in `critical` that the client does not know refuses the document.
- A profile with an unknown `type`, or with a transport of an unknown `type`, is refused as a whole profile and shown as "not supported by this version of the app". The other profiles of the document are kept.
- An unknown value in any field that this page gives a closed set of values (a card type, a severity, a rating cap, a refusal) refuses the object that holds it: the card, the notice, the profile, or for a refusal the document.

When a refresh leaves out or refuses a profile the client had, the app tells the user which profile was dropped and why, at the latest when the user next opens the profile list.

**Wrong type, out of range, missing.** A member of the wrong JSON type or outside its range, or a required member that is missing, refuses the document when it is a top-level member, refuses the profile when it is part of a profile, and drops the object when it is a card, a notice, a support link, a listed device or an exit. A document in which every profile was refused is refused. A missing optional member takes the default its row gives. No value is clamped into range, with two stated exceptions: display text is cut, and the accent color is adjusted for contrast. Two profiles with the same `id` are both refused. A second exit with a tag that is already taken is left out.

**Display text.** Every string that is shown to the user is filtered and cut by the rule of the control channel page ("Framing", display text): control, bidirectional formatting, zero-width and other invisible characters are removed, then the text is cut to its limit on a character boundary. It is shown as plain text. Nothing in it is a link, markup or a command. A limit such as "1 to 64 characters" is judged after the filter. Text of any raw length is cut, never refused for being long. A name that must have at least one character must have one that is neither white space nor a combining mark. The filter itself, with the full list of what it removes, is defined on the control channel page, and one filter serves both.

### Text in several languages

A provider may write for readers of more than one language. Every member that this page types as "display text" may be given in several languages, with these exceptions: a device's name, which the user typed, and the legacy `profile-title`. That covers `provider.name`, the `name` of a profile and of an exit, the `label` of a support link, the `text` of a notice, and in cards the `label`, `value`, `unit` and `text`. Nothing else is ever translated: not a URL, a tag, an id, a host, a number or a refusal. A refusal is a code, and the app shows its own words for it.

**The form.** A text is either a JSON string or a JSON object:

```json
"name": "Frankfurt"
"name": {"default": "Frankfurt", "fa": "فرانکفورت", "de": "Frankfurt am Main"}
```

- A string is the default and nothing else.
- In an object, `default` is required and is a string. Every other member is a language tag with a string.
- **Only `default` can make a text wrong.** A text whose `default` is missing or is not a string is a member of the wrong type, with the result the rule for wrong types gives for its place.
- **A bad translation is dropped and nothing else is touched.** A member whose name is not a legal tag (a tag in another case, a longer tag, any other form), or whose value is not a string, is dropped. Of the legal tags, the first 8 in the order they appear in the document are kept and the rest are dropped. A legal tag takes one of the 8 places whatever its value is: a translation among the first 8 that is dropped for its value is not replaced by the ninth. `default` and the other translations stay. A translation never refuses a profile or a document.
- The same tag twice is a duplicate key, which strict JSON already refuses for the whole document.

**The tags.** A small, strict subset of the language tags of BCP 47 (RFC 5646), in one spelling only:

| Part | Form | Example |
|---|---|---|
| Language, required | 2 or 3 lowercase letters | `fa`, `en`, `ckb` |
| Script, optional | `-`, then one uppercase and three lowercase letters | `-Arab`, `-Latn` |
| Region, optional | `-`, then two uppercase letters | `-IR`, `-AF` |

A tag is at most 11 characters, such as `zh-Hant-TW`. Nothing else is a tag: no other subtags, no other case, no underscore. The client does not check a tag against a registry. A tag it has never heard of simply matches no app language. That includes `und`, which fits the grammar and matches nothing, even when an app asks for it. It also includes a three-letter code for a language that has a two-letter one. A client cannot know that without a registry, so this case is a warning for the panel to give the provider, not a rule for the client.

**Each translation is held to what the default is held to.** The same display filter (defined on the control channel page, "The display filter", with its rule for the two joiners that Persian and other scripts need), the same limit, and for a name the same requirement that one visible character is left. A translation that fails that requirement, or is empty after the filter, is dropped and the others stay. A `default` that fails is a failed text, as before. Every translation is a JSON value and counts toward the document's limits on values and on size, which are unchanged, so a provider that translates everything fits fewer exits.

**How the client picks.** The app has one display language, and the user may set fallback languages. Both are chosen from the languages the app ships. For each of its own languages the app knows the script and the usual region from its own table, so that a language it knows by region only still finds a translation tagged by script. For the display language, and then for each fallback in order, the client tries these four tags in turn and takes the first that the text has:

1. language, script and region;
2. language and script;
3. language and region;
4. the language alone.

If none of them is there, it shows `default`. The client never guesses what language `default` is in, never picks a "similar" language, and never translates by machine. What the provider did not write, the user does not see.

**Where a translation is shown, and where it is not.** A text that is shown in a translation carries a small mark of its language on the surface where it is read, with a way to see `default` from there. On every screen where the user decides something (an import, a replacement, the consent to a lower class, the question about a private address), a provider's name and a profile's name are shown in `default`, with the picked translation beside it when there is one, both marked as the provider's own words. Without this a provider could show one identity in `default` and another to readers of one language, at the moment trust is decided.

**Direction and shaping.** How a provider's text is laid out is fixed by the rules under "The display filter" on the control channel page: its own directional isolate, direction from the first character with a strong direction, for a translation as for `default`. The language tag does not set the direction, since a text tagged `fa` may be written in Latin letters. The tag of the picked translation is passed to the renderer as the text's language, for shaping and the choice of font only: the same characters are drawn differently for Persian and for Arabic.

**What translations can and cannot do.** A provider can write anything in any one language, and with several it can say different things to different readers: a calm notice in one language and a false one in another. Nobody who reads only one of them will notice. The format does not stop this and cannot. What it does keep true:

- Everything that carries a warning is the app's own text in the app's own language: the warning for an Unsafe profile, the wording of the import and consent screens, key fingerprints, hosts, and the message for every refusal. Where a provider's name or a profile's name appears on such a screen, `default` is always there.
- A link has one `url`, whatever language its label is in, and the screen that asks before it is opened shows the host. A translation cannot change where a link goes.
- A translation cannot change a tag, an exit, a profile's settings or a number the app computes.
- The mark on a translated text, and the way from it to `default`, make a difference between the two something a user can find.

**Languages and privacy.** The app's display language and the fallback list are read only by the app. They are never sent, logged or put in a diagnostic report. No request the client makes for a subscription carries an `Accept-Language` field. Where a transport copies a browser's header fields from the fingerprint pack and a browser would send that field, its value is the pack's fixed one, never the user's. A provider can still learn a reader's language in two ways the format does not control: the browser that opens a support link or a card's link sends its own languages, and a device name is typed in the user's script.

**The provider's labels in the app's own lists.** A profile's name and an exit's name appear in the app's lists, outside the provider's area. They are always shown as the provider's labels, next to part of the key's fingerprint so that two subscriptions with one name can be told apart, and never in the place where the app shows its own warnings.

**Keys.** A WireGuard key, a transport key and a transport secret are written as in the config reference: standard base64 with padding, 44 characters, 32 bytes. An Ed25519 public key in a document is written the same way. An all-zero key is an error. An `inbound_public_key`, a `transport_public_key` or a `device.public_key` of small order refuses the profile, as a device key of small order is refused in a request.

### Top level

| Member | Type | Required | Rule and default |
|---|---|---|---|
| `v` | integer | yes | The format version, 1. See "Versioning". |
| `critical` | list of strings | no | Names of extensions the client must understand. Default empty. Version 1 defines none, so any entry refuses the document. |
| `subscription_id` | string matching `[A-Za-z0-9_-]{16,64}` | yes | See "Identity". |
| `serial`, `issued_at`, `expires_at` | integers | yes | See "Rollback and expiry". |
| `signing_keys` | list of 1 or 2 Ed25519 public keys | yes | See "Keys held for a subscription". |
| `refusal` | string | no | Makes the document a signed refusal. See "The answer". |
| `provider` | object | yes | `name`: display text, 1 to 64 characters. Nothing else. It is shown as the provider's own claim, next to the fingerprint. |
| `update_interval` | integer | no | Seconds between automatic refreshes. |
| `endpoint_pins` | list of 1 or 2 pins | no | The pins of the main endpoint (see "Moving the main endpoint"), each standard base64, 44 characters, as the `pins` of a candidate. The two are different: a list that names one pin twice refuses the document. See "Pins, and a standby". A pinned endpoint always lists two, the active pin and a standby, and the client cannot enforce that. The list must include a pin the client holds for that endpoint: the main endpoint, or for a document fetched from the endpoint of a pending move, a pin of the move's `pins`. A document that has it when that endpoint is not pinned is refused. It is ignored in a whole document, which has no endpoint. Absent, it changes nothing. |
| `refresh_urls` | list of at most 4 entries | no | Other endpoints of the same subscription. An entry is a URL string, for an endpoint whose certificate is validated by its chain, or an object with exactly `url` and `pins` (a list of 1 or 2 pins, standard base64), for a pinned one. A URL string may be `http`, for a plain endpoint, which has no pins. A pin is not listed twice. An IP literal in a `url` follows the same one spelling as in the link, and is allowed only in an entry given as an object with `pins` or in an `http` string. An entry of the main endpoint's host and port that has pins must hold at least one pin the client holds for the main endpoint, or the document is refused. That is the same rule as for the link, said per entry, and a document cannot move an entry from one kind to the other: an entry with the host and port of the main endpoint, or of another entry, must be of the same kind as it, and an entry of any other shape or kind refuses the document. A `url` follows the URL rules below and has no fragment. Their hosts are shown on the import confirmation, and a plain one with the words "the network can tell that you use this app, now and later in its records." A request to any of them is sealed to the top-level `gateway_keys`. A host that a later document adds is not contacted until the user has confirmed it: the app notes "the provider added a refresh host" in the subscription's details, as it notes a renewed key, and asks at the next refresh the user starts. Until then the client uses the hosts it already had. What the user confirms is a host and port together, with its kind: checked by chain, pinned, or plain. A host listed with another kind than it was confirmed with is asked about again, and a change of its pins is not. It stays confirmed only while documents list it: one that a document dropped and a later document lists again is asked about again. A whole document has no endpoints, whatever its `refresh_urls` say. |
| `static_mirrors` | list of at most 4 strings | no | Base URLs of static mirrors, validated by chain, no pins. See "Listing static mirrors". |
| `gateway_keys` | list of 1 or 2 objects | yes, in every document that has an endpoint: one a client fetches from an endpoint, a relay mirror or a static mirror. Not in a whole document or a refusal. | The gateway keys of the main endpoint, the active one first and the next one second. Each is an object with exactly `id`, an integer from 0 to 255, and `key`, an X25519 public key in the form of "Keys" above. Two entries with one `id` or one `key` refuse the document, and so does a key that is all zero or of small order. See "Gateway keys". It is ignored in a whole document, which has no endpoint. |
| `main_endpoint` | object | no | The endpoint the provider wants this subscription to use. Naming the main endpoint the client holds, or leaving it out, asks for nothing. Naming another asks for a move. See "Moving the main endpoint". |
| `profiles` | list of 1 to 64 | yes | See "A profile". |
| `devices` | list of at most 64 | no | Each: `name` (display text, at most 32 characters, may be empty), `enrolled_at` (Unix seconds), `this` (boolean, true for the asking device), `pending` (boolean, default `false`). See "Devices and their places". When more than one entry has `this` set, each of them is left out and the document is kept. |
| `usage` | object | no | See "Usage". |
| `support` | list | no | See "Provider content". |
| `agreement` | object | no | See "Provider content". |
| `cards`, `logo`, `accent` | | no | See "Provider content". |
| `notices` | list | no | See "Provider content". |

In a signed refusal only `v`, `subscription_id`, `issued_at` and `refusal` are required. `v` and `critical` are checked, and the other members are ignored.

### A profile

A profile is what one device needs to reach one inbound.

| Member | Type | Required | Rule and default |
|---|---|---|---|
| `id` | string matching `[a-z0-9][a-z0-9_-]{0,63}` | yes | Unique in the document. It is how the client keeps the user's own settings and consents for a profile across refreshes. A profile whose `id` is new is a new profile, with no consent. |
| `name` | display text, 1 to 64 characters | yes | |
| `type` | `"veilway"` | yes | An unknown value refuses the profile. A plain `wireguard` inbound is not delivered in this format. |
| `inbound_public_key` | key | yes | `inbound_pub` of the protocol pages. |
| `device` | object | yes | See "Device keys". |
| `gateways` | list of 1 or 2 IP addresses | yes | The gateway address per family. One per family of `device.addresses`, in the same order, inside the ranges the config reference allows for a pool. They are the resolver and the control channel address. A gateway equal to the device's own address of that family refuses the profile. |
| `mtu` | integer, 1280 to 1500 | yes | The inbound's `mtu`. |
| `transport_public_key` | key | when a `tls`, `ws`, `fronted` or `fronted-shaped` transport is listed | The node transport public key of those transports. A `faketls` transport carries its own key and never uses this one, so a profile whose transports are all `faketls` needs none. |
| `transports` | list of 1 to 8 | yes | In the provider's order. See "Transports of a profile". |
| `stream_first` | boolean | no | Default `false`. See "Transport fallback" on the transports page. The user may set it too, and the user's setting wins. |
| `parallel` | integer, 1 to 4 | no | Default 1. Connections per tunnel on `tls` and `ws`. |
| `padding` | object | no | `wide_max` (512 to 1023, default 1023), `normal_max` (64 to 255, default 255), `keepalive` (a list of two integers, seconds, the lower and the upper bound, each from 10 to 60, the upper at least 10 above the lower, default 20 and 40). |
| `min_control_version` | integer, 1 to 255 | no | Default 1. |
| `rating_cap` | `"detectable"` or `"unsafe"` | no | The provider's statement that something the client cannot see lowers the rating, such as another service on the node's address. It can only lower. There is no value that raises. |
| `exits` | list of at most 256 | no | See below. Default empty. An exit's `name` may be translated. |
| `notices` | list of at most 4 | no | The notices of this profile's node, each with `severity` and `text` as at the top level. They exist so that what the node sends on the control channel can be shown in the reader's language (see "Languages" on the control channel page). The app does not show them by themselves. Default empty. A `notices` that is not a list, or has more than 4 entries, refuses the profile. An entry that does not read is left out. |

What a profile does not have, on purpose: routes, a resolver other than the gateway, a setting of the kill switch, a rating, a fingerprint pack, a certificate authority, an "allow insecure" switch, and the cookie name of the upgrade answer on `tls` and `ws`, which the client ignores anyway. A `ws-plain` transport is the exception: its `cookie` member is how the client sends the token. In version 1 a native profile always carries all of the device's traffic. A provider cannot ask for less or for more.

**The cap the client computes itself.** Apart from `rating_cap`, the client compares the dial addresses of all transports of all profiles of the subscription. A pinned or plain endpoint whose host is an IP literal, the main endpoint, a move's or a refresh entry's, counts as a `udp` endpoint at that address: a cover transport at the same address is capped at Detectable, since a subscription host with a self-signed certificate on the address is something a prober can see, and `POST`s of one fixed size to a plain endpoint are something a filter can match. Wherever such an endpoint is offered for consent, the app says: "the network can tell that you use this app, now and later in its records." A pinned endpoint with a host name is not compared, because the client makes no lookup for it, and the panel warns its operator when the address of its pinned endpoint is the address of one of the nodes in its documents. A cover transport whose address is also the address of a `udp` or `udp-obfs` endpoint is capped at Detectable, as the transports page requires, and so is one that shares an address or a host name with a `ws-plain` transport. What the provider runs on an address and does not list, the client cannot see. A `ws-plain` transport is never above Detectable. Wherever a `ws-plain` transport is offered for consent or is in use, the app says: "the network can see this server's name and can tell that you use this app, now and later in its records. It cannot see what you send."

An entry of `exits`:

| Member | Type | Rule |
|---|---|---|
| `tag` | string matching the config's tag rule, `[a-z0-9][a-z0-9_-]{0,63}`, not a reserved word | Unique in the list. |
| `name` | display text, 1 to 64 characters | |
| `country` | two uppercase ASCII letters | Optional. |
| `full_ip` | boolean | Whether the exit carries every IP protocol. Default `false`. |
| `linked` | boolean | Whether traffic through this exit leaves from a second node that is joined to this one by a node link, and that may be run by someone else (see [Node links](../node-links/)). Default `false`. The app shows it on the exit. A value that is not a boolean drops the exit, as any wrong member of an exit does. An older client that does not know the member ignores it and shows the exit without the mark. A panel sets it from the node's config, never by hand. |

The catalog in a subscription is what the user sees before connecting. Once connected, the catalog from the control channel replaces it for that session.

### Device keys

| Member of `device` | Type | Required | Rule |
|---|---|---|---|
| `public_key` | key | yes | The device's WireGuard public key, `device_pub`. |
| `private_key` | key | no | Present only when the provider made the key. Its public half must equal `public_key`, or the profile is refused. |
| `preshared_key` | key | no | WireGuard's optional preshared key for this device, when the node's config has one. |
| `addresses` | list of 1 or 2 IP addresses | yes | At most one IPv4 and one IPv6, IPv4 first, inside the ranges the config reference allows for a pool. |
| `transport_secrets` | list of 1 or 2 keys | yes | This device's transport secrets. The client uses the first. The second exists so that a rotation can be staged. |

There are two ways for a device to get its WireGuard key, and the format supports both.

| | The device makes the key | The provider makes the key |
|---|---|---|
| How | The client generates a key pair before its first fetch and sends the public half. The document names that public key and has no `private_key`. | The panel generates the pair and puts the private half in the document. |
| What the provider holds | The public key. It holds nothing that works anywhere else. | The private key, for as long as it keeps it. |
| What a holder of the link gets | The right to enroll a device of its own while a place is free. That device gets its own addresses and its own transport secrets. It does not get the key or the secrets of the user's device. | The private key and the secrets of the user's device, and with them everything. |
| What it needs | A provider whose endpoint enrolls devices. | Nothing. It also works for a whole document in a link, where there is no endpoint to enroll with. |

The default is the first. The client always sends its own public key.

- A document that names the client's public key and has no `private_key` is the default case.
- A first document that carries a `private_key` is the second case. The first confirmation says "key issued by the provider", in words that say it is the weaker choice: the private key travels in every fetch and sits in the provider's database.
- A document without `private_key` that names another public key than the client's is refused.
- **No silent change.** On a refresh, a `device.public_key` that differs from the stored one, or a `private_key` where there was none, fails the refresh. Moving to another key or to a provider-issued key takes a new import by the user, with its confirmation. With provider-issued keys, every `device.public_key` in a refreshed document must be one the stored document had, under whatever profile `id`. A new profile that brings a `private_key` into a subscription whose keys were made on the device fails the refresh too.

In both cases the device's transport secret is in the document, so whoever holds a copy of that device's document can recognize that device's `udp-obfs` traffic (see the transports page).

### Transports of a profile

Every transport has a `type`. An unknown `type` refuses the profile. A provider that offers `ws-plain`, `fronted-shaped` or `faketls` to clients that may be older lists it in a profile of its own, so that a client which does not know the type refuses only that profile and keeps the rest. The committed parser does exactly this: an unknown transport type drops the profile and leaves the others. The class of each type (cover, no cover, exposed, plain) is fixed by the transports page and is never a field.

| `type` | Members | Rule |
|---|---|---|
| `udp`, `udp-obfs` | `endpoints`: list of 1 to 16 | Each an IP address and port, `192.0.2.10:51820` or `[2001:db8::10]:51820`. |
| `tls` | `path`, `candidates` | Every candidate must have `pins`. A candidate may set `self_signed`. |
| `ws` | `path`, `candidates` | A candidate may have `pins`. |
| `fronted` | `path`, `candidates` | No candidate has `pins`: the certificate is a content delivery network's and changes. |
| `fronted-shaped` | `path`, `candidates`, `shape` | As `fronted`: no candidate has `pins`. `shape` is the required object of "What a shape is" on [Shapes of fronted](../fronted-shapes/), `up` and `down`, which must say what the node's config says. The grammar, the valid combinations and the ranges are on that page and are not repeated here. A shape that breaks them refuses the transport. |
| `faketls` (alpha) | `transport_public_key`, `candidates` | The key is on the transport. Each candidate has `address` and `sni`, the borrowed site's name. See "The `faketls` transport" below. |
| `ws-plain` | `path`, `candidates` | Plain HTTP, no TLS. No candidate has `pins`, `sni`, `verify_name` or `ech`. See "`ws-plain`" on the transports page. A `ws-plain` transport may not use a `host` or a `path` that any `tls`, `ws` or `fronted` transport of the document uses, and carries its own `transport_public_key` on the transport. A `ws-plain` transport may carry an optional `appearance` (a fixed identifier), which dresses the frames as another kind of content (see "Appearance of `ws-plain` frames" on the transports page, a design that is not built). An unknown or malformed `appearance` refuses the transport, not the document. It has a required `cookie`: the name of the cookie that carries the token, 1 to 32 characters from `A-Z a-z 0-9 _ -`. A missing or malformed `cookie` refuses the transport. |

- `path` follows the path rule of the config reference and is at least 12 characters.
- **An unknown type refuses the whole profile.** A client that does not know a transport `type`, such as an older client that meets `fronted-shaped` or `faketls`, refuses the profile that holds it as "not supported by this version of the app". The other profiles of the document are kept. That is the safe failure, and it is why a provider that serves older clients puts these transports in a profile of their own. A `shape` on a `fronted` transport would be ignored by an older client, which would then speak the classic form to a node that expects another, and that is why the shaped form is a type of its own.
- **Rating.** `fronted-shaped` and `faketls` are of the cover class (see the transports page). Neither raises a rating. A profile that has either is rated Detectable, like every native profile, and stays so until the tests of its page pass and someone outside the project has reviewed it.
- **A malformed candidate drops only that candidate.** This holds for every transport type. A candidate with a member it must not have, or with a member that does not read, refuses that candidate and nothing else, and the transport keeps its other candidates in the provider's order. A transport whose candidates are all refused is left out, and a profile whose transports are all left out is refused. A fault of the transport itself, such as a bad `path` or `shape`, is not a fault of a candidate and follows the rule of its type. The client keeps what it left out of each profile, for each transport a count and a reason (a candidate that did not read, a transport left out because none of its candidates read, a `faketls` transport left out for a member it must not have, a key that does not read or a list that is not 1 to 16 candidates, a `faketls` key equal to the profile's, or one that another `faketls` transport has too). It logs one line for each, with no address, name or key in it, and its profile view says that some addresses were left out.
- A candidate is an object with the members of "Fronting options" on the transports page: `address` (IP address and port, required), `sni` (required: a host name, or empty for none), `host` (a host name, required), `verify_name` (a host name, required when `sni` is empty and not allowed otherwise), `ech` (an Encrypted Client Hello configuration in standard base64, optional, at most 1,024 bytes when decoded), and `pins`. A candidate of a `tls`, `ws` or `fronted` transport may also have `http2` (designed, not built, see [HTTP/2](../http2/)): `off`, `fetch` or `full`, with `fetch` as the default. `off` offers `http/1.1` alone, as today. `fetch` lets `fronted` offer `h2` and `http/1.1`, and leaves `tls` and `ws` as they are. `full` also lets `tls` and `ws` try WebSocket over HTTP/2 first. The node's own side is `http2` of a `tls` transport in the [config reference](../../reference/config/), `off` or `on`, default `off`. An `http2` on another transport, or a value that is not one of the three, refuses that candidate. There is no member that turns TLS off on a candidate: a transport without TLS is the separate type `ws-plain`, whose candidates carry `address` and `host` and none of `sni`, `verify_name`, `ech` or `pins`. A candidate with a member it must not have (a `pins` on a `fronted` candidate, any of the TLS members on a `ws-plain` candidate) is refused under the rule above.
- `pins` is a list of 1 to 4 pins and belongs to one candidate, because one transport can list a candidate that reaches the operator's own server and another that goes through a content delivery network. A pin is the SHA-256 of a certificate's SubjectPublicKeyInfo, in standard base64, 44 characters. A candidate with pins is a "pinned candidate" on the transports page. A candidate of a `tls` transport may also have `self_signed`, a boolean, default `false`. With `true` the client trusts the server's certificate only through the candidate's `pins` and does not check its chain, name or dates (see the `tls` client steps on the transports page). `self_signed` on a candidate of any other transport, or a value that is not a boolean, refuses that candidate. A candidate with `self_signed` set still needs 1 to 4 `pins`. Its `sni` may be a host name, which is sent, or empty. It has no `verify_name`, since no name is checked, and a `verify_name` on it refuses the candidate.
- A host name is lowercase ASCII, at most 253 bytes, by the domain rule of the config reference, without the wildcard.
- A hint on the control channel names a transport by its position in `transports` and a candidate by its position in that transport's `candidates`, or in its `endpoints` for `udp` and `udp-obfs`, always as the document wrote them, counted before anything is left out. A transport or a candidate that the client left out keeps its place: the ones after it do not move, a hint that names a place that was left out names nothing and is ignored, and a client that reports which candidate it is trying reports the place the document gave it.

**Where a client may be told to connect.** The transport's own connection is the one thing that leaves the device outside the tunnel, so its destination is restricted.

- Every address a client dials is an IP address. A profile has no host name that the client would have to look up before the tunnel is up, because that lookup would name the provider to the local network.
- Refused when the document is parsed, with the profile: an address that is loopback, link-local, unspecified (all of `0.0.0.0/8` counts as unspecified), multicast or broadcast; an IPv6 address that carries an IPv4 address (IPv4-compatible, IPv4-mapped, IPv4-translated, NAT64 in `64:ff9b::/96` and `64:ff9b:1::/48`, 6to4, Teredo); an address in `fec0::/10`; port 0; and a port written with a leading zero.
- Skipped at each connect: an address inside one of the device's own networks, unless the address is itself private or shared and the user agreed. Those are the networks of every address the device holds on an interface that is not a tunnel, at the moment it connects, with the prefix the interface has, and the address of its default gateway. A profile must not be able to point the device at its own router or at a neighbor without the user's consent, so such an address is skipped, with one exception. A candidate that is private or shared (the list of the next rule) and lies inside the device's own networks is asked about like any private address, and only after a yes is it dialled. Without the yes it stays skipped, and a session to a candidate whose address becomes one of the device's own networks is ended. With the yes, a private candidate is dialled and its session is kept when the network changes. The yes never covers a public address: a public address inside the device's own networks is skipped at every connect and its session is ended when the network changes to one that holds it, whatever the user answered, because a network that declares a public subnet as its own would otherwise choose where the device connects (TunnelCrack LocalNet). The check is made again at every connect and at every change of network, because the device's networks change when it moves. A node on the home network is reached this way, and its socket stays outside the tunnel whatever the tunnel routes.
- Asked about once per profile: any other private or shared address, which includes a private address inside one of the device's own networks. "Private or shared" is exactly the list that `geoip:private` stands for in the config reference. Such a profile is a lab or an office set-up, and the app says "this profile connects to a private address" before the first connect.
- The same check covers the tunnel side: when a `device` address or a gateway falls inside one of the device's own networks, the profile cannot be used on that network, and the app says why instead of connecting.

#### The `faketls` transport

`faketls` is [Borrowed-site mode](../borrowed-site/): the node borrows a real site, and a client proves itself inside its first TLS message. It is in alpha. Nobody outside the project has reviewed it, and it has not run against real sites.

| Member | Type | Required | Rule |
|---|---|---|---|
| `type` | `"faketls"` | yes | |
| `transport_public_key` | key | yes | The public key of this transport's own `transport_key` on the node, standard base64, 44 characters, 32 bytes. A key that is missing or does not read refuses the transport. |
| `candidates` | list of 1 to 16 | yes | In the provider's order. A list that is empty, longer than 16 or not a list refuses the transport. |

Each candidate has two members.

| Member | Type | Required | Rule |
|---|---|---|---|
| `address` | IP address and port | yes | Read and dialled by the same rules as every other candidate (see "Where a client may be told to connect" above). |
| `sni` | host name | yes | The name of the borrowed site, which the node takes as the only server name. A lowercase host name, at most 253 bytes, not empty, not a wildcard and not an IP address. |

Rules of the transport:

- **Members it does not take.** `path`, `host`, `verify_name`, `ech`, `pins`, `self_signed`, `http2` and `shape` have no meaning here: there is no CDN, no front and no certificate to check but the one the client derives from the proof. One of them on a candidate drops that candidate. One of them on the transport refuses the transport. Unknown members are ignored, as everywhere in version 1.
- **The key is the transport's own.** The profile's `transport_public_key` is never used in its place, and a profile whose transports are all `faketls` needs no profile key. A `faketls` key equal to the profile's `transport_public_key`, or to the key of another `faketls` transport of the profile, refuses that `faketls` transport only. Of two `faketls` transports with one key, both are refused, since the document does not say which one is right.
- **Several per profile.** A profile may list several `faketls` transports, each with a key of its own, for example one per borrowed site.
- **A refused transport.** A `faketls` transport that is refused is left out of the profile, and the profile keeps its other transports. A profile left with no transport is refused.
- **Order and fallback.** `parallel` and `stream_first` apply to it as to the other stream transports. Fallback follows the provider's order of transports and of candidates. A hint on the control channel names a candidate by its position in `candidates` as the document wrote it.
- **Older clients.** A client without `faketls` meets an unknown `type` and refuses the whole profile as not supported. A provider therefore puts `faketls` in a profile of its own, next to a profile without it that older clients can use.

**Rating and consent.** `faketls` is of the cover class, and a profile that has it is rated Detectable. Its candidates join the address comparison of the cap: a `faketls` candidate whose address is also the address of a `udp` or `udp-obfs` endpoint is capped like any cover candidate. A client dials no `faketls` candidate until the user turns on `alpha_transports`, a client setting that is off by default. While it is off, a profile is used as if it had no `faketls` transport, and a profile whose only transports are `faketls` does not start. Each time the user turns it on, in the settings of the apps ("Alpha transports") or with `veilway connect --alpha`, the client shows a warning first and turns it on only after a yes: the transport is alpha, nobody outside the project has reviewed it, and it borrows a real site that has not agreed to it. A connection that can only be made over `faketls` while the setting is off says so in plain words and points at the setting. Turning the setting off while a `faketls` session runs ends that session, and the profile is used as if it had no `faketls` transport.

**Secrets and public values.** The transport needs no new secret in the document. The tag and binder keys of the proof are derived from `device.transport_secrets`, as for the other transports. A log line or a status screen may show a candidate's `address` and `sni`. It never shows a key, a secret or the carrier of a proof.

**What the panel must emit.** For each `faketls` transport of the node that a user may use, a transport in a profile of its own with `type` `"faketls"`, the public key of that transport's `transport_key` as `transport_public_key`, and one candidate per address the node is reached at, each with `address` and the `site.host` of the node's config as `sni`. It emits none of the members the transport does not take. The panel does not do this yet.

### Usage

| Member of `usage` | Type | Meaning |
|---|---|---|
| `used_bytes`, `quota_bytes` | integers, 0 to 9007199254740991 | The names and meanings of the control channel's `usage`. `quota_bytes` of 0 means no limit. |
| `period` | `"none"`, `"daily"`, `"weekly"` or `"monthly"` | |
| `period_start`, `expires_at` | integers, Unix seconds | 0 for none. |
| `device_limit` | integer, 0 to 65,535 | 0 for none. |

Usage in a subscription is information for the screen, as old as the document. It decides nothing. The node enforces quota and expiry, and what the control channel reports while connected is shown in its place. A client never refuses to connect because of these numbers. Every member of `usage` is required when `usage` is present. Any fault in it leaves the usage out and keeps the document.

### Provider content

All of it is data. It is shown in an area that is visibly the provider's, apart from the app's own interface, and the user can hide that area.

| Member | Type | Rule |
|---|---|---|
| `support` | list of at most 4 | Each: `label` (display text, at most 32 characters) and `url`. |
| `agreement` | object | `terms` and `privacy`, each a `url`, at least one of them: the provider's terms of service and privacy policy. The app shows both and asks the user to accept them before the first connection with this subscription, and again when either changes; until then it does not connect. An `agreement` with no link, or with a member that is not a valid `url`, is left out. |
| `cards` | list of at most 6 | See below. |
| `logo` | object | `type`: `"png"` or `"jpeg"`. `data`: standard base64 of at most 65,536 bytes. The client decodes it with size limits, refuses more than 512 by 512 pixels or anything that is not a plain still image, and re-encodes it before it is shown. A logo that fails is left out. |
| `accent` | string `#rrggbb` | One color. The client adjusts it until text on it meets the app's contrast rule. |
| `notices` | list of at most 4 | Each: `severity` (`"info"` or `"warning"`) and `text` (display text, cut to 280 bytes). |

A card has a `type` and, by type:

| `type` | Members |
|---|---|
| `stat` | `label` (at most 32 characters), `value` (at most 16 characters), `unit` (at most 8 characters, optional) |
| `progress` | `label`, `used` and `total` (integers, 0 to 9007199254740991, `used` not above `total`, `total` above 0) |
| `notice` | `severity`, `text` (cut to 280 bytes) |
| `link` | `label`, `url` |

Every `url` in `support`, in `agreement`, in a `link` card and in `refresh_urls`:

- is an `https` URL with a host name, no user or password part, at most 512 characters, or at most 256 for a refresh URL or the URL of a move, which are also held to the rules for a URL the token is sent to. Those two may also be `http`, as a plain link may, since what they carry is sealed. A pinned or plain one may have an IP literal as its host, as a pinned or plain link may;
- is shown with its host in ASCII form, with the registrable domain marked so that a long name cannot hide whose it is;
- in `support`, in `agreement` and in a card, is opened only after the user confirms a screen that shows that host, in the system's browser, never inside the app, and is never fetched by the app;
- in `refresh_urls`, is fetched by the app under the rules of "Fetching" and only those.

There are no icons, images, fonts or styles in provider content other than the one logo and the one color.

## Import

A subscription enters the app in one of these ways. Every one of them goes through the same three steps.

| Way | What is accepted |
|---|---|
| A link typed or pasted | A native link, or a legacy `https` URL |
| The clipboard | The same, read only when the user presses "paste". The app never reads the clipboard by itself. |
| A QR code | A native link in either form, or a whole document |
| A deep link | A native link in the `veilway` form, or `veilway://doc#v1.<key>.<document>` |
| A file | `v1.<key>.<document>` and nothing else, except one line end (LF or CRLF) at the very end, which editors add when a file is saved and which is ignored. Or a sealed file, which holds a link (see "Sealed subscription file"). |

**A whole document in a link, a code or a file.** A single profile, or a few, can be given without a server. The content is the provider's key and the signed document, joined by dots after `v1`. It is the same JWS, checked by the same rules against that key. It has no endpoint, so it cannot refresh, and the app says so. It carries a provider-issued device key, since there is nothing to enroll with. Such a link holds a private key and transport secrets: wherever the link goes (a chat history, a browser history, a screenshot), they go too. The app says this on the confirmation, and a provider should prefer an ordinary link wherever it has an endpoint. A whole document never replaces a stored subscription that has a link.

**Step 1: before any request.** The app shows, from the link alone:

- the host of the endpoint, with its registrable domain marked, or "a document in a link" or "a file";
- the fingerprint of the key in the link;
- when the link has a pin: "this server uses its own certificate, which this link names. Only that certificate will be trusted." For a host that is an address: "this server has an address and no name.";
- what will be sent if the user continues: one request sealed to the provider's gateway key, which holds the link's token and a new key for this device, to that host, from the device's own address, outside any tunnel. For a plain link the screen adds: "this link does not use TLS. Your request stays sealed, but the network can tell that you use this app, now and later in its records. It sees the server's name and address, the path, and when you ask.";
- that the link is native, or that it is a legacy link that cannot be verified. For a legacy link the screen adds: "this link has no key part. If your provider gave you a Veilway link, part of it was lost on the way."
- when another subscription's tunnel is up, the two ways the request can go, as "When a fetch happens" lists them.

Nothing is sent, generated or stored by the app before the user continues. A deep link, a QR code or a file can bring the user to this screen and can do nothing else. It cannot cause a request, an enrollment or a used device place.

**Step 2: the fetch.** One request with `op` `"fetch"`. A native link expects a signed document under the link's key, and anything else is a failure. If the endpoint is on a private address the user has not said yes to, there is no request: the client stays at this step with the question of "How a fetch is made", and nothing is sent, generated or stored until the answer. A no leaves the import where step 1 left it. A legacy link gets a `GET`. A whole document needs no fetch.

**Step 3: the confirmation.** From the verified document the app shows:

- the provider's name, in `default` and with the picked translation beside it when there is one, marked as the provider's own claim;
- the fingerprint again, and the hosts in `refresh_urls`;
- how many profiles it holds, and whether any of them is Unsafe, with the plain warning for that. Ratings and classes are not shown to users.
- whether the device's key was made on this device or issued by the provider;
- when the document asks for a move, the new host and how it is checked, as "Moving the main endpoint" shows it. Accepting the import accepts the move;
- whether this adds a new subscription or replaces a stored one (same key and same id), and which, and when the link replaces a stored link whose endpoint was checked another way (pinned or not, or by another pin), that it changes;
- the account's devices, as the document lists them.

The user may type a name for the device, and the screen says that the name will be visible to anyone who holds the link. If the user accepts, the client stores the subscription and sends `"confirm"`, with the name if one was typed. If the user declines, the client sends `"release"`, so that the device place is freed, and keeps nothing: not the document, not the link, not the key it made. If what is stored changes while the confirmation is on screen so that the notice that the endpoint is checked another way is no longer true, the import is declined and shown again.

**Rules that hold for every way in.**

- An import never connects. Connecting is a separate action by the user.
- A web page that opens a `veilway` link learns nothing from the app, and the app makes no request because of it. The host in the link learns nothing from the app unless the user continues at step 1. What a browser or a messenger does with an `https` link before the app sees it is outside the app's control, see "Form".
- The consent to use a lower class of transport (see the transports page) is stored per subscription and profile `id`. It is not carried over to a profile with a new `id` or to another subscription.
- A link over a size limit, or one that is not exactly one of the forms above, is refused at once.

### Sealed subscription file

A link in a chat, a mail or a shared folder is read by whoever reads the chat, the mail or the folder. A sealed file is a way to pass a subscription link on with a password that goes another way. It is a convenience for people who share a subscription, and for a provider that sends a link to a user over a channel it does not control. It adds secrecy while the file is in transit. It never adds trust.

**What it holds.** The text of a link, and nothing else: a native link in the `veilway` form (`veilway://sub/...` or `veilway://sub-plain/...`), or a whole document in a link (`veilway://doc#v1....`). The link text is enough. It is the smallest content that carries the whole subscription, since a native link has the endpoint, the provider's key, the gateway key, the token and the pin, and the document comes from the endpoint after the user's yes. It is also the one thing the import already knows how to read, so a sealed file needs no second reader of subscriptions and has no second way to go wrong. A document in a file (`v1.<key>.<document>`) is not sealed: it can be larger than a link, and it holds a private device key when it is a whole document, which a provider should not be sending by file at all. A client never writes a sealed file of a legacy link.

**The bytes.** All numbers are big-endian.

| Offset | Size | Field |
|---|---|---|
| 0 | 8 | The magic, `VWSUBSEA` in ASCII |
| 8 | 1 | The format version, `1` |
| 9 | 4 | Argon2id memory in KiB |
| 13 | 4 | Argon2id passes |
| 17 | 4 | Argon2id lanes |
| 21 | 16 | The salt, random for every file |
| 37 | 12 | The nonce, random for every file |
| 49 | n + 16 | ChaCha20-Poly1305 of the link text (UTF-8, no line end) and its 16 byte tag |

The first 49 bytes are the header. They are the associated data of the encryption, so a changed byte of the header, the cost included, makes the tag fail. The key is the 32 bytes Argon2id (version 0x13) gives for the password's UTF-8 bytes, the salt and the three costs. The password is used as it is typed, with no normalization and no trimming. Two keyboards that write the same Persian word with different code points make two passwords; a person who sends a password in text should send it in the form that was typed.

**Numbers.**

| Quantity | Value |
|---|---|
| Argon2id cost of a new file | 65,536 KiB (64 MiB), 3 passes, 1 lane. A file made with less is refused by a client, so that no client takes part in a file whose password is cheap to guess. |
| What a client opens at most | 131,072 KiB (128 MiB), 6 passes, 4 lanes. A header that asks for more, or for less than a new file, is refused before any memory is allocated. |
| Password | At least 10 characters (code points) when a file is made, at most 1,024 bytes. A client that opens a file asks for no minimum: the one who made the file chose the password. |
| Link text | At most 2,109 bytes, which is the longest link there is: a whole document in a link. A native link with its gateway key and a pin is at most 421 bytes. |
| The file | At most 2,174 bytes (`49 + 2,109 + 16`). A file over that is refused before it is read further. |

**Making a file.** The maker picks a password (in an app, typed twice) and draws the salt and the nonce from the system's random source. The file is the header followed by the sealed link text. The maker shows the user, before the password is asked for, that the password has to go another way than the file, and that anyone who has the file and guesses the password has the link.

**Opening a file.** In this order, and the first failure ends it:

1. A content that begins with the magic is a sealed file, and is not read as a plain subscription file. The app asks for the password. Nothing is hashed before the user types one.
2. A file over its size, or shorter than the header and a tag, is refused. A version other than `1` is refused, and a version above it says that the app needs an update.
3. A cost outside the numbers above is refused with no hashing.
4. The key is made and the tag is checked. A wrong password and a changed byte are one error, "the password is wrong, or the file is damaged", so that an answer never tells a guesser which part was right.
5. The plaintext has to be UTF-8 and within the link limit. It then goes through exactly the ordinary import of its form: the grammar of "The link", step 1 and its first yes, the fetch and its signature checks, step 3. Nothing is skipped because the file was sealed.

The hashing takes a moment and a large block of memory. An app does it away from the thread that draws its window, and shows that it is working.

**What the password does and does not do.** It keeps a stranger who sees the file from reading the link. It does not make the link trustworthy, and it does not make the provider's key one the user knows: the user's first yes still shows the host and the key's fingerprint, and a document that does not verify under the key in the link is refused as ever. A file from a stranger with a password from the same stranger is as untrusted as a link from that stranger.

**The file's name and type.** The extension is `.vwsealed`, and the media type is `application/vnd.veilway.sealed-subscription`. The magic, not the name, decides what a file is.

**A test vector.** The password is `correct horse battery`, the salt is sixteen bytes of `07`, the nonce is twelve bytes of `09`, and the link is

```
veilway://sub/sub.example.com/s#v1.0EqyMnQrtKs6E2i9RhXk5tAiSrcaAWuvhSCjMsl3hzc.AXmmMe7eG_nJjxIDLN6t0OegeTmPx4a4jMhG7ImvhaUa.VVVVVVVVVVVVVVVVVVVVVQ
```

The file, in hexadecimal, is:

```
5657535542534541010001000000000003000000010707070707070707070707070707070709090909090909090909090966802ab495a740c98ea383a9ccf97fc7ba1d350bf66efd7fe9855a54bba3f8b67fb1cf40753399b129afd10474cf22f319edd5132b8643d19ea37624d118f17c22517776e674d0d826e99bd7005a5c75f485edb88dc07f55076ceacc17812967d65131bb702ba09fb5655627fc1ed62eb71685b26814b0c51d64071710d1928c7858aab3d00aeefe581d3ac97ff9f55754e36b30216ffa881a21dd75e2e532e5f9ba
```

The link is in the grammar of this page, with a gateway key whose key id is `01` and whose public key belongs to the X25519 private key `40..5f` (32 bytes). The file is 211 bytes, and the header is the first 98 hexadecimal characters. The vector was computed with an independent Argon2 and ChaCha20-Poly1305 (`argon2-cffi` and `cryptography`). The crate's test (`tests/sealed_file.rs`) gives the same bytes.

## Native and legacy

A client also reads the unsigned formats that other apps use, so that a user can bring an existing subscription along. This page does not specify those protocols. It says only what is accepted and how it is treated.

**Which is which.** A link with a `v1` fragment is native. Every other link is legacy, and must be `https`. Nothing a server answers changes that:

- A native link that is answered with anything but a signed document under its key is a failed fetch, on the first import as on every refresh. It is never read as a legacy list.
- A legacy link is fetched with a `GET`, never with a device key. If it is answered with a signed document, the app says "this provider offers a native subscription, ask it for the full link" and imports nothing from that answer.

**What is accepted from a legacy link.**

- A body that is a list of links, one per line, plain or in base64. Links with the schemes `vless://`, `vmess://`, `trojan://` and `ss://` are read. Every other line is skipped and counted. A server name in a legacy entry is held to the same refusals as a dial address of a native profile, and the client applies them to every address that a legacy name resolves to. `localhost` is not a legacy server. A legacy `path` holds only characters of a URL path and query.
- The response headers `subscription-userinfo` (it needs `upload`, `download` and `total` as integers, and may have an expiry), `profile-title` (display text, at most 64 characters, taken as it is: a `base64:` prefix is not decoded), `profile-update-interval` (hours, within the bounds of `update_interval`) and `support-url` (a URL under the rules above). A header that does not parse, or that is sent twice, is ignored.
- The limits in the table of numbers. A list over the count limit is cut at the limit and the app says so.

**How it is treated.**

- Each link is parsed into a typed profile. A field that is not on the parser's list of known fields is dropped. A link that does not parse is skipped. Nothing from a link is ever copied into a configuration as raw text, a path or a URL.
- Step 1 of the import says "this link cannot be verified". Every legacy profile is marked "unsigned", and the subscription is marked "unsigned: it can be changed on the way at every fetch".
- The rating is computed by the core from the settings in the link. It is Unsafe when there is no encryption, when certificate checking is switched off, or when the cipher is one the core lists as weak. Otherwise it is Detectable. A legacy profile is never rated higher. Until the core has its own list of strong ciphers, the implementation's list is a placeholder, and a cipher it does not know counts as weak.
- Connecting to a legacy profile needs the optional compatibility add-on, which the app offers to install at that moment. Such a profile is marked "TCP and UDP only".
- A legacy subscription follows the same rules for when a fetch happens as a native one.
- Provider content does not exist in the legacy format. Only the title, the usage numbers and the support link are shown. Legacy formats have no translations: every legacy text is one string.

**The panel side.** A provider's panel can serve the legacy format, at a different URL from the native endpoint, for users on other apps. What such a link reveals and protects is whatever those formats provide.

## Versioning

- `v` is the format version of the payload. This page defines 1.
- Display text as a string or an object of translations is part of version 1 from its first release. It is not growth that an older parser has to tolerate: no client reads only strings. The `v1` of a link's fragment is the form of the link and is separate.
- Version 1 grows only by new optional members and by new names for `critical`. An older client ignores a member it does not know, and refuses a document that marks a feature it does not know as critical. A provider puts a name in `critical` only when ignoring the feature would be unsafe or would leave a profile unusable.
- A document with a `v` above what the client knows is refused. The client keeps the last good document and tells the user that the app needs an update to read this provider's subscription.
- A new kind of profile or transport is a new `type`. An older client refuses that profile and keeps the others, so a provider can list a new transport in a new profile next to the old ones.
- A change to the envelope (another algorithm, another serialization) is a new `typ`, a new form of link and a new page, never a new meaning of this one.
- A client never falls back from a newer format to an older one for the same link.

## What a provider can and cannot do

A provider that is malicious, or whose panel or signing key is in someone else's hands, signs whatever it wants. The format does not stop it from being a bad provider. It keeps it inside its box.

**It can, and the format cannot change that:**

- See and alter everything the user sends through its nodes that is not encrypted end to end, and see destinations, names, volume, timing and the client's address. It runs the node.
- Point its own profiles at any public address, which the client will then dial when the user connects. With many users, that can be a third party's address, which then receives their connection attempts.
- Choose the server name a client sends in clear when it connects. A name that is dangerous to be seen asking for is the user's risk, and the user does not see it unless they look at the profile's details.
- List up to four more endpoints that the app will send the token to, sealed to its gateway, when it refreshes, once the user has seen and confirmed their hosts.
- Move the subscription to another main endpoint, with another kind of check or none, once the user has confirmed the new host. See "Moving the main endpoint".
- List up to four static mirrors that the app will send a plain `GET` to when everything else fails, once the user has confirmed their hosts. Each such host sees the device's address, or the address of the provider's exit, and a name for the device that holds for one period, see "What each party learns".
- Show false names, numbers, notices and cards in its own area, and false names on its own profiles and exits. With translations it can show different text to readers of different languages.
- See the time of every refresh, and tell users and devices apart. It may also learn a reader's language from the browser that opens one of its links and from the script of a device's name.
- Give different users different documents.
- With provider-issued keys: keep a copy of the device's private key.
- Stop serving, or serve a document that fails, which leaves the user on the last good one.

**It cannot:**

- Run code, or show markup, remote images or its own interface elements. Content is typed data and plain text.
- Open a URL without the user confirming a screen that shows the host, or make the app fetch anything other than its own subscription endpoints and the static mirrors its documents list, each only once the user has confirmed its host.
- Make the app connect to the device itself, to its router or its neighbors, or to a private address without the user being asked.
- Change a setting of the app: the kill switch, the resolver setting, routes, the theme, the language, the update channel, the fingerprint pack.
- Raise a rating, or hide the class of a transport. It can only lower a rating with `rating_cap`. A lower-class transport in its list is still used only with the user's consent.
- Switch off certificate checking. The format has no such field.
- Send traffic outside the tunnel. A profile has no routes, and the kill switch is the app's.
- Touch, replace or read another subscription, including another account of its own, or learn from the app that another provider's subscription exists. Its subscription is never fetched through another provider's tunnel, nor another's through its own, without the user choosing that for one request.
- Replace its own earlier document with an older one, or move a device to a provider-issued key without a new import.
- Import, enroll or connect without the user.

**Someone who is neither the provider nor the user,** and can answer the fetch in the provider's place without the gateway's private key (a content delivery network, a proxy that ends TLS, a relay mirror, a plain HTTP path), can refuse to answer and nothing else: every answer is sealed to its request, so it cannot serve an older document or replay a refusal, and it cannot read the request. Whoever also holds the gateway's private key can read the requests it sees, and can serve a document it has seen that is still valid and no older than the stored one, or a signed refusal it has seen for up to a day, which shows the user a wrong message and changes nothing. On a first import of a link with provider-issued keys there is no stored document, so such a party can serve any older valid document of that account until that document expires. A static host is one of these, and can do less: it is never asked for a first import, and it cannot send a refusal it was not given.

**A holder of a leaked link can:**

- With provider-issued keys: fetch the user's document, with every address, name, path, key and secret in it, act as the user's device, and recognize that device's `udp-obfs` traffic in recordings.
- With device-made keys: enroll a device of its own while a place is free, and use the account from there, with its own addresses and secrets. It learns the node's addresses, names, paths and public keys, the account's usage numbers and the names of the account's devices. It does not get the user's device key. It does not get the user's transport secrets either, even if it learns the device's public key, because the device's document is released only with the device secret.
- Fill the account's device places, which the user sees in the device list and in a `"device_limit"` refusal.
- Block everything in the document, if it controls a network.

It cannot read what the user sent, change what the user's app holds, or sign anything. It ends when the provider resets the link and removes the devices the holder enrolled, and, with provider-issued keys, rotates the device's keys and secrets. A reset alone does not undo what the holder already copied.

## Security considerations

- **The link is the root of trust.** It carries the key, so the fetch needs no trust. In exchange, a link from the wrong hands is a complete, valid subscription to the wrong provider. Providers should hand links over a channel the user already trusts and publish their fingerprint somewhere else as well.
- **The link is the account.** There is no password behind it. Leaked links are the ordinary way a subscription is lost, and screenshots of QR codes are the ordinary way links leak. A whole document in a link is worse, because it holds the device's keys themselves.
- **The signature protects against the path, not against the provider.** It says nothing about whether the provider deserves trust.
- **The panel can show a link again, at a cost.** Copies of tokens, sealed under a key that is not in the database, are what let an operator copy a link again. A stolen database alone gives no secret, but a stolen database with the key file gives every token and every sealed secret. An operator who does not want to carry the tokens sets "show links once", and then cannot copy a link again, only reset it. The key file is a single point of loss: a restored database without it serves nothing, and the panel says so and never makes new keys by itself. See "Storing the token".
- **A signing key that sits on the panel is as safe as the panel.** If the panel signs online, whoever takes the panel signs documents for every user, and a stolen key cannot be revoked. Enrollment needs a document per device, which pushes providers towards signing online. Where the signing key lives is the provider's largest decision (threat model Q9).
- **What a self-signed endpoint costs.** It is the way for a provider with no domain, and it has three costs. The link is longer: 159 characters of fragment against 115, so a QR code is denser and harder to scan from a screen or a print. The key behind the pin is a long-lived secret on the web server's host: whoever has it and a place on the network can answer the fetch in the endpoint's place. Since the exchange is sealed to the gateway, that gives it the sizes and times of requests and the power to refuse them, not the token. The standby pin, kept off the server, is what turns that theft into a switch and a reset of the tokens instead of a new link for every user. An operator who leaves the standby on the server loses that protection. And a self-signed endpoint is something a censor can look for: a prober that completes the handshake sees a certificate that no authority signed on a host that serves subscriptions, which ordinary sites rarely do, and the pin cannot hide it. On a server that also runs a node it marks the address, and the client caps the profiles at that address when it can see the match. A pin adds no trust that the link did not already have, since whoever gave the link already chose the key and the host. A link altered on the way to lose its pin is no new case of that: it also fails closed unless the altering party can show a certificate the chain accepts, and one who can alter a link can alter its key as well.
- **A static mirror trades freshness and a pseudonym for holding no secret.** Its host sees no token and no document, but its logs tie the fetches of a device in one period to one file name, with the address each came from. Every host is taken to keep every sealed version, and whoever later holds the link and the device secret opens them all, which is why they carry no usage. A host name that only the provider uses is blocked at no cost. See "Static mirrors".
- **The gateway key opens what was recorded.** Each request has a fresh ephemeral key, so a token that leaks later opens no recorded exchange. The gateway's private key does: whoever holds it and a recording of requests, made by a content delivery network, a proxy that ends TLS, a relay mirror or anyone on a plain HTTP path, reads every request sealed to it since it was listed and its answer, tokens and device secrets included. Destroying the key stops new exposure and opens nothing back up. A switch every 180 days and retired keys kept no longer than old links need bound how much one key covers. After a theft with recordings, every account that used the key needs a reset token and a new link. Like the signing key, it is as safe as the panel that holds it.
- **Plain HTTP gives up hiding, not secrecy.** Over `http` the exchange is as secret and as authenticated as over `https`, but the network sees the host, the path and the exact fixed sizes, which a filter can match on every request. TLS stays recommended. A move to plain HTTP is a signed decision of the provider that the user confirms.
- **A move follows the signing key.** A document can move every client to another endpoint, after one confirmation per client. Whoever holds the signing key could already sign any profile, so a move adds no power, but it does let a stolen signing key move clients to an endpoint the thief runs, where it would see their requests. The user's confirmation, which shows the new host, is the only check.
- **Stale documents.** A client that cannot refresh keeps working on old addresses and keys. Whoever can block the fetch can keep it there for up to a document's lifetime before any warning shows. Only a holder of the gateway's private key, or a static host, can serve it an older document. The warnings and the 30 day rule limit how quietly that continues.
- **Presence.** An automatic refresh happens only inside the provider's own tunnel, where the provider already sees the device. A refresh the user asks for outside a tunnel is visible to the local network, and the app says so first.
- **Every parser here needs a fuzz target** in the same change as the parser. The code has targets for the link grammar (`fuzz_deeplink`), the envelope (`fuzz_sub_envelope`), the payload behind a valid signature (`fuzz_subscription`), the legacy reader (`fuzz_links`), the request (`fuzz_sub_request`), the sealed file (`fuzz_sub_sealed`) and the opening of a static file (`fuzz_sub_mirror`). The Encrypted Client Hello configuration has none, because its reader is not written. Each target asserts that no input changes stored state unless every check passed. The exchange adds two: `fuzz_sub_gateway`, the gateway's handling of any body up to its limit (size, key id, `enc`, the open, the length and zero padding, then the request reader, the window and the replay memory), which asserts that every failure gives the one unknown-path answer and records nothing; and `fuzz_sub_answer`, the client's opening of any answer (status, size, open, length, padding, then the envelope), which asserts that no input changes stored state unless every check passed. The link target covers the gateway key, the plain forms and the lengths, and the payload target `gateway_keys` and `main_endpoint`.
- **What the code does with secrets.** Its types print no document, secret, dial address or path in debug output. Secrets are not wiped from memory when they are dropped, which is the same stated limit the threat model records as G36.
- **Nothing here is invented cryptography.** The envelope is JWS with EdDSA as published, verified by the strict rule of RFC 8032. The exchange is Oblivious HTTP over HPKE as published, with its own content and strings as RFC 9458 allows, and a 1-byte header on the wire in place of 7, all 7 still bound into `info`. The rules around them (the keys in the link, rotation, identity, enrollment, replay, moves) are policy. 

Tests this page calls for: a document with another header, a badly encoded part, a signature that only a lax verifier accepts, a lower serial, an equal serial and other bytes, another `subscription_id`, already expired, or under a key that is not held, is refused and changes nothing; a native link answered with a legacy list imports nothing; opening a deep link or scanning a code sends no packet until the user continues; declining an import frees the device place; a refresh that changes the device key or adds a private key fails; an unknown token and an unknown path get identical bytes from the panel, with the remaining difference in time measured and stated, while a valid token always gets a signed answer; no refresh leaves the device outside the subscription's own tunnel unless the user asked; a pinned link whose server shows another certificate, or the pinned certificate without its key, or does not negotiate TLS 1.3, fails with no byte of the request sent and the message of "A pinned endpoint", and is a failed fetch and not a refusal; a link with a pin cut short, or with a fourth field, is refused, and a link without a pin never trusts a self-signed certificate; no document moves a link from pinned to unpinned or back, except a confirmed move, and a document that lists no pin the client holds is refused; a dump of the panel's database holds no token, no transport secret and no private key in the clear, and a panel with accounts and no key file serves nothing and makes no key; a document list of `endpoint_pins` that keeps none of an endpoint's current pins is refused when the operator saves it; a request is matched by the lookup value and an unknown token costs the same as a known one; a profile that dials loopback is refused and one that dials the device's own network is not dialed; one subscription's document cannot change another; no field of any document changes the kill switch, the resolver setting, the routes or a rating upward; the token appears in no log line, no URL and no request to a host the provider did not sign; a hostile corpus of text, URLs and logos is shown as plain text, refused or left out; a static fetch carries no token, device secret, device key, cookie or conditional field; a static file of a wrong size, with a bad tag, with padding that is not zero, under another file's name or another period's, or holding an older serial, changes nothing and the next mirror is tried; a static file with the document held is no successful refresh; a 404 from a static mirror is never taken as a revocation; a static mirror is never tried before the endpoint and the relay mirrors have failed in the same refresh, and never for an import; a refresh asks each static mirror for one name only, the one of the client's period; an older client ignores `static_mirrors` and keeps the document; a `static_mirrors` with pins, an IP literal or the host of the endpoint is refused; the derivation and one sealed file match vectors computed apart from the implementation; the publisher writes each period's files from `W` before it to `W` after it and no longer; every file of a published folder, decoys included, has one size and changes in every round, the decoy count stays in its range, and no decoy birth is paired with a death; a published document has no `usage`; a panel publishes no file for a pending device, and none after a reset or a removal; the endpoint and the publisher never sign one serial twice for a device. For the exchange: a body of another size, an unknown key id, a bit flipped anywhere but the top bit of `enc`, an `enc` of small order, a token that is unknown, a `t` out of the window, a replayed request and a replay with only the top bit of `enc` changed each get bytes identical to an unknown path, after the same work, and change nothing; a `t` earlier than the gateway's start is refused, so a request captured before a restart is refused after it; a clock that steps back reopens no window; the top bit of `enc` on the wire is random; a request that times out is never sent again with the same bytes; an answer that opens for one request does not open for another; an answer of a wrong size, with a bad tag, a length out of range or padding that is not zero is a failed fetch; no byte of a token, a device key or secret, `kids` or a device name is on the wire outside the seal, over `https` or `http`; a document whose `gateway_keys` leaves out the active key is never signed; a client whose first gateway key was destroyed reaches the gateway with its second without a question; a move is never followed before the user's yes, completes only at a document from the new endpoint, is undone by no older document, and falls back to the old endpoint until it completes; a legacy `http` link is refused. The exchange needs test vectors computed apart from the implementation, with an HPKE written out in plain Python as for the stream proof: fixed inputs for the gateway key, the ephemeral key, the request JSON, `response_nonce` and an envelope, giving `enc`, the 1,073 request bytes and the answer of 9,413 bytes. They are in "Test vectors of the exchange" above.

## Open questions

Each is listed with the default this draft takes. The first five are the ones a reviewer should attack first.

| Question | Default |
|---|---|
| The key in the link makes the giver of the link the root of trust. Is there anything better that needs no central party? | No. The project runs no directory of providers, and will not. |
| Device places can be filled by a holder of the link, and only the provider can clear them. Should a device be able to remove another, and how would it prove it is the older one? | Not in version 1. WireGuard keys cannot sign, so it would need a second key per device. The device list and the signed refusal make the state visible. |
| The first fetch enrolls a pending device before the user has seen the document. Is a separate request that only previews the document worth a second kind of answer? | No. The place is pending, is released on a decline, and expires by itself. |
| Keeping a retired signing key for a year, to tell late clients that they need a new link | Kept. A key that was retired because it was stolen signs nothing the thief could not sign already. The alternative is that late clients see the message for an interception. |
| Can the endpoint really give the web server's own answer for an unknown path, in bytes and in time? | Bytes: required to be identical, and handing the request back to the web server makes them so. Time: not the same, since the gateway does work an unknown path does not. The difference is to be measured from the network, against the operator's web server in front, with the method and the number stated here. Not measured. |
| Can "an unknown token answers like an unknown path" hold in timing, when a valid token leads to a signature and an unknown one does not? | Up to the token check, required: every kind of refused request does the same work, and the difference between them is to be measured and stated. After it, no: a valid token leads to a signature or a cached refusal, and that difference is visible only to someone who already holds a valid token. Not measured. |
| Is no automatic refresh outside the subscription's own tunnel too strict? A user whose profiles all die gets no new ones until they ask. | Kept. The app tells the user to refresh when every profile of a subscription has failed. |
| May a fetch use the fronting options of the transports? (threat model Q15) | Not specified. `refresh_urls`, `static_mirrors` and a whole document in a link are the answers here. Candidates for the fetch would have to be in the link. |
| A static mirror's file name could be fixed for the life of a token and a device, so that the host's logs follow one device for as long. Should names change per period? | Yes, in version 1. Names change every 604,800 s, derived with the period's number and the base URL, and every name of a folder changes in the same round, so the change marks nobody. It costs a client clock within a day of the panel's, which the format needs anyway, and two sets of files for two days around each change. See "Periods and clocks". |
| May a client fetch a static mirror automatically outside a tunnel, since the request carries no secret? | No. The fetch still tells the local network and the host the device's address and when its other paths failed. Only when the user asks, as for any refresh. |
| Should a link be able to name a static mirror, so that a first import works while the endpoint is blocked? | No. The derivation needs a device secret the provider has seen, so a device that never reached the endpoint has no file. A whole document in a link is the way for a first import. |
| Is the decoy range enough, and are births and deaths at 1 in 4 rounds each the right shape? | Taken as written. No measurement is behind it. It hides the count and single events only from those without the host's logs, and hides no mass event. |
| Rewriting every file in every round costs bandwidth: a folder of 1,000 files of 36,979 bytes is about 37 MB per round, and twice that in the two days around a change of period. Should a round rewrite only what changed? | No. Rewriting only changed files tells the host when each user's document changed, which follows their devices and profiles. The operator sets the round, from 1 to 12 hours. |
| A host is taken to keep every sealed version, and `k_mirror` is fixed for the life of a token, so a later leak of the link and the device secret opens all of them. Should the key move forward with each period, by a hash chain, so that a later key opens no earlier file? | Not in version 1. The panel would keep the current key of the chain and drop the old one, and a client would step its key forward from the last period it knows, which a client that was away for long must step through. It is the way to give static files forward secrecy, and is the first thing to add. |
| Should the publisher upload by itself? | Later, as an option. The first version writes a folder and the operator copies it, so the panel holds no credential of the host. |
| Should a document over 30 days past its expiry stop working, not only ask? | It asks. Stopping would let whoever blocks the subscription host take the user's working connection away after a month. |
| How does a panel change the key of a self-signed endpoint, or recover from its theft, without a new link? | By `endpoint_pins`: the operator always lists the active pin and a standby kept off the server, and a switch loads the standby. A client offline for the whole notice time, or an operator who left the standby on the stolen server, needs a new link. A new link at every change was passed over, because a link in a chat or on a wall cannot be recalled. |
| Should the panel store a token only as a keyed hash? | Not by default. Operators want to copy a link again, so it also stores a sealed copy under a key outside the database. "Show links once" drops the copy. |
| Can a client know that a pinned endpoint with a host name shares an address with a node? | No. It makes no lookup for it. Only an IP literal is compared. The panel warns the operator for the names. |
| Dial addresses are IP addresses only | Yes. It avoids a lookup before the tunnel. It costs providers whose fronts change address often, who must reissue documents. |
| Certificate pins behind a content delivery network (threat model Q22) | None. Such candidates rely on ordinary validation, and the tunnel inside does not depend on it. |
| Where the signing key lives, and whether the panel may sign online (threat model Q9) | The provider's decision. Device-made keys need a document per device, signed when the device enrolls, so an offline key means provider-issued keys or devices registered ahead of time. |
| Should the exchange be plain RFC 9458, Binary HTTP and the 7-byte header included, so that a third party's Oblivious HTTP relay could carry it? | No. Binary HTTP would add a second HTTP parser of hostile input on both sides and a method, target and fields nothing reads, the 6 fixed bytes have nothing to carry, and `message/ohttp-req` would mark the traffic for every party on the way. The cost is that a public Oblivious HTTP relay, which expects `message/ohttp-req`, cannot serve as a relay mirror. |
| The gateway's key is static, so a recording and a later theft of the key open every request sealed to it until it is destroyed. Should the key change more often, or each answer carry a key for the next request? | Not in version 1. A switch every 180 days bounds how much one key covers, and after a theft with recordings every account that used the key needs a new link. A key that moves forward per period would bound it further, and every client would have to follow it. |
| Can a gateway do the same work for every request, in time? | Required, in the way a node opens a stream proof: one setup, one open, one window and memory check, one HMAC and one lookup in memory for every `POST`. Whether a body of another size, an unknown key id, a failed open, a stale `t`, a replay and an unknown token are told apart in time from the network is to be measured, and the result stated here. Not measured. |
| Is one fixed request size worth the pattern it makes on a plain HTTP path? | Kept. A size per `op` would tell the path which step of an enrollment a device is at. On `http` the provider gives up hiding anyway. |
| A move is confirmed by the user once, and a stolen signing key can then move clients to the thief's endpoint. Should a move need more, such as a delay? | No. A stolen signing key can already sign any profile. The confirmation shows the new host. |
| Should a profile be able to carry routes (split tunneling chosen by the provider)? | No, not in version 1. Routes from a provider are a way to move traffic outside the tunnel. |
| Should a legacy link be refreshed outside a tunnel at all, since it cannot be verified? | Only when the user asks, as for a native one. |
| Translations repeat in every profile's exit catalog. Should a catalog be shared at the top level? | Not in this version. The limit on JSON values is what a large provider meets first. |
| Should a text whose translations differ greatly be flagged? | No. The app cannot judge meaning. It marks a translated text and shows `default` on every screen where the user decides. |
