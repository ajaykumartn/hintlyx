# Hintlyx landing page

Static site for **hintlyx.ajaytn.in**. The download button links to the latest GitHub Release,
so it always serves the newest installer with no site change needed.

Files: `index.html`, `styles.css`, `favicon.ico`. No build step.

## Deploy on Cloudflare Pages (recommended — your DNS is already on Cloudflare)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the `hintlyx` repo. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `site`
3. Deploy. Then open the project → **Custom domains** → **Set up a custom domain** →
   `hintlyx.ajaytn.in`. Cloudflare adds the DNS record and HTTPS automatically.

## Alternative: GitHub Pages

1. Repo → **Settings → Pages** → Source: deploy from a branch, folder `/site`.
2. In Cloudflare DNS add a `CNAME` record: name `hintlyx`, target `ajaykumartn.github.io`,
   proxy status **DNS only** (grey cloud) so the certificate can issue.
3. Set the custom domain to `hintlyx.ajaytn.in` and enable **Enforce HTTPS**.

Updating the installer: publish a new GitHub Release (e.g. `v0.1.1`). The page needs no change.
