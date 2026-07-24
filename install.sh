#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="dry-run"
INSTALL_ZSH=true

usage() {
  cat <<'EOF'
Usage: ./install.sh [--apply] [--skip-zsh]

Without --apply, prints the operations without changing your machine.
Existing targets are backed up under ~/.dotfiles-backup/<timestamp>/.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --apply) MODE="apply" ;;
    --skip-zsh) INSTALL_ZSH=false ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

BACKUP_ROOT="${DOTFILES_BACKUP_ROOT:-$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)}"
export DOTFILES_BACKUP_ROOT="$BACKUP_ROOT"

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

link_item "$ROOT/nvim/.config/nvim" "$HOME/.config/nvim"
link_item "$ROOT/tmux/.tmux.conf" "$HOME/.tmux.conf"
if [[ "$INSTALL_ZSH" == true ]]; then
  link_item "$ROOT/zsh/.zshrc" "$HOME/.zshrc"
fi

if [[ "$MODE" == "apply" ]]; then
  "$ROOT/pi/agent/setup.sh" --apply
else
  "$ROOT/pi/agent/setup.sh"
fi

cat <<EOF

$([[ "$MODE" == "apply" ]] && echo 'Installation complete.' || echo 'Dry run complete; rerun with --apply to install.')
Backups: $BACKUP_ROOT
EOF
