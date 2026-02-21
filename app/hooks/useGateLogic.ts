import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

export const useGateLogic = () => {
    // -- Animations for Loading & Gate --
    const flickerAnim = useRef(new Animated.Value(0.4)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const returnPulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Initialization animations
        Animated.loop(
            Animated.sequence([
                Animated.timing(flickerAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.bezier(0.4, 0, 0.2, 1),
                    useNativeDriver: true,
                }),
                Animated.timing(flickerAnim, {
                    toValue: 0.4,
                    duration: 1500,
                    easing: Easing.bezier(0.4, 0, 0.2, 1),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.05,
                    duration: 2500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 2500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Return button pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(returnPulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
                Animated.timing(returnPulseAnim, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ])
        ).start();
    }, []);

    return {
        flickerAnim,
        scaleAnim,
        returnPulseAnim
    };
};
