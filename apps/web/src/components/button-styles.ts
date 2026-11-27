/** Shared look of actions, also for links that read as buttons (Design System — Button). */
const baseButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-pill py-2 font-semibold aria-disabled:cursor-wait aria-disabled:opacity-80';

const sizeClass = {
  md: 'min-h-11 px-5 text-base',
  /** Main actions of public screens (SCRUM-56). */
  lg: 'min-h-14 px-8 text-lg',
} as const;
export type ButtonSize = keyof typeof sizeClass;

const variantClass = {
  primary:
    'border-2 border-brand-primary bg-brand-primary text-on-brand hover:border-brand-primary-hover hover:bg-brand-primary-hover',
  secondary:
    'border-2 border-brand-primary bg-surface text-brand-primary hover:bg-accent-soft hover:text-on-accent-soft',
} as const;
export type ButtonVariant = keyof typeof variantClass;

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md') =>
  `${baseButtonClass} ${sizeClass[size]} ${variantClass[variant]}`;

export const primaryButtonClass = buttonClass('primary');
export const secondaryButtonClass = buttonClass('secondary');
