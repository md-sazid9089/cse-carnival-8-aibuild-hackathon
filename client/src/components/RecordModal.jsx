import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx, titleCase } from "../lib/format.js";
import Modal from "./Modal.jsx";
import { Button, Field, Select, TextArea, TextInput } from "./ui.jsx";

const emptyValue = (field) => (field.type === "tags" ? "" : (field.default ?? ""));

function buildInitial(fields, initial) {
  const form = {};
  for (const field of fields) {
    let value = initial?.[field.key] ?? emptyValue(field);
    if (field.type === "tags" && Array.isArray(value)) value = value.join(", ");
    if (field.type === "date" && typeof value === "string") value = value.slice(0, 10);
    if (field.type === "time" && typeof value === "string") value = value.slice(0, 5);
    form[field.key] = value === null || value === undefined ? "" : String(value);
  }
  return form;
}

/** Rules the server also enforces — checked here so the user is told before a round trip. */
function baseValidate(form, fields) {
  const errors = {};
  const has = (key) => fields.some((f) => f.key === key);

  for (const field of fields) {
    const value = String(form[field.key] ?? "").trim();
    if (!field.optional && value === "") errors[field.key] = `${field.label} is required`;
    else if (field.type === "number" && value !== "") {
      const num = Number(value);
      if (Number.isNaN(num)) errors[field.key] = "Enter a number";
      else if (field.min !== undefined && num < field.min) errors[field.key] = `Must be at least ${field.min}`;
    }
  }

  if (has("start_time") && has("end_time") && form.start_time && form.end_time && form.end_time <= form.start_time)
    errors.end_time = "End time must be after the start time";

  if (has("date") && has("expires") && form.date && form.expires && form.expires < form.date)
    errors.expires = "Expiry cannot be before the posted date";

  if (has("assigned_date") && has("deadline") && form.assigned_date && form.deadline && form.deadline < form.assigned_date)
    errors.deadline = "Deadline cannot be before the assigned date";

  if (has("date") && has("end_date") && form.date && form.end_date && form.end_date < form.date)
    errors.end_date = "End date cannot be before the start date";

  return errors;
}

function serialize(form, fields) {
  const out = { ...form };
  for (const field of fields) {
    const raw = out[field.key];
    if (field.type === "tags")
      out[field.key] = String(raw ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    else if (field.type === "number") out[field.key] = Number(raw);
    else if (typeof raw === "string") out[field.key] = raw.trim();
    if (field.optional && (out[field.key] === "" || Number.isNaN(out[field.key]))) delete out[field.key];
  }
  return out;
}

export default function RecordModal({
  title,
  description,
  fields,
  initial,
  submitLabel = "Save",
  onSubmit,
  onClose,
  validate,
}) {
  const [form, setForm] = useState(() => buildInitial(fields, initial));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef(null);
  const formId = useId();

  useEffect(() => {
    setForm(buildInitial(fields, initial));
    setErrors({});
  }, [fields, initial]);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = { ...baseValidate(form, fields), ...(validate?.(form) ?? {}) };
    const cleaned = Object.fromEntries(Object.entries(found).filter(([, message]) => message));
    setErrors(cleaned);
    if (Object.keys(cleaned).length > 0) {
      document.getElementById(`${formId}-${Object.keys(cleaned)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit(serialize(form, fields));
    } finally {
      setBusy(false);
    }
  };

  const controls = useMemo(
    () =>
      fields.map((field, index) => {
        const id = `${formId}-${field.key}`;
        const invalid = Boolean(errors[field.key]);
        const shared = {
          id,
          invalid,
          value: form[field.key] ?? "",
          onChange: (event) => set(field.key, event.target.value),
          ref: index === 0 ? firstFieldRef : undefined,
        };

        let control;
        if (field.type === "select")
          control = (
            <Select {...shared}>
              <option value="" disabled>
                Select…
              </option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          );
        else if (field.type === "textarea") control = <TextArea {...shared} rows={field.rows ?? 3} />;
        else
          control = (
            <TextInput
              {...shared}
              type={field.type === "number" ? "number" : (field.type ?? "text")}
              inputMode={field.type === "number" ? "numeric" : undefined}
              min={field.type === "number" ? (field.min ?? 0) : undefined}
              placeholder={field.placeholder}
              autoComplete="off"
            />
          );

        return (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={id}
            required={!field.optional}
            hint={field.hint}
            error={errors[field.key]}
            className={cx(field.wide && "sm:col-span-2")}
          >
            {control}
          </Field>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, form, errors, formId],
  );

  return (
    <Modal
      title={title}
      description={description}
      onClose={busy ? undefined : onClose}
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {controls}
      </form>
    </Modal>
  );
}
