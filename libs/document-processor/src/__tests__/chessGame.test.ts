import { expect, describe, test, vi, beforeEach } from 'vitest';
import { InternalContext } from '../context';
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

/**
 * Loads a YAML document from the resources directory
 */
async function loadYamlDocument(
  filename: string,
): Promise<Record<string, any>> {
  const resourcePath = path.join(__dirname, 'resources', filename);
  const yamlContent = await fs.readFile(resourcePath, 'utf8');
  return yaml.load(yamlContent) as Record<string, any>;
}

describe('Chess Game with Two Timeline Channels', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  /**
   * Creates a timeline event for a player's move
   */
  function timelineEvent(timelineId: string, move: string) {
    return createTimelineEntryEvent(
      timelineId,
      { move, player: timelineId },
      blue,
    );
  }

  // Mock loadBlueContent to provide chess.js library
  beforeEach(() => {
    const originalLoad = InternalContext.prototype.loadBlueContent;
    vi.spyOn(InternalContext.prototype, 'loadBlueContent').mockImplementation(
      async (blueId: string) => {
        if (blueId === 'chess') {
          // Load chess.js from resources directory
          const chessJsPath = path.join(
            __dirname,
            'resources/chessjs-1.2.0.js',
          );
          return fs.readFile(chessJsPath, 'utf8');
        }
        // For other blueIds, use the original implementation
        return originalLoad.call(this, blueId);
      },
    );
  });

  test('should play a chess game through alternating moves', async () => {
    // Load document from YAML
    const doc = await loadYamlDocument('chessGame.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    // Play a sequence of moves
    // 1. e4 (White's first move)
    const whiteMove1 = timelineEvent('white-player', 'e4');
    const { state: state1 } = await documentProcessor.processEvents(
      initializedState,
      [whiteMove1],
    );

    // Verify game state after first move
    const state1Typed = blue.nodeToJson(state1, 'simple') as any;
    expect(state1Typed.gameState).toBeDefined();
    expect(state1Typed.gameState?.validMove).toBe(true);
    expect(state1Typed.gameState?.turn).toBe('black');
    expect(state1Typed.gameState?.history).toEqual(['e4']);

    // 2. e5 (Black's response)
    const blackMove1 = timelineEvent('black-player', 'e5');
    const { state: state2 } = await documentProcessor.processEvents(state1, [
      blackMove1,
    ]);

    // Verify game state after second move
    const state2Typed = blue.nodeToJson(state2, 'simple') as any;
    expect(state2Typed.gameState?.validMove).toBe(true);
    expect(state2Typed.gameState?.turn).toBe('white');
    expect(state2Typed.gameState?.history).toEqual(['e4', 'e5']);

    // 3. Wrong player tries to move (Black tries to move again)
    const invalidPlayerMove = timelineEvent('black-player', 'Nf6');
    const { state: state3 } = await documentProcessor.processEvents(state2, [
      invalidPlayerMove,
    ]);

    // Verify error is handled
    const state3Typed = blue.nodeToJson(state3, 'simple') as any;
    expect(state3Typed.gameState?.validMove).toBe(false);
    expect(state3Typed.gameState?.message).toBe('Not your turn');
    expect(state3Typed.gameState?.history).toEqual(['e4', 'e5']); // No change in history

    // 4. Invalid move (White attempts illegal knight move)
    const invalidMove = timelineEvent('white-player', 'Na4'); // Knights start at b1/g1
    const { state: state4 } = await documentProcessor.processEvents(state3, [
      invalidMove,
    ]);

    // Verify error is handled
    const state4Typed = blue.nodeToJson(state4, 'simple') as any;
    expect(state4Typed.gameState?.validMove).toBe(false);
    expect(state4Typed.gameState?.message).toContain('Invalid move');
    expect(state4Typed.gameState?.history).toEqual(['e4', 'e5']); // No change in history

    // 5. Play a complete sequence of the Scholar's Mate
    // White's second move: Qh5 (Queen to h5)
    const whiteMove2 = timelineEvent('white-player', 'Qh5');
    const { state: state5 } = await documentProcessor.processEvents(state4, [
      whiteMove2,
    ]);
    const state5Typed = blue.nodeToJson(state5, 'simple') as any;
    expect(state5Typed.gameState?.validMove).toBe(true);
    expect(state5Typed.gameState?.history).toEqual(['e4', 'e5', 'Qh5']);

    // Black's second move: Nc6 (Knight to c6)
    const blackMove2 = timelineEvent('black-player', 'Nc6');
    const { state: state6 } = await documentProcessor.processEvents(state5, [
      blackMove2,
    ]);
    const state6Typed = blue.nodeToJson(state6, 'simple') as any;
    expect(state6Typed.gameState?.validMove).toBe(true);
    expect(state6Typed.gameState?.history).toEqual(['e4', 'e5', 'Qh5', 'Nc6']);

    // White's third move: Bc4 (Bishop to c4)
    const whiteMove3 = timelineEvent('white-player', 'Bc4');
    const { state: state7 } = await documentProcessor.processEvents(state6, [
      whiteMove3,
    ]);
    const state7Typed = blue.nodeToJson(state7, 'simple') as any;
    expect(state7Typed.gameState?.validMove).toBe(true);
    expect(state7Typed.gameState?.history).toEqual([
      'e4',
      'e5',
      'Qh5',
      'Nc6',
      'Bc4',
    ]);

    // Black's third move: Nf6?? (Knight to f6) - blunder
    const blackMove3 = timelineEvent('black-player', 'Nf6');
    const { state: state8 } = await documentProcessor.processEvents(state7, [
      blackMove3,
    ]);
    const state8Typed = blue.nodeToJson(state8, 'simple') as any;
    expect(state8Typed.gameState?.validMove).toBe(true);
    expect(state8Typed.gameState?.history).toEqual([
      'e4',
      'e5',
      'Qh5',
      'Nc6',
      'Bc4',
      'Nf6',
    ]);

    // White's fourth move: Qxf7# (Queen takes pawn at f7, checkmate)
    const whiteMove4 = timelineEvent('white-player', 'Qxf7#');
    const { state: state9 } = await documentProcessor.processEvents(state8, [
      whiteMove4,
    ]);

    // Verify checkmate
    const state9Typed = blue.nodeToJson(state9, 'simple') as any;

    expect(state9Typed.gameState?.validMove).toBe(true);
    expect(state9Typed.gameState?.isCheckmate).toBe(true);
    expect(state9Typed.gameState?.winner).toBe('white');
    expect(state9Typed.gameState?.history).toEqual([
      'e4',
      'e5',
      'Qh5',
      'Nc6',
      'Bc4',
      'Nf6',
      'Qxf7#',
    ]);
  });
});
