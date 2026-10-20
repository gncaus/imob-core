import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/** Valida parâmetros de rota que são ids (UUID). */
export const UuidParamPipe = new ZodValidationPipe(z.uuid('Id inválido'));
