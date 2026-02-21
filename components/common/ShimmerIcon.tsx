import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface ShimmerIconProps {
    children: React.ReactNode;
    colors: {
        bg: string;
        shadow: string;
        shimmer: string;
    };
    isDark: boolean;
}

const ShimmerIcon = memo(({ children, colors, isDark }: ShimmerIconProps) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            shimmerAnim.setValue(0);
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 2000,
                // Use native driver based on platform to avoid warnings on web
                useNativeDriver: Platform.OS !== 'web',
            }).start(() => animate());
        };
        animate();
    }, [shimmerAnim]);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-40, 40],
    });

    return (
        <View className="relative overflow-hidden w-10 h-10 rounded-xl mr-3"
            style={{
                ...Platform.select({
                    web: { boxShadow: `0px 2px 6px ${colors.shadow}66` },
                    default: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5 }
                })
            } as any}
        >
            <LinearGradient
                colors={isDark ? [colors.bg, colors.bg] : ['#ffffff', colors.bg]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0 w-full h-full items-center justify-center"
            >
                {children}
            </LinearGradient>
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 20,
                    transform: [{ translateX }],
                }}
            >
                <LinearGradient
                    colors={['transparent', colors.shimmer, 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{ flex: 1, opacity: 0.6 }}
                />
            </Animated.View>
        </View>
    );
});

export default ShimmerIcon;
