"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/shared/section-card";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { ConsentTemplateConfig, ProcedureFormConfig, ProtocolTemplate } from "@/lib/constants/clinical";
import { clinicSettingsSchema, useSettingsStore, type ClinicSettings } from "@/lib/stores/settings";

function ClinicForm({ disabled }: { disabled: boolean }) {
  const run = useRunAction();
  const clinic = useSettingsStore((s) => s.clinic);
  const update = useSettingsStore((s) => s.updateClinic);
  const form = useZodForm<ClinicSettings>(clinicSettingsSchema, clinic);
  return (
    <SectionCard
      title="Clinic & numbering"
      description="Clinic name, currency and numbering formats used for new records."
    >
      <Form {...form}>
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) =>
            run(
              () => {
                update(v);
                return true;
              },
              { success: "Configuration saved", setError: form.setError },
            ),
          )}
        >
          <TextField control={form.control} name="clinicName" label="Clinic name" required disabled={disabled} />
          <TextField
            control={form.control}
            name="currencySymbol"
            label="Currency symbol"
            required
            disabled={disabled}
          />
          <TextField
            control={form.control}
            name="receiptPrefix"
            label="Receipt prefix"
            required
            disabled={disabled}
            description="Receipts: PREFIX-000123"
          />
          <TextField
            control={form.control}
            name="ivfPrefix"
            label="IVF number prefix"
            required
            disabled={disabled}
            description="Episodes: PREFIX-0001"
          />
          {!disabled ? (
            <Button type="submit" className="w-fit">
              Save configuration
            </Button>
          ) : null}
        </form>
      </Form>
    </SectionCard>
  );
}

function ConsentEditor({ disabled }: { disabled: boolean }) {
  const run = useRunAction();
  const templates = useSettingsStore((s) => s.consentTemplates);
  const update = useSettingsStore((s) => s.updateConsentTemplate);
  const [id, setId] = useState<ConsentTemplateConfig["id"]>(templates[0]?.id ?? "ivf");
  const t = templates.find((x) => x.id === id);
  const [draft, setDraft] = useState({ title: t?.title ?? "", version: t?.version ?? "", body: t?.body ?? "" });
  return (
    <SectionCard
      title="Consent templates"
      description="New signatures use the current version; signed consents keep the version they were signed under."
    >
      <div className="grid gap-3">
        <Select
          value={id}
          onValueChange={(v) => {
            const next = templates.find((x) => x.id === v);
            setId(v as ConsentTemplateConfig["id"]);
            setDraft({ title: next?.title ?? "", version: next?.version ?? "", body: next?.body ?? "" });
          }}
        >
          <SelectTrigger aria-label="Template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templates.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="ct-title">Title</Label>
            <Input
              id="ct-title"
              value={draft.title}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ct-version">Version</Label>
            <Input
              id="ct-version"
              value={draft.version}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, version: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ct-body">Wording</Label>
          <Textarea
            id="ct-body"
            rows={5}
            value={draft.body}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </div>
        {!disabled ? (
          <Button
            className="w-fit"
            onClick={() =>
              run(
                () => {
                  update(id, draft);
                  return true;
                },
                { success: "Consent template saved" },
              )
            }
          >
            Save template
          </Button>
        ) : null}
      </div>
    </SectionCard>
  );
}

