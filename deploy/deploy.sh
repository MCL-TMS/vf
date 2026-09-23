#!/usr/bin/env bash

set -Eeuo pipefail
umask 022

DEPLOY_ENVIRONMENT="${1:?Usage: deploy.sh <test|prod> <release-path> [--dry-run]}"
SOURCE_ROOT="$(realpath "${2:?Release path is required}")"
MODE="${3:-}"
APP_ROOT="${APP_ROOT:-${DEPLOY_PATH:-/home/evelyn.zou/apps/cms-dashboard}}"
BACKEND_DIR="${BACKEND_DIR:-${APP_ROOT}/backend}"
FRONTEND_STAGING_DIR="${FRONTEND_STAGING_DIR:-${FRONTEND_STAGE_ROOT:-${APP_ROOT}/frontend/build}}"
FRONTEND_DIR="${FRONTEND_DIR:-${NGINX_WEB_ROOT:-/var/www/mcl}}"
BACKEND_SERVICE="${BACKEND_SERVICE:-${SYSTEMD_SERVICE:-cms_dashboard_backend}}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${BACKEND_ENV_TARGET:-/etc/cms-dashboard/backend.env}}"
DEPLOY_TARGET_FILE="${DEPLOY_TARGET_FILE:-/etc/cms-dashboard/deploy-target}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ).$$"
BACKEND_BACKUP="${APP_ROOT}/backend.bak.${TIMESTAMP}"
FRONTEND_BACKUP="${APP_ROOT}/frontend.bak.${TIMESTAMP}"
RELEASE_DIR="${APP_ROOT}/.release.${TIMESTAMP}"
BACKEND_READY=false
FRONTEND_READY=false
PUBLISH_STARTED=false
STATE_EXCLUDES=(--exclude='.env' --exclude='.env.*' --exclude='logs/' --exclude='uploads/' --exclude='debug/')

fail() {
  echo "$*" >&2
  exit 1
}

[[ "${DEPLOY_ENVIRONMENT}" == test || "${DEPLOY_ENVIRONMENT}" == prod ]] || fail 'Environment must be test or prod'
[[ -z "${MODE}" || "${MODE}" == --dry-run ]] || fail 'Unknown option'
for command_name in node npm rsync curl flock systemctl nginx sudo; do
  command -v "${command_name}" >/dev/null || fail "Missing command: ${command_name}"
done
[[ -r "${DEPLOY_TARGET_FILE}" ]] || fail "Missing server identity: ${DEPLOY_TARGET_FILE}"
[[ "$(cat "${DEPLOY_TARGET_FILE}")" == "${DEPLOY_ENVIRONMENT}" ]] || fail 'Server identity does not match deployment environment'
[[ -d "${APP_ROOT}" && -w "${APP_ROOT}" ]] || fail "App directory is not writable: ${APP_ROOT}"
[[ -d "${FRONTEND_DIR}" && -w "${FRONTEND_DIR}" ]] || fail "Web directory is not writable: ${FRONTEND_DIR}"
[[ "$(realpath "${APP_ROOT}")" != / && "$(realpath "${FRONTEND_DIR}")" != / ]] || fail 'Refusing to deploy to filesystem root'
case "${SOURCE_ROOT}/" in
  "$(realpath "${APP_ROOT}")/"*|"$(realpath "${FRONTEND_DIR}")/"*) fail 'Release source must be outside deployed directories' ;;
esac
[[ -f "${SOURCE_ROOT}/backend/package-lock.json" && -f "${SOURCE_ROOT}/backend/src/api-server.js" ]] || fail 'Backend release is incomplete'
[[ -s "${SOURCE_ROOT}/frontend/build/index.html" ]] || fail 'Frontend release is incomplete'
[[ -f "${BACKEND_ENV_FILE}" ]] || fail "Missing backend environment file: ${BACKEND_ENV_FILE}"
[[ "$(systemctl show "${BACKEND_SERVICE}" --property=LoadState --value)" == loaded ]] || fail 'Backend systemd service is not installed'
sudo -n -l /usr/bin/systemctl stop "${BACKEND_SERVICE}" >/dev/null
sudo -n -l /usr/bin/systemctl restart "${BACKEND_SERVICE}" >/dev/null
sudo -n -l /usr/bin/systemctl reload nginx >/dev/null
sudo -n /usr/sbin/nginx -t

