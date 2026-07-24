-- ~/.config/nvim/init.lua

vim.g.mapleader = " "
vim.wo.relativenumber = false
vim.wo.number = true

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup("plugins")

-- Telescope keymaps
local builtin = require('telescope.builtin')
vim.keymap.set('n', '<C-p>', builtin.find_files, {})
vim.keymap.set('n', '<leader>fg', builtin.live_grep, {})

-- Neotree
vim.keymap.set('n','<C-n>',':Neotree filesystem reveal left<CR>',{})

-- Treesitter
require("nvim-treesitter.configs").setup {
  auto_install = true,
  highlight = { enable = true },
  indent = { enable = true },
}

-- Catppuccin theme
require("catppuccin").setup {
  flavour = "mocha",
  integrations = {
    cmp = true,
    gitsigns = true,
    nvimtree = true,
    treesitter = true,
    notify = false,
  },
}
vim.cmd.colorscheme "catppuccin"

-- Lualine
require('lualine').setup {
  options = { theme = 'catppuccin' }
}

-- Mason & LSP
require("mason").setup()
require("mason-lspconfig").setup {
  ensure_installed = { "lua_ls", "clangd", "jsonls", "pyright", "rust_analyzer", "tinymist" },
}
local lspconfig = require("lspconfig")
lspconfig.pyright.setup({})
lspconfig.clangd.setup({})
lspconfig.lua_ls.setup({})
lspconfig.tinymist.setup({})

-- Keymaps for LSP
vim.keymap.set('n', 'K', function() vim.lsp.buf.hover() end, {})
vim.keymap.set('n','gD',function() vim.lsp.buf.definition() end, {})
vim.keymap.set({'n','v'},'<leader>ca', function() vim.lsp.buf.code_action() end, {})

-- null-ls
local null_ls = require("null-ls")
null_ls.setup {
  sources = {
    null_ls.builtins.formatting.stylua,
    null_ls.builtins.completion.spell,
    null_ls.builtins.formatting.black,
    null_ls.builtins.formatting.isort,
  },
}
vim.keymap.set('n','<leader>gf',function() vim.lsp.buf.format() end,{})

-- Alpha dashboard
local alpha = require("alpha")
local dashboard = require("alpha.themes.dashboard")
dashboard.section.header.val = {
  [[N E O V I M]],
  [[___________]],
}
dashboard.section.buttons.val = {
  dashboard.button("e", "New file", ":ene <BAR> startinsert <CR>"),
  dashboard.button("f", "Find file", builtin.find_files),
  dashboard.button("g", "Live grep", builtin.live_grep),
  dashboard.button("q", "Quit", ":qa<CR>"),
}
alpha.setup(dashboard.opts)

-- Gitsigns
require("gitsigns").setup()
require("no-neck-pain").setup()

-- ~CMP & LuaSnip Setup~
local cmp = require("cmp")
local luasnip = require("luasnip")

require("luasnip.loaders.from_vscode").lazy_load()

cmp.setup({
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },
  mapping = cmp.mapping.preset.insert({
    ["<C-b>"] = cmp.mapping.scroll_docs(-4),
    ["<C-f>"] = cmp.mapping.scroll_docs(4),
    ["<C-Space>"] = cmp.mapping.complete(),
    ["<C-e>"] = cmp.mapping.abort(),
    ["<CR>"] = cmp.mapping.confirm({ select = true }),
    ["<Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_next_item()
      elseif luasnip.expand_or_jumpable() then
        luasnip.expand_or_jump()
      else
        fallback()
      end
    end, { "i", "s" }),
    ["<S-Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_prev_item()
      elseif luasnip.jumpable(-1) then
        luasnip.jump(-1)
      else
        fallback()
      end
    end, { "i", "s" }),
  }),
  sources = cmp.config.sources({
    { name = "nvim_lsp" },
    { name = "luasnip" },
  }, {
    { name = "buffer" },
  }),
})

-- Telescope file ignore patterns
local telescope = require("telescope")
telescope.setup {
  defaults = {
    file_ignore_patterns = {
      "node_modules",
      "%.git",
      "__pycache__",
      ".cache",
      "%.o",
      "%.exe",
      "%.dll",
      "%.so",
      "%.dylib",
      "%.a",
      "%.out",
      "%.class",
      "%.jar",
      "%.war",
      "%.zip",
      "%.tar",
      "%.gz",
      "%.7z",
      "target",
      "build",
      "dist",
      "%.lock",
      "package-lock.json",
      "yarn.lock",
    },
  },
  extensions = {
    ["ui-select"] = {
      require("telescope.themes").get_dropdown {}
    }
  },
}
telescope.load_extension("ui-select")
