/** The AI provider failed, timed out or rejected the call; the assistant cannot answer now. */
export class AiProviderUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('The AI provider is not available', options);
    this.name = 'AiProviderUnavailableError';
  }
}
