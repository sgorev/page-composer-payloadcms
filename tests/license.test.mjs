import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign, createHash } from 'node:crypto'
import { createLicenseVerifier } from '../dist/license.js'
const keys = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64')
const apiKey = 'pce_lic_test-only-key'
const token = (domain, patch = {}) => {
  const json = Buffer.from(JSON.stringify({ status: 'active', product: 'payloadcms', domain, key_hash: createHash('sha256').update(apiKey).digest('hex'), exp: Math.floor(Date.now() / 1000) + 600, ...patch }))
  return json.toString('base64url') + '.' + sign(null, json, keys.privateKey).toString('base64url')
}
test('missing keys never contact the license server', async () => {
  const check = createLicenseVerifier({}, async () => assert.fail('must not fetch'))
  assert.equal((await check('example.com')).status, 'missing')
})
test('signed decision caching is bound to domain; a moved site is checked immediately', async () => {
  const calls = []
  const check = createLicenseVerifier({ apiKey, publicKey }, async (_, opts) => {
    const body = JSON.parse(opts.body); calls.push(body)
    return Response.json({ token: token(body.domain, { status: body.domain === 'example.com' ? 'active' : 'domain_mismatch' }) })
  })
  assert.equal((await check('WWW.Example.com:80')).ok, true)
  assert.equal((await check('example.com')).ok, true)
  assert.equal(calls.length, 1)
  assert.equal((await check('new.example.com')).status, 'domain_mismatch')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].product, 'payloadcms')
})
test('forged, expired, wrong-product, wrong-key and replayed-domain tokens do not unlock editing', async () => {
  for (const patch of [{ exp: 1 }, { product: 'wp-pro' }, { key_hash: 'other' }, { domain: 'wrong.com' }, { exp: Math.floor(Date.now() / 1000) + 99999 }]) {
    const check = createLicenseVerifier({ apiKey, publicKey }, async () => Response.json({ token: token('example.com', patch) }))
    assert.equal((await check('example.com')).ok, false)
  }
  const check = createLicenseVerifier({ apiKey, publicKey }, async () => Response.json({ token: token('example.com') + 'broken' }))
  assert.equal((await check('example.com')).ok, false)
})
test('network failures fail closed and are retried, while blocked licenses stay blocked', async () => {
  let calls = 0
  const check = createLicenseVerifier({ apiKey, publicKey }, async () => { calls++; throw new Error('offline') })
  assert.equal((await check('example.com')).status, 'unavailable')
  assert.equal((await check('example.com')).ok, false)
  assert.equal(calls, 2)
  const blocked = createLicenseVerifier({ apiKey, publicKey }, async () => Response.json({ token: token('example.com', { status: 'blocked' }) }))
  assert.equal((await blocked('example.com')).ok, false)
})
