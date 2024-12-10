import { StripeCustomer } from '../contracts/StripeCustomer';
import { Chess } from '../contracts/Chess';
import { AppSDK } from '../../sdk';

describe('StripeCustomer', () => {
  it.skip('should set the email', async () => {
    const sdk = AppSDK.getInstance();
    const customer = new StripeCustomer(sdk);
    await customer.setEmail('abc@def.com');

    const chess = new Chess(sdk);
    await chess.move({ from: 'a1', to: 'a2' });
  });
});
