export declare const VERIFY_PUBLIC_KEY = "DKLlVfxJLfj6ARCyzx81q79GaOWBtHLxu0pBCXNIqI4=";
export declare const VERIFY_URL = "https://page-composer.com/verify-plugin";
export type LicenseResult = {
    ok: boolean;
    status: string;
    message: string;
    token?: string;
};
export declare function normalizeLicenseDomain(value: string): string;
export declare function createLicenseVerifier(options: {
    apiKey?: string;
    verifyURL?: string;
    publicKey?: string;
}, request?: typeof fetch): (hostname: string) => Promise<LicenseResult>;
