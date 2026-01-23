'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    description?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, description, id, ...props }, ref) => {
        const checkboxId = id || React.useId();

        return (
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    id={checkboxId}
                    className={cn(
                        'h-5 w-5 rounded border-zinc-300 text-emerald-600 transition-colors',
                        'focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {(label || description) && (
                    <div className="flex flex-col">
                        {label && (
                            <label
                                htmlFor={checkboxId}
                                className="text-sm font-medium text-zinc-900 cursor-pointer"
                            >
                                {label}
                            </label>
                        )}
                        {description && (
                            <span className="text-xs text-zinc-500">{description}</span>
                        )}
                    </div>
                )}
            </div>
        );
    }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
