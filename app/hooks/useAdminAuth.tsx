import { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { hashPassword } from '../../utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 권한 타입 정의
export type UserRole = 'super_admin' | 'alliance_admin' | 'operator' | 'user';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface UserProfile {
    uid: string;
    username: string; // 로그인 ID
    nickname: string; // 인게임 닉네임
    role: UserRole;
    status: UserStatus;
    serverId?: string;
    allianceId?: string;
    contact?: string;
    createdAt?: number;
}

const STORAGE_KEY = 'wos_commander_user';

export const useAdminAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. 초기 로드: 로컬 스토리지 확인
    useEffect(() => {
        loadUserFromStorage();
    }, []);

    const loadUserFromStorage = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsedUser = JSON.parse(stored);
                // DB에서 최신 상태 다시 확인 (권한 박탈 등 체크)
                const freshUser = await fetchUserProfile(parsedUser.username);
                if (freshUser && freshUser.status === 'active') {
                    setUser(freshUser);
                } else {
                    await logout(); // 상태가 active가 아니면 로그아웃 처리
                }
            }
        } catch (e) {
            console.error('Auth Load Error:', e);
        } finally {
            setLoading(false);
        }
    };

    // 2. 유저 정보 가져오기 (Helper)
    const fetchUserProfile = async (username: string): Promise<UserProfile | null> => {
        try {
            // users 컬렉션에서 username으로 조회
            // (Firestore에서 username을 문서 ID로 쓸지, 필드로 쿼리할지 결정 필요. 
            //  여기서는 편의상 username을 문서 ID로 가정합니다.)
            const userRef = doc(db, 'users', username);
            const snap = await getDoc(userRef);

            if (snap.exists()) {
                return snap.data() as UserProfile;
            }
            return null;
        } catch (e) {
            console.error('Fetch Profile Error:', e);
            return null;
        }
    };

    // 3. 로그인 함수
    const login = async (id: string, pw: string): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
        try {
            const normalizedId = id.trim();
            const targetUser = await fetchUserProfile(normalizedId);

            if (!targetUser) {
                return { success: false, message: '존재하지 않는 아이디입니다.' };
            }

            // 비밀번호 검증
            const inputHash = await hashPassword(pw);
            const dbRef = doc(db, 'users', normalizedId);
            const snap = await getDoc(dbRef);
            const dbData = snap.data();

            if (dbData?.password !== inputHash) {
                return { success: false, message: '비밀번호가 일치하지 않습니다.' };
            }

            if (targetUser.status !== 'active') {
                return { success: false, message: '승인 대기 중이거나 비활성화된 계정입니다.' };
            }

            // 로그인 성공
            setUser(targetUser);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(targetUser));
            return { success: true, user: targetUser };

        } catch (e: any) {
            console.error('Login Error:', e);
            return { success: false, message: e.message };
        }
    };

    // 4. 로그아웃
    const logout = async () => {
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
    };

    // 5. 회원가입 신청 (Pending 상태로 생성)
    const register = async (profile: Omit<UserProfile, 'status' | 'uid' | 'createdAt'>, pw: string) => {
        try {
            const exists = await fetchUserProfile(profile.username);
            if (exists) {
                return { success: false, message: '이미 존재하는 아이디입니다.' };
            }

            const pwHash = await hashPassword(pw);

            const newUser: UserProfile = {
                ...profile,
                uid: `${profile.username}_${Date.now()}`,
                status: 'pending', // 기본 대기 상태
                createdAt: Date.now(),
            };

            // DB 저장 (Password는 별도 필드로 저장하거나 UserProfile에 포함하지 않고 따로 관리 추천하지만, 
            // 여기서는 편의상 문서에 같이 저장합니다.)
            const userRef = doc(db, 'users', profile.username);
            await setDoc(userRef, {
                ...newUser,
                password: pwHash
            });

            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    // [개발용] 초기 Super Admin 시딩 함수
    const seedSuperAdmin = async () => {
        const adminId = 'admin'; // 변경 가능
        const adminPw = 'wos1234'; // 초기 비번

        const exists = await fetchUserProfile(adminId);
        if (!exists) {
            const pwHash = await hashPassword(adminPw);
            await setDoc(doc(db, 'users', adminId), {
                uid: 'super_admin_001',
                username: adminId,
                nickname: 'System Admin',
                password: pwHash,
                role: 'super_admin',
                status: 'active',
                createdAt: Date.now()
            });
            console.log('Super Admin Seeded!');
            return true;
        }
        return false;
    };

    return {
        user,
        loading,
        login,
        logout,
        register,
        seedSuperAdmin, // 개발용 툴
    };
};
