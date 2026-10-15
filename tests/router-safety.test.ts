import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normListingUrl, AUTO_ARCHIVE_MAX_SHARE } from '../server/sync/pipeline-lambda.ts';

test('normListingUrl ignores scheme, www, trailing slash, case', () => {
  assert.equal(normListingUrl('https://www.Botero.com/listing/A-1/'), normListingUrl('http://botero.com/listing/a-1'));
  assert.notEqual(normListingUrl('https://x.com/listing/a-1'), normListingUrl('https://x.com/listing/a-2'));
});
test('auto-archive share cap is conservative', () => { assert.ok(AUTO_ARCHIVE_MAX_SHARE <= 0.3); });
