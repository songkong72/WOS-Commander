/**
 * Admin Configuration for WOS Commander
 * 
 * 마스터 관리자(최상위 권한) 설정 파일입니다.
 * 보안을 위해 이 파일에 소수의 마스터 계정만 해싱된 비밀번호로 등록합니다.
 */

export const MASTER_CREDENTIALS = [
    // wos1234 의 SHA-256 해시값
    { id: '관리자', pw: '94c348f56641680d226f31623190df627e85741f0a2e269f88c96ae229dd5bcd' },
    { id: 'master', pw: '94c348f56641680d226f31623190df627e85741f0a2e269f88c96ae229dd5bcd' }
];

// 하위 호환성을 위해 남겨두는 마스터 ID 목록
export const SUPER_ADMINS = MASTER_CREDENTIALS.map(m => m.id);

export type AdminStatus = {
    isLoggedIn: boolean;
    adminName: string | null;
};
