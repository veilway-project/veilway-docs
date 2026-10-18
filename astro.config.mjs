import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Served by GitHub Pages under /veilway-docs. Change both when the site moves to a domain of its own, or CSS, scripts and links break.
export default defineConfig({
	site: "https://veilway-project.github.io",
	base: "/veilway-docs",
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
				{ label: "The alpha release", translations: { fa: "نسخهٔ آلفا" }, slug: "alpha" },
				{ label: "Getting started", translations: { fa: "شروع به کار" }, slug: "getting-started" },
				{
					label: "Guides",
					translations: { fa: "آموزش‌ها" },
					items: [
						{ label: "Entry node", translations: { fa: "گره ورودی" }, slug: "guides/entry-node" },
						{ label: "Release mirror", translations: { fa: "آینهٔ انتشارها" }, slug: "guides/release-mirror" },
						{ label: "Offline bundles", translations: { fa: "بسته‌های آفلاین" }, slug: "guides/offline-bundle" },
						{ label: "Xray profiles on Linux", translations: { fa: "پروفایل‌های Xray روی لینوکس" }, slug: "guides/xray-profiles" },
					],
				},
				{
					label: "Protocol specification",
					translations: { fa: "مشخصات پروتکل" },
					items: [
						{ label: "Overview", translations: { fa: "نمای کلی" }, slug: "protocol/overview" },
						{ label: "Transports", translations: { fa: "ترنسپورت‌ها" }, slug: "protocol/transports" },
						{ label: "HTTP/2", translations: { fa: "HTTP/2" }, slug: "protocol/http2" },
						{ label: "Shapes of fronted", translations: { fa: "شکل‌های fronted" }, slug: "protocol/fronted-shapes" },
						{ label: "Borrowed site (alpha)", translations: { fa: "سایت قرضی (آلفا)" }, slug: "protocol/borrowed-site" },
						{ label: "Control channel", translations: { fa: "کانال کنترل" }, slug: "protocol/control-channel" },
						{ label: "Subscription format", translations: { fa: "قالب اشتراک" }, slug: "protocol/subscription-format" },
						{ label: "Node links", translations: { fa: "پیوند نودها" }, slug: "protocol/node-links" },
						{ label: "Offline bundle", translations: { fa: "بسته آفلاین" }, slug: "protocol/offline-bundle" },
						{ label: "Xray in the desktop apps", translations: { fa: "Xray در برنامه‌های دسکتاپ" }, slug: "protocol/xray-client" },
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
						{ label: "Android app", translations: { fa: "برنامهٔ اندروید" }, slug: "manuals/android" },
						{ label: "Home network", translations: { fa: "شبکهٔ خانگی" }, slug: "manuals/home-network" },
						{ label: "Xray add-on", translations: { fa: "افزونهٔ Xray" }, slug: "manuals/xray" },
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
				{
					label: "Legal",
					translations: { fa: "حقوقی" },
					items: [
						{ label: "Operator terms", translations: { fa: "شرایط اپراتور" }, slug: "legal/operator-terms" },
						{ label: "App privacy policy", translations: { fa: "حریم خصوصی برنامه" }, slug: "legal/app-privacy" },
						{ label: "Provider templates", translations: { fa: "الگوهای ارائه‌دهنده" }, slug: "legal/provider-templates" },
					],
				},
			],
		}),
	],
});
