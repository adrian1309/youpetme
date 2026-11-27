import { Eye, EyeOff } from 'lucide-react';
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
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-pill text-brand-primary hover:bg-accent-soft"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      }
    />
  );
}
