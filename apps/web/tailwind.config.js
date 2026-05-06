/**
 * DUSK Tailwind Configuration
 * --------------------------------------------------------------------------
 * The config maps Tailwind utility names to design tokens (CSS variables).
 * This means utilities like bg-surface-1, text-muted, border-default
 * automatically respect light/dark mode without writing dark: variants.
 *
 * Brand color "fuchsia" is preserved for backward compat but NEW code
 * should prefer "brand" which is semantic.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand (semantic alias)
        brand: {
          50:  'var(--dusk-brand-50)',
          100: 'var(--dusk-brand-100)',
          200: 'var(--dusk-brand-200)',
          300: 'var(--dusk-brand-300)',
          400: 'var(--dusk-brand-400)',
          500: 'var(--dusk-brand-500)',
          600: 'var(--dusk-brand-600)',
          700: 'var(--dusk-brand-700)',
          800: 'var(--dusk-brand-800)',
          900: 'var(--dusk-brand-900)',
          950: 'var(--dusk-brand-950)',
        },

        // Backward-compat alias (DO NOT use in new code)
        fuchsia: {
          500: 'var(--dusk-brand-500)',
          600: 'var(--dusk-brand-600)',
        },

        // Surfaces
        bg:                 'var(--dusk-bg)',
        'surface-1':        'var(--dusk-surface-1)',
        'surface-2':        'var(--dusk-surface-2)',
        'surface-muted':    'var(--dusk-surface-muted)',
        'surface-hover':    'var(--dusk-surface-hover)',
        'surface-active':   'var(--dusk-surface-active)',

        // Text
        'text-primary':     'var(--dusk-text-primary)',
        'text-secondary':   'var(--dusk-text-secondary)',
        'text-muted':       'var(--dusk-text-muted)',
        'text-soft':        'var(--dusk-text-soft)',
        'text-inverse':     'var(--dusk-text-inverse)',
        'text-brand':       'var(--dusk-text-brand)',

        // Borders
        'border-subtle':    'var(--dusk-border-subtle)',
        'border-default':   'var(--dusk-border-default)',
        'border-strong':    'var(--dusk-border-strong)',
      },

      fontFamily: {
        display: 'var(--dusk-font-display)',
        body:    'var(--dusk-font-body)',
        mono:    'var(--dusk-font-mono)',
        sans:    'var(--dusk-font-body)',
      },

      fontSize: {
        xs:   ['var(--dusk-text-xs)',   { lineHeight: 'var(--dusk-leading-normal)' }],
        sm:   ['var(--dusk-text-sm)',   { lineHeight: 'var(--dusk-leading-normal)' }],
        base: ['var(--dusk-text-base)', { lineHeight: 'var(--dusk-leading-normal)' }],
        lg:   ['var(--dusk-text-lg)',   { lineHeight: 'var(--dusk-leading-snug)'   }],
        xl:   ['var(--dusk-text-xl)',   { lineHeight: 'var(--dusk-leading-snug)'   }],
        '2xl':['var(--dusk-text-2xl)',  { lineHeight: 'var(--dusk-leading-tight)'  }],
        '3xl':['var(--dusk-text-3xl)',  { lineHeight: 'var(--dusk-leading-tight)'  }],
        '4xl':['var(--dusk-text-4xl)',  { lineHeight: 'var(--dusk-leading-tight)'  }],
        '5xl':['var(--dusk-text-5xl)',  { lineHeight: 'var(--dusk-leading-tight)'  }],
      },

      letterSpacing: {
        tight:  'var(--dusk-tracking-tight)',
        normal: 'var(--dusk-tracking-normal)',
        wide:   'var(--dusk-tracking-wide)',
        kicker: 'var(--dusk-tracking-kicker)',
      },

      borderRadius: {
        sm:     'var(--dusk-radius-sm)',
        md:     'var(--dusk-radius-md)',
        DEFAULT:'var(--dusk-radius-lg)',
        lg:     'var(--dusk-radius-lg)',
        xl:     'var(--dusk-radius-xl)',
        '2xl':  'var(--dusk-radius-2xl)',
        '3xl':  'var(--dusk-radius-3xl)',
        full:   'var(--dusk-radius-full)',
      },

      boxShadow: {
        1:        'var(--dusk-shadow-1)',
        2:        'var(--dusk-shadow-2)',
        3:        'var(--dusk-shadow-3)',
        4:        'var(--dusk-shadow-4)',
        overlay:  'var(--dusk-shadow-overlay)',
        brand:    'var(--dusk-shadow-brand)',
        focus:    'var(--dusk-focus-ring)',
      },

      spacing: {
        // The 4px scale exists in tokens.css; Tailwind's default scale
        // already aligns. We expose token-based aliases for explicit usage.
        'page-x': 'var(--dusk-content-pad-x)',
        'page-y': 'var(--dusk-content-pad-y)',
      },

      maxWidth: {
        content: 'var(--dusk-content-max)',
      },

      zIndex: {
        dropdown: 'var(--dusk-z-dropdown)',
        sticky:   'var(--dusk-z-sticky)',
        overlay:  'var(--dusk-z-overlay)',
        modal:    'var(--dusk-z-modal)',
        toast:    'var(--dusk-z-toast)',
        tooltip:  'var(--dusk-z-tooltip)',
      },

      transitionDuration: {
        fast: 'var(--dusk-duration-fast)',
        base: 'var(--dusk-duration-base)',
        slow: 'var(--dusk-duration-slow)',
      },

      transitionTimingFunction: {
        standard: 'var(--dusk-ease-standard)',
        enter:    'var(--dusk-ease-enter)',
        exit:     'var(--dusk-ease-exit)',
      },

      backgroundImage: {
        'brand-gradient': 'var(--dusk-brand-gradient)',
      },
    },
  },
  plugins: [],
};
