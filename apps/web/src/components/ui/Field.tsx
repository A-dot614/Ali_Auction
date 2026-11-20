import type { ReactNode } from "react";

/**
 * Labelled form control. The id/template pair is intentionally identical on
 * label and control so the association holds for every generated field.
 */
export default function Field({
  id,
  label,
  type = "text",
  required = false,
  value,
  onChange,
  as = "input",
  options,
  children,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  as?: "input" | "select" | "textarea";
  options?: Array<{ value: string; label: string }>;
  children?: ReactNode;
}) {
  const change = (event: { target: { value: string } }) => onChange?.(event.target.value);
  return (
    <div className="ui-field">
      <label htmlFor={`${id}`}>{label}</label>
      {as === "select" ? (
        <select id={`${id}`} name={id} required={required} className="ui-input" value={value ?? ""} onChange={change}>
          {(options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : as === "textarea" ? (
        <textarea id={`${id}`} name={id} required={required} className="ui-input" value={value ?? ""} onChange={change} rows={4} />
      ) : (
        <input id={`${id}`} name={id} type={type} required={required} className="ui-input" value={value ?? ""} onChange={change} />
      )}
      {children}
    </div>
  );
}
