import type { AdoptionRequestItem } from '@youpetme/contracts';

import type { AdoptionRequestView } from '../../domain/ports/adoption-request-repository';

export function toAdoptionRequestItem(view: AdoptionRequestView): AdoptionRequestItem {
  return {
    id: view.id,
    status: view.status,
    message: view.message,
    createdAt: view.createdAt.toISOString(),
    decidedAt: view.decidedAt?.toISOString() ?? null,
    animal: view.animal,
    applicant: view.applicant,
  };
}
