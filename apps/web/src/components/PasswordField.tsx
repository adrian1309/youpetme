import { useState } from 'react';

import { TextField, type TextFieldProps } from './TextField';

interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'endAdornment'> {
  /** Accessible names of the toggle, already translated. */
  showLabel: string;
  hideLabel: string;
}

/**
 * Password input with a show/hide toggle (Design System — Password fields). Pasting is never
 * blocked, so password managers keep working.
 */
export function PasswordField({ showLabel, hideLabel, ...fieldProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...fieldProps}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="min-h-11 min-w-11 rounded-control text-sm font-medium text-brand-primary underline"
        >
          {visible ? hideLabel : showLabel}
        </button>
      }
    />
  );
}
