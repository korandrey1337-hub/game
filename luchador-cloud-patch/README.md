# Luchador Cloud Progress

This directory is an integration kit for the live Luchador described in the supplied PDF.
It is not a replacement game and must not be deployed over the live installation.

The available local and GitHub Luchador repositories contain a different prototype.
The live `index.html`, `src/main.js`, and economy module are required before applying this change.

In the live page, retain its import map and other application markup. Replace only its main
module script and any duplicate Telegram SDK tag with this block at the end of the body:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script src="./hub-sdk.js"></script>
<script src="./hub-cloud.js"></script>
<script src="./hub-progress-config.js"></script>
<script type="module" src="./hub-progress-bootstrap.js"></script>
```

Keep any existing cache-version query on the real `src/main.js` import when applying the patch.
No local prototype or production installation has been changed for this game.
