'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from './primitives';

export function CopyButton({
  value,
  label,
  size = 'sm',
  variant = 'ghost',
  ...props
}: { value: string; label?: string } & Omit<ButtonProps, 'value' | 'onClick' | 'children'>) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Button
      size={size}
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard is unavailable on insecure origins; fail quietly.
        }
      }}
      aria-label={label ? undefined : 'Хуулах'}
      title="Хуулах"
      {...props}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ? (copied ? 'Хуулсан' : label) : null}
    </Button>
  );
}
