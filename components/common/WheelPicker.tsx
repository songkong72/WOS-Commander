import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, FlatList, Platform, Pressable } from 'react-native';

export interface WheelPickerProps {
    options: any[];
    value: any;
    onChange: (value: any) => void;
    isDark: boolean;
    width?: number | string;
    showHighlight?: boolean;
    syncKey?: any;
    containerBgColor?: string;
    lines?: number;
}

const WheelPicker = ({ options, value, onChange, isDark, width, showHighlight = true, syncKey, containerBgColor, lines = 3 }: WheelPickerProps) => {
    const itemHeight = 44;
    const flatListRef = useRef<FlatList>(null);
    const [localActiveValue, setLocalActiveValue] = useState(value);
    const lastSyncedKey = useRef(syncKey);
    const isFirstRun = useRef(true);

    const getLabel = (opt: any) => (typeof opt === 'object' ? opt.label : opt);
    const getValue = (opt: any) => (typeof opt === 'object' ? opt.value : opt);

    const infiniteOptions = useMemo(() => [...options, ...options, ...options], [options]);
    const centerOffset = options.length;

    const scrollToIndex = (index: number, animated = true) => {
        if (!flatListRef.current) return;
        flatListRef.current.scrollToOffset({
            offset: index * itemHeight,
            animated
        });
    };

    const mid = Math.floor(lines / 2);

    useEffect(() => {
        const valStr = String(value || '').trim();
        const localStr = String(localActiveValue || '').trim();

        const forceSync = syncKey !== undefined && syncKey !== lastSyncedKey.current;
        const valueChanged = valStr !== localStr;
        const shouldSync = isFirstRun.current || forceSync || valueChanged;

        if (shouldSync) {
            const wasFirstRun = isFirstRun.current;
            isFirstRun.current = false;
            lastSyncedKey.current = syncKey;
            setLocalActiveValue(value);

            const realIndex = options.findIndex((o: any) => String(getValue(o)).trim() === valStr);
            if (realIndex !== -1) {
                // Scroll so that (realIndex + centerOffset) is at row 'mid'
                const targetTopIndex = realIndex + centerOffset - mid;
                if (wasFirstRun) {
                    setTimeout(() => scrollToIndex(targetTopIndex, false), 50);
                } else {
                    scrollToIndex(targetTopIndex, false);
                }
            }
        }

    }, [value, syncKey, options]);

    const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleScroll = (e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        const topIndex = Math.round(offset / itemHeight);
        const centerIndex = topIndex + mid;

        if (centerIndex >= 0 && centerIndex < infiniteOptions.length) {
            const currentItem = infiniteOptions[centerIndex];
            const currentVal = getValue(currentItem);
            if (currentVal !== localActiveValue) {
                setLocalActiveValue(currentVal);
            }
        }

        if (Platform.OS === 'web') {
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
            scrollTimeout.current = setTimeout(() => {
                if (centerIndex < 0 || centerIndex >= infiniteOptions.length) return;
                const selectedItem = infiniteOptions[centerIndex];
                const selectedVal = getValue(selectedItem);
                if (selectedVal !== value) onChange(selectedVal);
                scrollToIndex(topIndex, true);

                const realIndex = centerIndex % options.length;
                const targetTopIndex = realIndex + centerOffset - mid;
                if (topIndex !== targetTopIndex) setTimeout(() => scrollToIndex(targetTopIndex, false), 300);
            }, 150);
        }
    };

    const handleScrollEnd = (e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        const topIndex = Math.round(offset / itemHeight);
        const centerIndex = topIndex + mid;

        if (centerIndex < 0 || centerIndex >= infiniteOptions.length) return;

        const selectedItem = infiniteOptions[centerIndex];
        const selectedVal = getValue(selectedItem);
        if (selectedVal !== value) onChange(selectedVal);

        scrollToIndex(topIndex, true);

        const realIndex = centerIndex % options.length;
        const targetTopIndex = realIndex + centerOffset - mid;
        if (topIndex !== targetTopIndex) {
            setTimeout(() => scrollToIndex(targetTopIndex, false), 50);
        }
    };

    return (
        <View style={{ height: itemHeight * lines, width: width || '100%', overflow: 'hidden', backgroundColor: containerBgColor || 'transparent' }}>
            {showHighlight && (
                <View
                    style={{
                        position: 'absolute',
                        top: itemHeight * mid,
                        left: 10,
                        right: 10,
                        height: itemHeight,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    }}
                />
            )}
            <FlatList
                ref={flatListRef}
                data={infiniteOptions}
                keyExtractor={(_, i) => i.toString()}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => {
                            const val = getValue(item);
                            onChange(val);
                        }}
                        style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: getValue(item) === localActiveValue ? '900' : '400',
                                color: getValue(item) === localActiveValue
                                    ? (isDark ? '#fff' : '#000')
                                    : (isDark ? '#64748b' : '#94a3b8'),
                            }}
                        >
                            {getLabel(item)}
                        </Text>
                    </Pressable>
                )}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate="fast"
                onScroll={handleScroll}
                onMomentumScrollEnd={handleScrollEnd}
                getItemLayout={(_, index) => ({
                    length: itemHeight,
                    offset: itemHeight * index,
                    index,
                })}
                initialScrollIndex={centerOffset - mid}
            />

        </View>
    );
};

export default WheelPicker;
