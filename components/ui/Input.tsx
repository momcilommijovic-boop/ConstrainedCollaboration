interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="font-mono text-xs uppercase tracking-widest text-olive">
        {label}
      </label>
      <input
        id={inputId}
        className={`
          border font-body text-sm px-3 py-2 bg-off-white text-near-black
          placeholder:text-olive/60
          ${error ? 'border-accent-red' : 'border-near-black/30 focus:border-near-black'}
          transition-colors duration-100 ${className}
        `}
        {...props}
      />
      {error && (
        <p className="font-mono text-xs text-accent-red">{error}</p>
      )}
      {hint && !error && (
        <p className="font-mono text-xs text-olive">{hint}</p>
      )}
    </div>
  )
}
