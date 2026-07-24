return {
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 },

  {
    'nvim-telescope/telescope.nvim', tag = '0.1.6',
    dependencies = { 'nvim-lua/plenary.nvim' }
  },

  { "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" },

  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons", -- optional, for file icons
      "MunifTanjim/nui.nvim",
      -- "3rd/image.nvim", -- optional image support
    }
  },

  {
    'nvim-lualine/lualine.nvim',
    dependencies = { 'nvim-tree/nvim-web-devicons' }
  },

  { "williamboman/mason.nvim" },

  { "williamboman/mason-lspconfig.nvim" },

  { "neovim/nvim-lspconfig" },

  { 'nvim-telescope/telescope-ui-select.nvim' },

  { "nvimtools/none-ls.nvim" },

  {
    "goolord/alpha-nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
  },

  -- Add gitsigns plugin
  { "lewis6991/gitsigns.nvim" },

  -- Add vimtex plugin
  { "lervag/vimtex" },

  -- Plugin for nvim-cmp LSP support
  { "hrsh7th/cmp-nvim-lsp" },

  -- Plugin for LuaSnip snippet support
  {
    "L3MON4D3/LuaSnip",
    dependencies = {
      "saadparwaiz1/cmp_luasnip",
      "rafamadriz/friendly-snippets",
    },
  },

  -- Plugin for nvim-cmp autocompletion
  {
    "hrsh7th/nvim-cmp",
    config = function()
      -- Configure nvim-cmp here, or in init.lua
    end,
  },

  {"shortcuts/no-neck-pain.nvim", version = "*"},

{
    "iamcco/markdown-preview.nvim",
    ft = "markdown",
    build = ":call mkdp#util#install()",
    config = function()
      vim.g.mkdp_auto_start = 0
      vim.g.mkdp_auto_close = 1
      vim.g.mkdp_refresh_slow = 0
      vim.g.mkdp_browser = "" -- Uses default browser
    end,
  },
}
