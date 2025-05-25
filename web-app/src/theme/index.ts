import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

// Professional color palette for a betting platform
const colors = {
  // Primary brand colors - sophisticated blues and teals
  brand: {
    50: "#e6f7ff",
    100: "#bae7ff",
    200: "#91d5ff",
    300: "#69c0ff",
    400: "#40a9ff",
    500: "#1890ff", // Primary brand color
    600: "#096dd9",
    700: "#0050b3",
    800: "#003a8c",
    900: "#002766",
  },
  
  // Secondary colors - sophisticated greens for success states
  success: {
    50: "#f6ffed",
    100: "#d9f7be",
    200: "#b7eb8f",
    300: "#95de64",
    400: "#73d13d",
    500: "#52c41a", // Success green
    600: "#389e0d",
    700: "#237804",
    800: "#135200",
    900: "#092b00",
  },
  
  // Warning colors - professional oranges
  warning: {
    50: "#fff7e6",
    100: "#ffe7ba",
    200: "#ffd591",
    300: "#ffc069",
    400: "#ffa940",
    500: "#fa8c16", // Warning orange
    600: "#d46b08",
    700: "#ad4e00",
    800: "#873800",
    900: "#612500",
  },
  
  // Error colors - professional reds
  error: {
    50: "#fff2f0",
    100: "#ffccc7",
    200: "#ffa39e",
    300: "#ff7875",
    400: "#ff4d4f",
    500: "#f5222d", // Error red
    600: "#cf1322",
    700: "#a8071a",
    800: "#820014",
    900: "#5c0011",
  },
  
  // Neutral grays - professional and accessible
  gray: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e8e8e8",
    300: "#d9d9d9",
    400: "#bfbfbf",
    500: "#8c8c8c",
    600: "#595959",
    700: "#434343",
    800: "#262626",
    900: "#141414",
  },
  
  // Background colors for different contexts
  background: {
    primary: "#ffffff",
    secondary: "#fafafa",
    tertiary: "#f5f5f5",
    dark: "#001529",
    overlay: "rgba(0, 0, 0, 0.45)",
  },
  
  // Betting-specific colors
  betting: {
    win: "#52c41a",
    loss: "#f5222d",
    pending: "#fa8c16",
    placed: "#1890ff",
    available: "#595959",
  }
}

// Typography scale
const fonts = {
  heading: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
  body: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
  mono: `'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace`,
}

// Font sizes with consistent scale
const fontSizes = {
  xs: "0.75rem",    // 12px
  sm: "0.875rem",   // 14px
  md: "1rem",       // 16px
  lg: "1.125rem",   // 18px
  xl: "1.25rem",    // 20px
  "2xl": "1.5rem",  // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem",    // 48px
  "6xl": "3.75rem", // 60px
}

// Spacing scale
const space = {
  px: "1px",
  0.5: "0.125rem",  // 2px
  1: "0.25rem",     // 4px
  1.5: "0.375rem",  // 6px
  2: "0.5rem",      // 8px
  2.5: "0.625rem",  // 10px
  3: "0.75rem",     // 12px
  3.5: "0.875rem",  // 14px
  4: "1rem",        // 16px
  5: "1.25rem",     // 20px
  6: "1.5rem",      // 24px
  7: "1.75rem",     // 28px
  8: "2rem",        // 32px
  9: "2.25rem",     // 36px
  10: "2.5rem",     // 40px
  12: "3rem",       // 48px
  14: "3.5rem",     // 56px
  16: "4rem",       // 64px
  20: "5rem",       // 80px
  24: "6rem",       // 96px
  28: "7rem",       // 112px
  32: "8rem",       // 128px
}

// Breakpoints for responsive design
const breakpoints = {
  sm: "30em",    // 480px
  md: "48em",    // 768px
  lg: "62em",    // 992px
  xl: "80em",    // 1280px
  "2xl": "96em", // 1536px
}

// Shadows for depth
const shadows = {
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
}

// Border radius scale
const radii = {
  none: "0",
  sm: "0.125rem",   // 2px
  md: "0.375rem",   // 6px
  lg: "0.5rem",     // 8px
  xl: "0.75rem",    // 12px
  "2xl": "1rem",    // 16px
  "3xl": "1.5rem",  // 24px
  full: "9999px",
}

