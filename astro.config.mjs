import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Set `site` (and `base` if served from a subpath such as /veilway-docs/) before the first deploy, or CSS, scripts and links break.
export default defineConfig({
	integrations: [
		starlight({
			title: { en: "Veilway Docs", fa: "مستندات Veilway" },
			// English is served at the site root, Persian under /fa/.
			defaultLocale: "root",
			locales: {
				root: { label: "English", lang: "en" },
				fa: { label: "فارسی", lang: "fa", dir: "rtl" },
			},
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/veilway-project/veilway" }],
			sidebar: [
				{ label: "Introduction", translations: { fa: "معرفی" }, slug: "" },
				{ label: "Getting started", translations: { fa: "شروع به کار" }, slug: "getting-started" },
				{
					label: "Protocol specification",
					translations: { fa: "مشخصات پروتکل" },
					items: [
						{ label: "Overview", translations: { fa: "نمای کلی" }, slug: "protocol/overview" },
						{ label: "Transports", translations: { fa: "ترنسپورت‌ها" }, slug: "protocol/transports" },
						{ label: "Control channel", translations: { fa: "کانال کنترل" }, slug: "protocol/control-channel" },
						{ label: "Subscription format", translations: { fa: "قالب اشتراک" }, slug: "protocol/subscription-format" },
					],
				},
				{ label: "Config reference", translations: { fa: "مرجع پیکربندی" }, slug: "reference/config" },
				{ label: "Control API reference", translations: { fa: "مرجع API کنترل" }, slug: "reference/api" },
				{
					label: "SDK guides",
					translations: { fa: "راهنمای SDK" },
					items: [
						{ label: "Rust", slug: "sdk/rust" },
						{ label: "TypeScript", slug: "sdk/typescript" },
					],
				},
				{
					label: "Manuals",
					translations: { fa: "راهنماها" },
					items: [
						{ label: "Panel", translations: { fa: "پنل" }, slug: "manuals/panel" },
						{ label: "Client", translations: { fa: "کلاینت" }, slug: "manuals/client" },
					],
				},
				{
					label: "Security",
					translations: { fa: "امنیت" },
					items: [
						{ label: "Threat model", translations: { fa: "مدل تهدید" }, slug: "security/threat-model" },
						{ label: "Obfuscation layer status", translations: { fa: "وضعیت لایه مبهم‌سازی" }, slug: "security/obfuscation" },
					],
				},
			],
		}),
	],
});
