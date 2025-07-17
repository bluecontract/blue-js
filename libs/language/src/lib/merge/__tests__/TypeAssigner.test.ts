import { describe, it, expect } from 'vitest';
import { TypeAssigner } from '../processors/TypeAssigner';
import { ValuePropagator } from '../processors/ValuePropagator';
import { SequentialMergingProcessor } from '../processors/SequentialMergingProcessor';
import { Merger } from '../Merger';
import { BlueNode, NodeDeserializer } from '../../model';
import { yamlBlueParse } from '../../../utils/yamlBlue';
import { BlueIdCalculator } from '../../utils/BlueIdCalculator';
import { NO_LIMITS } from '../../utils/limits';
import { JsonBlueValue } from '../../../schema';
import { BasicNodeProvider } from '../../provider/BasicNodeProvider';

describe('TypeAssigner', () => {
  it('testPropertySubtype - should handle property subtype correctly', () => {
    // Create nodes
    const a = new BlueNode('A');
    const b = new BlueNode('B').setType(
      new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(a))
    );
    const c = new BlueNode('C').setType(
      new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(b))
    );

    const x = new BlueNode('X').setProperties({
      a: new BlueNode().setType(
        new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(b))
      ),
    });

    const y = new BlueNode('Y')
      .setType(
        new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(x))
      )
      .setProperties({
        a: new BlueNode().setType(
          new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(c))
        ),
      });

    const nodeProvider = new BasicNodeProvider([a, b, c, x, y]);

    // Create merging processor with TypeAssigner
    const mergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
    ]);

    // Create merger and resolve
    const merger = new Merger(mergingProcessor, nodeProvider);
    const blueIdY = BlueIdCalculator.calculateBlueIdSync(y);
    const fetchedNodeY = nodeProvider.fetchByBlueId(blueIdY)?.[0];
    const resolvedNode = merger.resolve(fetchedNodeY!, NO_LIMITS);

    // Assert
    expect(resolvedNode.getProperties()?.a?.getType()?.getName()).toBe('C');
  });

  it('testEmptyTypeIsInherited - should inherit empty type from parent', () => {
    // Create nodes
    const a = new BlueNode('A');
    const b = new BlueNode('B').setType(
      new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(a))
    );
    const c = new BlueNode('C').setType(
      new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(b))
    );

    const x = new BlueNode('X').setProperties({
      a: new BlueNode().setType(
        new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(b))
      ),
    });

    const y = new BlueNode('Y')
      .setType(
        new BlueNode().setBlueId(BlueIdCalculator.calculateBlueIdSync(x))
      )
      .setProperties({
        a: new BlueNode(), // Empty type should inherit from parent
      });

    const nodeProvider = new BasicNodeProvider([a, b, c, x, y]);

    // Create merging processor with TypeAssigner
    const mergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
    ]);

    // Create merger and resolve
    const merger = new Merger(mergingProcessor, nodeProvider);
    const fetchedNodeY = nodeProvider.findNodeByName('Y');
    const resolvedNode = merger.resolve(fetchedNodeY!, NO_LIMITS);

    // Assert
    expect(resolvedNode.getProperties()?.a?.getType()?.getName()).toBe('B');
  });

  it('testPropertySubtypeOnYamlDocsWithNoBlueIds - should handle property subtype on YAML docs with no BlueIds', () => {
    const aYaml = 'name: A';

    const bYaml = `name: B
type:
  name: A`;

    const cYaml = `name: C
type:
  name: B
  type:
    name: A`;

    const xYaml = `name: X
a:
  type:
    name: A`;

    const yYaml = `name: Y
type:
  name: X
  a:
    type:
      name: A
a:
  type:
    name: B
    type:
      name: A`;

    // Parse YAML documents
    const nodes: BlueNode[] = [aYaml, bYaml, cYaml, xYaml, yYaml].map(
      (yaml) => {
        const parsed = yamlBlueParse(yaml) as JsonBlueValue;
        return NodeDeserializer.deserialize(parsed);
      }
    );

    const nodeProvider = new BasicNodeProvider(nodes);

    // Create merging processor with TypeAssigner
    const mergingProcessor = new SequentialMergingProcessor([
      new TypeAssigner(),
    ]);

    // Create merger and resolve
    const merger = new Merger(mergingProcessor, nodeProvider);
    const fetchedNodeY = nodeProvider.findNodeByName('Y');
    const resolvedNode = merger.resolve(fetchedNodeY!, NO_LIMITS);

    // Assert
    expect(resolvedNode.getProperties()?.a?.getType()?.getName()).toBe('B');
  });

  it('testDifferentSubtypeVariations2 - should handle different subtype variations', async () => {
    // Create sample nodes to simulate the directory-based test
    // Since we don't have the actual samples directory, we'll create test daata

    const voucherDetailsYaml = `name: General Hattori Hanzo Voucher
details:
  restaurantName: Hattori Hanzo
  validity:
    startDate: 2024-04-01
    endDate: 2024-12-31
  termsAndConditions:
    - Voucher must be presented before ordering.
    - Not redeemable for cash.
    - Cannot be combined with other offers or discounts.
    - Valid for dine-in only.
    - Excludes alcoholic beverages.
  redemptionProcess:
    - Present the voucher at the time of seating.
    - Inform the server of the voucher before ordering.
    - Enjoy your meal up to the voucher's value.
  exclusions:
    - Special events
    - Catering services
  purchaseChannels:
    - In-restaurant
    - Online through the official website
  customerSupport:
    phone: "+1234567890"
    email: "support@hattorihanzo.com"
issuer:
  name: Hattori Hanzo Dining Group
  address: 123 Samurai Lane, Kyoto, Japan
  contactInfo:
    phone: "+1234567890"
    email: "info@hattorihanzo.com"`;

    const voucherDetailsBlueId = BlueIdCalculator.calculateBlueIdSync(
      NodeDeserializer.deserialize(
        yamlBlueParse(voucherDetailsYaml) as JsonBlueValue
      )
    );

    const voucherKillBillYaml = `name: Celebrating Kill Bill Anniversary 2024
type:
  blueId: ${voucherDetailsBlueId}
availableMenuItems:
  appetizers:
    - SakuraSpringSalad:
        description: "A delicate mix of spring greens, cherry blossoms, and a light yuzu dressing."
        isVegetarian: true
    - EdamameWithSeaSalt:
        description: "Freshly steamed edamame sprinkled with sea salt."
        isVegetarian: true
    - TunaTataki:
        description: "Lightly seared tuna slices with ponzu sauce and scallions."
        isVegetarian: false
  mains:
    - TempuraTastingPlatter:
        description: "An assortment of seasonal vegetables and seafood in a light tempura batter."
        isVegetarian: false
    - GrilledMisoSalmon:
        description: "Salmon fillet marinated in miso and grilled to perfection."
        isVegetarian: false
    - VegetableSushiPlatter:
        description: "A variety of sushi featuring seasonal vegetables."
        isVegetarian: true
  desserts:
    - CherryBlossomRoll:
        description: "Sweet sushi roll with cherry blossom-infused cream and fresh fruit."
        isVegetarian: true
    - MatchaGreenTeaCheesecake:
        description: "Rich and creamy cheesecake with a bold matcha flavor."
        isVegetarian: true
    - YuzuSorbet:
        description: "Refreshing sorbet with the citrusy tang of yuzu."
        isVegetarian: true
  beverages:
    - SakuraMartini:
        description: "A floral martini with hints of cherry blossom and sake."
        isAlcoholic: true
    - GreenTeaLatte:
        description: "Creamy latte made with steamed milk and rich green tea."
        isAlcoholic: false
    - SparklingPlumWine:
        description: "Effervescent plum wine, perfect for toasting the season."
        isAlcoholic: true
`;

    const voucherKillBillBlueId = BlueIdCalculator.calculateBlueIdSync(
      NodeDeserializer.deserialize(
        yamlBlueParse(voucherKillBillYaml) as JsonBlueValue
      )
    );

    const myVoucherYaml = `name: My Voucher
type:
  blueId: ${voucherKillBillBlueId}
serialNumber: 30902345235
purchaseDate: 2024-04-01`;

    // Parse YAML documents
    const voucherDetails = NodeDeserializer.deserialize(
      yamlBlueParse(voucherDetailsYaml) as JsonBlueValue
    );
    const voucherKillBill = NodeDeserializer.deserialize(
      yamlBlueParse(voucherKillBillYaml) as JsonBlueValue
    );
    const myVoucher = NodeDeserializer.deserialize(
      yamlBlueParse(myVoucherYaml) as JsonBlueValue
    );

    const nodeProvider = new BasicNodeProvider([
      voucherDetails,
      voucherKillBill,
      myVoucher,
    ]);

    // Create merging processor with ValuePropagator and TypeAssigner
    const mergingProcessor = new SequentialMergingProcessor([
      new ValuePropagator(),
      new TypeAssigner(),
    ]);

    // Create merger and resolve
    const merger = new Merger(mergingProcessor, nodeProvider);
    const resolvedNode = merger.resolve(myVoucher, NO_LIMITS);

    // Assert
    expect(
      resolvedNode
        .getProperties()
        ?.details?.getProperties()
        ?.customerSupport?.getProperties()
        ?.phone?.getValue()
    ).toBe('+1234567890');
  });
});
