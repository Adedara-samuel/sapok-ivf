"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { DatePicker } from "@/components/shared/date-picker";
import { TimePicker } from "@/components/shared/time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

export interface Option {
  value: string;
  label: string;
}

interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

function RequiredMark({ show }: { show?: boolean }) {
  return show ? (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  ) : null;
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  type = "text",
  placeholder,
  autoComplete,
}: BaseProps<T> & { type?: "text" | "email" | "tel" | "password"; placeholder?: string; autoComplete?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label} <RequiredMark show={required} />
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={(field.value as string | undefined) ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" && !required ? undefined : e.target.value)}
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              disabled={disabled}
              aria-required={required}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  min,
  max,
  fromYear,
  toYear,
}: BaseProps<T> & { min?: string; max?: string; fromYear?: number; toYear?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label} <RequiredMark show={required} />
          </FormLabel>
          <FormControl>
            <DatePicker
              ref={field.ref}
              name={field.name}
              value={(field.value as string | undefined) ?? undefined}
              onChange={(v) => field.onChange(v === undefined ? (required ? "" : undefined) : v)}
              onBlur={field.onBlur}
              disabled={disabled}
              min={min}
              max={max}
              fromYear={fromYear}
              toYear={toYear}
              aria-required={required}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TimeField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
}: BaseProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label} <RequiredMark show={required} />
          </FormLabel>
          <FormControl>
            <TimePicker
              ref={field.ref}
              name={field.name}
              value={(field.value as string | undefined) ?? undefined}
              onChange={(v) => field.onChange(v ?? (required ? "" : undefined))}
              onBlur={field.onBlur}
              disabled={disabled}
              aria-required={required}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  step = "any",
  min,
  max,
  suffix,
}: BaseProps<T> & { step?: string; min?: number; max?: number; suffix?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label} <RequiredMark show={required} />
          </FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                type="number"
                inputMode="decimal"
                step={step}
                min={min}
                max={max}
                disabled={disabled}
                aria-required={required}
                className={cn("tabular-nums", suffix && "pr-12")}
                value={
                  field.value === undefined || field.value === null || Number.isNaN(field.value)
                    ? ""
                    : String(field.value)
                }
                onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </FormControl>
            {suffix ? (
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                {suffix}
              </span>
            ) : null}
          </div>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  rows = 4,
  placeholder,
}: BaseProps<T> & { rows?: number; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label} <RequiredMark show={required} />
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              value={(field.value as string | undefined) ?? ""}
              rows={rows}
              placeholder={placeholder}
              disabled={disabled}
              aria-required={required}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  options,
  placeholder = "Select…",
  allowEmpty,
}: BaseProps<T> & { options: readonly Option[]; placeholder?: string; allowEmpty?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label} <RequiredMark show={required} />
          </FormLabel>
          <Select
            value={(field.value as string | undefined) ?? ""}
            onValueChange={(v) => field.onChange(allowEmpty && v === "__none" ? undefined : v)}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full" onBlur={field.onBlur} ref={field.ref} aria-required={required}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {allowEmpty ? <SelectItem value="__none">— None —</SelectItem> : null}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: BaseProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-row items-start gap-3 space-y-0", className)}>
          <FormControl>
            <Checkbox
              checked={Boolean(field.value)}
              onCheckedChange={(v) => field.onChange(v === true)}
              disabled={disabled}
            />
          </FormControl>
          <div className="grid gap-1 leading-none">
            <FormLabel className="font-normal">{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}

export function toOptions<T extends string>(values: readonly T[], label: (v: T) => string = (v) => v): Option[] {
  return values.map((v) => ({ value: v, label: label(v) }));
}
