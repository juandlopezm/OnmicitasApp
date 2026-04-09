import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface SelectProps extends React.ComponentProps<"select"> {
  placeholder?: string;
}

function Select({ className, children, placeholder, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground",
          "focus:ring-ring flex h-9 w-full appearance-none rounded-lg border px-3 py-1 pr-8 text-sm shadow-xs",
          "focus:outline-none focus:ring-[3px] focus:border-ring focus:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
    </div>
  )
}

function SelectItem({ className, ...props }: React.ComponentProps<"option">) {
  return <option className={cn("", className)} {...props} />
}

export { Select, SelectItem }
