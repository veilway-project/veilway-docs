---
title: Your decoy site
description: What the plain site on your server is for, where it lives, and how to edit or replace it.
---

When `veilway.sh install panel` sets up a web server (`--domain` or `--no-domain`), it also puts up a plain site. This page says what it is for and how to make it your own. It takes about 10 minutes.

## What it is for

- **Strangers see it.** Anyone who opens your domain, or any path that is not the panel's, gets this site. A server that shows an ordinary page looks like an ordinary server.
- **Probers see it.** The node's `tls`, `ws` and `fronted` transports send anything that is not a real device to a decoy origin. By default that is this same site, served over plain HTTP on `127.0.0.1:8080`. Only the server itself can reach that address.

So one page does both jobs. A page that looks real hides the server better.

## Where it is

- The page is `/var/www/veilway-site/index.html`. Every file in `/var/www/veilway-site` is served, so you can add pictures, styles or more pages.
- The installer draws the first page for each server: a topic (a garden diary, a kitchen notebook, a walking log and so on), titles, dates, fonts and colors picked at random. It has no Veilway name or text. Two servers almost never get the same page.
- A server where you set up the web server yourself has no such site. Point the transport's decoy at a site of your own in the JSON view (`decoy.origin`), see the [config reference](../../reference/config/#transports).

## Edit it

1. Open the page on the server: `sudo nano /var/www/veilway-site/index.html`.
2. Change the text, or replace the whole file with a page of your own.
3. Save. There is nothing to reload: the web server reads the file on each visit.
4. Check both doors. Open `https://your-domain/` in a browser, and on the server run `curl -s http://127.0.0.1:8080/ | head`.

To use a whole site instead, copy its files into `/var/www/veilway-site` and keep `index.html` as the first page. The files must be readable by everyone: `sudo chmod -R a+rX /var/www/veilway-site`.

## What makes a good decoy

- **Looks lived in.** A small personal site, a portfolio or a hobby blog with a few pages and dates works well. A blank page or "under construction" stands out.
- **Plain and static.** HTML, CSS and pictures only. No login forms and no code that runs on the server.
- **Your own words.** Do not copy a famous site: a copy is easy to spot.
- **Nothing about Veilway or VPNs**, in the text, the file names or the page title.

## What the installer does with your page

- `update` never overwrites a page you edited. It only replaces the one page that every install shared before v0.3.3, and only if you never changed it.
- `uninstall web` removes `/var/www/veilway-site` only if it still holds just the drawn page. An edited site stays.
