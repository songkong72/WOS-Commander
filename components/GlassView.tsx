import { View, ViewProps } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);

interface GlassViewProps extends ViewProps {
    intensity?: number;
}

export default function GlassView({ children, style, className, ...props }: GlassViewProps) {
    return (
        <StyledView
            className={`bg-white/10 border border-white/20 rounded-xl backdrop-blur-md ${className}`}
            {...props}
        >
            {children}
        </StyledView>
    );
}
