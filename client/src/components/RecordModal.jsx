import { useEffect, useId, useRef, useState } from "react";
import { cx, titleCase } from "../lib/format.js";
import { Alert } from "../lib/icons.jsx";
import Modal from "./Modal.jsx";
import { Button, Field, Select, TextArea, TextInput } from "./ui.jsx";

function buildInitial(fields, initial) {
  const form = {};
  for (const field of fields) {
    let value = initial?.[field.key] ?? field.default ?? "";
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
    const blank = String(raw ?? "").trim() === "";
    if (field.omitWhenEmpty && blank) {
      delete out[field.key];
      continue;
    }
    if (field.type === "tags")
      out[field.key] = String(raw ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    else if (field.type === "number") out[field.key] = blank ? (field.min ?? 0) : Number(raw);
    else if (typeof raw === "string") out[field.key] = raw.trim();
  }
  return out;
}

/**
 * Create/edit form in a dialog. `onSubmit` must throw on failure — the reason is
 * then shown inline and persistently, because a toast that vanishes after a few
 * seconds is the wrong place for "this room is already booked at that time".
 */
export default function RecordModal({
  title,
  description,
  fields,
  initial,
  recordKey = "new",
  submitLabel = "Save",
  onSubmit,
  onClose,
  validate,
}) {
  const [form, setForm] = useState(() => buildInitial(fields, initial));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef(null);
  const formId = useId();

  // Reset on a *different record*, never merely because the parent re-rendered:
  // live data re-renders these pages constantly and would wipe what was typed.
  useEffect(() => {
    setForm(buildInitial(fields, initial));
    setErrors({});
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey]);

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
    setSubmitError(null);
    try {
      await onSubmit(serialize(form, fields));
    } catch (error) {
      setSubmitError(error.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
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
      {submitError ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical-soft px-3 py-2.5"
        >
          <Alert size={16} className="mt-px shrink-0 text-critical" />
          <p className="text-[13px] leading-snug text-ink">{submitError}</p>
        </div>
      ) : null}

      <form id={formId} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {fields.map((field, index) => {
          const id = `${formId}-${field.key}`;
          const invalid = Boolean(errors[field.key]);
          const shared = {
            id,
            invalid,
            required: !field.optional,
            value: form[field.key] ?? "",
            onChange: (event) => set(field.key, event.target.value),
            ref: index === 0 ? firstFieldRef : undefined,
          };

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
              {({ describedBy }) =>
                field.type === "select" ? (
                  <Select {...shared} aria-describedby={describedBy} className="capitalize">
                    <option value="" disabled>
                      Select…
                    </option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {titleCase(option)}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "textarea" ? (
                  <TextArea {...shared} aria-describedby={describedBy} rows={field.rows ?? 3} />
                ) : (
                  <TextInput
                    {...shared}
                    aria-describedby={describedBy}
                    type={field.type === "number" ? "number" : (field.type ?? "text")}
                    inputMode={field.type === "number" ? "numeric" : undefined}
                    min={field.type === "number" ? (field.min ?? 0) : undefined}
                    placeholder={field.placeholder}
                    autoComplete="off"
                  />
                )
              }
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}
