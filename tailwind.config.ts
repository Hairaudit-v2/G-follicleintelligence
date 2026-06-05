import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Satoshi", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: [
          "Iowan Old Style",
          "Palatino Linotype",
          "Book Antiqua",
          "Georgia",
          "ui-serif",
          "serif",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        "fi-panel":
          "0 16px 50px rgb(1 5 12 / 48%), inset 0 1px 0 rgb(255 255 255 / 4%)",
        "fi-event": "0 1px 2px 0 rgb(15 23 42 / 8%)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        fi: {
          procedure: {
            consult: {
              DEFAULT: "hsl(var(--fi-procedure-pre-surgery-consult-base))",
              foreground: "hsl(var(--fi-procedure-pre-surgery-consult-foreground))",
              muted: "hsl(var(--fi-procedure-pre-surgery-consult-muted))",
            },
            transplant: {
              DEFAULT: "hsl(var(--fi-procedure-full-transplant-base))",
              foreground: "hsl(var(--fi-procedure-full-transplant-foreground))",
              muted: "hsl(var(--fi-procedure-full-transplant-muted))",
            },
            prp: {
              DEFAULT: "hsl(var(--fi-procedure-prp-session-base))",
              foreground: "hsl(var(--fi-procedure-prp-session-foreground))",
              muted: "hsl(var(--fi-procedure-prp-session-muted))",
            },
            followup: {
              DEFAULT: "hsl(var(--fi-procedure-follow-up-nurse-prp-base))",
              foreground: "hsl(var(--fi-procedure-follow-up-nurse-prp-foreground))",
              muted: "hsl(var(--fi-procedure-follow-up-nurse-prp-muted))",
            },
            virtual: {
              DEFAULT: "hsl(var(--fi-procedure-virtual-zoom-base))",
              foreground: "hsl(var(--fi-procedure-virtual-zoom-foreground))",
              muted: "hsl(var(--fi-procedure-virtual-zoom-muted))",
            },
          },
          status: {
            confirmed: {
              DEFAULT: "hsl(var(--fi-status-confirmed-base))",
              foreground: "hsl(var(--fi-status-confirmed-foreground))",
              muted: "hsl(var(--fi-status-confirmed-muted))",
            },
            arrived: {
              DEFAULT: "hsl(var(--fi-status-arrived-base))",
              foreground: "hsl(var(--fi-status-arrived-foreground))",
              muted: "hsl(var(--fi-status-arrived-muted))",
            },
            completed: {
              DEFAULT: "hsl(var(--fi-status-completed-base))",
              foreground: "hsl(var(--fi-status-completed-foreground))",
              muted: "hsl(var(--fi-status-completed-muted))",
            },
            "no-show": {
              DEFAULT: "hsl(var(--fi-status-no-show-base))",
              foreground: "hsl(var(--fi-status-no-show-foreground))",
              muted: "hsl(var(--fi-status-no-show-muted))",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
