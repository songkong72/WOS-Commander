import { WikiEvent } from './event-types';
import { PERSONAL_EVENTS } from './wiki_events_personal';
import { ALLIANCE_EVENTS } from './wiki_events_alliance';
import { SERVER_EVENTS } from './wiki_events_server';
import { ROOKIE_EVENTS } from './wiki_events_rookie';

export * from './event-types';

export const INITIAL_WIKI_EVENTS: WikiEvent[] = [
    ...PERSONAL_EVENTS,
    ...SERVER_EVENTS,
    ...ALLIANCE_EVENTS,
    ...ROOKIE_EVENTS
];
