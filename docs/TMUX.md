# tmux Configuration

A keyboard-driven tmux setup with a `Ctrl-a` prefix, directory-preserving panes/windows, Vim-style copy mode, persistent sessions, and fast window navigation.

## Installation

Use the repository installer:

```bash
./install.sh --apply
```

Or link only tmux:

```bash
ln -s ~/Codes/repos/dotfiles/tmux/.tmux.conf ~/.tmux.conf
```

Install tmux:

```bash
brew install tmux
```

## Prefix

The default `Ctrl-b` prefix is replaced with:

```text
Ctrl-a
```

In the tables below, `Prefix` means press `Ctrl-a`, release it, then press the next key.

`Prefix Ctrl-a` sends a literal prefix to a nested tmux session.

## Core settings

| Setting | Value | Effect |
|---|---:|---|
| Terminal | `screen-256color` | Enables 256-color terminal behavior |
| Escape time | `10ms` | Makes Vim/Neovim mode transitions feel responsive |
| Focus events | On | Applications can react to focus changes |
| Visual bell | On | Avoids audible terminal bells |
| Mouse | On | Select panes, resize, scroll, and switch windows with the mouse |
| History | `100000` lines | Large pane scrollback buffer |
| Copy mode | Vi | Vim-style copy-mode keys |

## Keybindings

### Configuration

| Keys | Action |
|---|---|
| `Prefix r` | Reload `~/.tmux.conf` |

### Panes

New panes inherit the current pane's working directory.

| Keys | Action |
|---|---|
| `Prefix |` | Split horizontally |
| `Prefix -` | Split vertically |
| `Prefix h` | Resize left by 5 cells; repeatable |
| `Prefix j` | Resize down by 5 cells; repeatable |
| `Prefix k` | Resize up by 5 cells; repeatable |
| `Prefix l` | Resize right by 5 cells; repeatable |
| `Prefix m` | Toggle pane zoom; repeatable |
| `Prefix <` | Swap pane upward |
| `Prefix >` | Swap pane downward |

Pane movement integrates with `vim-tmux-navigator`, whose standard mappings are:

| Keys | Direction |
|---|---|
| `Ctrl-h` | Left |
| `Ctrl-j` | Down |
| `Ctrl-k` | Up |
| `Ctrl-l` | Right |
| `Ctrl-\` | Previous pane |

These work across tmux panes and Vim/Neovim splits when the corresponding editor plugin is installed.

### Windows

| Keys | Prefix required? | Action |
|---|---:|---|
| `Prefix c` | Yes | New window in the current directory |
| `Prefix w` | Yes | Interactive window chooser |
| `Prefix ,` | Yes | Rename current window |
| `Ctrl-n` | No | Next window |
| `Ctrl-p` | No | Previous window |
| `Ctrl-t` | No | New window |
| `Alt-1` … `Alt-9` | No | Jump directly to window 1–9 |
| `Prefix t` | Yes | Clock mode |

Because `Ctrl-n` and `Ctrl-p` are global tmux bindings, they take priority while tmux is active.

### Sessions

| Keys | Action |
|---|---|
| `Prefix s` | Choose an existing session |
| `Prefix S` | Create a new session |
| `Prefix R` | Rename current session |

Useful shell commands:

```bash
tmux new -s work
tmux list-sessions
tmux attach -t work
tmux kill-session -t work
```

### Copy mode

Enter copy mode with tmux's standard `Prefix [` binding, then:

| Key | Action |
|---|---|
| `v` | Begin selection |
| `y` | Copy selection to the macOS clipboard and exit |
| `Enter` | Copy selection to the macOS clipboard and exit |

Copying uses `pbcopy`, so this binding is macOS-specific. Mouse drag selection remains active until explicitly copied because the default mouse-drag-end behavior is unbound.

## Plugins

The configuration uses [TPM](https://github.com/tmux-plugins/tpm), the tmux plugin manager.

| Plugin | Purpose |
|---|---|
| `tmux-plugins/tpm` | Plugin installation and updates |
| `christoomey/vim-tmux-navigator` | Seamless movement between tmux and editor panes |
| `jimeh/tmux-themepack` | Powerline-style cyan theme |
| `tmux-plugins/tmux-resurrect` | Save and restore sessions/windows/panes |
| `tmux-plugins/tmux-continuum` | Automatically save every 15 minutes and restore on startup |

Resurrect is configured to capture pane contents. Continuum automatic restoration is enabled.

### Install TPM and plugins

```bash
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
tmux source-file ~/.tmux.conf
```

Then use:

| Keys | Action |
|---|---|
| `Prefix I` | Install configured plugins |
| `Prefix U` | Update plugins |
| `Prefix Alt-u` | Remove plugins no longer listed |

## Troubleshooting

Inspect tmux's effective bindings:

```bash
tmux list-keys
tmux show-options -g
```

If colors look wrong, verify the outer terminal supports 256 colors and run:

```bash
echo "$TERM"
tmux info
```

If plugins do not load, ensure `~/.tmux/plugins/tpm/tpm` exists and reload the configuration with `Prefix r`.
