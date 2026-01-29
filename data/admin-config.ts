/**
 * Admin Configuration for WOS Commander
 * 
 * 요청하신 '엑셀' 기반 관리자 명단을 대체하는 설정 파일입니다.
 * 여기에 등록된 영주 이름만 관리자 기능을 사용할 수 있습니다.
 */

export const ADMIN_USERS = [
    '영광의사령관', // 맹주
    '세종대왕',    // 장로
    '관리자영주',  // 테스트 지원용
];

export type AdminStatus = {
    isLoggedIn: boolean;
    adminName: string | null;
};
