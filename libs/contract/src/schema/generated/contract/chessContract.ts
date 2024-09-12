import {
  BlueObjectBooleanValue,
  BlueObjectStringValue,
} from '@blue-company/language';
import { Contract } from './contract';

export interface ChessContract extends Contract {
  properties: {
    chessboard: BlueObjectStringValue;
    playerToMove: {
      value: 'White' | 'Black';
    };
    winner: {
      value: 'White' | 'Black' | 'None';
    };
    draw: BlueObjectBooleanValue;
    gameOver: BlueObjectBooleanValue;
  };
}
