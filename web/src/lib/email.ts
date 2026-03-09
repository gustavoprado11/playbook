export function normalizeEmail(value: string | null | undefined) {
    return value?.trim().toLowerCase() || '';
}

export function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
}
