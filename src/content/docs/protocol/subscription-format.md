---
title: Subscription format
description: The signed document in which a provider delivers profiles to a client, the link that leads to it, how it is fetched, imported and checked, and what a client refuses.
---

:::caution[Draft]
This page is a draft specification. It has had two rounds of internal adversarial review, and its client-side reading (the link, the envelope, the payload, the request, the client's state machine and the legacy reader) has a first implementation that was reviewed once against this page. It has not been reviewed by anyone outside the project. No client and no endpoint exists. Do not rely on any property described here.
:::

A subscription is how a provider gives a user what the app needs to connect: one or more profiles, the list of exits, and a little content of the provider's own. Read [Protocol overview](../overview/) first for the terms. This page defines every profile field that [Transports](../transports/) and [Control channel](../control-channel/) rely on.

Four rules shape the page:

- **Everything in a subscription is hostile input.** A provider can be malicious, and so can a link on a wall. Every byte is checked against a limit before it is used.
- **The link carries the provider's key.** A document is verified against a key the user already holds, from the first fetch on. No key is ever accepted because a server sent it.
- **A subscription is data inside a box.** It can describe how to reach the provider's nodes and what to show in the provider's area of the screen. It cannot run anything, open anything, change a setting of the app, or touch another subscription.
- **A document that fails any check changes nothing.** The last good document stays in force.

Related things that are not subscriptions: a supporter token is a separate signed file with its own format, and a pairing code that links two nodes is exchanged between panels and is never imported into a client.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends. None of these numbers has a measurement behind it. A limit on display text is in characters unless it says bytes, and a character is one Unicode code point after the filter of the control channel page.

| Name | Value |
|---|---|
| Link token | 16 bytes, 22 base64url characters |
| Device secret | 16 bytes, 22 base64url characters |
| Link pin | 32 bytes, 43 base64url characters. A link with a pin has a fragment of 113 characters, one without has 69. |
| Pins held for one endpoint | 1 or 2 |
| Stored token lookup value | 32 bytes: HMAC-SHA-256 under the panel's lookup key over the label `"veilway v1 sub token"` and the 16 token bytes |
| Stored encrypted token copy | ChaCha20-Poly1305 under the panel's copy key: a random 12-byte nonce, the 16-byte token sealed, a 16-byte tag, 44 bytes in all. A nonce is drawn at each creation or reset of a token, which is few enough writes for random nonces. |
| Panel keys for stored secrets | three keys of 32 random bytes: the lookup key, the copy key and the secret key. No key serves two purposes. |
| Notice of a new endpoint pin | The panel names a pin in its documents at least 120 days before the endpoint presents it. That is the longest document lifetime plus the grace after expiry. A standby pin is named from the first document, so the notice has long run when it is needed. |
| Key ids in a request | 1 or 2 |
| Subscription URL without its fragment | at most 256 characters, counted on the `https` form for both forms. The same limit holds for a refresh URL. |
| Request body | at most 1,024 bytes |
| Response body, and a document in a file | at most 1,048,576 bytes |
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
| Fetch timeouts | 10 s to connect, 30 s in all |
| Redirects | none |
| Legacy list | at most 256 links, each at most 4,096 bytes. Every line that is not empty counts toward the 256, also one that is skipped. |

The limits cannot all be reached at once. A large provider meets the limit on JSON values first: 64 profiles with a handful of transports and a few dozen exits each fit, 64 profiles with 256 exits each do not.

## The link

### Form

A native subscription link has one of two forms with the same content, and its fragment has one of two kinds. With two fields the endpoint has a certificate from an authority. With three it has a self-signed certificate, and the third field is its pin:

```
veilway://sub/sub.example.com/s#v1.<key>.<token>
https://sub.example.com/s#v1.<key>.<token>
veilway://sub/sub.example.com/s#v1.<key>.<token>.<pin>
https://203.0.113.7:8443/s#v1.<key>.<token>.<pin>
```

| Part | Meaning |
|---|---|
| `sub.example.com/s` | The provider's subscription endpoint: a host, an optional port, and a path. It is the same for all of a provider's users and holds no secret. The client always reaches it over `https`, and never over `http`. |
| `v1` | The form of the fragment. Anything else is not a native link. |
| `<key>` | The provider's Ed25519 public key, 32 bytes, base64url without padding, 43 characters |
| `<token>` | The user's token, 16 bytes, base64url without padding, 22 characters |
| `<pin>` | Optional. The SHA-256 of the SubjectPublicKeyInfo of the endpoint's certificate, 32 bytes, base64url without padding, 43 characters, with the unused trailing bits zero. It is the same hash as a `pins` entry of a transport candidate, in the encoding of a link. Present only when the endpoint serves a self-signed certificate. See "A pinned endpoint". |

The exact grammar, which the client checks before it does anything else:

- The `veilway` form is `veilway://sub/`, then a host with an optional `:` and port, then `/` and a path, then `#v1.`, 43 base64url characters, `.`, and 22 base64url characters, and then either nothing or `.` and 43 base64url characters, which are the pin. Nothing else, and no query: no fourth field, no empty field, and no pin of any other length. The fragment is therefore exactly 69 or exactly 113 characters. The host is a lowercase host name. An IP literal is written in one spelling only. An IPv4 address is four decimal numbers with no leading zeros. An IPv6 address is in brackets in its compressed form of RFC 5952: lowercase, the longest run of zero groups written ::, and no :: for a single group. A link whose address is written any other way is refused, so that two spellings of one address are never two hosts. It is an IP literal (a dotted IPv4 address, or an IPv6 address in brackets, lowercase, with no zone) only in a link that has a pin, since a provider with no domain has nothing else to put there. Such a literal is held to the refusals of a profile's dial address when the link is parsed, and to the address check of "How a fetch is made" at each fetch. The path is `/` followed by characters that RFC 3986 allows in a path.
- The `https` form is the same with `https://` in place of `veilway://sub/`.
- A whole document is `veilway://doc#v1.`, 43 base64url characters, `.`, and the document, or in a file the same without `veilway://doc#`. The content is split at the first two dots, because the document has two dots of its own.
- Anything that begins with `veilway://` and matches none of these is refused at once.
- An `https` text that holds `v1.`, 43 base64url characters, a dot and 22 base64url characters anywhere in it, and is not exactly the `https` form, is refused. That covers a pinned link as well, and so a pin that was cut short, or something put behind it, never turns a link into one without a pin. So is an `https` URL whose fragment is `v`, digits, and then a dot or the end, and does not fit the native grammar. Neither is ever read as a legacy link: a damaged native link must not turn into a `GET` that carries the key and the token.
- A URL the token is sent to (the endpoint, a refresh URL) and a legacy link hold no percent-encoded control character (`%00` to `%1f`, `%7f`), no `%2f` or `%5c`, and no `.` or `..` path segment in any spelling, the `%2e` forms and a segment with a parameter included.

The fragment is 70 characters with its `#`, or 114 with a pin. A link to a short host name is about 100 characters, and about 145 with a pin. The first fits a QR code of version 6 (41 by 41 modules) at the lowest error correction level, or version 8 at the medium level. The second needs version 7 (45 by 45 modules) at the lowest level, or version 8 (49 by 49) at the medium level, and the code is denser for it.

A web server and a proxy never receive the fragment of a URL. That is why the key and the token are there. The token is not in the path, so it does not land in access logs.

**Providers hand out the `veilway` form.** It is what a panel shows for copying and puts in a QR code. The app also reads the `https` form when a user pastes or scans it, because links get rewritten on the way. The difference matters when a link is tapped:

- A tapped `https` link opens in a browser, not in the app. The browser looks up the host and requests the endpoint from the user's own network, before the app has shown anything. The link, fragment included, lands in the browser's history and in its history sync. A messenger may fetch a preview of the link, sometimes from its own servers. None of these send the fragment to the endpoint, and all of them show the host to someone.
- The endpoint answers a `GET` exactly as an unknown path and never serves a page, so no script of the provider's or anyone else's ever runs with the fragment in reach.
- The app is never tied to the `https` host by an app link or universal link. The file such a tie needs would sit on the host and name it as a subscription host.
- A tapped `veilway` link opens whichever app has claimed the scheme. On a platform where another app can claim it, that app receives the key and the token. The app cannot prevent this. It says so in its help, and pasting the link or scanning the code inside the app are the ways in that no other app sees. An app that took a token this way could enroll a device, which the user would see in the device list.

**The form of the link decides what it is.** A link with a `v1` fragment is native. Any other `https` URL is a legacy link (see "Native and legacy"). The answer of a server never changes which of the two a link is. A link is never upgraded or downgraded without the user importing another link.

**The link alone decides whether the endpoint is pinned.** A link with two fields is validated by chain, whatever the server presents, and a link with three trusts exactly the certificates its pin names, whatever else the server presents. No answer, no document and no setting moves a link from one to the other. A pinned link that loses its pin on the way (a messenger that cuts the end of a text) reads as a link without one and fails closed at its first fetch, because a self-signed certificate has no chain, and the app says what may have happened (see "A pinned endpoint"). `http` is refused in every form, for native and legacy links, whatever a pin says. A legacy link has no pin field and cannot name a self-signed server.

**An `https` pinned link opens badly in a browser.** A browser that is sent to a self-signed endpoint shows its own certificate warning, and a user must not be taught to click through it. A provider with a self-signed endpoint hands out the `veilway` form only.

### What the key in the link means

The client verifies every document of a subscription, the first one included, against keys it holds, and the first of those came with the link. So whoever answers the fetch, be it the provider's host, a mirror, a content delivery network in front of it, or someone who holds a certificate the device trusts, can refuse to answer or serve an older valid document. It cannot make the client accept a document of its own.

The limit, stated plainly: **whoever gave the user the link is trusted for the key.** A link from the provider's own channel is the provider's. A link from a stranger is a stranger's provider, with the stranger's key in it, and everything about it will verify. The app cannot tell these apart. It shows the host and the key's fingerprint before it does anything, and the user's check is where the link came from.

The fingerprint of a key is the first 16 bytes of its SHA-256, shown as 8 groups of 4 hexadecimal digits.

### The token is a bearer secret

Whoever has the link is that user to the provider, until the provider resets it. There is no second factor in the format. What follows:

- The client stores the link, the documents and its device keys in the operating system's secret storage where the platform has one, and otherwise in a file encrypted under a key kept there. It never shows the token after import, writes it to a log or includes it in a diagnostic report. What is stored is trusted as the link is: whoever can write the client's storage chooses the keys. A stored document that still verifies but that the app can no longer read, for example after an update that tightened a rule, is not thrown away with its subscription: the link, the device key and secret and the keys held stay, and the user refreshes.
- The token is sent only in the body of a request to the endpoint of the link, or to an endpoint in `refresh_urls` of an accepted document, which the provider signed. It is never put in a URL or a header, and never sent to a URL from provider content or to anything the project runs. The project runs no service that sees subscription links.
- Whoever ends TLS for the endpoint sees the token: the provider's host, and any content delivery network or reverse proxy the provider puts in front of it. Each of them is a holder of the link. A pinned endpoint ends TLS at the panel itself: a content delivery network in front of it would present its own certificate, which the pin does not name, so none can be there.
- The panel does not keep the token as it stands to find an account by. See "Storing the token".
- A request carries no cookie, no referrer and no identifier of the device other than what "Fetching" lists.

**Reset.** A provider resets a user's link in the panel. From then on the old token is unknown: its lookup value and its encrypted copy are deleted at once. The provider gives the user a new link. Importing it replaces the stored token when the key and the subscription id are the same.

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

A native fetch is a `POST` to the endpoint, with `Content-Type: application/json` and this body:

| Member | Type | Rule |
|---|---|---|
| `v` | integer | 1 |
| `token` | string | The token from the link |
| `kids` | list of 1 or 2 strings | The key ids of the signing keys the client holds for this subscription. On a first import, the id of the key in the link. |
| `device_public_key` | key | The public half of the WireGuard key the client made for this subscription |
| `device_secret` | string, 22 base64url characters | 16 random bytes the client made together with the device key. Sent on every request. |
| `op` | string | `"fetch"`, `"confirm"` or `"release"` |
| `device_name` | display text, at most 32 characters | Only with `"confirm"`, and only what the user typed. The client never fills it from the system. Absent when the user typed nothing. A name that is empty after the filter is not sent. |

A legacy fetch is a plain `GET` and carries none of this.

The body of a native request is at most 1,024 bytes. A body with a member this table does not list, or with a `device_name` that is empty after the filter, is malformed: the endpoint answers `"bad_request"` when the token in it is valid, and as an unknown path otherwise.

**The device secret.** A WireGuard public key is not a secret: it is in the provider's panel, and users paste it into support chats. Without something more, anyone with the link and that public key could fetch that device's document, transport secrets included. So the client makes a random secret with the device key and sends both at its first fetch. The provider stores the secret with the device and requires it on every later request for that device key. It is a stored random value compared in constant time, not a cryptographic construction. The client keeps it where it keeps the link. A client that loses it cannot fetch that device's document again: it gets `"device_mismatch"`, makes a new key and a new secret, and enrolls as a new device, which takes a new place.

**What `kids` reveals.** The endpoint, and whoever ends TLS for it, sees which of the provider's own keys this client holds, which says roughly how recently it refreshed. It is at most two ids of 8 bytes, and they name the provider's keys, not the device.

### The answer

| Request | Answer |
|---|---|
| An unknown or reset token, a body that is not this JSON object, a `GET`, or a source over its limit | Exactly what the host answers on any path it does not serve: the same status, headers and body, in the same time. A prober who guesses tokens learns nothing, and a host cannot be recognized as a subscription host by asking it. |
| A valid token | Always a signed document: the subscription, or a signed refusal that says why there is none. |

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
| `"released"` | A pending place was freed, or there was none. | Nothing. |
| `"bad_request"` | A member was missing or malformed, or the device key was all zero or of small order. | A fault in the app. |

A refusal is verified like any document. On a refresh it must carry the stored `subscription_id`, or it is a failed refresh. On a first import it may carry any id, and its age is still checked. It is never stored as the last good document and changes no profile. One that is older than the limit in the table of numbers is treated as a failed refresh, so that an old refusal cannot be replayed for long. The requester has already shown a valid token, so naming the state protects nobody's secret, and the real user needs to know.

**When the answer is not a subscription at all.** A native fetch that gets anything but a signed document (the host's not-found answer, a page, an error) is a failed fetch. The client shows "the endpoint did not answer as a subscription: the link may have been reset, or something else answered in its place", keeps the last good document, and backs off as after any failure.

### The endpoint

What the endpoint owes, as the threat model requires of it:

- Tokens of at least 128 bits from a secure random source. The request is matched by the token's lookup value (see "Storing the token"), never by the token itself, and the values are compared in constant time. The check costs the same whether the token is known or not: one HMAC, one lookup, and one comparison, against a dummy value when nothing was found. A token that is not in the one encoding of the link grammar is an unknown token.
- No session cookie read or set, and nothing else served at that path.
- **One answer for everything that is not a valid request.** The endpoint is one path behind the operator's own web server. For an unknown token it does not compose a not-found answer of its own, which would differ from the web server's. Either the web server is set up so that the endpoint hands the request back and the web server answers as it does for any unknown path, or the endpoint learns that answer by one request to the web server for a path that does not exist, at start and on reload, and repeats its status, header fields and body, in the way the transports page has a listener learn its decoy's header fields. The first way is exact and is preferred.
- **Limits per source** are applied by the web server to every path alike, so that reaching one says nothing about this path.
- **Limits that a link holder cannot turn on the user.** An enrolled device is recognized by its key and secret and has its own allowance, per token and device. Requests with device keys the endpoint has not seen share a separate, tighter allowance per token, and an account has at most 2 pending places. A holder of the link can use up those two things. It cannot use up the allowance of the user's enrolled device, so the user's refreshes go on.
- The request body is hostile input to the panel. `device_name` is stored and shown as text only, after the same filter the client applies to display text.

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
- The client keeps its device key and secret where a reinstall can find them again, where the platform allows, so that reinstalling the app does not take a new place. That makes them an identifier that outlives the app's removal. Removing a subscription in the app deletes its key, secret and link, and the app has one action that deletes everything it has stored.
- A name typed for a device is shown to anyone who holds the link, in the device list. The app says so where the name is typed.

The cost: recovery from a filled account needs the provider.

### How a fetch is made

- `https` only, never `http`, for a native and for a legacy link. The link chose how the certificate is checked:
  - **Two fields, no pin:** normal certificate validation, TLS 1.2 or later, and the client's browser-like TLS where the build has it. The certificate protects the token on the way. The document is protected by its signature.
  - **Three fields, or a pinned entry of `refresh_urls`:** the rules of "A pinned endpoint", and no chain validation.
- No `Accept-Language` field.
- `Accept-Encoding: identity`. An answer with a `Content-Encoding` field is refused, which removes the decompression bomb as a case.
- No redirect is followed. A request that is redirected is a failed fetch.
- The timeouts and the size limit in the table of numbers. The body is read up to the limit and no further.
- The endpoint's host name is looked up once per fetch, by the resolver in force: the tunnel's when the fetch goes through a tunnel, the system's when it does not. The address that was checked is the address that is dialed. An address that is loopback, link-local, private, unspecified or multicast is refused, for the endpoint and for every entry of `refresh_urls`.

### A pinned endpoint

An endpoint is pinned when its link has a third field, or when it is an entry of `refresh_urls` given as an object with `pins`. A provider with no domain and no certificate from an authority serves its endpoint with a self-signed certificate, and the link carries the pin of that certificate, so the app trusts exactly that server and no other. What the client does on a pinned endpoint is what the `tls` transport does on a candidate with `self_signed` (see "`tls`" on the [transports](../transports/) page), with these particulars:

1. **TLS 1.3 only.** An endpoint that does not negotiate it fails the fetch. The client uses no early data and no resumed session, so that every fetch shows its certificate.
2. **The check.** The SHA-256 of the SubjectPublicKeyInfo of the end-entity certificate must equal one of the endpoint's pins (1 or 2 are held). The TLS 1.3 handshake's signature is still verified against that key, by the TLS library's own verification, so that a server which shows the pinned certificate without its key fails. The chain, the name and the dates are not checked, and any other certificate the server sends is ignored. There is no fallback to chain validation, no "trust this certificate" button, and no way for the server to name a pin.
3. **The name sent.** A host name is sent as the server name. An IP literal is not sent, so a pinned link with an address in it makes no lookup and shows the network only a connection to that address.
4. **Nothing is sent before the check passes.** The request, with the token in its body, is written only after the handshake has finished and the pin matched.
5. **A mismatch** (no pin matches, the signature fails, or TLS 1.3 is not negotiated) is a failed fetch. It is never a signed refusal and never a refusal by the endpoint, since nothing was authenticated, and nothing was sent. Whatever the server then writes is not read. The client shows: "the subscription server's certificate does not match this link. If your provider has changed it, ask for a new link. If not, something between you and your provider answered in its place." It keeps the last good document and backs off as after any failure, and it goes on to the next entry of the list of endpoints.
6. **A link without a pin that meets a self-signed certificate** fails chain validation like any other, and the app adds: "this link has no certificate part. If your provider uses its own certificate, part of the link was lost on the way."
7. **The pins held** change in two ways only: the user imports a link, which replaces them with the link's pin, and an accepted document changes them, as "Pins, and a standby" says.

**Pins, and a standby.** A client learns a new pin only from a document, and gets a document only from an endpoint it can reach with a pin it holds. So the panel never leaves a pinned endpoint with one pin. At setup it makes a second key, the standby, and every document it signs lists both pins in `endpoint_pins`: the pin of the certificate it presents, and the pin of the standby. Every client holds both from its first document. A client that accepts a document holds exactly the pins in its list, as it holds exactly the signing keys of a document, and accepts a certificate that matches either.

- **The standby key is kept off the server.** The panel shows its private half once, at setup, for the operator to put away, and keeps no copy on the host. It says that if the standby stays on the server, whoever takes the active key from that server takes the standby with it, and then a stolen key means a new link for every user. It says so again whenever it finds that key on its host.
- **A switch.** To change the key, planned or after a theft, the operator loads the standby key. The panel presents its certificate, makes a new standby, and signs documents that list the new active pin and the new standby. The list includes a pin the client holds, which is the former standby, so clients accept it. The user is asked nothing. The client notes "the provider renewed the certificate of its subscription server" with the date in the subscription's details. A new certificate for the same key needs no step, since the dates are not checked.
- **A list must include a pin the client holds for that endpoint,** or the document is refused, so a pin set cannot jump to keys the client has no tie to. The first pins of a refresh entry that a document adds have nothing to include, and are taken on the signed document's word and the user's confirmation of the host. The signing key is the root of trust, so this is no new trust. The same holds, at import and when stored state is read back, for an entry of `refresh_urls` on the link's host and port. Pins stored for the endpoint are exactly the `endpoint_pins` of the last accepted document when it had that list, and stored pins that differ from it are treated as damaged storage.
- **What the client cannot enforce, the panel must.** The client cannot tell a standby that was listed long ago from one listed yesterday. The panel names a pin for the time in the table of numbers before it presents it, and it compares every list it is about to sign with the certificate it serves, and refuses to sign a list that leaves that pin out. A panel that signed a list without it would lock every refreshing client out of its endpoint, with new links as the only way back.
- **A second pinned entry of `refresh_urls` on another host** does the same for a stolen key, and a pinned entry follows the same rule with the list in its `pins`.

The other choice would be a new link at every key change. It was not taken because a link on a wall or in a chat cannot be recalled. What the rule costs is a client that was offline through the whole notice time: its pins are those of an endpoint that no longer exists, and it shows the mismatch message above and needs a new link. This is the same state as a client that missed a rotation of the signing key. When the endpoint's key was stolen and the standby is not lost with it, the switch above answers it. Without a standby, the panel cannot recall the pin from clients that hold it, and every user needs a new link. In both cases the panel resets the tokens, since whoever holds the key and the network can have received them. A client that imports an old link sets its pins back to that link's pin, which is covered by the same reset, since the old link's token is then unknown.

**What the panel's endpoint certificate is.** The certificate of a pinned endpoint is made for that endpoint, with a key of its own, kept on the panel's host with mode 600, outside its database and apart from the signing key and from the panel keys of "Storing the token". It is never the certificate of a node's `tls` listener, and the two never share a key. What it says about itself follows "What the node writes into its own certificate" and the validity row for a self-signed certificate on the transports page: no fixed placeholder name, a random serial, a normal validity renewed with the same key before it ends, an ECDSA key on P-256, and the common extensions of a server certificate, with the host (a name, or the IP address) as its subject alternative name.

### When a fetch happens

A fetch outside a tunnel tells the local network that this device talks to this provider's subscription host. On a hostile network that marks the user even while they are not connected. So:

| Situation | What the client does |
|---|---|
| A tunnel of one of this subscription's own profiles is up | Refreshes automatically, on the interval, through that tunnel. |
| No tunnel is up | Does not refresh by itself. The user can ask for a refresh. Before it goes out, the app names every host it may contact (the endpoint and the accepted `refresh_urls`) and says what the network will see: a lookup of each name and a TLS connection to it. |
| A tunnel of another subscription is up | Does not refresh this subscription by itself. When the user asks, the app offers the two ways below. |
| First import | The request leaves only after the user's first yes, by the same choice of ways. |

**When another subscription's tunnel is up,** a request for this subscription can go two ways, and each shows something to someone. The app shows both and lets the user choose:

| Way | Who sees what |
|---|---|
| Disconnect, and fetch from the device's own address. This is the default. | The local network sees a lookup of this provider's host and a connection to it. The other provider sees nothing. With the kill switch on, the user has to disconnect or switch it off first. |
| Fetch through the tunnel that is up. Only when the user chooses it, each time. | The other provider sees a lookup of this provider's host and a connection to it. The local network sees nothing new. This provider's host sees the other provider's exit address, not the user's. |

On a network the user is hiding from, the second way is often the safer one, and the app says that in plain words. It is never taken without the user choosing it.

Automatic refresh can be switched off per subscription. A provider cannot ask for refreshes more often than every 15 minutes, and it still sees the time of every refresh and the node address it came from.

### When nothing works

A user whose profiles have all stopped working can refresh only by asking. With the kill switch on, nothing leaves the device outside a tunnel, the fetch included: the user has to switch the kill switch off, or disconnect, to refresh from the device's own address. The fetch is not an exception to the kill switch.

If the subscription host is blocked as well, the format has two partial answers and no complete one:

- `refresh_urls`: the provider can list other endpoints for the same subscription. The client tries them in order after the first fails. Because every document is verified against a key held, a mirror needs no trust beyond seeing the token.
- A whole document can be carried in a link, a QR code or a file (see "Import"), so a provider can send a new one over any channel the user still has.

Fetching a subscription through the fronting options of the transports is not specified in this draft. See "Open questions".

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
| `endpoint_pins` | list of 1 or 2 pins | no | The pins of the link's endpoint, each standard base64, 44 characters, as the `pins` of a candidate. The two are different: a list that names one pin twice refuses the document. See "Pins, and a standby". A pinned endpoint always lists two, the active pin and a standby, and the client cannot enforce that. The list must include a pin the client holds for that endpoint. A document that has it when the link's endpoint is not pinned is refused. It is ignored in a whole document, which has no endpoint. Absent, it changes nothing. |
| `refresh_urls` | list of at most 4 entries | no | Other endpoints of the same subscription. An entry is a URL string, for an endpoint whose certificate is validated by its chain, or an object with exactly `url` and `pins` (a list of 1 or 2 pins, standard base64), for a pinned one. A pin is not listed twice. An IP literal in a `url` follows the same one spelling as in the link, and is allowed only in an entry given as an object with `pins`. An entry of the link's own host and port that has pins must hold at least one pin the client holds for the link's endpoint, or the document is refused. That is the same rule as for the link, said per entry, and a document cannot move an entry from one kind to the other: an entry with the host and port of the link's endpoint, or of another entry, must be of the same kind as it, and an entry of any other shape or kind refuses the document. A `url` follows the URL rules below and has no fragment. Their hosts are shown on the import confirmation. A host that a later document adds is not contacted until the user has confirmed it: the app notes "the provider added a refresh host" in the subscription's details, as it notes a renewed key, and asks at the next refresh the user starts. Until then the client uses the hosts it already had. What the user confirms is a host and port together, with whether it is pinned. A host listed pinned that was confirmed unpinned, or the reverse, is asked about again, and a change of its pins is not. It stays confirmed only while documents list it: one that a document dropped and a later document lists again is asked about again. A whole document has no endpoints, whatever its `refresh_urls` say. |
| `profiles` | list of 1 to 64 | yes | See "A profile". |
| `devices` | list of at most 64 | no | Each: `name` (display text, at most 32 characters, may be empty), `enrolled_at` (Unix seconds), `this` (boolean, true for the asking device), `pending` (boolean, default `false`). See "Devices and their places". When more than one entry has `this` set, each of them is left out and the document is kept. |
| `usage` | object | no | See "Usage". |
| `support` | list | no | See "Provider content". |
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
| `transport_public_key` | key | when a `tls`, `ws` or `fronted` transport is listed | The node transport public key. |
| `transports` | list of 1 to 8 | yes | In the provider's order. See "Transports of a profile". |
| `stream_first` | boolean | no | Default `false`. See "Transport fallback" on the transports page. The user may set it too, and the user's setting wins. |
| `parallel` | integer, 1 to 4 | no | Default 1. Connections per tunnel on `tls` and `ws`. |
| `padding` | object | no | `wide_max` (512 to 1023, default 1023), `normal_max` (64 to 255, default 255), `keepalive` (a list of two integers, seconds, the lower and the upper bound, each from 10 to 60, the upper at least 10 above the lower, default 20 and 40). |
| `min_control_version` | integer, 1 to 255 | no | Default 1. |
| `rating_cap` | `"detectable"` or `"unsafe"` | no | The provider's statement that something the client cannot see lowers the rating, such as another service on the node's address. It can only lower. There is no value that raises. |
| `exits` | list of at most 256 | no | See below. Default empty. An exit's `name` may be translated. |
| `notices` | list of at most 4 | no | The notices of this profile's node, each with `severity` and `text` as at the top level. They exist so that what the node sends on the control channel can be shown in the reader's language (see "Languages" on the control channel page). The app does not show them by themselves. Default empty. A `notices` that is not a list, or has more than 4 entries, refuses the profile. An entry that does not read is left out. |

What a profile does not have, on purpose: routes, a resolver other than the gateway, a setting of the kill switch, a rating, a fingerprint pack, a certificate authority, an "allow insecure" switch, and the cookie name of the upgrade answer on `tls` and `ws`, which the client ignores anyway. A `ws-plain` transport is the exception: its `cookie` member is how the client sends the token. In version 1 a native profile always carries all of the device's traffic. A provider cannot ask for less or for more.

**The cap the client computes itself.** Apart from `rating_cap`, the client compares the dial addresses of all transports of all profiles of the subscription. A pinned endpoint whose host is an IP literal, the link's or a refresh entry's, counts as a `udp` endpoint at that address: a cover transport at the same address is capped at Detectable, since a subscription host with a self-signed certificate on the address is something a prober can see. A pinned endpoint with a host name is not compared, because the client makes no lookup for it, and the panel warns its operator when the address of its pinned endpoint is the address of one of the nodes in its documents. A cover transport whose address is also the address of a `udp` or `udp-obfs` endpoint is capped at Detectable, as the transports page requires, and so is one that shares an address or a host name with a `ws-plain` transport. What the provider runs on an address and does not list, the client cannot see. A `ws-plain` transport is never above Detectable. Wherever a `ws-plain` transport is offered for consent or is in use, the app says: "the network can see this server's name and can tell that you use this app, now and later in its records. It cannot see what you send."

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

Every transport has a `type`. An unknown `type` refuses the profile. A provider that offers `ws-plain` to clients that may be older lists it in a profile of its own, so that a client which does not know the type refuses only that profile and keeps the rest. The committed parser does exactly this: an unknown transport type drops the profile and leaves the others. The class of each type (cover, no cover, exposed, plain) is fixed by the transports page and is never a field.

| `type` | Members | Rule |
|---|---|---|
| `udp`, `udp-obfs` | `endpoints`: list of 1 to 16 | Each an IP address and port, `192.0.2.10:51820` or `[2001:db8::10]:51820`. |
| `tls` | `path`, `candidates` | Every candidate must have `pins`. A candidate may set `self_signed`. |
| `ws` | `path`, `candidates` | A candidate may have `pins`. |
| `fronted` | `path`, `candidates` | No candidate has `pins`: the certificate is a content delivery network's and changes. |
| `ws-plain` | `path`, `candidates` | Plain HTTP, no TLS. No candidate has `pins`, `sni`, `verify_name` or `ech`. See "`ws-plain`" on the transports page. A `ws-plain` transport may not use a `host` or a `path` that any `tls`, `ws` or `fronted` transport of the document uses, and carries its own `transport_public_key` on the transport. A `ws-plain` transport may carry an optional `appearance` (a fixed identifier), which dresses the frames as another kind of content (see "Appearance of `ws-plain` frames" on the transports page, a design that is not built). An unknown or malformed `appearance` refuses the transport, not the document. It has a required `cookie`: the name of the cookie that carries the token, 1 to 32 characters from `A-Z a-z 0-9 _ -`. A missing or malformed `cookie` refuses the transport. |

- `path` follows the path rule of the config reference and is at least 12 characters.
- A candidate is an object with the members of "Fronting options" on the transports page: `address` (IP address and port, required), `sni` (required: a host name, or empty for none), `host` (a host name, required), `verify_name` (a host name, required when `sni` is empty and not allowed otherwise), `ech` (an Encrypted Client Hello configuration in standard base64, optional, at most 1,024 bytes when decoded), and `pins`. There is no member that turns TLS off on a candidate: a transport without TLS is the separate type `ws-plain`, whose candidates carry `address` and `host` and none of `sni`, `verify_name`, `ech` or `pins`. A candidate with a member it must not have (a `pins` on a `fronted` candidate, any of the TLS members on a `ws-plain` candidate) refuses that candidate and nothing else. A transport whose candidates are all refused is left out, and a profile whose transports are all left out is refused.
- `pins` is a list of 1 to 4 pins and belongs to one candidate, because one transport can list a candidate that reaches the operator's own server and another that goes through a content delivery network. A pin is the SHA-256 of a certificate's SubjectPublicKeyInfo, in standard base64, 44 characters. A candidate with pins is a "pinned candidate" on the transports page. A candidate of a `tls` transport may also have `self_signed`, a boolean, default `false`. With `true` the client trusts the server's certificate only through the candidate's `pins` and does not check its chain, name or dates (see the `tls` client steps on the transports page). `self_signed` on a candidate of any other transport, or a value that is not a boolean, refuses that candidate. A candidate with `self_signed` set still needs 1 to 4 `pins`. Its `sni` may be a host name, which is sent, or empty. It has no `verify_name`, since no name is checked, and a `verify_name` on it refuses the candidate.
- A host name is lowercase ASCII, at most 253 bytes, by the domain rule of the config reference, without the wildcard.
- A hint on the control channel names a transport by its position in `transports` and a candidate by its position in that transport's `candidates`, or in its `endpoints` for `udp` and `udp-obfs`.

**Where a client may be told to connect.** The transport's own connection is the one thing that leaves the device outside the tunnel, so its destination is restricted.

- Every address a client dials is an IP address. A profile has no host name that the client would have to look up before the tunnel is up, because that lookup would name the provider to the local network.
- Refused when the document is parsed, with the profile: an address that is loopback, link-local, unspecified (all of `0.0.0.0/8` counts as unspecified), multicast or broadcast; an IPv6 address that carries an IPv4 address (IPv4-compatible, IPv4-mapped, IPv4-translated, NAT64 in `64:ff9b::/96` and `64:ff9b:1::/48`, 6to4, Teredo); an address in `fec0::/10`; port 0; and a port written with a leading zero.
- Skipped at each connect: an address inside one of the device's own networks, unless the address is itself private or shared and the user agreed. Those are the networks of every address the device holds on an interface that is not a tunnel, at the moment it connects, with the prefix the interface has, and the address of its default gateway. A profile must not be able to point the device at its own router or at a neighbor without the user's consent, so such an address is skipped, with one exception. A candidate that is private or shared (the list of the next rule) and lies inside the device's own networks is asked about like any private address, and only after a yes is it dialled. Without the yes it stays skipped, and a session to a candidate whose address becomes one of the device's own networks is ended. With the yes, a private candidate is dialled and its session is kept when the network changes. The yes never covers a public address: a public address inside the device's own networks is skipped at every connect and its session is ended when the network changes to one that holds it, whatever the user answered, because a network that declares a public subnet as its own would otherwise choose where the device connects (TunnelCrack LocalNet). The check is made again at every connect and at every change of network, because the device's networks change when it moves. A node on the home network is reached this way, and its socket stays outside the tunnel whatever the tunnel routes.
- Asked about once per profile: any other private or shared address, which includes a private address inside one of the device's own networks. "Private or shared" is exactly the list that `geoip:private` stands for in the config reference. Such a profile is a lab or an office set-up, and the app says "this profile connects to a private address" before the first connect.
- The same check covers the tunnel side: when a `device` address or a gateway falls inside one of the device's own networks, the profile cannot be used on that network, and the app says why instead of connecting.

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

Every `url` in `support`, in a `link` card and in `refresh_urls`:

- is an `https` URL with a host name, no user or password part, at most 512 characters, or at most 256 for a refresh URL, which is also held to the rules for a URL the token is sent to. A pinned refresh URL may have an IP literal as its host, as a pinned link may;
- is shown with its host in ASCII form, with the registrable domain marked so that a long name cannot hide whose it is;
- in `support` and in a card, is opened only after the user confirms a screen that shows that host, in the system's browser, never inside the app, and is never fetched by the app;
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
| A file | `v1.<key>.<document>` and nothing else, except one line end (LF or CRLF) at the very end, which editors add when a file is saved and which is ignored |

**A whole document in a link, a code or a file.** A single profile, or a few, can be given without a server. The content is the provider's key and the signed document, joined by dots after `v1`. It is the same JWS, checked by the same rules against that key. It has no endpoint, so it cannot refresh, and the app says so. It carries a provider-issued device key, since there is nothing to enroll with. Such a link holds a private key and transport secrets: wherever the link goes (a chat history, a browser history, a screenshot), they go too. The app says this on the confirmation, and a provider should prefer an ordinary link wherever it has an endpoint. A whole document never replaces a stored subscription that has a link.

**Step 1: before any request.** The app shows, from the link alone:

- the host of the endpoint, with its registrable domain marked, or "a document in a link" or "a file";
- the fingerprint of the key in the link;
- when the link has a pin: "this server uses its own certificate, which this link names. Only that certificate will be trusted." For a host that is an address: "this server has an address and no name.";
- what will be sent if the user continues: the link's token and a new key for this device, to that host, from the device's own address, outside any tunnel;
- that the link is native, or that it is a legacy link that cannot be verified. For a legacy link the screen adds: "this link has no key part. If your provider gave you a Veilway link, part of it was lost on the way."
- when another subscription's tunnel is up, the two ways the request can go, as "When a fetch happens" lists them.

Nothing is sent, generated or stored by the app before the user continues. A deep link, a QR code or a file can bring the user to this screen and can do nothing else. It cannot cause a request, an enrollment or a used device place.

**Step 2: the fetch.** One request with `op` `"fetch"`. A native link expects a signed document under the link's key, and anything else is a failure. A legacy link gets a `GET`. A whole document needs no fetch.

**Step 3: the confirmation.** From the verified document the app shows:

- the provider's name, in `default` and with the picked translation beside it when there is one, marked as the provider's own claim;
- the fingerprint again, and the hosts in `refresh_urls`;
- how many profiles it holds, and whether any of them is Unsafe, with the plain warning for that. Ratings and classes are not shown to users.
- whether the device's key was made on this device or issued by the provider;
- whether this adds a new subscription or replaces a stored one (same key and same id), and which, and when the link replaces a stored link whose endpoint was checked another way (pinned or not, or by another pin), that it changes;
- the account's devices, as the document lists them.

The user may type a name for the device, and the screen says that the name will be visible to anyone who holds the link. If the user accepts, the client stores the subscription and sends `"confirm"`, with the name if one was typed. If the user declines, the client sends `"release"`, so that the device place is freed, and keeps nothing: not the document, not the link, not the key it made. If what is stored changes while the confirmation is on screen so that the notice that the endpoint is checked another way is no longer true, the import is declined and shown again.

**Rules that hold for every way in.**

- An import never connects. Connecting is a separate action by the user.
- A web page that opens a `veilway` link learns nothing from the app, and the app makes no request because of it. The host in the link learns nothing from the app unless the user continues at step 1. What a browser or a messenger does with an `https` link before the app sees it is outside the app's control, see "Form".
- The consent to use a lower class of transport (see the transports page) is stored per subscription and profile `id`. It is not carried over to a profile with a new `id` or to another subscription.
- A link over a size limit, or one that is not exactly one of the forms above, is refused at once.

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
- Display text as a string or an object of translations is part of version 1 from its first release. It is not growth that an older parser has to tolerate: no client is released that reads only strings, and the first implementation's parser is to be changed before anything ships. The `v1` of a link's fragment is the form of the link and is separate.
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
- List up to four more endpoints that the app will send the token to when it refreshes, once the user has seen and confirmed their hosts.
- Show false names, numbers, notices and cards in its own area, and false names on its own profiles and exits. With translations it can show different text to readers of different languages.
- See the time of every refresh, and tell users and devices apart. It may also learn a reader's language from the browser that opens one of its links and from the script of a device's name.
- Give different users different documents.
- With provider-issued keys: keep a copy of the device's private key.
- Stop serving, or serve a document that fails, which leaves the user on the last good one.

**It cannot:**

- Run code, or show markup, remote images or its own interface elements. Content is typed data and plain text.
- Open a URL without the user confirming a screen that shows the host, or make the app fetch anything other than its own subscription endpoints.
- Make the app connect to the device itself, to its router or its neighbors, or to a private address without the user being asked.
- Change a setting of the app: the kill switch, the resolver setting, routes, the theme, the language, the update channel, the fingerprint pack.
- Raise a rating, or hide the class of a transport. It can only lower a rating with `rating_cap`. A lower-class transport in its list is still used only with the user's consent.
- Switch off certificate checking. The format has no such field.
- Send traffic outside the tunnel. A profile has no routes, and the kill switch is the app's.
- Touch, replace or read another subscription, including another account of its own, or learn from the app that another provider's subscription exists. Its subscription is never fetched through another provider's tunnel, nor another's through its own, without the user choosing that for one request.
- Replace its own earlier document with an older one, or move a device to a provider-issued key without a new import.
- Import, enroll or connect without the user.

**Someone who is neither the provider nor the user,** and can answer the fetch in the provider's place, can refuse to answer, can serve a document it has seen that is still valid and no older than the stored one, and can replay a signed refusal it has seen for up to a day, which shows the user a wrong message and changes nothing. On a first import of a link with provider-issued keys there is no stored document, so it can serve any older valid document of that account until that document expires. Nothing else.

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
- **The panel can show a link again, at a price.** Copies of tokens, sealed under a key that is not in the database, are what let an operator copy a link again. A stolen database alone gives no secret, but a stolen database with the key file gives every token and every sealed secret. An operator who does not want to carry the tokens sets "show links once", and then cannot copy a link again, only reset it. The key file is a single point of loss: a restored database without it serves nothing, and the panel says so and never makes new keys by itself. See "Storing the token".
- **A signing key that sits on the panel is as safe as the panel.** If the panel signs online, whoever takes the panel signs documents for every user, and a stolen key cannot be revoked. Enrollment needs a document per device, which pushes providers towards signing online. Where the signing key lives is the provider's largest decision (threat model Q9).
- **What a self-signed endpoint costs.** It is the way for a provider with no domain, and it has three costs. The link is longer: 114 characters of fragment against 70, so a QR code is denser and harder to scan from a screen or a print. The key behind the pin is a long-lived secret on the panel's host: whoever has it and a place on the network can answer the fetch, receive the token, and serve stale documents. The standby pin, kept off the server, is what turns that theft into a switch and a reset of the tokens instead of a new link for every user. An operator who leaves the standby on the server loses that protection. And a self-signed endpoint is something a censor can look for: a prober that completes the handshake sees a certificate that no authority signed on a host that serves subscriptions, which ordinary sites rarely do, and the pin cannot hide it. On a server that also runs a node it marks the address, and the client caps the profiles at that address when it can see the match. The panel warns the operator of this, as the transports page has the node do. A pin adds no trust that the link did not already have, since whoever gave the link already chose the key and the host. A link altered on the way to lose its pin is no new case of that: it also fails closed unless the altering party can show a certificate the chain accepts, and one who can alter a link can alter its key as well.
- **Stale documents.** A client that cannot refresh keeps working on old addresses and keys. Whoever can answer the fetch can keep it there for up to a document's lifetime before any warning shows. The warnings and the 30 day rule limit how quietly that continues.
- **Presence.** An automatic refresh happens only inside the provider's own tunnel, where the provider already sees the device. A refresh the user asks for outside a tunnel is visible to the local network, and the app says so first.
- **Every parser here needs a fuzz target** in the same change as the parser. The first implementation has targets for the link grammar, the envelope, the payload behind a valid signature, the legacy reader and the request. The logo decoder and the Encrypted Client Hello configuration have none yet, because their readers are not written. Each target asserts that no input changes stored state unless every check passed. The panel's parser of the request body needs one too (`fuzz_sub_request`).
- **What the first implementation does with secrets.** Its types print no document, secret, dial address or path in debug output. Secrets are not wiped from memory when they are dropped, which is the same stated limit the threat model records as G36.
- **Nothing here is invented cryptography.** The envelope is JWS with EdDSA as published, verified by the strict rule of RFC 8032. The rules around it (the key in the link, rotation, identity, enrollment) are policy, and they have been reviewed once, inside the project.

Tests this page needs before it leaves Draft: a document with another header, a badly encoded part, a signature that only a lax verifier accepts, a lower serial, an equal serial and other bytes, another `subscription_id`, already expired, or under a key that is not held, is refused and changes nothing; a native link answered with a legacy list imports nothing; opening a deep link or scanning a code sends no packet until the user continues; declining an import frees the device place; a refresh that changes the device key or adds a private key fails; an unknown token and an unknown path get identical bytes and timing from the panel, while a valid token always gets a signed answer; no refresh leaves the device outside the subscription's own tunnel unless the user asked; a pinned link whose server shows another certificate, or the pinned certificate without its key, or does not negotiate TLS 1.3, fails with no byte of the request sent and the message of "A pinned endpoint", and is a failed fetch and not a refusal; a link with a pin cut short, or with a fourth field, is refused, and a link without a pin never trusts a self-signed certificate; no document moves a link from pinned to unpinned or back, and a document that lists no pin the client holds is refused; a dump of the panel's database holds no token, no transport secret and no private key in the clear, and a panel with accounts and no key file serves nothing and makes no key; a document list of `endpoint_pins` that leaves out the pin of the certificate the panel serves is never signed; a request is matched by the lookup value and an unknown token costs the same as a known one; a profile that dials loopback is refused and one that dials the device's own network is not dialed; one subscription's document cannot change another; no field of any document changes the kill switch, the resolver setting, the routes or a rating upward; the token appears in no log line, no URL and no request to a host the provider did not sign; a hostile corpus of text, URLs and logos is shown as plain text, refused or left out.

## Open questions

Each is listed with the default this draft takes. The first five are the ones a reviewer should attack first.

| Question | Default |
|---|---|
| The key in the link makes the giver of the link the root of trust. Is there anything better that needs no central party? | No. The project runs no directory of providers, and will not. |
| Device places can be filled by a holder of the link, and only the provider can clear them. Should a device be able to remove another, and how would it prove it is the older one? | Not in version 1. WireGuard keys cannot sign, so it would need a second key per device. The device list and the signed refusal make the state visible. |
| The first fetch enrolls a pending device before the user has seen the document. Is a separate request that only previews the document worth a second kind of answer? | No. The place is pending, is released on a decline, and expires by itself. |
| Keeping a retired signing key for a year, to tell late clients that they need a new link | Kept. A key that was retired because it was stolen signs nothing the thief could not sign already. The alternative is that late clients see the message for an interception. |
| Can the endpoint really give the web server's own answer for an unknown path, in bytes and in time? | Required. Handing the request back to the web server is exact. Repeating a learned answer is an imitation that must be measured. |
| Can "an unknown token answers like an unknown path" hold in timing, when a valid token leads to a signature and an unknown one does not? | Required of the panel. Not shown. The check of the token must cost the same either way, and the difference in what follows is visible only to someone who already holds a valid token. |
| Is no automatic refresh outside the subscription's own tunnel too strict? A user whose profiles all die gets no new ones until they ask. | Kept. The app tells the user to refresh when every profile of a subscription has failed. |
| May a fetch use the fronting options of the transports? (threat model Q15) | Not specified. `refresh_urls` and a whole document in a link are the only answers here. Candidates for the fetch would have to be in the link. |
| Should a document over 30 days past its expiry stop working, not only ask? | It asks. Stopping would let whoever blocks the subscription host take the user's working connection away after a month. |
| How does a panel change the key of a self-signed endpoint, or recover from its theft, without a new link? | By `endpoint_pins`: the panel always lists the active pin and a standby kept off the server, and a switch loads the standby. A client offline for the whole notice time, or an operator who left the standby on the stolen server, needs a new link. A new link at every change was passed over, because a link in a chat or on a wall cannot be recalled. |
| Should the panel store a token only as a keyed hash? | Not by default. Operators want to copy a link again, so it also stores a sealed copy under a key outside the database. "Show links once" drops the copy. |
| Can a client know that a pinned endpoint with a host name shares an address with a node? | No. It makes no lookup for it. Only an IP literal is compared. The panel warns the operator for the names. |
| Dial addresses are IP addresses only | Yes. It avoids a lookup before the tunnel. It costs providers whose fronts change address often, who must reissue documents. |
| Certificate pins behind a content delivery network (threat model Q22) | None. Such candidates rely on ordinary validation, and the tunnel inside does not depend on it. |
| Where the signing key lives, and whether the panel may sign online (threat model Q9) | The provider's decision. Device-made keys need a document per device, signed when the device enrolls, so an offline key means provider-issued keys or devices registered ahead of time. |
| Should a profile be able to carry routes (split tunneling chosen by the provider)? | No, not in version 1. Routes from a provider are a way to move traffic outside the tunnel. |
| Should a legacy link be refreshed outside a tunnel at all, since it cannot be verified? | Only when the user asks, as for a native one. |
| Translations repeat in every profile's exit catalog. Should a catalog be shared at the top level? | Not in this version. The limit on JSON values is what a large provider meets first. |
| Should a text whose translations differ greatly be flagged? | No. The app cannot judge meaning. It marks a translated text and shows `default` on every screen where the user decides. |
