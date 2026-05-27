import { createPublicKey, verify } from 'node:crypto';

import {
  BexEngine,
  BexIntrinsicRegistry,
  BexValues,
  type BexIntrinsicProcessor,
} from '@blue-labs/bex';
import {
  blueRepository,
  coordinationBlueIds,
  ContractProcessorRegistry,
  ContractProcessorRegistryBuilder,
  createDefaultMergingProcessor,
  DocumentProcessor,
  DocumentProcessorBuilder,
  myosBlueIds,
  type DocumentProcessorOptions,
} from '@blue-labs/document-processor';
import { Blue, type BlueRepository } from '@blue-labs/language';
import { blueIds as commonBlueIds } from '@blue-repository/types/packages/common/blue-ids';

export const COMMON_CRYPTO_ED25519_VERIFY_GAS = 500;

const COMMON_CRYPTO_ED25519_VERIFY_BLUE_ID =
  commonBlueIds['Common/Crypto Ed25519 Verify'];

const LEGACY_CRYPTO_ED25519_VERIFY_BLUE_ID =
  '6P98bLNKcsNPUovBBsLu6W3BQnrg6F8TPjhbZhegrDSL';
const LEGACY_TIMELINE_CHANNEL_BLUE_ID =
  '84v6rvTN2CQq2c9FmViEc5rx3TSUaMLi6R4mHgqzoBkW';
const LEGACY_MYOS_TIMELINE_CHANNEL_BLUE_ID =
  'B734e6ZNoHfjhBF6L2W1MvQ1Wok2ihCMRauBiWhoyk7T';
const LEGACY_DOCUMENT_SECTION_BLUE_ID =
  'HiM1XEPoxkHoKPURVbtu2Cc5CvFvXqjkNxVtd3PUnJWu';

export interface CoordinationProcessorOptions extends Omit<
  DocumentProcessorOptions,
  'bexEngine'
> {
  readonly bexEngine?: BexEngine;
  readonly intrinsics?: BexIntrinsicRegistry;
}

export function createCoordinationBlue(): Blue {
  return new Blue({
    repositories: [coordinationRepository()],
    mergingProcessor: createDefaultMergingProcessor(),
  });
}

export function createCoordinationBexEngine(
  options: Pick<CoordinationProcessorOptions, 'bexEngine' | 'intrinsics'> = {},
): BexEngine {
  return (
    options.bexEngine ??
    BexEngine.builder()
      .intrinsics(options.intrinsics ?? CoordinationBexIntrinsics.common())
      .build()
  );
}

export function createCoordinationRegistry(
  options: Pick<CoordinationProcessorOptions, 'bexEngine' | 'intrinsics'> = {},
): ContractProcessorRegistry {
  return ContractProcessorRegistryBuilder.create({
    bexEngine: createCoordinationBexEngine(options),
  })
    .registerDefaults()
    .build();
}

export function createCoordinationProcessor(
  options: CoordinationProcessorOptions = {},
): DocumentProcessor {
  const bexEngine = createCoordinationBexEngine(options);
  return new DocumentProcessor({
    blue: options.blue ?? createCoordinationBlue(),
    registry: options.registry ?? createCoordinationRegistry({ bexEngine }),
    bexEngine,
  });
}

export function configureCoordinationProcessorBuilder(
  builder: DocumentProcessorBuilder,
  options: CoordinationProcessorOptions = {},
): DocumentProcessorBuilder {
  const bexEngine = createCoordinationBexEngine(options);
  if (options.blue) {
    builder.withBlue(options.blue);
  }
  builder.withBexEngine(bexEngine);
  if (options.registry) {
    builder.withRegistry(options.registry);
  }
  return builder;
}

export class CoordinationBexIntrinsics {
  static common(): BexIntrinsicRegistry {
    return this.registerCommon(BexIntrinsicRegistry.empty());
  }

  static registerCommon(registry: BexIntrinsicRegistry): BexIntrinsicRegistry {
    const processor = this.commonCryptoEd25519Verify();
    return registry
      .with(COMMON_CRYPTO_ED25519_VERIFY_BLUE_ID, processor)
      .with(LEGACY_CRYPTO_ED25519_VERIFY_BLUE_ID, processor)
      .with('Common/Crypto Ed25519 Verify', processor);
  }

  static commonCryptoEd25519Verify(): BexIntrinsicProcessor {
    return (invocation) => {
      invocation.chargeGas(COMMON_CRYPTO_ED25519_VERIFY_GAS);
      return BexValues.fromSimple(
        verifyEd25519(
          textField(invocation.field('publicKey')),
          textField(invocation.field('message')),
          textField(invocation.field('signature')),
        ),
      );
    };
  }
}

function verifyEd25519(
  publicKeyText: string | null,
  message: string | null,
  signatureText: string | null,
): boolean {
  if (publicKeyText === null || message === null || signatureText === null) {
    return false;
  }
  const publicKey = decodeBase64Url(publicKeyText, 32);
  const signature = decodeBase64Url(signatureText, 64);
  if (publicKey === null || signature === null) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'),
        publicKey,
      ]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(message, 'utf8'), key, signature);
  } catch {
    return false;
  }
}

function textField(
  value: ReturnType<typeof BexValues.fromSimple>,
): string | null {
  const simple = value.toSimple();
  return typeof simple === 'string' ? simple : null;
}

function decodeBase64Url(value: string, expectedLength: number): Buffer | null {
  const normalized = value.trim();
  if (normalized.length % 4 === 1) {
    return null;
  }
  try {
    const decoded = Buffer.from(normalized, 'base64url');
    return decoded.length === expectedLength ? decoded : null;
  } catch {
    return null;
  }
}

function coordinationRepository(): BlueRepository {
  const commonPackage = blueRepository.packages.common;
  const coordinationPackage = blueRepository.packages.coordination;
  const myosPackage = blueRepository.packages.myos;
  if (!commonPackage || !coordinationPackage || !myosPackage) {
    return blueRepository as BlueRepository;
  }
  return {
    ...blueRepository,
    packages: {
      ...blueRepository.packages,
      common: {
        ...commonPackage,
        aliases: {
          ...commonPackage.aliases,
          [LEGACY_CRYPTO_ED25519_VERIFY_BLUE_ID]:
            COMMON_CRYPTO_ED25519_VERIFY_BLUE_ID,
        },
      },
      coordination: {
        ...coordinationPackage,
        aliases: {
          ...coordinationPackage.aliases,
          [LEGACY_TIMELINE_CHANNEL_BLUE_ID]:
            coordinationBlueIds['Coordination/Timeline Channel'],
          [LEGACY_DOCUMENT_SECTION_BLUE_ID]:
            coordinationBlueIds['Coordination/Document Section'],
        },
      },
      myos: {
        ...myosPackage,
        aliases: {
          ...myosPackage.aliases,
          [LEGACY_MYOS_TIMELINE_CHANNEL_BLUE_ID]:
            myosBlueIds['MyOS/MyOS Timeline Channel'],
        },
      },
    },
  } as BlueRepository;
}
