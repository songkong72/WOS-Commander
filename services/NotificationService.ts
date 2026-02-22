export const sendWebhookNotification = async (webhookUrl: string, content: string, username: string = 'WOS Commander Bot') => {
    if (!webhookUrl || !webhookUrl.startsWith('http')) return;

    try {
        const payload = {
            content: content,
            username: username,
            avatar_url: 'https://raw.githubusercontent.com/songkong72/WOS-Commander/main/assets/icon.png'
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('Webhook notification failed:', await response.text());
        }
    } catch (error) {
        console.error('Webhook notification error:', error);
    }
};

export const createAllianceRegistrationMessage = (allianceId: string, serverId: string, memberCount: number) => {
    return `📢 **[연맹원 등록 알림]**\n\n` +
        `🏰 **연맹**: ${allianceId}\n` +
        `🌐 **서버**: ${serverId}\n` +
        `👥 **등록 인원**: ${memberCount}명\n\n` +
        `모든 연맹원분들의 계정이 생성되었습니다. 사령관 앱을 통해 전략과 이벤트를 확인하세요!`;
};

export const createAdminApplicationMessage = (allianceId: string, serverId: string, adminId: string) => {
    return `🚨 **[신규 연맹 관리자 신청]**\n\n` +
        `🏰 **연맹**: ${allianceId}\n` +
        `🌐 **서버**: ${serverId}\n` +
        `👤 **신청 ID**: ${adminId}\n\n` +
        `사령관님, 대시보드에서 승인 대기 중인 신청 건을 확인해주세요.`;
};
