export type ValidationFieldError = {
  field: string;
  message: string;
};

export type ValidationErrorData = {
  errors: ValidationFieldError[];
};

export type ClientErrorResponse = {
  error: true;
  message: string;
  status: number;
  code: string;
  data?: unknown;
};

export type ClientErrorOptions = {
  message: string;
  status?: number;
  code?: string;
  data?: unknown;
};

export class ClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly data?: unknown;

  constructor(opts: ClientErrorOptions) {
    super(opts.message);
    this.name = "ClientError";
    this.status = opts.status ?? 400;
    this.code = opts.code ?? "error";
    this.data = opts.data;
  }

  static badRequest(message: string, code?: string, data?: unknown) {
    return new ClientError({ message, status: 400, code, data });
  }

  static unauthorized(message: string, code?: string, data?: unknown) {
    return new ClientError({ message, status: 401, code, data });
  }

  static forbidden(message: string, code?: string, data?: unknown) {
    return new ClientError({ message, status: 403, code, data });
  }

  static notFound(message: string, code?: string, data?: unknown) {
    return new ClientError({ message, status: 404, code, data });
  }

  static validation(
    errors: ValidationFieldError[],
    message = "Validation failed",
  ) {
    return new ClientError({
      message,
      status: 400,
      code: "validation",
      data: { errors } satisfies ValidationErrorData,
    });
  }

  isValidationError(): this is ClientError & { data: ValidationErrorData } {
    return (
      this.code === "validation" &&
      this.data != null &&
      typeof this.data === "object" &&
      "errors" in this.data
    );
  }

  toJSON(): ClientErrorResponse {
    return {
      error: true,
      message: this.message,
      status: this.status,
      code: this.code,
      data: this.data,
    };
  }

  static isClientErrorResponse(obj: unknown): obj is ClientErrorResponse {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "error" in obj &&
      obj.error === true &&
      "code" in obj
    );
  }

  static fromJSON(json: ClientErrorResponse) {
    return new ClientError({
      message: json.message,
      status: json.status,
      code: json.code,
      data: json.data,
    });
  }
}
