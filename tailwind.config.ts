import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Colours and fonts are CSS variables (src/index.css), so the two looks
// (editorial, minimal) are a data-look attribute on <html>.
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				display: ["var(--font-display)"],
				body: ["var(--font-body)"],
				ui: ["var(--font-ui)"],
				sans: ["var(--font-ui)"],
			},
			colors: {
				paper: "rgb(var(--paper) / <alpha-value>)",
				panel: "rgb(var(--panel) / <alpha-value>)",
				ink: "rgb(var(--ink) / <alpha-value>)",
				"ink-2": "rgb(var(--ink-2) / <alpha-value>)",
				"ink-3": "rgb(var(--ink-3) / <alpha-value>)",
				rule: "rgb(var(--rule) / <alpha-value>)",
				"rule-soft": "rgb(var(--rule-soft) / <alpha-value>)",
				brand: "rgb(var(--brand) / <alpha-value>)",
				good: "rgb(var(--good) / <alpha-value>)",
				bad: "rgb(var(--bad) / <alpha-value>)",
				series: {
					1: "rgb(var(--series-1) / <alpha-value>)",
					2: "rgb(var(--series-2) / <alpha-value>)",
				},
				// shadcn primitives (popover, command) read these
				border: "rgb(var(--rule-soft))",
				input: "rgb(var(--rule-soft))",
				ring: "rgb(var(--brand))",
				background: "rgb(var(--paper))",
				foreground: "rgb(var(--ink))",
				popover: { DEFAULT: "rgb(var(--panel))", foreground: "rgb(var(--ink))" },
				accent: { DEFAULT: "rgb(var(--rule-soft))", foreground: "rgb(var(--ink))" },
				muted: { DEFAULT: "rgb(var(--rule-soft))", foreground: "rgb(var(--ink-2))" },
				primary: { DEFAULT: "rgb(var(--ink))", foreground: "rgb(var(--paper))" },
				secondary: { DEFAULT: "rgb(var(--rule-soft))", foreground: "rgb(var(--ink))" },
				destructive: { DEFAULT: "rgb(var(--bad))", foreground: "rgb(var(--paper))" },
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
		},
	},
	plugins: [animate],
} satisfies Config;
