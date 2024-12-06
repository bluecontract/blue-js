/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  BlueMethodApiClient,
  BlueMethod,
  BlueMethodParam,
} from '../decorators';

@BlueMethodApiClient
export abstract class EmailSetterMethod {
  @BlueMethod({ returnType: 'Boolean' })
  setEmail(
    @BlueMethodParam('Text') email: string,
    @BlueMethodParam('Boolean') force?: boolean
  ): Promise<boolean> {
    throw new Error('Not implemented.');
  }
}