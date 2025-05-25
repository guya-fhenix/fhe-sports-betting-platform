import { Badge as ChakraBadge } from "@chakra-ui/react"
import type { BadgeProps as ChakraBadgeProps } from "@chakra-ui/react"
import { forwardRef } from "react"

export interface BadgeProps extends Omit<ChakraBadgeProps, 'variant'> {
  variant?: "solid" | "outline" | "success" | "warning" | "error" | "betting" | "active" | "upcoming" | "ended"
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "solid", children, ...props }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "solid":
          return {
            bg: "brand.500",
            color: "white",
            variant: "solid" as const,
          }
        case "outline":
          return {
            borderWidth: "1px",
            borderColor: "brand.500",
            color: "brand.500",
            bg: "transparent",
            variant: "outline" as const,
          }
        case "success":
          return {
            bg: "success.500",
            color: "white",
            variant: "solid" as const,
          }
        case "warning":
          return {
            bg: "warning.500",
            color: "white",
            variant: "solid" as const,
          }
        case "error":
          return {
            bg: "error.500",
            color: "white",
            variant: "solid" as const,
          }
        case "betting":
          return {
            bg: "betting.placed",
            color: "white",
            variant: "solid" as const,
          }
        case "active":
          return {
            bg: "success.500",
            color: "white",
            variant: "solid" as const,
          }
        case "upcoming":
          return {
            bg: "brand.500",
            color: "white",
            variant: "solid" as const,
          }
        case "ended":
          return {
            bg: "gray.500",
            color: "white",
            variant: "solid" as const,
          }
        default:
          return {
            variant: "solid" as const,
          }
      }
    }

    const variantStyles = getVariantStyles()

    return (
      <ChakraBadge
        ref={ref}
        fontWeight="semibold"
        fontSize="xs"
        px={2}
        py={1}
        borderRadius="md"
        textTransform="uppercase"
        letterSpacing="wide"
        {...variantStyles}
        {...props}
      >
        {children}
      </ChakraBadge>
    )
  }
)

Badge.displayName = "Badge" 