/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./imports/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Maersk Brand Colors
        'maersk-blue': 'var(--maersk-blue)',
        'maersk-white': 'var(--maersk-white)',
        'maersk-black': 'var(--maersk-black)',
        
        // Functional Blues
        'functional-dark-blue': 'var(--functional-dark-blue)',
        'functional-mid-blue': 'var(--functional-mid-blue)',
        'functional-light-blue': 'var(--functional-light-blue)',
        'functional-bright-blue': 'var(--functional-bright-blue)',
        
        // Functional Greys
        'functional-dark-grey': 'var(--functional-dark-grey)',
        'functional-mid-grey': 'var(--functional-mid-grey)',
        'functional-light-grey': 'var(--functional-light-grey)',
        'functional-bright-grey': 'var(--functional-bright-grey)',
        
        // Accent Teals
        'accent-dark-teal': 'var(--accent-dark-teal)',
        'accent-mid-teal': 'var(--accent-mid-teal)',
        'accent-light-teal': 'var(--accent-light-teal)',
        'accent-bright-teal': 'var(--accent-bright-teal)',
        
        // Accent Greens
        'accent-dark-green': 'var(--accent-dark-green)',
        'accent-mid-green': 'var(--accent-mid-green)',
        'accent-light-green': 'var(--accent-light-green)',
        'accent-bright-green': 'var(--accent-bright-green)',
        
        // Accent Oranges
        'accent-dark-orange': 'var(--accent-dark-orange)',
        'accent-mid-orange': 'var(--accent-mid-orange)',
        'accent-light-orange': 'var(--accent-light-orange)',
        'accent-bright-orange': 'var(--accent-bright-orange)',
        
        // Accent Reds
        'accent-dark-red': 'var(--accent-dark-red)',
        'accent-mid-red': 'var(--accent-mid-red)',
        'accent-light-red': 'var(--accent-light-red)',
        'accent-bright-red': 'var(--accent-bright-red)',
        
        // shadcn/ui colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Chart colors
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        'maersk-text': ['Maersk Text', 'system-ui', 'sans-serif'],
        'maersk-headline': ['Maersk Headline', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
  darkMode: ["class"],
}