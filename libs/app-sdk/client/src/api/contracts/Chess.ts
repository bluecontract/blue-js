import { BlueMethodApiClient } from '../decorators';
import { ChessMoveMethod } from '../methods/ChessMove';

@BlueMethodApiClient
export class Chess extends ChessMoveMethod {
  public board = '';
}
