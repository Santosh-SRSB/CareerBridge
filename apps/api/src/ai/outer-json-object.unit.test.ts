import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { outerJsonObject as gatewayOuter } from './ai-gateway.service';
import { outerJsonObject as geminiOuter } from './providers/gemini.provider';

describe('outerJsonObject', () => {
  for (const [label, outerJsonObject] of [
    ['ai-gateway', gatewayOuter],
    ['gemini', geminiOuter],
  ] as const) {
    it(`${label} slices from the first brace to the last brace`, () => {
      assert.deepEqual(outerJsonObject('prefix {"a":1} trailing'), ['{"a":1}']);
      assert.deepEqual(outerJsonObject('{"a":{"b":2}}'), ['{"a":{"b":2}}']);
      assert.equal(outerJsonObject('no braces'), null);
      assert.equal(outerJsonObject('{ incomplete'), null);
      assert.equal(outerJsonObject('}{'), null);
    });
  }
});
