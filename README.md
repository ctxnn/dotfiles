# Dotfiles

A portable macOS development environment for **Neovim**, **tmux**, **Pi**, and **Zsh**.

This repository keeps editor behavior, terminal ergonomics, AI-agent orchestration, shell initialization, plugin declarations, model routing, and installation instructions reproducible—without storing credentials or machine-generated state.

## Included configurations

| Component | What is included | Detailed guide |
|---|---|---|
| **Neovim** | Lua config, lazy.nvim plugin declarations and lockfile, LSP, formatting, completion, Telescope, Neo-tree, Treesitter, Git signs, Markdown preview, Catppuccin | [docs/NVIM.md](docs/NVIM.md) |
| **tmux** | `Ctrl-a` prefix, splits in the current directory, Vim-style copy mode, pane management, sessions, TPM, resurrect/continuum | [docs/TMUX.md](docs/TMUX.md) |
| **Pi** | Global instructions, model-routed agents, skills, destructive-command approval gate, saved chains, live subagent inspection, Plannotator, Exa, NVIDIA-NIM guardrails, dynamic workflows | [docs/PI.md](docs/PI.md) |
| **Zsh** | Git-aware prompt, Conda/Mamba, NVM, tool paths, Grok completions, private local override support | [Zsh](#zsh) |

## Repository layout

```text
.
├── docs/
│   ├── NVIM.md
│   ├── TMUX.md
│   └── PI.md
├── nvim/.config/nvim/       # Neovim config root
├── tmux/.tmux.conf          # tmux configuration
├── zsh/.zshrc               # portable shell configuration
├── pi/
│   ├── agent/               # umgbhalla-style Pi config root
│   │   ├── AGENTS.md
│   │   ├── settings.json
│   │   ├── agents/
│   │   ├── chains/
│   │   ├── extensions/
│   │   ├── prompts/
│   │   └── skills/
│   ├── workflows/           # dynamic-workflow settings and model tiers
│   └── web-search.json       # Exa search preference
└── install.sh
```

## Installation

### 1. Clone

```bash
git clone https://github.com/ctxnn/dotfiles.git ~/Codes/repos/dotfiles
cd ~/Codes/repos/dotfiles
```

### 2. Preview

The installer is deliberately a dry run unless `--apply` is supplied:

```bash
./install.sh
```

It shows every link it would create. Existing files are not touched.

### 3. Apply

```bash
./install.sh --apply
```

Existing targets are moved to:

```text
~/.dotfiles-backup/YYYYMMDD-HHMMSS/
```

Skip Zsh if desired:

```bash
./install.sh --apply --skip-zsh
```

The installer links tracked configuration into the expected home-directory locations and invokes the Pi setup script. You can install only Pi with:

```bash
./pi/agent/setup.sh --apply
```

## Zsh

The tracked `.zshrc` uses `$HOME` instead of a personal absolute path. It configures:

- a Git-branch-aware prompt through `vcs_info`;
- Miniforge/Conda and Mamba when installed;
- NVM and its shell completion;
- developer-tool paths for Windsurf, Antigravity, OpenCode, Grok, PostgreSQL, and local binaries;
- Grok completions when present.

Secrets and machine-specific exports belong in:

```bash
~/.zshrc.local
```

That file is sourced automatically and ignored by Git. Example:

```bash
export EXA_API_KEY="..."
export NVIDIA_API_KEY="..."
```

Never put real values in the tracked `.zshrc`.

## Updating

```bash
cd ~/Codes/repos/dotfiles
git pull
```

Symlinked configurations update immediately. Restart Neovim/tmux as appropriate and run `/reload` in Pi after Pi configuration changes.

To record local improvements:

```bash
git status
git add -p
git commit -m "Update dotfiles"
git push
```

Always review the staged diff and run a secret scan before pushing.

## Security model

This repository intentionally excludes:

- Pi `auth.json` and provider credentials;
- API keys, tokens, private keys, and `.env` files;
- Pi sessions, runtime state, caches, generated model catalogs, binaries, and `node_modules`;
- a fail-closed Pi permission gate requires one-time approval for destructive commands;
- Neovim-exported Pi session HTML;
- tmux runtime snapshots;
- `~/.zshrc.local`.

The `.gitignore` contains defense-in-depth rules, but it is not a substitute for reviewing `git diff --cached` before publishing.

## Requirements

The configuration degrades gracefully when optional tools are absent, but the complete experience expects:

- macOS, Git, Zsh, Neovim, and tmux;
- a Nerd Font for editor icons;
- `ripgrep`, language servers/formatters, Node.js, and Python tooling as needed;
- TPM for tmux plugins;
- Pi plus locally configured provider credentials.

See the component guides for exact setup and usage.
