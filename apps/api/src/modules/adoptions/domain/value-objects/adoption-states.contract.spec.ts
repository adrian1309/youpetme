import {
  ADOPTION_MESSAGE_MAX_LENGTH,
  ADOPTION_REQUEST_ACTIONS_BY_STATUS,
  ADOPTION_REQUEST_STATUSES,
} from '@youpetme/contracts';

import { AdoptionRequest, decisionFor } from '../entities/adoption-request.entity';
import { ADOPTION_ACTIONS, ADOPTION_STATUSES } from './adoption-states';

describe('Adoptions domain vs. published contract', () => {
  it('publishes the same statuses, limit and allowed actions per status', () => {
    expect([...ADOPTION_REQUEST_STATUSES]).toEqual([...ADOPTION_STATUSES]);
    expect(ADOPTION_MESSAGE_MAX_LENGTH).toBe(AdoptionRequest.MESSAGE_MAX_LENGTH);
    for (const status of ADOPTION_STATUSES) {
      const allowed = ADOPTION_ACTIONS.filter((action) => decisionFor(action, status) !== null);
      expect([...ADOPTION_REQUEST_ACTIONS_BY_STATUS[status]]).toEqual(allowed);
    }
  });
});