exec 9>"${APP_ROOT}/.deploy.lock"
flock -n 9 || fail 'Another deployment is running on this server'
if [[ "${MODE}" == --dry-run ]]; then
  echo "Preflight passed for ${DEPLOY_ENVIRONMENT}; no application files changed."
  exit 0
fi

health_check() {
  curl --fail --silent --show-error \
    --connect-timeout 3 --max-time 10 --retry 12 --retry-delay 2 \
    --retry-connrefused --retry-all-errors "${HEALTH_URL}" | node -e '
      let body = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => { body += chunk; });
      process.stdin.on("end", () => {
        try {
          const health = JSON.parse(body);
          if (health.status !== "healthy" || health.database !== "connected") process.exit(1);
        } catch {
          process.exit(1);
        }
      });'
}

rollback() {
  local exit_code="$1"
  local rollback_failed=false
  trap - ERR INT TERM
  set +e
  echo 'Deployment failed.' >&2
  if [[ "${PUBLISH_STARTED}" == true ]]; then
    sudo -n /usr/bin/systemctl stop "${BACKEND_SERVICE}" || rollback_failed=true
    if [[ "${BACKEND_READY}" == true ]]; then
      rsync -a --delete "${STATE_EXCLUDES[@]}" "${BACKEND_BACKUP}/" "${BACKEND_DIR}/" || rollback_failed=true
    fi
    if [[ "${FRONTEND_READY}" == true ]]; then
      rsync -a --delete "${FRONTEND_BACKUP}/" "${FRONTEND_DIR}/" || rollback_failed=true
      rsync -a --delete "${FRONTEND_BACKUP}/" "${FRONTEND_STAGING_DIR}/" || rollback_failed=true
    fi
    if [[ -f "${BACKEND_BACKUP}/src/api-server.js" ]]; then
      sudo -n /usr/bin/systemctl restart "${BACKEND_SERVICE}" || rollback_failed=true
      health_check || rollback_failed=true
    fi
    echo "Rollback attempted; rollback_failed=${rollback_failed}. Backups: ${TIMESTAMP}" >&2
  fi
  rm -rf -- "${RELEASE_DIR}"
  exit "${exit_code}"
}

trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM

echo "Preparing ${DEPLOY_ENVIRONMENT} release from ${SOURCE_ROOT}"
mkdir -p "${RELEASE_DIR}" "${BACKEND_DIR}" "${FRONTEND_STAGING_DIR}"
rsync -a --delete "${STATE_EXCLUDES[@]}" --exclude='node_modules/' \
  "${SOURCE_ROOT}/backend/" "${RELEASE_DIR}/"
pushd "${RELEASE_DIR}" >/dev/null
npm ci --omit=dev
popd >/dev/null

mkdir -p "${BACKEND_BACKUP}" "${FRONTEND_BACKUP}"
rsync -a "${STATE_EXCLUDES[@]}" "${BACKEND_DIR}/" "${BACKEND_BACKUP}/"
BACKEND_READY=true
rsync -a "${FRONTEND_DIR}/" "${FRONTEND_BACKUP}/"
FRONTEND_READY=true

PUBLISH_STARTED=true
sudo -n /usr/bin/systemctl stop "${BACKEND_SERVICE}"
rsync -a --delete "${STATE_EXCLUDES[@]}" "${RELEASE_DIR}/" "${BACKEND_DIR}/"
rsync -a --delete "${SOURCE_ROOT}/frontend/build/" "${FRONTEND_STAGING_DIR}/"
rsync -a --delete --chmod=D755,F644 "${FRONTEND_STAGING_DIR}/" "${FRONTEND_DIR}/"
sudo -n /usr/bin/systemctl restart "${BACKEND_SERVICE}"
systemctl is-active --quiet "${BACKEND_SERVICE}"
health_check
sudo -n /usr/sbin/nginx -t
sudo -n /usr/bin/systemctl reload nginx

trap - ERR INT TERM
rm -rf -- "${RELEASE_DIR}"
echo "${DEPLOY_ENVIRONMENT} deployment succeeded. Backup ID: ${TIMESTAMP}"
echo 'Backups are retained for manual rollback; prune old backups after verification.'