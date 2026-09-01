# Railway deployment

Deploy this repository as three application services plus one Railway MySQL
service. Railway does not run `compose.yaml` directly.

## 1. Create the services

Create an empty Railway project, add a MySQL database, and add the same GitHub
repository three times. Name the repository services exactly:

- `api`
- `admin`
- `user`

Do not set a Root Directory; all Docker builds require the repository root as
their build context.

Set `RAILWAY_DOCKERFILE_PATH` on each service:

| Service | Value |
| --- | --- |
| api | `docker/railway/Dockerfile.api` |
| admin | `docker/railway/Dockerfile.admin` |
| user | `docker/railway/Dockerfile.user` |

## 2. Generate public domains

Generate a Railway public domain for `admin` and `user`. The API is reached
through the frontend reverse proxies and does not require a public domain.

## 3. Configure variables

Add these variables to `api`. Replace `MySQL`, `admin`, and `user` if the
Railway service names differ. Generate a unique JWT secret of at least 32
characters.

```env
NODE_ENV=production
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
ADMIN_FRONTEND_URL=https://${{admin.RAILWAY_PUBLIC_DOMAIN}}
USER_FRONTEND_URL=https://${{user.RAILWAY_PUBLIC_DOMAIN}}
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

Add this variable to both `admin` and `user`:

```env
API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
```

Railway supplies `PORT` automatically to all three services.

## 4. Deploy and verify

Deploy MySQL first, then `api`, `admin`, and `user`. Verify the API through a
frontend domain:

```text
https://<admin-domain>/api/health
```

The expected response has `status: "ok"` and `database: "connected"`.

For a custom domain, update `ADMIN_FRONTEND_URL` or `USER_FRONTEND_URL` to the
final HTTPS URL and redeploy the API. These values are also used for password
reset links and QR codes.
