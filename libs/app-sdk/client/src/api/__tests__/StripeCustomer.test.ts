import { StripeCustomer } from '../contracts/StripeCustomer';
import { Chess } from '../contracts/Chess';

describe('StripeCustomer', () => {
  it('should set the email', async () => {
    const customer = new StripeCustomer();
    await customer.setEmail('abc@def.com');

    const chess = new Chess();
    await chess.move({ from: 'a1', to: 'a2' });
  });
});
