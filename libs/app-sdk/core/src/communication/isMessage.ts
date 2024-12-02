import { Message } from './MessageTypes';

const messageTypes = [
  'page-height',
  'route-change',
  'custom',
  'api-request',
  'api-response',
] as const;

export const isMessage = (data: unknown): data is Message => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    messageTypes.includes(data.type as Message['type'])
  );
};
