export type SubscriptionType = 'ByType' | 'ById';

export interface SubscriptionHandle {
  unsubscribe: () => void;
}
