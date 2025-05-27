import { BlueNode } from '../../model/Node';
import { ContractProcessor } from '../types';

/**
 * Registry for contract processors with type ordering
 *
 * Manages the registration and lookup of contract processors
 * while preserving order information for execution priority.
 */
export class ContractRegistry {
  private readonly processors = new Map<string, ContractProcessor>();
  private readonly typeOrder = new Map<string, number>();

  /**
   * Creates a new contract registry
   *
   * @param list - Initial list of processors to register
   */
  constructor(list: ContractProcessor[] = []) {
    list.forEach((p, i) => this.register(p, i));
  }

  /**
   * Registers a new contract processor
   *
   * @param proc - The processor to register
   * @param orderHint - Optional priority value for execution order
   * @throws Error if a processor for the same contract type is already registered
   */
  register(proc: ContractProcessor, orderHint?: number): void {
    if (this.processors.has(proc.contractBlueId)) {
      throw new Error(`Processor for ${proc.contractType} already registered`);
    }
    this.processors.set(proc.contractBlueId, proc);
    if (!this.typeOrder.has(proc.contractBlueId)) {
      this.typeOrder.set(proc.contractBlueId, orderHint ?? this.typeOrder.size);
    }
  }

  /**
   * Gets a processor by contract type node
   *
   * @param typeNode - The contract type node
   * @returns The associated processor or undefined
   */
  get(typeNode?: BlueNode): ContractProcessor | undefined {
    if (!typeNode) return undefined;
    const blueId = typeNode.getBlueId();
    if (!blueId) return undefined;
    return this.processors.get(blueId);
  }

  /**
   * Gets the order priority for a contract type node
   *
   * @param typeNode - The contract type node
   * @returns The priority value (0 if not found)
   */
  orderOf(typeNode?: BlueNode): number {
    if (!typeNode) return 0;
    const blueId = typeNode.getBlueId();
    if (!blueId) return 0;
    return this.typeOrder.get(blueId) ?? 0;
  }

  /**
   * Gets all registered processors
   *
   * @returns Iterator of all registered processors
   */
  values(): IterableIterator<ContractProcessor> {
    return this.processors.values();
  }
}
