---
title: Operator terms
description: A plain summary of what running Veilway means for the person who runs it. Not a contract; the license governs.
---

:::caution[A plain summary]
This page says the terms in plain words. It is not a contract and gives no legal guarantee beyond the license. The [Apache License 2.0](https://github.com/veilway-project/veilway/blob/main/LICENSE) governs your use of the software, and the [name and logo policy](https://github.com/veilway-project/veilway/blob/main/TRADEMARKS.md) governs the name Veilway and its logo.
:::

## The software

Veilway is free software under the Apache License 2.0. You may run it, change it and give it to others under that license, including for a paid service. It is provided as it is, with no warranty of any kind. The project and its contributors do not promise that it suits your purpose, that it is secure, or that it has no faults.

## The project runs no service

The Veilway project does not run a node, a panel, a subscription endpoint, a relay or any other service for you or your users. It does not see your traffic, your users, your devices or your data, and nothing you run sends data to the project.

The panel makes one request on its own. At start and every six hours it asks GitHub whether a newer release exists. That request carries the panel's version and nothing about your users, but GitHub sees the address the panel connects from, as with any web request. Set `update_check` to `false` in `panel.json` to turn it off. The software sends no other telemetry, usage statistics or crash reports.

## You run it, so you answer for it

You decide how Veilway runs: where it is hosted, who gets an account, what is logged, which exits traffic leaves through, and what you tell your users. The project does not decide these for you and cannot step in when something goes wrong on your server.

You alone are responsible for:

- the security of your server, your panel, its keys and its backups;
- your users' data and the promises you make about it;
- the laws that apply where you run the service and where your users live, including rules on traffic, logs, access to data and requests from authorities;
- the terms and privacy policy you give your users. The [provider templates](../provider-templates/) are a starting point, not legal advice.

## The name

You may say that your service works with Veilway, or runs Veilway software, when that is true. Do not use the name for a paid service or a company in a way that makes it look like the official Veilway service. If you change the code and give the result to others, give it its own name and logo, as the name and logo policy requires.

Your users see the provider name you set under **Settings** next to their subscription. Set it to your own name, not to Veilway.

## Related pages

- [Provider templates](../provider-templates/): starting texts for your own Terms of Service and Privacy policy.
- [Panel manual](../../manuals/panel/): where the panel asks you to accept these terms at setup, and where to set the links your users see.
