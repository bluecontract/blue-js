import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';

function loadYamlFromResources(filename: string): Record<string, any> {
  const resourcePath = path.join(__dirname, 'resources', filename);
  const yamlContent = fs.readFileSync(resourcePath, 'utf8');
  return yaml.load(yamlContent) as Record<string, any>;
}

describe('BlueDocumentProcessor - Advanced Contract Testing', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  describe('Example 2 - Dynamic Workflow Creation', () => {
    it('should create a new workflow contract dynamically', async () => {
      const doc = loadYamlFromResources('example2.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 't',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      expect(jsonState.counter).toBe(2);
      expect(jsonState.contracts?.wf2).toBeDefined();
      expect(jsonState.secondCounter).toBe(1);
    });
  });

  describe('Example 3 - Contract Removal and Replacement', () => {
    it('should remove a contract and add a new one dynamically', async () => {
      const doc = loadYamlFromResources('example3.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 't',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      expect(jsonState.counter).toBe(1);
      expect(jsonState.contracts?.wf2).toBeUndefined();
      expect(jsonState.contracts?.wf2new).toBeDefined();
      expect(jsonState.secondCounter).toBe(0);
    });
  });

  describe('Example 4 - Multiple Workflows and Channels', () => {
    it('should handle counter updates and trigger salary multiplication', async () => {
      const doc = loadYamlFromResources('example4.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 't',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      expect(jsonState.counter).toBe(1);
      expect(jsonState.salary).toBe(20);
    });
  });

  describe('Example 5 - Sequential Workflows on Same Channel', () => {
    it('should execute multiple workflows from the same timeline event in order of sequence number', async () => {
      const doc = loadYamlFromResources('example5.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 't',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      expect(jsonState.counter).toBe(1);
      expect(jsonState.salary).toBe(40);
    });
  });

  describe('Example 6 - Embedded Document Processing', () => {
    it('should handle embedded documents with their own contracts', async () => {
      const doc = loadYamlFromResources('example6.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 't',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state, 'simple') as any;

      expect(jsonState.counter).toBe(1);
      expect(jsonState.salary).toBe(40);
      expect(jsonState.emb.counter2).toBe(1);
      expect(jsonState.emb.salary2).toBe(1);
    });
  });

  describe('Example 7 - Deeply Nested Embedded Documents', () => {
    it('should fire the sub-document workflow (wfSub1) when subTimeline1 ticks', async () => {
      const doc = loadYamlFromResources('example7.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state: state1 } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 'sub1T',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state1, 'simple') as any;

      expect(jsonState.embA.subDoc1.count1).toBe(5);
      expect(jsonState.embA.subDoc1.metrics.score).toBe(6);
    });

    it('should fire the sub-document workflow (wfA1) when embTimeline ticks', async () => {
      const doc = loadYamlFromResources('example7.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state: state2 } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 'aT',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state2, 'simple') as any;

      expect(jsonState.embA.counterA).toBe(1);
      expect(jsonState.embA.salaryA).toBe(22);
    });

    it('should fire the sub-document workflow (wfNested) from emb.nestedB1 when nestedTimeline ticks', async () => {
      const doc = loadYamlFromResources('example7.yaml');

      const docNode = blue.jsonValueToNode(doc);
      const { state: state3 } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 'nestedB1T',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state3, 'simple') as any;

      expect(jsonState.embB.nestedB1.x).toBe(7);
      expect(jsonState.embB.nestedB1.y).toBe(8);
      expect(jsonState.embB.nestedB1.yUpdates).toBe(1);
      expect(jsonState.counter).toBe(2);
      expect(jsonState.salary).toBe(3);
    });

    it('should fire the sub-document workflow (wfB1) from emb.nestedB1 and emb when embBTimeline ticks', async () => {
      const doc = loadYamlFromResources('example7.yaml');

      const docNode = blue.jsonValueToNode(doc);

      const { state: state4 } = await documentProcessor.processEvents(docNode, [
        {
          type: 'Timeline Entry',
          timeline: 'bT',
          message: { type: 'Ping' },
        },
      ]);

      const jsonState = blue.nodeToJson(state4, 'simple') as any;

      expect(jsonState.embB.nestedB1.x).toBe(1);
      expect(jsonState.embB.nestedB1.y).toBe(1);
      expect(jsonState.embB.nestedB1.yUpdates).toBe(0);
      expect(jsonState.counter).toBe(2);
      expect(jsonState.salary).toBe(3);
    });
  });
});
