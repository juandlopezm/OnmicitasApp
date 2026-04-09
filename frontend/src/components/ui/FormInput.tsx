import type { InputHTMLAttributes } from 'react'
import { Input } from './input'
import { Label } from './label'

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
}

export function FormInput({ label, error, id, ...props }: FormInputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '_')

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <Label htmlFor={inputId}>
        {label}
        {props.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={inputId}
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
