export class ShellyAuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'ShellyAuthError';
  }
}

export class ShellyNetworkError extends Error {
  constructor(
    message: string,
    public readonly cause_?: unknown,
  ) {
    super(message);
    this.name = 'ShellyNetworkError';
  }
}

export class ShellyHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ShellyHttpError';
  }
}
