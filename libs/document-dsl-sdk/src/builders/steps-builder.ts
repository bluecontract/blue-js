import { expr } from '../expr.js';
import type { BlueObject, BlueValue } from '../types.js';
import { ChangesetBuilder } from './changeset-builder.js';

export type StepsFactory =
  | ((steps: StepsBuilder) => void)
  | BlueObject[]
  | undefined;

export class StepsBuilder {
  private readonly steps: BlueObject[];

  public constructor(initial?: BlueObject[]) {
    this.steps = initial ?? [];
  }

  public jsRaw(name: string, code: string): this {
    this.steps.push({
      name,
      type: 'Conversation/JavaScript Code',
      code,
    });
    return this;
  }

  public updateDocument(
    name: string,
    changes:
      | ((changeset: ChangesetBuilder) => void)
      | BlueObject[]
      | ChangesetBuilder,
  ): this {
    let changeset: BlueObject[];
    if (changes instanceof ChangesetBuilder) {
      changeset = changes.build();
    } else if (typeof changes === 'function') {
      const builder = new ChangesetBuilder();
      changes(builder);
      changeset = builder.build();
    } else {
      changeset = changes;
    }

    this.steps.push({
      name,
      type: 'Conversation/Update Document',
      changeset,
    });
    return this;
  }

  public updateDocumentFromExpression(name: string, expression: string): this {
    this.steps.push({
      name,
      type: 'Conversation/Update Document',
      changeset: expr(expression),
    });
    return this;
  }

  public triggerEvent(name: string, event: BlueValue): this {
    this.steps.push({
      name,
      type: 'Conversation/Trigger Event',
      event,
    });
    return this;
  }

  public replaceValue(name: string, path: string, value: BlueValue): this {
    return this.updateDocument(name, [{ op: 'replace', path, value }]);
  }

  public replaceExpression(name: string, path: string, expression: string): this {
    return this.updateDocument(name, [
      { op: 'replace', path, value: expr(expression) },
    ]);
  }

  public rawStep(step: BlueObject): this {
    this.steps.push(step);
    return this;
  }

  public addAll(stepsFactory: StepsFactory): this {
    if (!stepsFactory) {
      return this;
    }
    if (typeof stepsFactory === 'function') {
      stepsFactory(this);
      return this;
    }
    this.steps.push(...stepsFactory);
    return this;
  }

  public build(): BlueObject[] {
    return this.steps;
  }
}
