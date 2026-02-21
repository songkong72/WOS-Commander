import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import 'intl-pluralrules';

const resources = {
    ko: { translation: require('./locales/ko.json') },
    en: { translation: require('./locales/en.json') },
};

// 디바이스의 언어 설정을 확인하여 초기 언어를 설정합니다.
const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';

i18next
    .use(initReactI18next)
    .init({
        resources,
        lng: deviceLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        compatibilityJSON: 'v3' as any,
    });

export default i18next;
