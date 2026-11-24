/** No animal has the requested id. */
export class AnimalNotFoundError extends Error {
  constructor() {
    super('Animal not found');
    this.name = 'AnimalNotFoundError';
  }
}
