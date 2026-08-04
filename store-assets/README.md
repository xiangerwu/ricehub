# Chrome Web Store Assets

This directory is separate from the extension ZIP. It contains listing material and submission notes, not runtime code.

## Ready to Upload

- `icon-128.png`: the required 128×128 PNG extension icon. The same icon remains inside the ZIP at `src/icons/icon-128.png` because the manifest references it.

## Copy into the Dashboard

- `listing-copy.md`: proposed English and Traditional Chinese listing text, the single-purpose statement, permission justification, and data-handling disclosure.
- `privacy-policy.md`: a policy draft. Publish it at a public HTTPS URL and replace the contact placeholder before submitting its URL.

## Still Required

- `promo-small-440x280.png`: required promotional image.
- At least one actual-product screenshot: 1280×800 or 640×400 PNG/JPEG.

Capture screenshots only after the final Chrome smoke test. The existing `docs/branding/ricehub-social-preview*.png` files are 1280×640, so they do not meet either required dimension and must not be uploaded in those fields. The 512×512 logo and FAB master are source artwork, not store-ready assets. A 1400×560 marquee image is optional.

The release ZIP is generated separately at `web-ext-artifacts/ricehub-0.1.0.zip`. Do not add this directory, tests, repository documentation, or development files to that ZIP.
