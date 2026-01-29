export interface EventGuideContent {
    title: string;
    overview: string;
    howToPlay: { text: string; images?: string[] }[];
    tips: string[];
}

export const EVENT_GUIDES: Record<string, EventGuideContent> = {
    'p1': {
        title: '설국 사진첩',
        overview: "설국 사진첩은 다양한 미션을 통해 퍼즐 봉투를 획득하고, 퍼즐을 완성하여 보상을 받는 이벤트입니다.",
        howToPlay: [
            { text: "매일 갱신되는 미션을 완료하여 퍼즐 봉투를 모으세요." },
            { text: "획득한 퍼즐 조각을 맞춰 사진첩을 완성합니다." }
        ],
        tips: ["남는 퍼즐 조각은 연맹원들과 교환할 수 있습니다."]
    },
    'a1': {
        title: '서리 영역 병기 리그',
        overview: "서리 영역 병기 리그는 ‘무기 공장 쟁탈전’ 이벤트를 토너먼트 형식으로 진행하는 대규모 이벤트입니다.",
        howToPlay: [
            { text: "R5/R4가 선호 시간을 선택하여 참가 신청을 합니다." },
            { text: "군단(최대 50명)을 구성하여 전략적인 전투를 준비하세요." }
        ],
        tips: ["탈락하더라도 누적 포인트가 반영되니 끝까지 최선을 다하세요."]
    },
    // Add more as needed, or a default
};

export const getGuideContent = (id: string): EventGuideContent => {
    return EVENT_GUIDES[id] || {
        title: "가이드 준비 중",
        overview: "이벤트 공략 가이드 준비 중입니다.",
        howToPlay: [{ text: "미션을 확인하세요." }],
        tips: ["정보를 확인하세요."]
    };
};
