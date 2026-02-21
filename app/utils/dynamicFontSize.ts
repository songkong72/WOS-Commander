/**
 * Dynamic Font Size Utility
 * Adjusts font size classes based on user settings
 */

export type FontSizeSetting = 'small' | 'medium' | 'large';

export const dfs = (baseClass: string, fontSize: FontSizeSetting) => {
    if (fontSize === 'medium') return baseClass;

    const sizeMap: Record<string, { small: string, medium: string, large: string }> = {
        'text-[8px]': { small: 'text-[7px]', medium: 'text-[8px]', large: 'text-[9px]' },
        'text-[9px]': { small: 'text-[8px]', medium: 'text-[9px]', large: 'text-[10px]' },
        'text-[10px]': { small: 'text-[9px]', medium: 'text-[10px]', large: 'text-xs' },
        'text-xs': { small: 'text-[10px]', medium: 'text-xs', large: 'text-sm' },
        'text-sm': { small: 'text-xs', medium: 'text-sm', large: 'text-base' },
        'text-base': { small: 'text-sm', medium: 'text-base', large: 'text-lg' },
        'text-lg': { small: 'text-base', medium: 'text-lg', large: 'text-xl' },
        'text-xl': { small: 'text-lg', medium: 'text-xl', large: 'text-2xl' },
        'text-2xl': { small: 'text-xl', medium: 'text-2xl', large: 'text-3xl' },
        'text-3xl': { small: 'text-2xl', medium: 'text-3xl', large: 'text-4xl' },
        'text-4xl': { small: 'text-3xl', medium: 'text-4xl', large: 'text-5xl' },
    };

    return sizeMap[baseClass]?.[fontSize] || baseClass;
};
