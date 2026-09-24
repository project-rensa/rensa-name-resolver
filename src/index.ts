import type { OnNameLookupHandler } from '@metamask/snaps-sdk';
import { lookupName } from './lookup';

export const onNameLookup: OnNameLookupHandler = async (request) =>
  lookupName(request, fetch);
