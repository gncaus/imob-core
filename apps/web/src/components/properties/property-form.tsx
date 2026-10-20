'use client';

import {
  BRAZILIAN_STATES,
  type CreatePropertyInput,
  PROPERTY_TYPES,
  type PropertyDto,
} from '@imob/shared';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/api';
import { DISPLAY_ADDRESS_LABEL, PUBLICATION_TYPE_LABEL, PURPOSE_LABEL } from '@/lib/format';
import {
  type FieldError,
  type FormField,
  issuesToFieldErrors,
  type PropertyFormValues,
  toFormValues,
  toPayload,
  validatePayload,
} from './property-form-values';

const NO_TYPE = 'none';
const typesByUsage = (usage: string) =>
  Object.entries(PROPERTY_TYPES).filter(([value]) => value.startsWith(usage));

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`grid content-start gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function PropertyForm({
  property,
  submitLabel,
  onSubmit,
}: {
  property?: PropertyDto;
  submitLabel: string;
  onSubmit: (payload: CreatePropertyInput) => Promise<unknown>;
}) {
  const form = useForm<PropertyFormValues>({ defaultValues: toFormValues(property) });
  const { register, control, formState, setError, setValue, getValues } = form;
  const errors = formState.errors;
  const [lookingUpCep, setLookingUpCep] = useState(false);

  const showErrors = (fieldErrors: FieldError[]) => {
    for (const { field, message } of fieldErrors) setError(field, { message });
  };

  const submit = form.handleSubmit(async (values) => {
    const payload = toPayload(values);
    const fieldErrors = validatePayload(payload);
    if (fieldErrors.length > 0) {
      showErrors(fieldErrors);
      toast.error('Revise os campos destacados.');
      return;
    }
    try {
      await onSubmit(payload);
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) {
        showErrors(issuesToFieldErrors(error.issues));
      }
      toast.error(errorMessage(error));
    }
  });

  /** Preenche o endereço pelo CEP (ViaCEP) quando o usuário sai do campo. */
  const lookupCep = async () => {
    const cep = getValues('postalCode').replace(/\D/g, '');
    if (cep.length !== 8) return;
    setLookingUpCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as ViaCepResponse;
      if (!response.ok || data.erro) {
        toast.warning('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }
      const fill: [FormField, string | undefined][] = [
        ['street', data.logradouro],
        ['neighborhood', data.bairro],
        ['city', data.localidade],
        ['state', data.uf],
      ];
      for (const [field, value] of fill) {
        if (value) setValue(field, value, { shouldDirty: true });
      }
    } catch {
      toast.warning('Não foi possível consultar o CEP agora.');
    } finally {
      setLookingUpCep(false);
    }
  };

  const textField = (field: FormField, label: string, props: Record<string, unknown> = {}) => (
    <Field
      label={label}
      htmlFor={field}
      error={errors[field]?.message}
      className={props.className as string}
    >
      <Input id={field} aria-invalid={Boolean(errors[field])} {...props} {...register(field)} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {textField('code', 'Código', { placeholder: 'VV-101', className: 'sm:col-span-1' })}
          {textField('title', 'Título do anúncio', { className: 'sm:col-span-3' })}
          <Field label="Finalidade" htmlFor="purpose" className="sm:col-span-1">
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="purpose" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Tipo do imóvel"
            htmlFor="propertyType"
            error={errors.propertyType?.message}
            className="sm:col-span-3"
          >
            <Controller
              control={control}
              name="propertyType"
              render={({ field }) => (
                <Select
                  value={field.value || NO_TYPE}
                  onValueChange={(value) => field.onChange(value === NO_TYPE ? '' : value)}
                >
                  <SelectTrigger id="propertyType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TYPE}>Selecione…</SelectItem>
                    {(['Residential', 'Commercial'] as const).map((usage) => (
                      <SelectGroup key={usage}>
                        <SelectLabel>
                          {usage === 'Residential' ? 'Residencial' : 'Comercial'}
                        </SelectLabel>
                        {typesByUsage(usage).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Descrição"
            htmlFor="description"
            error={errors.description?.message}
            hint="Os portais exigem de 50 a 3.000 caracteres, sem HTML."
            className="sm:col-span-4"
          >
            <Textarea id="description" rows={6} {...register('description')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valores</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {textField('salePrice', 'Preço de venda (R$)', {
            inputMode: 'decimal',
            placeholder: '850.000,00',
          })}
          {textField('rentPrice', 'Aluguel mensal (R$)', {
            inputMode: 'decimal',
            placeholder: '3.500,00',
          })}
          {textField('condoFee', 'Condomínio (R$)', { inputMode: 'decimal' })}
          {textField('iptu', 'IPTU anual (R$)', { inputMode: 'decimal' })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Características</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          {textField('usableArea', 'Área útil (m²)', { inputMode: 'numeric' })}
          {textField('totalArea', 'Área total (m²)', { inputMode: 'numeric' })}
          {textField('bedrooms', 'Quartos', { inputMode: 'numeric' })}
          {textField('suites', 'Suítes', { inputMode: 'numeric' })}
          {textField('bathrooms', 'Banheiros', { inputMode: 'numeric' })}
          {textField('parkingSpots', 'Vagas', { inputMode: 'numeric' })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <Field
            label="CEP"
            htmlFor="postalCode"
            error={errors.postalCode?.message}
            hint={lookingUpCep ? 'Consultando CEP…' : 'O endereço é preenchido pelo CEP.'}
            className="sm:col-span-2"
          >
            <Input
              id="postalCode"
              inputMode="numeric"
              placeholder="29101-010"
              {...register('postalCode', { onBlur: () => void lookupCep() })}
            />
          </Field>
          {textField('street', 'Rua', { className: 'sm:col-span-4' })}
          {textField('streetNumber', 'Número', { className: 'sm:col-span-1' })}
          {textField('complement', 'Complemento', { className: 'sm:col-span-2' })}
          {textField('neighborhood', 'Bairro', { className: 'sm:col-span-3' })}
          {textField('city', 'Cidade', { className: 'sm:col-span-3' })}
          <Field label="UF" htmlFor="state" error={errors.state?.message} className="sm:col-span-1">
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="state" className="w-full">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(BRAZILIAN_STATES).map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {textField('latitude', 'Latitude', { inputMode: 'decimal', className: 'sm:col-span-1' })}
          {textField('longitude', 'Longitude', {
            inputMode: 'decimal',
            className: 'sm:col-span-1',
          })}
          <Field label="Exibir no anúncio" htmlFor="displayAddress" className="sm:col-span-3">
            <Controller
              control={control}
              name="displayAddress"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="displayAddress" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISPLAY_ADDRESS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publicação nos portais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de anúncio" htmlFor="publicationType">
            <Controller
              control={control}
              name="publicationType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="publicationType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PUBLICATION_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="flex items-center gap-3 self-end pb-1">
            <Controller
              control={control}
              name="publishToPortals"
              render={({ field }) => (
                <Switch
                  id="publishToPortals"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="publishToPortals">
              Publicar no ZAP, Viva Real e OLX (entra no feed quando não houver pendências)
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
