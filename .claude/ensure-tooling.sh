#!/usr/bin/env bash
# Provision the spec-driven-development tooling for Claude Code sessions:
#   1. the Superpowers plugin (skills used by the superpowers-bridge apply phase)
#   2. the OpenSpec CLI (@fission-ai/openspec)
# so that /opsx:apply's precheck passes with no manual per-developer setup.
#
# WHERE TO RUN THIS
# -----------------
# CLOUD / REMOTE: point the environment's *Setup script* (pre-launch) at:
#     f="$(find / -xdev -maxdepth 6 -path '*/.claude/ensure-tooling.sh' 2>/dev/null | head -n1)"; [ -n "$f" ] && bash "$f" || echo "[setup] ensure-tooling.sh not found, skipping"
# Do NOT use a bare "bash .claude/ensure-tooling.sh" - the setup script's working
# directory is undocumented by Anthropic and is not guaranteed to be the repo root
# (confirmed failing with exit 127 / "No such file or directory" in practice). The
# find-based form above also no-ops safely if this environment is ever pointed at
# a repo that doesn't have this file, instead of failing the session.
# The plugin MUST be installed before Claude Code launches, because plugin skills
# load at startup - before any SessionStart hook runs. The pre-launch setup phase
# is also where network access and workspace trust are available, and it is
# snapshotted, so this runs once per environment and every later task reuses it.
# That snapshot is what makes the AFK "send tasks to the cloud" workflow work.
#
# LOCAL: the SessionStart hook in .claude/settings.json also runs this file. That
# reliably provisions the OpenSpec CLI for local devs. The plugin half only takes
# effect from the next session when run via the hook, so remote runs must use the
# Setup script above.
#
# Best-effort and idempotent: it no-ops when a tool is already present, and warns
# but exits 0 on failure so a session never gets blocked by this script.

set -uo pipefail
log() { echo "[ensure-tooling] $*" >&2; }

# --- OpenSpec CLI ----------------------------------------------------------
# The real package is @fission-ai/openspec. The bare "openspec" name on npm is an
# unrelated placeholder (v0.0.0) - do not install that one.
if ! command -v openspec >/dev/null 2>&1; then
  if command -v npm >/dev/null 2>&1; then
    log "installing OpenSpec CLI (@fission-ai/openspec)..."
    if ! npm install -g @fission-ai/openspec >/dev/null 2>&1; then
      # Non-root fallback: install into a home-owned prefix and put it on PATH.
      prefix="$HOME/.npm-global"
      mkdir -p "$prefix/bin"
      if NPM_CONFIG_PREFIX="$prefix" npm install -g @fission-ai/openspec >/dev/null 2>&1; then
        export PATH="$prefix/bin:$PATH"
        [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "PATH=$prefix/bin:\$PATH" >> "$CLAUDE_ENV_FILE"
      else
        log "WARN: could not install openspec; run 'npm i -g @fission-ai/openspec' or see https://openspec.dev"
      fi
    fi
    command -v openspec >/dev/null 2>&1 && log "openspec $(openspec --version 2>/dev/null) ready"
  else
    log "WARN: npm not found; cannot install openspec. See https://openspec.dev"
  fi
fi

# --- Superpowers plugin ----------------------------------------------------
# Only effective when run pre-launch (Setup script), since Claude Code loads
# plugin skills at startup. The repo's .claude/settings.json then ENABLES it.
if command -v claude >/dev/null 2>&1; then
  if claude plugin list 2>/dev/null | grep -q 'superpowers@claude-plugins-official'; then
    log "superpowers plugin already installed"
  else
    log "installing Superpowers plugin..."
    claude plugin marketplace add anthropics/claude-plugins-official --scope user >/dev/null 2>&1 || true
    if claude plugin install superpowers@claude-plugins-official --scope user >/dev/null 2>&1; then
      log "superpowers plugin installed"
    else
      log "WARN: could not install superpowers plugin. Check the environment network level allows github.com, and that this runs in the pre-launch Setup script."
    fi
  fi
else
  log "WARN: claude CLI not found; cannot preinstall the superpowers plugin. Run this from the cloud environment Setup script."
fi

exit 0