// Component-specific styles
const components = {
  Button: {
    baseStyle: {
      fontWeight: "semibold",
      borderRadius: "md",
      transition: "all 0.2s",
      _focus: {
        boxShadow: "outline",
      },
    },
    variants: {
      solid: {
        bg: "brand.500",
        color: "white",
        _hover: {
          bg: "brand.600",
          transform: "translateY(-1px)",
          boxShadow: "md",
        },
        _active: {
          bg: "brand.700",
          transform: "translateY(0)",
        },
      },
      outline: {
        borderColor: "brand.500",
        color: "brand.500",
        _hover: {
          bg: "brand.50",
          borderColor: "brand.600",
        },
      },
      ghost: {
        color: "brand.500",
        _hover: {
          bg: "brand.50",
        },
      },
      success: {
        bg: "success.500",
        color: "white",
        _hover: {
          bg: "success.600",
          transform: "translateY(-1px)",
          boxShadow: "md",
        },
      },
      warning: {
        bg: "warning.500",
        color: "white",
        _hover: {
          bg: "warning.600",
          transform: "translateY(-1px)",
          boxShadow: "md",
        },
      },
      error: {
        bg: "error.500",
        color: "white",
        _hover: {
          bg: "error.600",
          transform: "translateY(-1px)",
          boxShadow: "md",
        },
      },
    },
    sizes: {
      sm: {
        h: "8",
        px: "3",
        fontSize: "sm",
      },
      md: {
        h: "10",
        px: "4",
        fontSize: "md",
      },
      lg: {
        h: "12",
        px: "6",
        fontSize: "lg",
      },
    },
    defaultProps: {
      size: "md",
      variant: "solid",
    },
  },
  
  Card: {
    baseStyle: {
      bg: "background.primary",
      borderRadius: "lg",
      boxShadow: "sm",
      border: "1px solid",
      borderColor: "gray.200",
      overflow: "hidden",
      transition: "all 0.2s",
      _hover: {
        boxShadow: "md",
        transform: "translateY(-2px)",
      },
    },
    variants: {
      elevated: {
        boxShadow: "lg",
        _hover: {
          boxShadow: "xl",
        },
      },
      outline: {
        boxShadow: "none",
        borderWidth: "2px",
      },
      betting: {
        borderColor: "brand.200",
        _hover: {
          borderColor: "brand.400",
          boxShadow: "lg",
        },
      },
    },
  },
  
  Badge: {
    baseStyle: {
      fontWeight: "semibold",
      fontSize: "xs",
      px: "2",
      py: "1",
      borderRadius: "md",
    },
    variants: {
      solid: {
        bg: "brand.500",
        color: "white",
      },
      outline: {
        borderWidth: "1px",
        borderColor: "brand.500",
        color: "brand.500",
      },
      success: {
        bg: "success.500",
        color: "white",
      },
      warning: {
        bg: "warning.500",
        color: "white",
      },
      error: {
        bg: "error.500",
        color: "white",
      },
      betting: {
        bg: "betting.placed",
        color: "white",
      },
    },
  },
  
  Input: {
    baseStyle: {
      field: {
        borderRadius: "md",
        borderColor: "gray.300",
        _focus: {
          borderColor: "brand.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
        },
        _invalid: {
          borderColor: "error.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-error-500)",
        },
      },
    },
    variants: {
      outline: {
        field: {
          bg: "background.primary",
          _hover: {
            borderColor: "gray.400",
          },
        },
      },
    },
    sizes: {
      sm: {
        field: {
          h: "8",
          px: "3",
          fontSize: "sm",
        },
      },
      md: {
        field: {
          h: "10",
          px: "4",
          fontSize: "md",
        },
      },
      lg: {
        field: {
          h: "12",
          px: "4",
          fontSize: "lg",
        },
      },
    },
  },
  
  Heading: {
    baseStyle: {
      fontFamily: "heading",
      fontWeight: "bold",
      lineHeight: "1.2",
      color: "gray.800",
    },
    sizes: {
      xs: {
        fontSize: "md",
      },
      sm: {
        fontSize: "lg",
      },
      md: {
        fontSize: "xl",
      },
      lg: {
        fontSize: "2xl",
      },
      xl: {
        fontSize: "3xl",
      },
      "2xl": {
        fontSize: "4xl",
      },
      "3xl": {
        fontSize: "5xl",
      },
      "4xl": {
        fontSize: "6xl",
      },
    },
  },
  
  Text: {
    baseStyle: {
      fontFamily: "body",
      lineHeight: "1.5",
      color: "gray.700",
    },
    variants: {
      body: {
        fontSize: "md",
      },
      caption: {
        fontSize: "sm",
        color: "gray.500",
      },
      label: {
        fontSize: "sm",
        fontWeight: "medium",
        color: "gray.700",
      },
      value: {
        fontSize: "md",
        fontWeight: "semibold",
        color: "gray.800",
      },
    },
  },
}

