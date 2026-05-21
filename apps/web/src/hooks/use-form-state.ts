import { useState, useCallback, useRef, useMemo } from "react";

import type { ZodType, ZodError, z } from "zod";

type Errors<T> = Partial<Record<keyof T, string | undefined>>;

export function useFormState<S extends ZodType<any, any>>(
  schema: S,
  initial: Partial<z.infer<S>> = {}
) {
  type Form = z.infer<S>;

  const initialRef = useRef(initial);
  const [form, setForm] = useState<Form>(() => initial as Form);
  const [errors, setErrors] = useState<Errors<Form>>({});

  const [isTouched, setIsTouched] = useState<
    Partial<Record<keyof Form, boolean>>
  >({});

  const mapZodErrors = (err: ZodError) => {
    const out: Errors<Form> = {};

    for (const issue of err.issues) {
      const key = issue.path[0] as keyof Form | undefined;

      if (!key) continue;
      if (!out[key]) out[key] = issue.message;
    }

    return out;
  };

  const validate = useCallback(
    (maybeForm?: Partial<Form>) => {
      const toValidate: unknown = maybeForm ?? form;
      const res = schema.safeParse(toValidate);

      if (res.success) {
        setErrors({});

        return { success: true, value: res.data as Form };
      } else {
        setErrors(mapZodErrors(res.error));

        return { success: false, error: res.error };
      }
    },
    [form, schema]
  );

  const setField = useCallback(
    <K extends keyof Form>(field: K, value: Form[K], validateField = true) => {
      setForm((prev) => {
        const next: Form = { ...prev, [field]: value };

        setIsTouched((t) => ({ ...t, [field]: true }));

        if (validateField) {
          const res = schema.safeParse(next);

          if (res.success) {
            setErrors((prevErr) => {
              const copy = { ...prevErr };

              delete copy[field];

              return copy;
            });
          } else {
            setErrors(mapZodErrors(res.error));
          }
        }

        return next;
      });
    },
    [schema]
  );

  const validateAll = useCallback(() => {
    const res = schema.safeParse(form);

    if (res.success) {
      setErrors({});

      return { ok: true, value: res.data as Form };
    } else {
      setErrors(mapZodErrors(res.error));

      return { ok: false, error: res.error };
    }
  }, [form, schema]);

  const reset = useCallback((values?: Partial<Form>) => {
    setForm(values ? (values as Form) : (initialRef.current as Form));
    setErrors({});
    setIsTouched({});
  }, []);

  const isValid = Object.keys(errors).length === 0;

  const setFormMerge = useCallback((input: Partial<Form>) => {
    setForm((prev) => ({
      ...prev,
      ...input,
    }));
  }, []);

  return useMemo(
    () => ({
      form,
      setForm: setFormMerge,
      setField,
      errors,
      validate,
      validateAll,
      reset,
      isValid,
      isTouched,
    }),
    [form, setFormMerge, setField, errors, validate, validateAll, reset, isValid, isTouched]
  );
}
