/**
 * 디스코드(Discord) 등 외부 메신저로 알림(Webhook)을 전송하는 기능을 담당하는 파일입니다.
 * 초보자 안내: Webhook(웹훅)은 웹 서비스들끼리 실시간으로 정보를 주고받기 위한 "연락처(URL)" 같은 개념입니다.
 */

/**
 * 봇(Bot)을 통해 지정된 URL로 알림 메시지를 보내는 핵심 함수입니다.
 * @param webhookUrl 알림을 받을 웹훅 주소 (예: 디스코드 봇 URL)
 * @param content 보낼 메시지 내용
 * @param username 봇의 이름 (기본값: 'WOS Commander Bot')
 */
export const sendWebhookNotification = async (webhookUrl: string, content: string, username: string = 'WOS Commander Bot') => {
    // 1. 방어 코드: URL이 비어있거나 'http'로 시작하지 않으면 오류가 나지 않게 그냥 종료합니다.
    if (!webhookUrl || !webhookUrl.startsWith('http')) return;

    try {
        // 2. 보낼 데이터(Payload)를 조립합니다. (디스코드 웹훅 규격에 맞춤)
        const payload = {
            content: content,           // 본문 메시지
            username: username,         // 알림을 보내는 봇의 프로필 이름
            avatar_url: 'https://raw.githubusercontent.com/songkong72/WOS-Commander/main/assets/icon.png' // 봇의 프로필 사진 모양 (아이콘 이미지)
        };

        // 3. fetch 함수를 이용해 인터넷(HTTP)으로 데이터를 전송(POST)합니다.
        const response = await fetch(webhookUrl, {
            method: 'POST', // 데이터를 서버에 '보내는' 행동
            headers: {
                'Content-Type': 'application/json', // "우리가 보내는 데이터는 JSON 형태의 글자다" 라고 알려줌
            },
            body: JSON.stringify(payload), // 만든 payload 덩어리를 문자열(String) 형태로 변환해서 전송
        });

        // 4. 전송 결과 확인
        if (!response.ok) {
            // response.ok가 false라면 전송에 실패한 것입니다. 콘솔(F12)에 이유를 출력합니다.
            console.error('Webhook notification failed:', await response.text());
        }
    } catch (error) {
        // 네트워크 연결 끊김 등으로 아예 전송 시도조차 실패했을 경우 에러를 잡아냅니다.
        console.error('Webhook notification error:', error);
    }
};

/**
 * 연맹원이 전부 등록되었을 때 보낼 안내 메시지 텍스트를 만들어주는 함수입니다.
 * 백틱(``) 기호와 ${변수} 문법을 통해 문자열 중간에 글자를 쉽게 끼워 넣을 수 있습니다.
 */
export const createAllianceRegistrationMessage = (allianceId: string, serverId: string, memberCount: number) => {
    return `📢 **[연맹원 등록 알림]**\n\n` +
        `🏰 **연맹**: ${allianceId}\n` +
        `🌐 **서버**: ${serverId}\n` +
        `👥 **등록 인원**: ${memberCount}명\n\n` +
        `모든 연맹원분들의 계정이 생성되었습니다. 사령관 앱을 통해 전략과 이벤트를 확인하세요!`;
};

/**
 * 누군가 "관리자 권한"을 달라고 신청했을 때 관리자들에게 보낼 신청 알림 메시지를 만들어줍니다.
 */
export const createAdminApplicationMessage = (allianceId: string, serverId: string, adminId: string) => {
    return `🚨 **[신규 연맹 관리자 신청]**\n\n` +
        `🏰 **연맹**: ${allianceId}\n` +
        `🌐 **서버**: ${serverId}\n` +
        `👤 **신청 ID**: ${adminId}\n\n` +
        `사령관님, 대시보드에서 승인 대기 중인 신청 건을 확인해주세요.`;
};
