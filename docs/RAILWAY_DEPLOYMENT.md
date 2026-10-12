# Deployment: Vercel frontends and Railway API

The current production topology hosts the `admin` and `user` frontends on
Vercel, with the `api` service and MySQL on Railway. The frontend requests
`/api/*` on its own domain; Vercel forwards these requests to Railway using
the repository root `vercel.json`. Railway does not run `compose.yaml`.

Hosting all three applications on Railway is an optional alternative,
described below. It is not required for the existing Vercel deployments.

## 1. Railway API and database

Add a MySQL service and a GitHub repository service named `api`. Leave the
Root Directory unset; the Docker build requires the repository root as its
build context. Set:

```env
RAILWAY_DOCKERFILE_PATH=docker/railway/Dockerfile.api
```

Generate a public domain for `api` so Vercel can reach it. Add the following
variables to `api`, replacing `MySQL` if the database service has another
name. Generate a unique JWT secret of at least 32 characters and use the
frontends' canonical production domains.

```env
NODE_ENV=production
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
ADMIN_FRONTEND_URL=https://match-skill-admin.vercel.app
USER_FRONTEND_URL=https://match-skill-user.vercel.app
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-strong-password-of-at-least-12-characters
BOOTSTRAP_ADMIN_NAME=System Administrator
```

The API creates this account as `super_admin` only when the email does not
already exist. After the first successful deployment and login, remove
`BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_ADMIN_EMAIL` from Railway Variables;
the database account remains available.

For password-reset email in production, also configure `SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

Railway supplies `PORT` automatically. Deploy MySQL first, then `api`.

## 2. Vercel frontends

Create two Vercel projects from the same repository, using the repository
root as the project root:

| Project | Build command | Output directory |
| --- | --- | --- |
| admin | `npm run build:admin` | `dist/admin` |
| user | `npm run build:user` | `dist/user` |

The `/api/:path*` rewrite in `vercel.json` must point to the Railway API's
public HTTPS domain. If that domain changes, update the rewrite destination
and redeploy both Vercel projects. `API_UPSTREAM` is only used by the optional
Railway frontend containers; it does not configure the Vercel rewrite.

## 3. Verify the public deployment

Verify the API through each frontend's canonical domain:

```text
https://<admin-domain>/api/health
```

The expected response has `status: "ok"` and `database: "connected"`.

For a custom domain, update `ADMIN_FRONTEND_URL` or `USER_FRONTEND_URL` to the
final HTTPS URL and redeploy the API. These values are also used for password
reset links and QR codes.

### Vercel user frontend

When the user frontend is hosted on Vercel, set `USER_FRONTEND_URL` to its
canonical production domain, for example:

```env
USER_FRONTEND_URL=https://match-skill-user.vercel.app
```

Do not use a deployment URL, Git branch URL, or team-scoped alias such as
`match-skill-user-<deployment>-<team>.vercel.app` or
`match-skill-user-git-<branch>-<team>.vercel.app`. Deployment Protection can
redirect anonymous students from those aliases to `vercel.com/sso-api`.

Verify the configured URL before distributing a QR code:

1. Open `<USER_FRONTEND_URL>/s/test` in a private/incognito browser window.
2. Confirm that the SEDA page loads without a Vercel sign-in screen.
3. Redeploy the API after changing `USER_FRONTEND_URL`.
4. Download and distribute the QR image again. Previously downloaded or
   printed images still contain the old URL even though the admin screen now
   shows the new URL.

The application cannot reliably identify a protected Vercel alias from its
hostname alone because deployment protection is an account setting. The
anonymous-browser check is therefore required whenever the public domain or
Vercel protection settings change.

## Usage-event queue

Usage telemetry is best-effort analytics. The API accepts valid events into
an in-memory queue of at most 5,000 waiting jobs and uses at most two database
writers per API process. Events for the same browser session are written in
arrival order. This leaves database capacity available for registration,
answer drafts, and assessment submissions during a burst of visitors.

`202 { "accepted": true }` means queued, not committed to the database.
`202 { "accepted": false }` means the queue is full, the process is shutting
down, or the telemetry rate limit was reached. Tracking must never block the
student's assessment. The limit is 180 events per IP and browser-session pair
per minute; a shared classroom IP does not combine different session IDs.

The queue is not durable: a process crash, a database write failure, or a
shutdown that exceeds the bounded drain period can lose telemetry. Database
write failures are logged. On graceful shutdown the API stops accepting new
events and gives queued work a short time to finish before closing the pool.
Assessment answers and submissions use their normal database transactions;
they are not stored in this telemetry queue. Use a durable external queue if
analytics must have guaranteed delivery across restarts.

## Optional: host the frontends on Railway

Instead of Vercel, add this repository twice more as services named `admin`
and `user`. Leave each Root Directory unset and configure:

| Service | `RAILWAY_DOCKERFILE_PATH` |
| --- | --- |
| admin | `docker/railway/Dockerfile.admin` |
| user | `docker/railway/Dockerfile.user` |

Generate public domains for both frontends and set this variable on both:

```env
API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
```

Update the API's frontend URLs:

```env
ADMIN_FRONTEND_URL=https://${{admin.RAILWAY_PUBLIC_DOMAIN}}
USER_FRONTEND_URL=https://${{user.RAILWAY_PUBLIC_DOMAIN}}
```

Railway supplies `PORT` automatically to all three services. Deploy the API
before the frontends. In this all-Railway topology the frontend containers
proxy API requests over Railway's private network, so the API does not need
a public domain. Verify `/api/health` and the public QR flow again after
changing topology or domains, and replace previously distributed QR images
if their URLs have changed.
