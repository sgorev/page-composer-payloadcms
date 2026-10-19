/** Resolve a configured frontend route from saved document data, never draft form input. */
export function resolveLiveEditURL(template, data) {
    if (!template || (!/^\/(?!\/)/.test(template) && !/^https?:\/\//i.test(template)))
        return undefined;
    let missing = false;
    const url = template.replace(/\{([\w.-]+)\}/g, (_, path) => {
        let value = data;
        for (const key of path.split('.')) {
            if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) {
                value = undefined;
                break;
            }
            value = value[key];
        }
        if ((typeof value !== 'string' && typeof value !== 'number') || value === '' || (typeof value === 'number' && !Number.isFinite(value))) {
            missing = true;
            return '';
        }
        return encodeURIComponent(String(value));
    });
    if (missing || /[{}\\\u0000-\u0020]/.test(url))
        return undefined;
    try {
        const parsed = new URL(url, 'https://page-composer.invalid');
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
            return undefined;
        return url;
    }
    catch {
        return undefined;
    }
}
