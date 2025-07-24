import { PathLimits, PathLimitsBuilder } from '../PathLimits';

describe('PathLimits', () => {
  let pathLimits: PathLimits;

  beforeEach(() => {
    pathLimits = new PathLimitsBuilder()
      .addPath('/x/*')
      .addPath('/y')
      .addPath('/a/b/*/c')
      .addPath('/d/0/*')
      .addPath('/e/*/*')
      .addPath('/forX/d/0')
      .addPath('/f/*/*')
      .setMaxDepth(4)
      .build();
  });

  test('testShouldProcessPathSegment', () => {
    expect(pathLimits.shouldExtendPathSegment('x')).toBe(true);
    pathLimits.enterPathSegment('x');
    expect(pathLimits.shouldExtendPathSegment('a')).toBe(true);
    pathLimits.enterPathSegment('a');
    expect(pathLimits.shouldExtendPathSegment('d')).toBe(false);
    pathLimits.exitPathSegment();
    expect(pathLimits.shouldExtendPathSegment('y')).toBe(true);
    pathLimits.exitPathSegment();

    pathLimits.enterPathSegment('y');
    expect(pathLimits.shouldExtendPathSegment('c')).toBe(false);
    pathLimits.exitPathSegment();

    pathLimits.enterPathSegment('a');
    pathLimits.enterPathSegment('b');
    expect(pathLimits.shouldExtendPathSegment('d')).toBe(true);
    pathLimits.enterPathSegment('d');
    expect(pathLimits.shouldExtendPathSegment('c')).toBe(true);
  });

  test('testMaxDepth', () => {
    pathLimits.enterPathSegment('a');
    pathLimits.enterPathSegment('b');
    expect(pathLimits.shouldExtendPathSegment('any')).toBe(true);
    pathLimits.enterPathSegment('any');
    expect(pathLimits.shouldExtendPathSegment('c')).toBe(true);
    pathLimits.enterPathSegment('c');
    expect(pathLimits.shouldExtendPathSegment('e')).toBe(false);
  });

  test('testWildcardSingle', () => {
    pathLimits.enterPathSegment('a');
    pathLimits.enterPathSegment('b');
    expect(pathLimits.shouldExtendPathSegment('any')).toBe(true);
    pathLimits.enterPathSegment('any');
    expect(pathLimits.shouldExtendPathSegment('c')).toBe(true);
  });

  test('testComplexPath', () => {
    pathLimits.enterPathSegment('a');
    pathLimits.enterPathSegment('b');
    expect(pathLimits.shouldExtendPathSegment('c')).toBe(true);
    pathLimits.enterPathSegment('c');
    expect(pathLimits.shouldExtendPathSegment('e')).toBe(false);
  });

  test('testInvalidPath', () => {
    pathLimits.enterPathSegment('z');
    expect(pathLimits.shouldExtendPathSegment('a')).toBe(false);
  });

  test('testPathWithIndex', () => {
    pathLimits.enterPathSegment('d');
    expect(pathLimits.shouldExtendPathSegment('0')).toBe(true);
    pathLimits.enterPathSegment('0');
    expect(pathLimits.shouldExtendPathSegment('any')).toBe(true);
    pathLimits.exitPathSegment();
    expect(pathLimits.shouldExtendPathSegment('1')).toBe(false);
  });

  test('testMultipleWildcards', () => {
    pathLimits.enterPathSegment('e');
    expect(pathLimits.shouldExtendPathSegment('0')).toBe(true);
    pathLimits.enterPathSegment('0');
    expect(pathLimits.shouldExtendPathSegment('1')).toBe(true);
  });

  test('testSpecificIndexPath', () => {
    const specificPathLimits = new PathLimitsBuilder()
      .addPath('/forX/d/0')
      .build();

    expect(specificPathLimits.shouldExtendPathSegment('forX')).toBe(true);
    specificPathLimits.enterPathSegment('forX');

    expect(specificPathLimits.shouldExtendPathSegment('d')).toBe(true);
    specificPathLimits.enterPathSegment('d');

    expect(specificPathLimits.shouldExtendPathSegment('0')).toBe(true);
    specificPathLimits.enterPathSegment('0');

    expect(specificPathLimits.shouldExtendPathSegment('any')).toBe(false);

    specificPathLimits.exitPathSegment();

    expect(specificPathLimits.shouldExtendPathSegment('1')).toBe(false);
  });

  test('testTwoLevelWildcard', () => {
    expect(pathLimits.shouldExtendPathSegment('f')).toBe(true);
    pathLimits.enterPathSegment('f');

    expect(pathLimits.shouldExtendPathSegment('anySegment')).toBe(true);
    pathLimits.enterPathSegment('anySegment');

    expect(pathLimits.shouldExtendPathSegment('anotherSegment')).toBe(true);
    pathLimits.enterPathSegment('anotherSegment');

    expect(pathLimits.shouldExtendPathSegment('tooDeep')).toBe(false);

    pathLimits.exitPathSegment();
    pathLimits.exitPathSegment();
    expect(pathLimits.shouldExtendPathSegment('differentSegment')).toBe(true);
    pathLimits.enterPathSegment('differentSegment');

    expect(pathLimits.shouldExtendPathSegment('lastSegment')).toBe(true);
    pathLimits.enterPathSegment('lastSegment');

    expect(pathLimits.shouldExtendPathSegment('tooDeepAgain')).toBe(false);

    pathLimits.exitPathSegment();
    pathLimits.exitPathSegment();
    pathLimits.exitPathSegment();
    expect(pathLimits.shouldExtendPathSegment('g')).toBe(false);
  });

  describe('static factory methods', () => {
    test('withMaxDepth should create limits with max depth', () => {
      const depthLimits = PathLimits.withMaxDepth(2);

      expect(depthLimits.shouldExtendPathSegment('a')).toBe(true);
      depthLimits.enterPathSegment('a');
      expect(depthLimits.shouldExtendPathSegment('b')).toBe(true);
      depthLimits.enterPathSegment('b');
      expect(depthLimits.shouldExtendPathSegment('c')).toBe(false);
    });

    test('withSinglePath should create limits with single path', () => {
      const singlePathLimits = PathLimits.withSinglePath('/a/b');

      expect(singlePathLimits.shouldExtendPathSegment('a')).toBe(true);
      singlePathLimits.enterPathSegment('a');
      expect(singlePathLimits.shouldExtendPathSegment('b')).toBe(true);
      singlePathLimits.enterPathSegment('b');
      expect(singlePathLimits.shouldExtendPathSegment('c')).toBe(false);
    });
  });

  describe('shouldMergePathSegment', () => {
    test('should behave same as shouldExtendPathSegment', () => {
      // Reset to clean state
      const cleanLimits = new PathLimitsBuilder()
        .addPath('/x/*')
        .addPath('/y')
        .build();

      expect(cleanLimits.shouldMergePathSegment('x')).toBe(true);
      expect(cleanLimits.shouldExtendPathSegment('x')).toBe(true);

      cleanLimits.enterPathSegment('x');
      expect(cleanLimits.shouldMergePathSegment('any')).toBe(true);
      expect(cleanLimits.shouldExtendPathSegment('any')).toBe(true);

      cleanLimits.exitPathSegment();
      expect(cleanLimits.shouldMergePathSegment('z')).toBe(false);
      expect(cleanLimits.shouldExtendPathSegment('z')).toBe(false);
    });
  });
});
