import { SetMetadata } from '@nestjs/common';

export const CONNECTION_AUTHENTICATED_KEY = 'connectionAuthenticated';

// Only apply to gateways that authenticate and store userId during connection.
export const ConnectionAuthenticated = () =>
  SetMetadata(CONNECTION_AUTHENTICATED_KEY, true);
