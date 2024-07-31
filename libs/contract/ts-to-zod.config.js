/**
 * ts-to-zod configuration.
 *
 * @type {import("ts-to-zod").TsToZodConfig}
 */
module.exports = [
  {
    name: 'source',
    input: 'src/schema/generated/source.ts',
    output: 'src/schema/generated/schema.zod.ts',
  },
];
