# Chrome Web Store Assets

This directory is separate from the extension ZIP. It contains listing material and submission notes, not runtime code.

## Ready to Upload

- `icon-128.png`: the required 128×128 PNG extension icon. The same icon remains inside the ZIP at `src/icons/icon-128.png` because the manifest references it.
- `screenshot-github-1280x800.png`: an actual 1280×800 Edge screenshot showing RiceHub on a GitHub repository page.
- `screenshot-settings-1280x800.png`: an actual 1280×800 Traditional Chinese screenshot of the RiceHub settings page.
- `promo-small-440x280.png`: the required 440×280 small promotional image, scaled from the existing social preview without generative edits.
- `promo-marquee-1400x560.png`: the optional 1400×560 marquee image, from the same source. Chrome shows it only to featured listings, so it is not needed to submit.

Icons are scaled from `docs/branding/ricehub-fab-master.png`, the 512px transparent
original. Regenerate rather than upscale a smaller copy.

## Copy into the Dashboard

- `listing-copy.md`: proposed English and Traditional Chinese listing text, the single-purpose statement, permission justification, and data-handling disclosure.
- `privacy-policy.md`: a policy draft with a public contact link. Publish it at a public HTTPS URL before submitting its URL.

The existing `docs/branding/ricehub-social-preview*.png` files are 1280×640, so they do not meet either screenshot dimension and must not be uploaded in those fields. The 512×512 logo and FAB master are source artwork, not store-ready assets. Additional actual-product screenshots and a 1400×560 marquee image are optional.

The release ZIP is generated separately at `web-ext-artifacts/ricehub-<version>.zip`. Do not add this directory, tests, repository documentation, or development files to that ZIP.
