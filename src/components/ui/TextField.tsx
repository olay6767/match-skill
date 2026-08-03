import type { InputHTMLAttributes, ReactNode } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  iconClassName?: string
  endAdornment?: ReactNode
}

function TextField({
  id,
  label,
  error,
  iconClassName,
  endAdornment,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        {iconClassName && (
          <span className={`field-icon ${iconClassName}`} aria-hidden="true" />
        )}
        <input
          {...inputProps}
          id={id}
          aria-invalid={error ? true : inputProps['aria-invalid']}
          aria-describedby={error ? errorId : inputProps['aria-describedby']}
        />
        {endAdornment}
      </div>
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  )
}

export default TextField
