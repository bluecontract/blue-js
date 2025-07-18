import { BlueNode } from '../Node';
import { NodeDeserializer } from '../NodeDeserializer';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { JsonBlueValue } from '../../../schema';
import Big from 'big.js';

describe('Node Contract Methods', () => {
  describe('getContracts', () => {
    it('should return undefined when no contracts exist', () => {
      const node = new BlueNode();
      expect(node.getContracts()).toBeUndefined();
    });

    it('should return contracts when they exist', () => {
      const doc = `
        name: TestContract
        contracts:
          partyA:
            name: Alice
            role: Buyer
          partyB:
            name: Bob
            role: Seller
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      const contracts = node.getContracts();
      expect(contracts).toBeDefined();
      expect(contracts?.['partyA']?.getName()).toEqual('Alice');
      expect(contracts?.['partyB']?.getName()).toEqual('Bob');
    });

    it('should return contracts with nested properties', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
            details:
              companyId: 12345
              department: Sales
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      const contracts = node.getContracts();
      expect(contracts).toBeDefined();

      const partyA = contracts?.['partyA'];
      expect(partyA?.getName()).toEqual('Alice');
      expect(
        partyA
          ?.getProperties()
          ?.['details']?.getProperties()
          ?.['companyId']?.getValue()
      ).toEqual(new Big('12345'));
      expect(
        partyA
          ?.getProperties()
          ?.['details']?.getProperties()
          ?.['department']?.getValue()
      ).toEqual('Sales');
    });
  });

  describe('setContracts', () => {
    it('should set contracts from a record', () => {
      const node = new BlueNode();
      const contracts = {
        partyA: new BlueNode().setName('Alice'),
        partyB: new BlueNode().setName('Bob'),
      };

      node.setContracts(contracts);

      const result = node.getContracts();
      expect(result).toBeDefined();
      expect(result?.['partyA']?.getName()).toEqual('Alice');
      expect(result?.['partyB']?.getName()).toEqual('Bob');
    });

    it('should remove contracts when set to undefined', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      // Verify contracts exist initially
      expect(node.getContracts()).toBeDefined();

      // Remove contracts
      node.setContracts(undefined);

      // Verify contracts are removed
      expect(node.getContracts()).toBeUndefined();
    });

    it('should replace existing contracts', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      // Verify initial contracts
      expect(node.getContracts()?.['partyA']?.getName()).toEqual('Alice');

      // Replace with new contracts
      const newContracts = {
        partyB: new BlueNode().setName('Bob'),
        partyC: new BlueNode().setName('Charlie'),
      };

      node.setContracts(newContracts);

      // Verify old contracts are gone and new ones exist
      expect(node.getContracts()?.['partyA']).toBeUndefined();
      expect(node.getContracts()?.['partyB']?.getName()).toEqual('Bob');
      expect(node.getContracts()?.['partyC']?.getName()).toEqual('Charlie');
    });
  });

  describe('addContract', () => {
    it('should add a contract when no contracts exist', () => {
      const node = new BlueNode();
      const contract = new BlueNode()
        .setName('Alice')
        .addProperty('role', new BlueNode().setValue('Buyer'));

      node.addContract('partyA', contract);

      const contracts = node.getContracts();
      expect(contracts).toBeDefined();
      expect(contracts?.['partyA']?.getName()).toEqual('Alice');
      expect(
        contracts?.['partyA']?.getProperties()?.['role']?.getValue()
      ).toEqual('Buyer');
    });

    it('should add a contract when contracts already exist', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      const newContract = new BlueNode()
        .setName('Bob')
        .addProperty('role', new BlueNode().setValue('Seller'));

      node.addContract('partyB', newContract);

      const contracts = node.getContracts();
      expect(contracts?.['partyA']?.getName()).toEqual('Alice');
      expect(contracts?.['partyB']?.getName()).toEqual('Bob');
      expect(
        contracts?.['partyB']?.getProperties()?.['role']?.getValue()
      ).toEqual('Seller');
    });

    it('should add contract with complex nested structure', () => {
      const node = new BlueNode();

      const contract = new BlueNode()
        .setName('ComplexContract')
        .addProperty(
          'details',
          new BlueNode()
            .addProperty('companyId', new BlueNode().setValue(12345))
            .addProperty('department', new BlueNode().setValue('Sales'))
        )
        .addProperty(
          'items',
          new BlueNode().setItems([
            new BlueNode().setName('Item1'),
            new BlueNode().setName('Item2'),
          ])
        );

      node.addContract('complex', contract);

      const contracts = node.getContracts();
      const complexContract = contracts?.['complex'];

      expect(complexContract?.getName()).toEqual('ComplexContract');
      expect(
        complexContract
          ?.getProperties()
          ?.['details']?.getProperties()
          ?.['companyId']?.getValue()
      ).toEqual(new Big('12345'));
      expect(
        complexContract
          ?.getProperties()
          ?.['details']?.getProperties()
          ?.['department']?.getValue()
      ).toEqual('Sales');
      expect(
        complexContract?.getProperties()?.['items']?.getItems()
      ).toHaveLength(2);
      expect(
        complexContract?.getProperties()?.['items']?.getItems()?.[0]?.getName()
      ).toEqual('Item1');
      expect(
        complexContract?.getProperties()?.['items']?.getItems()?.[1]?.getName()
      ).toEqual('Item2');
    });
  });

  describe('removeContract', () => {
    it('should remove an existing contract', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
          partyB:
            name: Bob
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      // Verify both contracts exist initially
      expect(node.getContracts()?.['partyA']?.getName()).toEqual('Alice');
      expect(node.getContracts()?.['partyB']?.getName()).toEqual('Bob');

      // Remove partyA
      node.removeContract('partyA');

      // Verify partyA is removed but partyB remains
      expect(node.getContracts()?.['partyA']).toBeUndefined();
      expect(node.getContracts()?.['partyB']?.getName()).toEqual('Bob');
    });

    it('should do nothing when removing non-existent contract', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      // Remove non-existent contract
      node.removeContract('nonExistent');

      // Verify existing contract is unchanged
      expect(node.getContracts()?.['partyA']?.getName()).toEqual('Alice');
    });

    it('should do nothing when no contracts exist', () => {
      const node = new BlueNode();

      // Should not throw an error
      expect(() => node.removeContract('anyKey')).not.toThrow();

      // Contracts should still be undefined
      expect(node.getContracts()).toBeUndefined();
    });

    it('should remove the last contract and remove contracts property entirely', () => {
      const doc = `
        contracts:
          partyA:
            name: Alice
      `;

      const map = yamlBlueParse(doc) as JsonBlueValue;
      const node = NodeDeserializer.deserialize(map);

      // Remove the only contract
      node.removeContract('partyA');

      // Contracts property should be completely removed
      expect(node.getProperties()?.['contracts']).toBeUndefined();
      expect(node.getContracts()).toBeUndefined();
    });
  });
});
