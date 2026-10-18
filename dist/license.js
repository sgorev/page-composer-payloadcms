import { createHash, createPublicKey, verify } from 'node:crypto';
export const VERIFY_PUBLIC_KEY = 'DKLlVfxJLfj6ARCyzx81q79GaOWBtHLxu0pBCXNIqI4=';
export const VERIFY_URL = 'https://page-composer.com/verify-plugin';
const messages = {
    missing: 'Page Composer requires an API key. Set apiKey in pageComposerPlugin({ apiKey: process.env.PAGE_COMPOSER_API_KEY }).',
    invalid: 'The Page Composer API key is invalid. Enter the key for your Payload CMS purchase.',
    blocked: 'This Page Composer license is inactive or blocked. Check your account or contact support.',
    wrong_product: 'This API key is for another product. Use a Payload CMS plugin license.',
    domain_unbound: 'Bind the main domain in your Page Composer account before using this license.',
    domain_mismatch: 'This domain does not match your Page Composer license. Change the technical domain in your account or ask an administrator to update the license domains.',
    unavailable: 'The Page Composer license could not be verified. Check connectivity and retry. Editing is disabled until verification succeeds.',
};
export function normalizeLicenseDomain(value) {
    return value.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/:]/)[0].replace(/^www\./, '');
}
export function createLicenseVerifier(options, request = fetch) {
    const cache = new Map();
    const apiKey = options.apiKey?.trim() || '';
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const result = (status) => ({ ok: status === 'active', status, message: status === 'active' ? '' : messages[status] || messages.invalid });
    return async (hostname) => {
        if (!apiKey)
            return result('missing');
        const domain = normalizeLicenseDomain(hostname);
        if (!domain)
            return result('domain_mismatch');
        const cached = cache.get(domain);
        if (cached && cached.expires > Date.now())
            return cached.result;
        try {
            const response = await request(options.verifyURL || VERIFY_URL, {
                method: 'POST', signal: AbortSignal.timeout(8000), cache: 'no-store',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ key: apiKey, domain, product: 'payloadcms' }),
            });
            if (!response.ok)
                return result('unavailable');
            const { token } = await response.json();
            if (typeof token !== 'string' || token.length > 10000)
                return result('unavailable');
            const parts = token.split('.');
            if (parts.length !== 2)
                return result('unavailable');
            const json = Buffer.from(parts[0], 'base64url');
            const rawPublicKey = Buffer.from(options.publicKey || VERIFY_PUBLIC_KEY, 'base64');
            if (rawPublicKey.length !== 32)
                return result('unavailable');
            const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey]), format: 'der', type: 'spki' });
            if (!verify(null, json, publicKey, Buffer.from(parts[1], 'base64url')))
                return result('unavailable');
            const decision = JSON.parse(json.toString('utf8'));
            const now = Date.now();
            if (decision.product !== 'payloadcms' || decision.domain !== domain || decision.key_hash !== keyHash || !Number.isFinite(decision.exp) || decision.exp * 1000 <= now || decision.exp * 1000 > now + 3600000)
                return result('unavailable');
            const verdict = result(decision.status);
            if (verdict.ok)
                verdict.token = token;
            if (cache.size >= 100)
                cache.clear();
            cache.set(domain, { expires: Math.min(decision.exp * 1000, now + (verdict.ok ? 600000 : 300000)), result: verdict });
            return verdict;
        }
        catch {
            return result('unavailable');
        }
    };
}
