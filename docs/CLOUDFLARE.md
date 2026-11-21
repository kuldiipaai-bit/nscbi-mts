# Hosting on Cloudflare Workers (static assets)

The web app is a static export, so Cloudflare serves it as plain files from its global network. The data stays in Supabase.
A Worker named `kuldiip` holds the files; the live address is **https://kuldiip.mts-nscbia.workers.dev**
(`mts-nscbia` is the account's workers.dev name; it only shows in this address and is not needed once a custom domain is set).

## Update the live site
One-time setup on the computer:

```bash
npm install --global cf
cf auth login        # prints a link and a code; approve it in the browser
```

Every update (build + upload, about one minute):

```bash
powershell -File web\scripts\deploy-cloudflare.ps1
```

The script builds a scratch copy for the site root (no `/nscbi-mts` prefix), uploads it with `cf deploy`, and deletes the copy.
The Supabase URL and public key are read from `web/.env.production`. The scratch copy keeps a running `npm run dev` untouched.
Use `-Name <worker>` to deploy under another Worker name.

## Custom domain (GoDaddy domain)
A Worker custom domain needs the domain's DNS to be on Cloudflare:
1. Add the domain to Cloudflare (Add a site, Free plan). Cloudflare imports the existing DNS records; compare them with GoDaddy's list (especially MX and TXT records for email) before continuing.
2. At GoDaddy, change the domain's nameservers to the two Cloudflare gives you. Wait until Cloudflare shows the site as Active.
3. In Cloudflare: Workers & Pages, the Worker, Settings, Domains and Routes, Add, Custom domain, for example `mts.yourdomain.com`. HTTPS is automatic.

## Keep the source code private later
Making the GitHub repository private does not affect this site (the files are uploaded, not pulled from GitHub).
For automatic deploys from a private repository, use Cloudflare Workers Builds (connect the GitHub repository in the Cloudflare dashboard)
or a GitHub Actions job with a Cloudflare API token stored as a repository secret. Never put the token in the code.

## Notes
- The site files are public by nature (a browser must download them). Database access is protected by Row Level Security in Supabase, not by hiding the site.
- `cf auth login` stores a short-lived token on this computer. `cf auth logout` removes it.
- Free plan: static asset requests are free. Check Cloudflare's current limits before relying on it for a commercial service.
