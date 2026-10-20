/** Base dos erros de regra de negócio. O `DomainExceptionFilter` mapeia cada um para HTTP. */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(readonly issues: ValidationIssue[]) {
    super('Dados inválidos');
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED';

  constructor(message = 'Sessão inválida ou expirada') {
    super(message);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('E-mail ou senha incorretos');
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';

  constructor(message = 'Você não tem permissão para esta ação') {
    super(message);
  }
}
