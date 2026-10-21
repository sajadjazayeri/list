# little us

A small shopping and to-do app for two. Static frontend, Supabase Auth + PostgreSQL, private membership policies, no analytics or third-party assets. Lists refresh every three seconds while visible.

## Local development

Node.js 24+. Run `npm ci`, `npm test`, then `npm start`. The server previews public/ on port 3000 (`PORT` overrides it). Development tests run the actual SQL schema in isolated local PostgreSQL via PGlite, including membership policies and pairing. Live Supabase sign-in and email delivery still require validation after dashboard setup.

`public/config.js` contains the public project URL and publishable key. Never put a secret/service-role key in browser files. The former SQLite backend is retired; any existing .data directory is preserved but not used or migrated.

## Supabase setup (required, once)

1. In SQL Editor, create a query, paste all of `supabase/setup.sql`, and Run. The script is a one-time transaction; do not run it again after success. It creates only lu_ prefixed tables/functions. Do not disable RLS if an operation fails.
2. Authentication → Providers → Email: enable email sign-in. For the best installed iPhone experience, open Authentication → Email Templates → Magic Link and include `{{ .Token }}` in the email body (for example: `<p>Your little us sign-in code: {{ .Token }}</p>`). The app supports entering that code without leaving the installed app. You may retain the default magic link too.
3. After Cloudflare deployment, Authentication → URL Configuration: set Site URL to the exact deployed HTTPS origin and add that origin with trailing `/` to Redirect URLs. No broad wildcard is needed. For local testing you can add the local development origin separately; do not replace the production origin with localhost.
4. Supabase's built-in email sender may restrict recipients to organization members and has low sending limits. If either person's email is rejected, configure a verified custom SMTP sender in Authentication → Email/SMTP. This can be required for real use; do not assume default email delivery will work for both people. Check current Supabase email limits/pricing before choosing a sender.

## Cloudflare Pages deployment

The easiest first deploy is Direct Upload: Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets. Upload the contents of public/ (index.html at the upload root); do not upload server.js, node_modules, test/, or SQL. Use the generated HTTPS pages.dev origin in Supabase URL Configuration. No build step or paid domain is needed.

For Git deployments: connect the repository, framework None, build command blank, build output directory `public`. Changes in this workspace must be pushed to GitHub before Git deployment can see them. Direct Upload avoids that prerequisite.

Open the deployed app, request a sign-in email, and follow its link in the same browser. Create one space, invite your partner, and have them sign in with their own email and choose “I have an invitation.” Do not have both people create separate spaces. Invitations are single use, 32 hexadecimal characters, and expire after 24 hours. Each account belongs to one space with at most two members. Signing in with the same email on a replacement device recovers access.

## iPhone and limitations

Safari → Share → Add to Home Screen. Use the emailed code directly in the installed app. Magic links may open Safari instead, creating a separate browser session. The email template must include `{{ .Token }}` to send a code. Physical iPhone installation and email delivery still need validation.

Lists are protected by PostgreSQL RLS and authenticated membership. Data is not end-to-end encrypted; your Supabase project administrators can access it. Browser sessions live in localStorage, as in typical browser Supabase clients; use only trusted devices. No offline writes or notifications. No member removal/moving between spaces yet. Deleting/clearing is permanent. Free-plan quotas, inactivity pausing, SMTP limits, and availability may change.

## Family lists upgrade (v1.1)

For an existing deployment, run **only** `supabase/migrations/002_family_lists.sql` in Supabase SQL Editor before uploading the new static assets. Do not rerun setup.sql. The upgrade preserves all existing items and memberships and is safe to rerun. For a new project, run setup.sql first, then this migration.

Upload `little-us-v1.1-cloudflare.zip` as a new deployment of your existing Cloudflare static-assets Worker (or Pages project); keep the same domain so email redirects and saved sessions continue to work. The ZIP contains only the files from public/, with index.html at its root. Refresh the app after deployment. No changes to email settings, project keys, or sharing invitations are needed.

Shopping offers Costco, Aldi, Walmart, Giant Eagle, Shop n Save, Home Goods, Home Depot, and Amazon by default. Select “Add a store…” to save a custom store for both members in lu_stores. Existing item store labels remain selectable. Store filters scroll horizontally. Films & series uses kind=watch, with Film/Series in the store column; places uses kind=places. Checkboxes mark titles watched or places visited. Completion, deletion, and clearing apply only to the selected list. Lists and custom stores retain the same household membership privacy rules.

Validated locally: actual PostgreSQL schema upgrade run twice over existing data; member/stranger/anonymous RLS checks; browser flows against mocked Supabase for custom stores, all four lists, completion, filters, and shared-state reloads; responsive widths from 320 to 1440px. Live deployment and physical iPhone checks remain manual after upload.

## Password sign-in update (v1.2)

Upload `little-us-password-update.zip` as a new deployment of the existing Cloudflare app. No SQL migration, new key, SMTP change, or domain is needed for password sign-in. Keep the same origin and existing Supabase Email provider enabled. Password sign-in sends credentials directly to Supabase Auth; only session tokens are persisted on the device. Local sign-out does not revoke the same account's sessions on other devices.

For the existing email-link account, open the app in the browser where you are already signed in. Tap the top-right space button → Set or change password. Set a password of at least 12 characters. Then open the iPhone Home Screen app and sign in using the same Gmail address and that password. This updates the existing account without altering membership or list data, and does not send an email. Do not create a second account for the same person.

If no existing signed-in browser is available, Forgot or haven’t set a password? offers a password-reset email and the legacy email-link sign-in. Reset links open a password-setting form; after saving, return to the installed app and use email/password. Email confirmation, reset and fallback links still depend on Supabase email delivery limits. The default sender may restrict your wife's confirmation email; this update does not remove those restrictions. Do not disable confirmation or RLS merely to bypass them. New accounts use Create an account and may require one confirmation email before password sign-in works.

Validated locally: password error handling, identity preservation, session persistence, refresh token renewal, recovery-link handling, signup with/without confirmation, password mismatch guard, and full browser shutdown/relaunch with mocked Supabase responses. Live password update, email delivery and physical iPhone session retention require user validation after deployment.

## Restaurants update (v1.3)

Run **only** `supabase/migrations/003_restaurants.sql` for an existing v1.2 project (which already has migration 002). Then deploy `little-us-restaurants-update.zip` to the existing Cloudflare app and refresh. For a new project apply setup.sql, 002, then 003. No email/auth settings or account changes are required.

Restaurants appears immediately after To-do. Add a name and optional cuisine, location/address and notes. Cuisine offers suggestions and accepts custom values; cuisine filters are derived from saved restaurants. Tap a restaurant name to edit its details. An explicit Maps link opens the address in Apple Maps, without sharing location information until tapped. Mark a restaurant tried using the circle; clearing completed only affects that list. Restaurant details share the existing lu_items household RLS; records in other lists receive empty metadata defaults and remain intact. Editing now grants title/cuisine/address/notes columns, with the existing household policies still applied; home_id remains non-editable.

Saved-item text increased from 14px to 15px on desktop and 13px to 14px on mobile. Five mobile tabs fit without horizontal page overflow at widths of 320–430px. Database tests apply upgrade 003 twice and verify existing data, metadata, field limits, shared edits and unrelated-account access restrictions. Browser tests use mocked Supabase for add/edit, custom cuisine filters, tried/clear, shared reload, Maps URL, and 320–1440px layouts. Live deployment still requires the SQL and ZIP upload steps above.
