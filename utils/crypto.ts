import * as Crypto from 'expo-crypto';

/**
 * 비밀번호를 SHA-256 방식으로 해싱합니다.
 * Expo 공식 라이브러리를 사용하여 네이티브와 웹 모두에서 안정적으로 작동합니다.
 */
export const hashPassword = async (password: string): Promise<string> => {
    if (!password) return '';
    try {
        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            password
        );
        return hash.toLowerCase(); // 일관성을 위해 소문자로 변환
    } catch (error) {
        console.error('Hashing failed:', error);
        return password; // 실패 시 평문 반환
    }
};
