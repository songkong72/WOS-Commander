export type EventCategory = '전체' | '개인' | '연맹' | '초보자' | '서버';

export interface WikiEvent {
    id: string;
    title: string;
    category: EventCategory;
    wikiUrl: string;
    imageUrl?: any;
    day: string; // Event Day (e.g., 월, 화, 수...)
    time: string; // Event Time (e.g., 11:00)
    description: string;
    strategy?: string; // Alliance Strategy content
    startDate?: string; // Start date for one-time events
    recurrenceValue?: string; // Recurrence value (e.g., '1')
    recurrenceUnit?: 'day' | 'week'; // Recurrence unit (day or week)
    isRecurring?: boolean;
    isBearSplit?: boolean;
    isFoundrySplit?: boolean;
}
