<p align="center">
<img src="public/favicon.svg" width="96" height="96" alt="Veilway">
</p>

<h1 align="center">Veilway Docs</h1>

<p align="center">
The source of the Veilway documentation site, in English and Persian.
</p>

<p align="center">
<b><a href="https://veilway-project.github.io/veilway-docs/">Read the docs: veilway-project.github.io/veilway-docs</a></b>
</p>

<p align="center">
<b>English</b> | <a href="README.fa.md">فارسی</a>
</p>

<p align="center">
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
</p>

## What it is

Source of the documentation site for [Veilway](https://github.com/veilway-project/veilway), an open-source VPN platform under development for people on censored networks. The site is written in English and Persian.

## Status

Parts of the site are written and parts are still stubs. Nothing here describes released software yet.

- Written, in English: the draft protocol specification (overview, transports, control channel, subscription format, node links), the obfuscation layer status page, the config reference and the control API reference.
- Written, in Persian: the config reference and the control API reference.
- Still stubs: the Persian protocol pages, getting started, the threat model summary, the panel and client manuals and the SDK guides.

The protocol pages are a draft. They have been reviewed only inside the project, and each page says which parts are built. The node side of the native transports and the control channel is built, but no client speaks them yet. The panel, the cross-platform clients and the Android client are not built yet.

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

## Repositories

- [veilway](https://github.com/veilway-project/veilway): the core, the control API and its SDK, and the desktop app.
- [veilway-ui](https://github.com/veilway-project/veilway-ui): the design system and the translations for the panel and the apps.
- veilway-docs: this repository, published at [veilway-project.github.io/veilway-docs](https://veilway-project.github.io/veilway-docs/).

## Contributing

Add or change a page in both languages in the same change. Examples must use placeholder names and addresses only (`example.com`, `192.0.2.0/24`), never real servers or keys.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
