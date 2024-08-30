/**
 * ts-to-zod configuration.
 *
 * @type {import("ts-to-zod").TsToZodConfig}
 */
module.exports = [
  {
    name: 'source',
    input: 'src/schema/generated/blueObject.ts',
    output: 'src/schema/generated/blueObject.zod.ts',
    jsDocTagFilter: (tags) =>
      !tags.map((tag) => tag.name).includes('ts-to-zod-ignore'), // <= rule here
  },
];
