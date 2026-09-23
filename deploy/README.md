# Deployment

This repository deploys from GitHub Actions through self-hosted runners.

| Branch | Runner label | GitHub environment | Target |
| --- | --- | --- | --- |
| `develop` | `test` | `test` | Test environment |
| `main` | `prod` | `production` | Production environment |

The workflow builds the frontend on the target runner, then installs and invokes
`/home/evelyn.zou/deploy.sh`. The script publishes backend files to
`/home/evelyn.zou/apps/cms-dashboard/backend`, stages frontend build files in
`/home/evelyn.zou/apps/cms-dashboard/frontend/build`, and publishes them to
`/var/www/mcl` by default.

## One-time server preparation

1. Install Node.js 20, npm, rsync, Nginx, and the GitHub Actions runner.
2. Create `/etc/cms-dashboard/backend.env` on each server. This file is never
   deployed from GitHub.
3. Install and enable the environment-specific systemd service. The workflow
   defaults to `cms_dashboard_backend`; update `BACKEND_SERVICE` in the workflow
   if test and production use different service names.
4. Allow the runner account to run, without a password, only these commands:

```text
/usr/bin/mkdir
/usr/bin/cp
/usr/bin/find
/usr/bin/rm
/usr/bin/rsync
/usr/bin/systemctl restart cms_dashboard_backend
/usr/bin/systemctl is-active cms_dashboard_backend
/usr/bin/systemctl reload nginx
/usr/sbin/nginx -t
```

5. Confirm that Nginx serves `/var/www/mcl` and proxies `/api/` to the backend
   port configured in `/etc/cms-dashboard/backend.env`.

## Deployment behavior

- The script keeps the three latest backend and frontend backups under the app
  root.
- Backend state directories (`logs`, `uploads`, and `debug`) and `.env` are not
  overwritten.
- A failed publish restores the latest pre-deployment backup and restarts the
  backend service.
- Configure required reviewers for GitHub Environment `production` before
  enabling production deploys.