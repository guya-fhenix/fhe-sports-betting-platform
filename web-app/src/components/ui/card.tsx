import { Box } from "@chakra-ui/react"
import type { BoxProps } from "@chakra-ui/react"
import { forwardRef } from "react"

export interface CardProps extends BoxProps {
  variant?: "elevated" | "outline" | "betting" | "default"
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", children, ...props }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "elevated":
          return {
            boxShadow: "lg",
            _hover: {
              boxShadow: "xl",
              transform: "translateY(-2px)",
            },
          }
        case "outline":
          return {
            boxShadow: "none",
            borderWidth: "2px",
            borderColor: "gray.200",
            _hover: {
              borderColor: "brand.300",
            },
          }
        case "betting":
          return {
            borderColor: "brand.200",
            _hover: {
              borderColor: "brand.400",
              boxShadow: "lg",
              transform: "translateY(-2px)",
            },
          }
        default:
          return {
            boxShadow: "sm",
            _hover: {
              boxShadow: "md",
              transform: "translateY(-1px)",
            },
          }
      }
    }

    return (
      <Box
        ref={ref}
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        overflow="hidden"
        transition="all 0.2s ease-in-out"
        {...getVariantStyles()}
        {...props}
      >
        {children}
      </Box>
    )
  }
)

Card.displayName = "Card"

export const CardHeader = forwardRef<HTMLDivElement, BoxProps>(
  ({ children, ...props }, ref) => (
    <Box ref={ref} p={6} pb={0} {...props}>
      {children}
    </Box>
  )
)

CardHeader.displayName = "CardHeader"

export const CardBody = forwardRef<HTMLDivElement, BoxProps>(
  ({ children, ...props }, ref) => (
    <Box ref={ref} p={6} {...props}>
      {children}
    </Box>
  )
)

CardBody.displayName = "CardBody"

export const CardFooter = forwardRef<HTMLDivElement, BoxProps>(
  ({ children, ...props }, ref) => (
    <Box ref={ref} p={6} pt={0} {...props}>
      {children}
    </Box>
  )
)

CardFooter.displayName = "CardFooter" 