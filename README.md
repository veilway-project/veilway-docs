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
<a href="https://t.me/VeilwayGroup"><img alt="Telegram" src="https://img.shields.io/badge/Telegram-VeilwayGroup-26A5E4?logo=telegram&logoColor=white"></a>
</p>

## What it is

This is the source of the documentation site for [Veilway](https://github.com/veilway-project/veilway). Veilway is an open-source VPN platform under development, for people on censored networks. The site is written in English and Persian.

## Status

The site describes the alpha, `v0.3.2-alpha`. It is tagged and released in the core repository. Parts of the site are still stubs.

- Written in English: the alpha release page, getting started, the guides (entry node, first inbound and user, release mirror, offline bundles, Xray profiles), the operator terms, the app privacy policy, the provider templates, the panel, client, Android, home network and Xray manuals, the config reference, the control API reference, the TypeScript SDK guide, the threat model summary, the obfuscation status page, and the draft protocol specification. The spec covers the overview, transports, HTTP/2, the shapes of fronted, borrowed site, the control channel, the subscription format, node links, the offline bundle, and Xray in the desktop apps.
- Written in Persian: the alpha release page, getting started, the guides, the legal pages, the manuals (Xray included), the config and control API references, the TypeScript SDK guide and the threat model summary.
- Still stubs: the Rust SDK guide. It lists the crates but has no example yet. The Persian protocol pages are missing for HTTP/2, the shapes of fronted, borrowed site, node links, the offline bundle, and Xray in the desktop apps. The Persian obfuscation status page is only partly translated.

The protocol pages are a draft. They have been reviewed only inside the project. Each page says which parts are built. The alpha release page lists what each part has been tested on, and what has not.

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

- [veilway](https://github.com/veilway-project/veilway): the core, the control API and its SDK, and the desktop and Android apps.
- [veilway-panel](https://github.com/veilway-project/veilway-panel): the panel, the admin side of a node.
- [veilway-ui](https://github.com/veilway-project/veilway-ui): the design system and the translations for the panel and the apps.
- veilway-docs: this repository. It is published at [veilway-project.github.io/veilway-docs](https://veilway-project.github.io/veilway-docs/).

## Contributing

Questions and help with setup go to [GitHub Discussions](https://github.com/veilway-project/veilway/discussions), in English or Persian. Issues are for bugs and concrete feature requests.

Add or change a page in both languages, in the same change. Examples must use placeholder names and addresses only (`example.com`, `192.0.2.0/24`). Never use real servers or keys.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
