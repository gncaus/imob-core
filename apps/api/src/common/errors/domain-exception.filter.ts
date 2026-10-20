import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidCredentialsError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from './domain-errors.js';

export interface ErrorBody {
  error: { code: string; message: string; issues?: ValidationError['issues'] };
}

function statusFor(error: DomainError): HttpStatus {
  if (error instanceof ValidationError) return HttpStatus.BAD_REQUEST;
  if (error instanceof UnauthenticatedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof InvalidCredentialsError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

/**
 * Converte erros de domínio em respostas HTTP com corpo padronizado. Exceções HTTP do Nest
 * passam como estão; qualquer outro erro vira 500 sem vazar detalhes.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      const body: ErrorBody = { error: { code: exception.code, message: exception.message } };
      if (exception instanceof ValidationError) body.error.issues = exception.issues;
      response.status(statusFor(exception)).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error({ err: exception }, 'Erro não tratado');
    const body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
