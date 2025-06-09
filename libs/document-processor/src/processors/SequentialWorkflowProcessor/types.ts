import { DocumentNode, EventNode, ProcessingContext } from '../../types';

export interface WorkflowStepExecutor {
  readonly stepType: string;
  supports(step: DocumentNode): boolean;
  execute(
    step: DocumentNode,
    event: EventNode,
    ctx: ProcessingContext,
    documentPath: string,
    steps?: Record<string, unknown>,
  ): Promise<unknown>;
}
