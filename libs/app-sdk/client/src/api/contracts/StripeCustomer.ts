import { BlueMethodApiClient } from '../decorators';
import { EmailSetterMethod } from '../methods/EmailSetter';

@BlueMethodApiClient
export class StripeCustomer extends EmailSetterMethod {
  email?: string;
  invoicePrefix?: string;
}
