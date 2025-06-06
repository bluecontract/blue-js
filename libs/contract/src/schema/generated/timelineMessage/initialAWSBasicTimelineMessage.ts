import {
  BaseBlueObject,
  BlueObject,
  BlueObjectStringValue,
} from '@blue-labs/language';

export type InitialAWSBasicTimelineMessageType = BlueObject & {
  name: 'AWS Basic Timeline with Secp256k1 Schnorr Signature';
};

export interface InitialAWSBasicTimelineMessage extends BaseBlueObject {
  type?: InitialAWSBasicTimelineMessageType;
  sqs: BlueObjectStringValue;
  publicKey?: BlueObjectStringValue;
}
