import {
  DocumentNode,
  ProcessingContext,
  EventNode,
  ProcessingAction,
  HandlerTask,
  BlueNodeGetResult,
} from './types';
import { makePath } from './utils/path';
import { Blue, BlueNodePatch } from '@blue-labs/language';

export class InternalContext implements ProcessingContext {
  private readonly actions: ProcessingAction[] = [];

  constructor(
    private getDocument: () => DocumentNode,
    private taskInfo: HandlerTask,
    private blue: Blue,
    private onFlush?: (actions: ProcessingAction[]) => Promise<void>
  ) {}

  get(path: string): BlueNodeGetResult {
    const doc = this.getDocument();
    const resolvedPath = makePath(this.taskInfo.nodePath, path);
    return doc.get(resolvedPath);
  }

  addPatch(patch: BlueNodePatch): void {
    this.actions.push({
      kind: 'patch',
      patch: {
        ...patch,
        path: makePath(this.taskInfo.nodePath, patch.path),
      },
    });
  }

  emitEvent(event: EventNode): void {
    const inputEvent = this.taskInfo.event;
    const inputEventTrace = inputEvent.trace ?? [];

    const enriched: EventNode = {
      ...event,
      source: event.source ?? 'internal',
      originNodePath: event.originNodePath ?? this.taskInfo.nodePath,
      rootEvent: event.rootEvent ?? inputEvent.rootEvent ?? inputEvent,
      trace: [...inputEventTrace],
    };
    this.actions.push({ kind: 'event', event: enriched });
  }

  async flush(): Promise<ProcessingAction[]> {
    if (!this.actions.length) return [];
    const out = [...this.actions];
    this.actions.length = 0;
    await this.onFlush?.(out);
    return out;
  }

  getNodePath(): string {
    return this.taskInfo.nodePath;
  }

  resolvePath(path: string): string {
    return makePath(this.taskInfo.nodePath, path);
  }

  getTaskInfo(): HandlerTask | undefined {
    return this.taskInfo;
  }

  getBlue(): Blue {
    return this.blue;
  }

  /* TODO: Move to a separate interface */
  loadExternalModule(): Promise<string> {
    throw new Error('Not implemented');
  }

  loadBlueContent(blueId: string): Promise<string> {
    const blueNode = this.blue.getNodeProvider().fetchFirstByBlueId(blueId);
    if (!blueNode) {
      throw new Error(`Blue node not found for blueId: ${blueId}`);
    }

    return Promise.resolve(JSON.stringify(this.blue.nodeToJson(blueNode)));
  }
}
