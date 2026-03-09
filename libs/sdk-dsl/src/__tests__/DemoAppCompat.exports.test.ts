import {
  BasicBlueTypes,
  DocBuilder,
  type JsonObject,
  type JsonValue,
  toOfficialJson,
  toOfficialYaml,
} from '../lib';

describe('demo-app compatibility exports', () => {
  it('exports BasicBlueTypes and JSON helper types', () => {
    const typedObject: JsonObject = {
      status: 'ok',
      counters: [1, 2, 3],
      enabled: true,
    };
    const typedValue: JsonValue = typedObject;

    expect(BasicBlueTypes).toEqual({
      Text: 'Text',
      Integer: 'Integer',
      Double: 'Double',
      Boolean: 'Boolean',
      List: 'List',
      Dictionary: 'Dictionary',
    });
    expect(typedValue).toEqual(typedObject);
  });

  it('toOfficialJson matches buildJson for builders and Blue nodes', () => {
    const builder = DocBuilder.doc()
      .name('Compat export')
      .type('Conversation/Event')
      .field('/count', 2);

    const node = builder.buildDocument();

    expect(toOfficialJson(builder)).toEqual(builder.buildJson());
    expect(toOfficialJson(node)).toEqual(builder.buildJson());
  });

  it('toOfficialYaml exports the simple alias-style YAML representation', () => {
    const builder = DocBuilder.doc()
      .name('Compat export')
      .type('Conversation/Event')
      .field('/status', 'ready');

    expect(toOfficialYaml(builder)).toBe(
      [
        'name: Compat export',
        'type: Conversation/Event',
        'status: ready',
        '',
      ].join('\n'),
    );
  });
});
