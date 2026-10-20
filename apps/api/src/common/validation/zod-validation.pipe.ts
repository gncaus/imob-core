import { type PipeTransform } from '@nestjs/common';
import { type z } from 'zod';
import { ValidationError } from '../errors/domain-errors.js';

/** Valida e normaliza a entrada com um schema Zod (normalmente de `@imob/shared`). */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}
