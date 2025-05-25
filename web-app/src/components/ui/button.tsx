import { Button as ChakraButton } from "@chakra-ui/react"
import type { ButtonProps as ChakraButtonProps } from "@chakra-ui/react"
import { forwardRef } from "react"

export interface ButtonProps extends Omit<ChakraButtonProps, 'variant' | 'size'> {
  variant?: "solid" | "outline" | "ghost" | "success" | "warning" | "error" | "betting"
  size?: "sm" | "md" | "lg"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "solid", size = "md", children, ...props }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "solid":
          return {
            bg: "brand.500",
            color: "white",
            variant: "solid" as const,
            _hover: {
              bg: "brand.600",
              transform: "translateY(-1px)",
              boxShadow: "md",
            },
            _active: {
              bg: "brand.700",
              transform: "translateY(0)",
            },
          }
        case "outline":
          return {
            borderColor: "brand.500",
            color: "brand.500",
            variant: "outline" as const,
            _hover: {
              bg: "brand.50",
              borderColor: "brand.600",
            },
          }
        case "ghost":
          return {
            color: "brand.500",
            variant: "ghost" as const,
            _hover: {
              bg: "brand.50",
            },
          }
        case "success":
          return {
            bg: "success.500",
            color: "white",
            variant: "solid" as const,
            _hover: {
              bg: "success.600",
              transform: "translateY(-1px)",
              boxShadow: "md",
            },
            _active: {
              bg: "success.700",
              transform: "translateY(0)",
            },
          }
        case "warning":
          return {
            bg: "warning.500",
            color: "white",
            variant: "solid" as const,
            _hover: {
              bg: "warning.600",
              transform: "translateY(-1px)",
              boxShadow: "md",
            },
            _active: {
              bg: "warning.700",
              transform: "translateY(0)",
            },
          }
        case "error":
          return {
            bg: "error.500",
            color: "white",
            variant: "solid" as const,
            _hover: {
              bg: "error.600",
              transform: "translateY(-1px)",
              boxShadow: "md",
            },
            _active: {
              bg: "error.700",
              transform: "translateY(0)",
            },
          }
        case "betting":
          return {
            bg: "betting.placed",
            color: "white",
            variant: "solid" as const,
            _hover: {
              bg: "brand.600",
              transform: "translateY(-1px)",
              boxShadow: "md",
            },
            _active: {
              bg: "brand.700",
              transform: "translateY(0)",
            },
          }
        default:
          return {
            variant: "solid" as const,
          }
      }
    }

    const getSizeStyles = () => {
      switch (size) {
        case "sm":
          return {
            h: "8",
            px: "3",
            fontSize: "sm",
            size: "sm" as const,
          }
        case "md":
          return {
            h: "10",
            px: "4",
            fontSize: "md",
            size: "md" as const,
          }
        case "lg":
          return {
            h: "12",
            px: "6",
            fontSize: "lg",
            size: "lg" as const,
          }
        default:
          return {
            size: "md" as const,
          }
      }
    }

    const variantStyles = getVariantStyles()
    const sizeStyles = getSizeStyles()

    return (
      <ChakraButton
        ref={ref}
        fontWeight="semibold"
        borderRadius="md"
        transition="all 0.2s ease-in-out"
        _focus={{
          boxShadow: "outline",
        }}
        {...sizeStyles}
        {...variantStyles}
        {...props}
      >
        {children}
      </ChakraButton>
    )
  }
)

Button.displayName = "Button" 