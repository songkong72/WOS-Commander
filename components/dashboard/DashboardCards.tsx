import React from 'react';
import { View } from 'react-native';
import { DashboardHeader } from './DashboardHeader';
import { NoticeBanner } from './NoticeBanner';
import { DashboardFeatureCards } from './DashboardFeatureCards';

interface DashboardCardsProps {
    isDark: boolean;
    now: Date;
    auth: any;
    serverId: string | null;
    allianceId: string | null;
    toggleTheme: () => void;
    handleInstallClick: () => void;
    handleSettingsPress: (setAdminMenuVisible: any, setLoginModalVisible: any) => void;
    setAdminMenuVisible: (v: boolean) => void;
    setLoginModalVisible: (v: boolean) => void;
    setIsManualVisible: (v: boolean) => void;
    setQRInviteVisible: (v: boolean) => void;
    openModalWithHistory: (setter: any) => void;
    setInputServer: (v: string) => void;
    setInputAlliance: (v: string) => void;
    setIsGateOpen: (v: boolean) => void;
    getNextResetSeconds: () => number;
    formatRemainingTime: (s: number) => string;
    notice: any;
    setNoticeDetailVisible: (v: boolean) => void;
    showCustomAlert: (title: string, message: string, type: string) => void;
    handleOpenNotice: () => void;
    router: any;
    pendingCount?: number;
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({
    isDark,
    now,
    auth,
    serverId,
    allianceId,
    toggleTheme,
    handleInstallClick,
    handleSettingsPress,
    setAdminMenuVisible,
    setLoginModalVisible,
    setIsManualVisible,
    setQRInviteVisible,
    openModalWithHistory,
    setInputServer,
    setInputAlliance,
    setIsGateOpen,
    getNextResetSeconds,
    formatRemainingTime,
    notice,
    setNoticeDetailVisible,
    showCustomAlert,
    handleOpenNotice,
    router,
    pendingCount = 0
}) => {
    return (
        <View className="w-full items-center">
            <View className="w-full max-w-6xl px-4 md:px-8">
                <DashboardHeader
                    isDark={isDark}
                    now={now}
                    auth={auth}
                    serverId={serverId}
                    allianceId={allianceId}
                    toggleTheme={toggleTheme}
                    handleInstallClick={handleInstallClick}
                    handleSettingsPress={handleSettingsPress}
                    setAdminMenuVisible={setAdminMenuVisible}
                    setLoginModalVisible={setLoginModalVisible}
                    setIsManualVisible={setIsManualVisible}
                    setQRInviteVisible={setQRInviteVisible}
                    openModalWithHistory={openModalWithHistory}
                    setInputServer={setInputServer}
                    setInputAlliance={setInputAlliance}
                    setIsGateOpen={setIsGateOpen}
                    getNextResetSeconds={getNextResetSeconds}
                    formatRemainingTime={formatRemainingTime}
                    pendingCount={pendingCount}
                />
            </View>

            <NoticeBanner
                notice={notice}
                auth={auth}
                isDark={isDark}
                setNoticeDetailVisible={setNoticeDetailVisible}
                showCustomAlert={showCustomAlert}
                handleOpenNotice={handleOpenNotice}
            />

            <DashboardFeatureCards
                isDark={isDark}
                auth={auth}
                router={router}
                showCustomAlert={showCustomAlert}
            />
        </View>
    );
};
