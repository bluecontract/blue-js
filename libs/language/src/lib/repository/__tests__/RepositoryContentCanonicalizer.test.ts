import { describe, expect, it } from 'vitest';
import { canonicalizeRepositoryContent } from '../RepositoryContentCanonicalizer';
import { TEXT_TYPE_BLUE_ID } from '../../utils/Properties';

describe('canonicalizeRepositoryContent', () => {
  it('normalizes anonymous core aliases in repository type controls', () => {
    expect(
      canonicalizeRepositoryContent({
        keyType: {
          type: {
            blueId: TEXT_TYPE_BLUE_ID,
          },
        },
      }),
    ).toEqual({
      keyType: {
        blueId: TEXT_TYPE_BLUE_ID,
      },
    });
  });

  it('preserves non-empty inline type definitions in repository type controls', () => {
    expect(
      canonicalizeRepositoryContent({
        keyType: {
          name: 'Key',
          type: {
            blueId: TEXT_TYPE_BLUE_ID,
          },
        },
      }),
    ).toEqual({
      keyType: {
        name: 'Key',
        type: {
          blueId: TEXT_TYPE_BLUE_ID,
        },
      },
    });
  });

  it('normalizes legacy repository expression strings to BEX objects', () => {
    expect(
      canonicalizeRepositoryContent({
        type: {
          blueId: TEXT_TYPE_BLUE_ID,
        },
        value: '${event.message.request.amountCompleted}',
      }),
    ).toEqual({
      $event: '/message/request/amountCompleted',
    });
  });
});
