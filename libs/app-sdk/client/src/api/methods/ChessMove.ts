/* eslint-disable @typescript-eslint/no-unused-vars */

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
  @BlueMethod({ returnType: 'Boolean' })
  move(@BlueMethodParam('ChessMove') move: ChessMove): Promise<boolean> {
    throw new Error('Not implemented.');
  }
}
