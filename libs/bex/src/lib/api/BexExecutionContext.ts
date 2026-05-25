import { BlueNode } from '@blue-labs/language';
import { BexStepResults } from './BexStepResults';
import { BexValue, BexValues } from '../value/BexValues';

type FrozenNodeLike = {
  toNode(): BlueNode;
};

type DocumentSnapshot = BlueNode | FrozenNodeLike;

export class BexExecutionContext {
  public documentScope = '/';
  public rootDocument?: BlueNode;
  public canonicalDocument?: BlueNode;
  public resolvedDocument?: BlueNode;
  public event = BexValues.undefined();
  public currentContract = BexValues.undefined();
  public steps = new BexStepResults();
  public gasLimit = 1_000_000;
  public bindings = new Map<string, BexValue>();

  public static builder(): BexExecutionContextBuilder {
    return new BexExecutionContextBuilder();
  }
}

export class BexExecutionContextBuilder {
  private readonly context = new BexExecutionContext();

  public document(
    rootDocument: DocumentSnapshot,
    documentScope = '/',
    resolvedDocument?: DocumentSnapshot,
  ): this {
    this.context.rootDocument = this.toNode(rootDocument);
    this.context.canonicalDocument = this.context.rootDocument;
    this.context.documentScope = documentScope;
    if (resolvedDocument !== undefined) {
      this.context.resolvedDocument = this.toNode(resolvedDocument);
    }
    return this;
  }

  public canonicalDocument(document: DocumentSnapshot): this {
    this.context.canonicalDocument = this.toNode(document);
    this.context.rootDocument = this.context.canonicalDocument;
    return this;
  }

  public resolvedDocument(document: DocumentSnapshot): this {
    this.context.resolvedDocument = this.toNode(document);
    return this;
  }

  public event(value: BexValue): this {
    this.context.event = value;
    this.context.bindings.set('event', value);
    return this;
  }

  public currentContract(value: BexValue): this {
    this.context.currentContract = value;
    this.context.bindings.set('currentContract', value);
    return this;
  }

  public steps(value: BexStepResults): this {
    this.context.steps = value;
    this.context.bindings.set('steps', value.asValue());
    return this;
  }

  public binding(name: string, value: BexValue): this {
    this.context.bindings.set(name, value);
    return this;
  }

  public gasLimit(value: number): this {
    this.context.gasLimit = value;
    return this;
  }

  public build(): BexExecutionContext {
    return this.context;
  }

  private toNode(document: DocumentSnapshot): BlueNode {
    return 'toNode' in document ? document.toNode() : document;
  }
}
