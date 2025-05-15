import * as React from "react"
import { cn } from "../../lib/utils"

// Definieer de varianten zonder class-variance-authority
const badgeVariantStyles = {
  default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
  outline: "text-foreground",
  success: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
  warning: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
};

export type BadgeVariant = keyof typeof badgeVariantStyles;

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariantStyles[variant as BadgeVariant],
        className
      )}
      {...props}
    />
  )
}

// Voor backward compatibility
const badgeVariants = {
  variant: badgeVariantStyles,
  defaultVariants: {
    variant: "default",
  },
};

export { Badge, badgeVariants }