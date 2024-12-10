/* eslint-disable @typescript-eslint/no-unused-vars */

import { AppSDK } from '../../sdk';
import {
  BlueMethodApiClient,
  BlueMethod,
  BlueMethodParam,
} from '../decorators';

type ChessMove = {
  from: string;
  to: string;
};

@BlueMethodApiClient
export abstract class ChessMoveMethod {
  constructor(public sdk: AppSDK) {}

  @BlueMethod({ returnType: 'Boolean' })
  move(@BlueMethodParam('ChessMove') move: ChessMove): Promise<boolean> {
    throw new Error('Not implemented.');
  }
}
