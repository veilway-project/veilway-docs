<p align="center">
<img src="public/favicon.svg" width="96" height="96" alt="Veilway">
</p>

English | [فارسی](README.fa.md)

# Veilway Docs

Source of the documentation site for [Veilway](https://github.com/veilway-project/veilway), a proxy and VPN platform under development. The site is written in English and Persian.

## Status

This is a skeleton. Every page is a stub that says what it will document. Nothing here describes released software yet.

A Windows desktop client exists in the current code. The panel, the cross-platform clients, the Android client, the new transports and the obfuscation layer are not built yet. When the obfuscation layer ships it will be experimental and not externally reviewed.

## Layout

| Path | Content |
|---|---|
| `src/content/docs/` | English pages |
| `src/content/docs/fa/` | Persian pages, same file names |
| `astro.config.mjs` | Site config, locales and sidebar |

The site is built with [Starlight](https://starlight.astro.build) on its default theme.

## Build

Requires Node.js 22.12 or newer.

```
npm install
npm run dev
npm run build
```

`npm run dev` serves the site locally. `npm run build` writes the static site to `dist/`.

## Contributing

Add or change a page in both languages in the same change. Examples must use placeholder names and addresses only (`example.com`, `192.0.2.0/24`), never real servers or keys.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
