import type { InputHTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  icon?: IconName
  startAdornment?: ReactNode
  endAdornment?: ReactNode
}

function TextField({
  id,
  label,
  error,
  icon,
  startAdornment,
  endAdornment,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        {startAdornment ?? (icon && <Icon name={icon} className="field-icon" />)}
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
