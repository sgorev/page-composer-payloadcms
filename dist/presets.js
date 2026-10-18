export function presetValues(node, definition) {
    const saved = Array.isArray(node?.fields) ? Object.fromEntries(node.fields.map(field => [field.name, field.value])) : node || {};
    // Only registered fields go into the panel; unknown fields stay in the node.
    return Object.fromEntries((definition.fields || []).map(field => [field.name,
        Object.hasOwn(saved, field.name) ? saved[field.name] : field.value,
    ]));
}
export function mergePresetValues(node, tag, definition, values) {
    const isNode = node && (Array.isArray(node.fields) || Array.isArray(node.components) || typeof node.name === 'string');
    const result = isNode ? { ...node } : { name: tag, ...(definition.template ? { template: definition.template } : {}) };
    const existing = Array.isArray(node?.fields) ? node.fields : node && !isNode
        ? Object.entries(node).map(([name, value]) => ({ name, type: definition.fields?.find(field => field.name === name)?.type, value })) : [];
    const fields = existing.map(field => Object.hasOwn(values, field.name) ? { ...field, value: values[field.name] } : { ...field });
    const seen = new Set(fields.map(field => field.name));
    for (const field of definition.fields || []) {
        if (!seen.has(field.name))
            fields.push({ name: field.name, type: field.type, value: Object.hasOwn(values, field.name) ? values[field.name] : field.value });
    }
    result.fields = fields;
    if (tag === 'Row' && typeof values.cols === 'string') {
        const widths = values.cols.split('+').map(width => width.trim()).filter(Boolean);
        if (widths.length) {
            const old = Array.isArray(result.components) ? result.components : [];
            const rescued = old.slice(widths.length).flatMap(col => col.components || []);
            result.components = widths.map((width, index) => {
                const col = { ...old[index], name: 'Col', col: width };
                const children = [...(col.components || []), ...(index === widths.length - 1 ? rescued : [])];
                if (children.length)
                    col.components = children;
                return col;
            });
        }
    }
    return result;
}
