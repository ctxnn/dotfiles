#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_DIR="$(cd "$SOURCE_DIR/.." && pwd)"
MODE="dry-run"
[[ "${1:-}" == "--apply" ]] && MODE="apply"
BACKUP_ROOT="${DOTFILES_BACKUP_ROOT:-$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)}"

link_item() {
  local source="$1" target="$2" relative backup
  if [[ -L "$target" && "$(readlink "$target")" == "$source" ]]; then
    printf 'ok      %s -> %s\n' "$target" "$source"
    return
  fi
  printf '%-7s %s -> %s\n' "$MODE" "$target" "$source"
  if [[ "$MODE" != "apply" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  if [[ -e "$target" || -L "$target" ]]; then
    relative="${target#$HOME/}"
    backup="$BACKUP_ROOT/$relative"
    mkdir -p "$(dirname "$backup")"
    mv "$target" "$backup"
    printf 'backup  %s\n' "$backup"
  fi
  ln -s "$source" "$target"
}

for name in AGENTS.md CONFIG.md settings.json plannotator.json packages.txt setup.sh; do
  link_item "$SOURCE_DIR/$name" "$HOME/.pi/agent/$name"
done
for name in agents chains extensions prompts skills; do
  link_item "$SOURCE_DIR/$name" "$HOME/.pi/agent/$name"
done
link_item "$PI_DIR/web-search.json" "$HOME/.pi/web-search.json"
link_item "$PI_DIR/workflows/settings.json" "$HOME/.pi/workflows/settings.json"
link_item "$PI_DIR/workflows/model-tiers.json" "$HOME/.pi/workflows/model-tiers.json"

if [[ "$MODE" == "apply" ]]; then
  if command -v pi >/dev/null 2>&1; then
    echo
    echo "Installing Pi packages..."
    while IFS= read -r package; do
      [[ -n "$package" ]] || continue
      pi install "$package" >/dev/null || {
        echo "Failed to install $package" >&2
        exit 1
      }
      echo "installed $package"
    done < "$SOURCE_DIR/packages.txt"

    # pi-subagents imports `typebox/compile` at runtime, but its package
    # metadata currently declares typebox as a peer dependency. Ensure the
    # shared Pi extension root supplies the compatible runtime dependency.
    npm install --prefix "$HOME/.pi/agent/npm" --save --no-audit --no-fund typebox@1.1.38 >/dev/null
    echo "installed runtime peer dependency typebox@1.1.38"
  else
    echo "Pi is not installed; skipping package installation." >&2
  fi
fi

cat <<'EOF'

Pi credentials are deliberately not managed by this repository.
Authenticate locally with Pi's /login command. Never commit ~/.pi/agent/auth.json.
After applying, start a new Pi session or run /reload.
EOF