// Global styles
const globalCss = {
  "*": {
    boxSizing: "border-box",
  },
  "html, body": {
    fontFamily: "body",
    lineHeight: "1.5",
    color: "gray.700",
    bg: "background.secondary",
  },
  "#root": {
    minHeight: "100vh",
  },
  // Custom scrollbar styles
  "::-webkit-scrollbar": {
    width: "8px",
  },
  "::-webkit-scrollbar-track": {
    bg: "gray.100",
  },
  "::-webkit-scrollbar-thumb": {
    bg: "gray.300",
    borderRadius: "full",
    _hover: {
      bg: "gray.400",
    },
  },
}

// Create the custom theme configuration using Chakra UI v3 syntax
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Primary brand colors - sophisticated blues
        brand: {
          50: { value: "#e6f7ff" },
          100: { value: "#bae7ff" },
          200: { value: "#91d5ff" },
          300: { value: "#69c0ff" },
          400: { value: "#40a9ff" },
          500: { value: "#1890ff" }, // Primary brand color
          600: { value: "#096dd9" },
          700: { value: "#0050b3" },
          800: { value: "#003a8c" },
          900: { value: "#002766" },
        },
        
        // Success colors - sophisticated greens
        success: {
          50: { value: "#f6ffed" },
          100: { value: "#d9f7be" },
          200: { value: "#b7eb8f" },
          300: { value: "#95de64" },
          400: { value: "#73d13d" },
          500: { value: "#52c41a" }, // Success green
          600: { value: "#389e0d" },
          700: { value: "#237804" },
          800: { value: "#135200" },
          900: { value: "#092b00" },
        },
        
        // Warning colors - professional oranges
        warning: {
          50: { value: "#fff7e6" },
          100: { value: "#ffe7ba" },
          200: { value: "#ffd591" },
          300: { value: "#ffc069" },
          400: { value: "#ffa940" },
          500: { value: "#fa8c16" }, // Warning orange
          600: { value: "#d46b08" },
          700: { value: "#ad4e00" },
          800: { value: "#873800" },
          900: { value: "#612500" },
        },
        
        // Error colors - professional reds
        error: {
          50: { value: "#fff2f0" },
          100: { value: "#ffccc7" },
          200: { value: "#ffa39e" },
          300: { value: "#ff7875" },
          400: { value: "#ff4d4f" },
          500: { value: "#f5222d" }, // Error red
          600: { value: "#cf1322" },
          700: { value: "#a8071a" },
          800: { value: "#820014" },
          900: { value: "#5c0011" },
        },
        
        // Betting-specific colors
        betting: {
          win: { value: "#52c41a" },
          loss: { value: "#f5222d" },
          pending: { value: "#fa8c16" },
          placed: { value: "#1890ff" },
          available: { value: "#595959" },
        }
      },
      
      fonts: {
        heading: { value: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` },
        body: { value: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` },
        mono: { value: `'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace` },
      },
      
      fontSizes: {
        xs: { value: "0.75rem" },
        sm: { value: "0.875rem" },
        md: { value: "1rem" },
        lg: { value: "1.125rem" },
        xl: { value: "1.25rem" },
        "2xl": { value: "1.5rem" },
        "3xl": { value: "1.875rem" },
        "4xl": { value: "2.25rem" },
        "5xl": { value: "3rem" },
        "6xl": { value: "3.75rem" },
      },
      
      spacing: {
        0.5: { value: "0.125rem" },
        1: { value: "0.25rem" },
        1.5: { value: "0.375rem" },
        2: { value: "0.5rem" },
        2.5: { value: "0.625rem" },
        3: { value: "0.75rem" },
        3.5: { value: "0.875rem" },
        4: { value: "1rem" },
        5: { value: "1.25rem" },
        6: { value: "1.5rem" },
        7: { value: "1.75rem" },
        8: { value: "2rem" },
        9: { value: "2.25rem" },
        10: { value: "2.5rem" },
        12: { value: "3rem" },
        14: { value: "3.5rem" },
        16: { value: "4rem" },
        20: { value: "5rem" },
        24: { value: "6rem" },
        28: { value: "7rem" },
        32: { value: "8rem" },
      },
      
      breakpoints: {
        sm: { value: "30em" },
        md: { value: "48em" },
        lg: { value: "62em" },
        xl: { value: "80em" },
        "2xl": { value: "96em" },
      },
      
      shadows: {
        xs: { value: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" },
        sm: { value: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" },
        md: { value: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" },
        lg: { value: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" },
        xl: { value: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" },
        "2xl": { value: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" },
        inner: { value: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)" },
      },
      
      radii: {
        none: { value: "0" },
        sm: { value: "0.125rem" },
        md: { value: "0.375rem" },
        lg: { value: "0.5rem" },
        xl: { value: "0.75rem" },
        "2xl": { value: "1rem" },
        "3xl": { value: "1.5rem" },
        full: { value: "9999px" },
      },
    },
  },
})

// Create and export the system
export const system = createSystem(defaultConfig, config)
export default system 