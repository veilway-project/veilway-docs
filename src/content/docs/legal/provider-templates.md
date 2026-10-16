---
title: Provider templates
description: Starting texts for a Terms of Service and a Privacy policy for a service that runs Veilway. Templates, not legal advice.
---

:::caution[Templates, not legal advice]
These are starting texts. Replace every part in [brackets], remove what does not apply to you, and have a lawyer in each place where you operate and where your users live check the result before you publish it. The privacy section describes what the software keeps by default. Change it when your setup keeps more, for example when you turn on destination logging or keep your own logs.
:::

The Veilway project does not run your service and does not see your terms or your users. You publish these texts yourself and give their addresses under **Settings** in the panel, as the Terms of service URL and the Privacy policy URL. Your users then see them as support links in their subscription.

## Terms of Service

Last updated: [date]

### 1. The service

[Provider name] runs servers that carry your internet traffic through an encrypted tunnel, for the devices you connect. [Describe what the service is for, what it does not do, and which apps and platforms it supports.]

The software that runs the servers is Veilway, free software under the Apache License 2.0. Your rights to that software come from its license, not from these terms.

### 2. Your account

You get an account from [Provider name]. Give true details when you sign up. Keep your subscription link private: anyone with it can download your settings and add devices. If it leaks, ask us for a new one.

### 3. Acceptable use

You may not use the service for [unlawful activity, attacks on other people or systems, sending spam, or anything else you list here]. [Provider name] may suspend or limit an account that breaks these rules. Where we can, we tell you why first.

### 4. Plans and limits

Your plan sets [the data quota, the number of devices, and the end date]. Usage is counted per [period]. When you reach a limit, traffic stops until the period resets or your plan changes. [Explain what you show users when a limit is reached.]

### 5. Availability

The service is provided on a best-effort basis. [Provider name] does not promise any particular uptime or speed, except [any service level you actually offer].

### 6. Changes to these terms

We may change these terms. We publish the new version at [address], and tell you about material changes [number] days before they take effect. If you keep using the service after that, you accept the changes.

### 7. Ending the service

You may stop using the service at any time. [Provider name] may end an account that breaks these terms, after [describe the notice you give, or when no notice is given].

### 8. Warranty and liability

The service is provided as it is, to the extent the law allows. [Provider name] is not liable for [the kinds of loss you exclude]. [Add anything your law requires. Consumer law in many places does not allow a provider to exclude liability for some losses, so do not remove rights that the law gives your users.]

### 9. Governing law

These terms are governed by the laws of [country or region]. [Describe how disputes are handled, such as a court or an arbitration body.]

### 10. Contact

[Name, email address and postal address for questions about these terms.]

## Privacy policy

Last updated: [date]

This policy says what [Provider name] keeps when you use the service, why, and for how long. It describes what the software keeps by default. Change any part that does not match your setup.

### 1. Who we are

[Provider name], [postal address], [contact address]. We run the service ourselves. The Veilway project does not run it and does not receive any of your data.

### 2. What we keep

- **Account details.** Your name or username, your plan, your device limit and your end date. We need them to run your account.
- **Devices.** The name each device has, its public key and the tunnel address it was given. The keys a device needs to connect are stored encrypted, and the keys that open them are kept apart from the database.
- **Subscription link.** The panel keeps a keyed hash of your subscription token, which is how it finds your account. Unless we have turned on "show links once", it also keeps an encrypted copy, so the link can be shown again.
- **Usage counters.** How many bytes your account sent and received in each period. We use them to apply your quota. [State how long we keep these.]
- **Connection records.** The node's log may name your account and device when a connection opens or closes, and when an exit is chosen for your traffic.
- **Name lookups.** When your device resolves a name, the node keeps a short memory of the name and the address it got back, so that rules about names work. Each entry lasts for the answer's time to live, at most an hour. The memory is cleared when your account is disabled or removed.
- **Staff records.** When our staff sign in or change settings, we keep a record of the change and the address it came from. These records never hold a link, a token or a key.

### 3. What we do not keep

- The content of your traffic. The software does not record it.
- The addresses and names you reach, unless we turn on destination logging in the node's log settings. That setting is off by default. [If you turn it on, say so here and say how long those lines are kept.]
- [Add anything else you do not keep.]

### 4. Why we use it

We use your information to run the service, apply your plan, keep the service and its servers safe, answer your questions, and meet our legal duties. [Add or remove purposes so that the list matches what you really do.]

### 5. Who sees it

Only [the staff roles that need it] can see your information. [Name any organization that processes data for you, such as the hosting provider or the email provider, and what it does.] We share it only when the law requires us to, and [describe how you check a request from an authority].

### 6. How long we keep it

- Account details and devices: while your account exists, and [period] after it ends.
- Usage counters: [period].
- Staff records: [period].
- Node logs: [period], or the time your system keeps them.

### 7. Your rights

Depending on where you live, you may ask to see, correct or delete your information, or to object to some uses of it. Send your request to [contact address]. [Add any other rights your law gives your users.]

### 8. Security

We protect the servers, the panel, its keys and its backups. Backups are encrypted with a passphrase that only we hold. No system is completely safe. [Describe your measures, and how and when you tell users about a breach, as your law requires.]

### 9. Changes to this policy

We may change this policy. The date at the top shows the last change, and [describe how you tell users about a material change].

### 10. Contact

[Name, email address and postal address for privacy questions.]
