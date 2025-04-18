import { JsonBlueValue } from '../schema';
import { NodeToObjectConverter } from './mapping';
import { BlueNode, NodeDeserializer } from './model';
import { NodeProvider, createNodeProvider } from './NodeProvider';
import { TypeSchemaResolver } from './utils';
import { NodeProviderWrapper } from './utils/NodeProviderWrapper';
import { ZodTypeDef, ZodType } from 'zod';
import { calculateBlueId, calculateBlueIdSync, yamlBlueParse } from '../utils';
import { Preprocessor } from './preprocess/Preprocessor';
import { BlueDirectivePreprocessor } from './preprocess/BlueDirectivePreprocessor';
import {
  UrlContentFetcher,
  UrlFetchStrategy,
} from './provider/UrlContentFetcher';

export interface BlueOptions {
  nodeProvider?: NodeProvider;
  typeSchemaResolver?: TypeSchemaResolver;
  urlFetchStrategy?: UrlFetchStrategy;
}

export class Blue {
  private nodeProvider: NodeProvider;
  private typeSchemaResolver: TypeSchemaResolver | null;
  private blueDirectivePreprocessor: BlueDirectivePreprocessor;
  private urlContentFetcher: UrlContentFetcher;

  constructor(options: BlueOptions = {}) {
    const {
      nodeProvider,
      typeSchemaResolver = null,
      urlFetchStrategy,
    } = options;

    const defaultProvider = createNodeProvider(() => []);
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider || defaultProvider
    );

    this.typeSchemaResolver = typeSchemaResolver;

    this.urlContentFetcher = new UrlContentFetcher(urlFetchStrategy);
    this.blueDirectivePreprocessor = new BlueDirectivePreprocessor(
      undefined,
      this.urlContentFetcher
    );
  }

  public nodeToSchemaOutput<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  >(node: BlueNode, schema: ZodType<Output, Def, Input>): Output {
    const converter = new NodeToObjectConverter(this.typeSchemaResolver);
    return converter.convert(node, schema);
  }

  public jsonValueToNode(json: JsonBlueValue) {
    return this.preprocess(NodeDeserializer.deserialize(json));
  }

  public async jsonValueToNodeAsync(json: JsonBlueValue): Promise<BlueNode> {
    return this.preprocessAsync(NodeDeserializer.deserialize(json));
  }

  public yamlToNode(yaml: string) {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNode(json);
  }

  public async yamlToNodeAsync(yaml: string): Promise<BlueNode> {
    const json = yamlBlueParse(yaml);
    if (!json) {
      throw new Error('Failed to parse YAML to JSON');
    }
    return this.jsonValueToNodeAsync(json);
  }

  public calculateBlueId(value: JsonBlueValue) {
    return calculateBlueId(value);
  }

  public calculateBlueIdSync(value: JsonBlueValue) {
    return calculateBlueIdSync(value);
  }

  public addPreprocessingAliases(aliases: Map<string, string>): void {
    this.blueDirectivePreprocessor.addPreprocessingAliases(aliases);
  }

  public preprocess(node: BlueNode): BlueNode {
    const preprocessedNode = this.blueDirectivePreprocessor.process(node);
    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
      preprocessedNode
    );
  }

  public async preprocessAsync(node: BlueNode): Promise<BlueNode> {
    const preprocessedNode = await this.blueDirectivePreprocessor.processAsync(
      node
    );
    return new Preprocessor(this.nodeProvider).preprocessWithDefaultBlue(
      preprocessedNode
    );
  }

  public getNodeProvider(): NodeProvider {
    return this.nodeProvider;
  }

  public setNodeProvider(nodeProvider: NodeProvider): Blue {
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
    return this;
  }

  public getTypeSchemaResolver(): TypeSchemaResolver | null {
    return this.typeSchemaResolver;
  }

  public setTypeSchemaResolver(
    typeSchemaResolver: TypeSchemaResolver | null
  ): Blue {
    this.typeSchemaResolver = typeSchemaResolver;
    return this;
  }

  public getUrlContentFetcher(): UrlContentFetcher {
    return this.urlContentFetcher;
  }

  public setUrlFetchStrategy(urlFetchStrategy: UrlFetchStrategy): Blue {
    this.urlContentFetcher.setFetchStrategy(urlFetchStrategy);
    return this;
  }

  public getPreprocessingAliases(): Map<string, string> {
    return this.blueDirectivePreprocessor.getPreprocessingAliases();
  }

  public setPreprocessingAliases(aliases: Map<string, string>): Blue {
    this.blueDirectivePreprocessor.setPreprocessingAliases(aliases);
    return this;
  }
}
