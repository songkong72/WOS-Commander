import React, { createContext, useContext, useState, useRef } from 'react';
import { AdminStatus } from '../data/admin-config';

// --- Auth Context ---
interface AuthContextType {
    auth: AdminStatus;
    login: (name: string, role?: AdminStatus['role']) => void;
    logout: () => void;
    serverId: string | null;
    allianceId: string | null;
    setAllianceInfo: (serverId: string | null, allianceId: string | null) => void;
    dashboardScrollY: number;
    setDashboardScrollY: (y: number) => void;
    mainScrollRef: React.RefObject<any>;
    isGateOpen: boolean;
    setIsGateOpen: (open: boolean) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

// --- Theme Context ---
type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    fontSizeScale: number;
    changeFontSize: (scale: number) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}
