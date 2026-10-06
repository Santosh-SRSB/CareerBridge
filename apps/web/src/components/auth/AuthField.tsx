import type { ReactNode } from 'react';

export function authFieldDescribedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function AuthField({
  id,
  label,
  required = false,
  optional = false,
  icon,
  error,
  hint,
  controlClassName = '',
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  controlClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="cb-auth-field">
      <label className="cb-auth-field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="cb-auth-required" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="font-normal text-slate-500"> (optional)</span> : null}
      </label>
      <div className={`cb-auth-field__control ${controlClassName} ${error ? 'is-error' : ''}`}>
        {icon ? <span className="cb-auth-field__icon">{icon}</span> : null}
        {children}
      </div>
      {error ? (
        <span id={`${id}-error`} role="alert" className="cb-auth-field__error">
          {error}
        </span>
      ) : hint ? (
        <p id={`${id}-hint`} className="cb-auth-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
