# Neovim Configuration

A Lua-based Neovim environment focused on code navigation, language tooling, completion, Git awareness, and a clean Catppuccin interface.

## Files

```text
nvim/.config/nvim/
├── init.lua          # options, keymaps, and plugin configuration
├── lua/plugins.lua   # lazy.nvim plugin specification
├── lazy-lock.json    # reproducible plugin revisions
└── .luarc.json       # Lua diagnostics recognize the `vim` global
```

The exported `pi-session-*.html` file found in the original local directory is intentionally excluded because it is session output, not editor configuration.

## Installation

Use the repository installer:

```bash
./install.sh --apply
```

Or link only Neovim:

```bash
mkdir -p ~/.config
ln -s ~/Codes/repos/dotfiles/nvim/.config/nvim ~/.config/nvim
```

On first launch, `init.lua` bootstraps stable [lazy.nvim](https://github.com/folke/lazy.nvim). lazy.nvim then installs the declared plugins.

Recommended prerequisites:

```bash
brew install neovim git ripgrep fd
```

Also install a Nerd Font for file icons. Mason can install configured language servers from inside Neovim.

## Core behavior

- Leader key: `Space`
- Absolute line numbers enabled
- Catppuccin Mocha colorscheme
- Lualine status line
- Treesitter highlighting and indentation
- Telescope searching with generated/build directories ignored
- Neo-tree file browser
- Mason-managed language servers
- none-ls formatting and spell completion
- nvim-cmp completion backed by LSP and LuaSnip

## Keybindings

### Navigation and search

| Keys | Mode | Action |
|---|---|---|
| `Ctrl-p` | Normal | Telescope file finder |
| `Space f g` | Normal | Telescope live grep |
| `Ctrl-n` | Normal | Reveal the current file in Neo-tree on the left |

Telescope ignores common generated artifacts such as `node_modules`, `.git`, `__pycache__`, compiled objects, archives, lockfiles, `target`, `build`, and `dist`.

### Language Server Protocol

| Keys | Mode | Action |
|---|---|---|
| `K` | Normal | Show hover documentation |
| `gD` | Normal | Jump to definition |
| `Space c a` | Normal/Visual | Show code actions |
| `Space g f` | Normal | Format the active buffer |

Configured servers:

- `lua_ls` — Lua
- `clangd` — C/C++
- `jsonls` — JSON, installed through Mason
- `pyright` — Python
- `rust_analyzer` — Rust, installed through Mason
- `tinymist` — Typst

Explicit setup calls currently exist for Pyright, clangd, lua_ls, and Tinymist.

### Completion

| Keys | Action |
|---|---|
| `Ctrl-Space` | Open completion menu |
| `Ctrl-e` | Abort completion |
| `Enter` | Confirm selected item |
| `Tab` | Next item or expand/jump through a snippet |
| `Shift-Tab` | Previous item or jump backward in a snippet |
| `Ctrl-b` / `Ctrl-f` | Scroll completion documentation |

## Plugins

| Plugin | Purpose |
|---|---|
| `catppuccin/nvim` | Mocha colorscheme |
| `nvim-telescope/telescope.nvim` | File and text search |
| `telescope-ui-select.nvim` | Telescope UI for selection prompts |
| `nvim-treesitter` | Parser-based highlighting and indentation |
| `neo-tree.nvim` | Filesystem browser |
| `lualine.nvim` | Status line |
| `mason.nvim` | External language-tool installer |
| `mason-lspconfig.nvim` | Mason/LSP integration |
| `nvim-lspconfig` | LSP client configurations |
| `none-ls.nvim` | Formatting and diagnostics sources |
| `alpha-nvim` | Startup dashboard |
| `gitsigns.nvim` | Git changes in the sign column |
| `vimtex` | LaTeX editing support |
| `nvim-cmp` | Completion engine |
| `cmp-nvim-lsp` | LSP completion source |
| `LuaSnip` | Snippet engine |
| `cmp_luasnip` | LuaSnip completion source |
| `friendly-snippets` | Community snippet collection |
| `no-neck-pain.nvim` | Centered, distraction-reduced editing |
| `markdown-preview.nvim` | Browser-based Markdown preview |

## Useful commands

| Command | Purpose |
|---|---|
| `:Lazy` | Open plugin manager |
| `:Lazy sync` | Install/update/remove plugins to match the spec |
| `:Mason` | Open the language-tool manager |
| `:LspInfo` | Inspect attached LSP clients |
| `:checkhealth` | Diagnose Neovim and plugin requirements |
| `:TSUpdate` | Update Treesitter parsers |
| `:Neotree` | Open or control Neo-tree |
| `:MarkdownPreview` | Start Markdown preview |
| `:MarkdownPreviewStop` | Stop Markdown preview |
| `:NoNeckPain` | Toggle centered editing |

## Formatting

none-ls defines these sources:

- Stylua for Lua
- Black for Python formatting
- isort for Python import ordering
- spell completion

Install the external executables separately if they are not available:

```bash
brew install stylua
python3 -m pip install black isort
```

## Maintenance

After editing `lua/plugins.lua`:

```vim
:Lazy sync
```

Commit `lazy-lock.json` so another machine can reproduce the same plugin revisions. Validate changes with:

```vim
:checkhealth
:Lazy health
```
