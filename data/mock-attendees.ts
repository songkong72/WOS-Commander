export interface Attendee {
    id: string;
    name: string;
    power: string;
    furnace: string;
    role: string;
    hero1: string;
    hero2: string;
    hero3: string;
}

export const INITIAL_ATTENDEES: Attendee[] = [
    { id: '1', name: '영광의사령관', power: '245.8M', furnace: 'Lv.30 (심화 5)', role: '맹주', hero1: '플린트', hero2: '바히티', hero3: '몰리' },
    { id: '2', name: '빙원의늑대', power: '182.4M', furnace: 'Lv.30 (심화 3)', role: '부맹주', hero1: '플린트', hero2: '몰리', hero3: '세르게이' },
    { id: '3', name: '얼음폭풍', power: '156.2M', furnace: 'Lv.30 (심화 2)', role: '지휘관', hero1: '바히티', hero2: '몰리', hero3: '진먼' },
    { id: '4', name: '고독한영주', power: '120.5M', furnace: 'Lv.30', role: '전사', hero1: '세르게이', hero2: '바히티', hero3: '재시' },
    { id: '5', name: '화염의기사', power: '98.7M', furnace: 'Lv.28', role: '전사', hero1: '플린트', hero2: '진먼', hero3: '바히티' },
    { id: '6', name: '세종대왕', power: '310.2M', furnace: 'Lv.30 (심화 5)', role: '장로', hero1: '진먼', hero2: '플린트', hero3: '몰리' },
    { id: '7', name: '리틀영주', power: '45.1M', furnace: 'Lv.22', role: '신입', hero1: '세르게이', hero2: '바히티', hero3: '몰리' },
];

export const attendeeStore: { [eventId: string]: Partial<Attendee>[] } = {};
