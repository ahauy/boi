import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-gold/25 bg-surface-soft/80 px-3.5 py-2 text-sm text-ink shadow-inner ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ash focus-visible:outline-none focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