function ProcedureBuilder({ disabled }: { disabled: boolean }) {
  const run = useRunAction();
  const forms = useSettingsStore((s) => s.procedureForms);
  const update = useSettingsStore((s) => s.updateProcedureForm);
  const [type, setType] = useState<ProcedureFormConfig["type"]>(forms[0]?.type ?? "OCR");
  const f = forms.find((x) => x.type === type);
  const set = (patch: Partial<Omit<ProcedureFormConfig, "type">>) =>
    run(
      () => {
        update(type, patch);
        return true;
      },
      { success: "Form updated" },
    );
  if (!f) return null;
  const toggles: {
    key: "showEmbryologist" | "showScrubNurse" | "showEmbryoGrade" | "showTransferred";
    label: string;
  }[] = [
    { key: "showEmbryologist", label: "Embryologist field" },
    { key: "showScrubNurse", label: "Scrub nurse field" },
    { key: "showEmbryoGrade", label: "Embryo grade field" },
    { key: "showTransferred", label: "Embryos transferred field" },
  ];
  return (
    <SectionCard
      title="Procedure form builder"
      description="One form engine drives OCR, PRP, cyst drainage, PGT, ET, FET, andrology and biopsy notes."
    >
      <div className="grid gap-3">
        <Select value={type} onValueChange={(v) => setType(v as ProcedureFormConfig["type"])}>
          <SelectTrigger aria-label="Procedure">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {forms.map((x) => (
              <SelectItem key={x.type} value={x.type}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid gap-2 sm:grid-cols-2">
          {toggles.map((t) => (
            <Label key={t.key} className="flex items-center justify-between gap-2 rounded-md border p-2 font-normal">
              {t.label}
              <Switch checked={f[t.key]} disabled={disabled} onCheckedChange={(v) => set({ [t.key]: v })} />
            </Label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-count">Count field label (blank = hidden)</Label>
            <Input
              id="pf-count"
              key={`${type}-count`}
              defaultValue={f.countLabel ?? ""}
              disabled={disabled}
              onBlur={(e) => set({ countLabel: e.target.value.trim() || undefined })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-note">Note label</Label>
            <Input
              id="pf-note"
              key={`${type}-note`}
              defaultValue={f.noteLabel}
              disabled={disabled}
              onBlur={(e) => e.target.value.trim() && set({ noteLabel: e.target.value.trim() })}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pf-template">Default note text</Label>
          <Textarea
            id="pf-template"
            key={`${type}-tpl`}
            rows={3}
            defaultValue={f.noteTemplate}
            disabled={disabled}
            onBlur={(e) => set({ noteTemplate: e.target.value })}
          />
        </div>
        <p className="text-muted-foreground text-xs">Text fields save when you leave them.</p>
      </div>
    </SectionCard>
  );
}

function ProtocolEditor({ disabled }: { disabled: boolean }) {
  const run = useRunAction();
  const protocols = useSettingsStore((s) => s.protocols);
  const update = useSettingsStore((s) => s.updateProtocol);
  const [id, setId] = useState<ProtocolTemplate["id"]>(protocols[0]?.id ?? "antagonist");
  const p = protocols.find((x) => x.id === id);
  if (!p) return null;
  return (
    <SectionCard title="Protocol templates" description="Shown when starting a cycle.">
      <div className="grid gap-3">
        <Select value={id} onValueChange={(v) => setId(v as ProtocolTemplate["id"])}>
          <SelectTrigger aria-label="Protocol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {protocols.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-desc">Description</Label>
          <Textarea
            id="pr-desc"
            key={`${id}-d`}
            rows={3}
            defaultValue={p.description}
            disabled={disabled}
            onBlur={(e) =>
              run(
                () => {
                  update(id, { description: e.target.value });
                  return true;
                },
                { success: "Protocol saved" },
              )
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-drugs">Drugs (comma separated)</Label>
          <Input
            id="pr-drugs"
            key={`${id}-x`}
            defaultValue={p.drugs.join(", ")}
            disabled={disabled}
            onBlur={(e) =>
              run(
                () => {
                  update(id, {
                    drugs: e.target.value
                      .split(",")
                      .map((d) => d.trim())
                      .filter(Boolean),
                  });
                  return true;
                },
                { success: "Protocol saved" },
              )
            }
          />
        </div>
      </div>
    </SectionCard>
  );
}

export function ConfigPanel() {
  const disabled = !usePermission("admin.settings");
  const branches = useSettingsStore((s) => s.branches);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ClinicForm disabled={disabled} />
      <SectionCard
        title="Branches"
        description="Branch switching filters patients, waiting lists, billing and reports."
      >
        <ul className="grid gap-2">
          {branches.map((b) => (
            <li key={b.id} className="flex items-start gap-3 rounded-lg border p-3">
              <Building2 className="text-primary mt-0.5 size-5" aria-hidden="true" />
              <span>
                <span className="block font-medium">
                  {b.name} <span className="text-muted-foreground text-xs">({b.id})</span>
                </span>
                <span className="text-muted-foreground text-sm">{b.address}</span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
      <ConsentEditor disabled={disabled} />
      <ProcedureBuilder disabled={disabled} />
      <ProtocolEditor disabled={disabled} />
    </div>
  );
}
