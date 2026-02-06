/**
 * Admin Configuration for WOS Commander
 * 
 * 시스템관리자(최상위 권한) 설정 파일입니다.
 * 보안을 위해 이 파일에 소수의 마스터 계정만 해싱된 비밀번호로 등록합니다.
 */

export const MASTER_CREDENTIALS = [
    // wos1234 의 SHA-256 해시값
    { id: '관리자', pw: 'ed9f02f10e07faa4b8c450098c23ad6a8b6a2396523897c0beec0ecdf327d2e9' },
    { id: 'master', pw: 'ed9f02f10e07faa4b8c450098c23ad6a8b6a2396523897c0beec0ecdf327d2e9' },
    { id: 'admin', pw: 'ed9f02f10e07faa4b8c450098c23ad6a8b6a2396523897c0beec0ecdf327d2e9' }
];

// 하위 호환성을 위해 남겨두는 마스터 ID 목록
export const SUPER_ADMINS = MASTER_CREDENTIALS.map(m => m.id);

export type AdminStatus = {
    isLoggedIn: boolean;
    adminName: string | null;
    role?: 'master' | 'alliance_admin' | 'admin' | 'super_admin' | 'user' | null;
};
