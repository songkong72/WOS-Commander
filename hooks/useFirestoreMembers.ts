/**
 * 구글 파이어베이스(Firebase) 데이터베이스와 통신하는 전용 파일입니다.
 * 이 훅(Hook)은 파이어베이스의 "Firestore"라는 실시간 NoSQL 데이터베이스에서
 * 연맹원 명단을 가져오고, 저장하고, 지우는 역할만 전문적으로 담당합니다.
 */
import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, writeBatch, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// 타입스크립트 인터페이스: 데이터베이스에 저장될 연맹원 1명의 데이터 모양을 강제합니다.
// ? 기호는 "이 데이터는 있을 수도 있고 없을 수도 있다(안전빵)"는 뜻입니다.
export interface Member {
    id: string;             // 게임 내 고유 ID (회원번호 같은 역할)
    nickname: string;       // 연맹원 닉네임
    password?: string;      // (선택) 개인 비밀번호
    updatedAt: number;      // 마지막으로 수정된 시간 (숫자형 타임스탬프)
}

export const useFirestoreMembers = (serverId?: string | null, allianceId?: string | null) => {
    // DB에서 가져온 전체 명단을 담아둘 바구니(State)
    const [members, setMembers] = useState<Member[]>([]);
    // 데이터를 아직 가져오는 중인지(로딩 중) 표시하는 스위치
    const [loading, setLoading] = useState(true);

    const getCollectionRef = () => {
        if (serverId && allianceId) {
            // New structure: servers/{serverId}/alliances/{allianceId}/members
            return collection(db, "servers", serverId, "alliances", allianceId, "members");
        }
        return collection(db, 'members');
    };

    // --- 실시간 데이터 동기화 (가장 중요한 부분!) ---
    useEffect(() => {
        // 서버 번호나 연맹 ID가 없으면 누군지 모르니까 멈춤
        if (serverId === undefined || allianceId === undefined) return;

        // DB에서 "이 폴더(컬렉션) 내놔라!" 하고 요청하는 쿼리문
        const q = query(getCollectionRef());

        // onSnapshot: 파이어베이스의 꽃! 일반적인 '한 번 가져오기(GET)'가 아니라, 
        // 데이터베이스에 누군가 변경을 가할 때마다 "카톡 알림음"처럼 실시간으로 데이터를 통째로 다시 쏴줍니다.
        const unsubscribe = onSnapshot(q, (snap) => {
            const list: Member[] = [];

            // 데이터베이스에서 넘어온 문서(Document)들을 하나씩 까서 우리 바구니(list)에 담습니다.
            snap.forEach((docSnap) => {
                // 문서의 제목(docSnap.id)과 내용물(...docSnap.data())을 합쳐서 Member 모양으로 만듭니다.
                list.push({ id: docSnap.id, ...docSnap.data() } as Member);
            });

            // 가져온 명단을 닉네임 ABC-가나다 순으로 예쁘게 정렬해서 State에 저장합니다.
            setMembers(list.sort((a, b) => a.nickname.localeCompare(b.nickname)));
            // 로딩 스위치 끄기! (화면의 뱅글뱅글 아이콘이 사라집니다)
            setLoading(false);
        }, (error) => {
            console.error("Members listener error:", error);
            setLoading(false); // 에러가 나도 로딩 스위치는 꺼야 화면이 멈추지 않습니다.
        });

        // 컴포넌트가 화면에서 꺼질 때, 실시간 통신 파이프를 끊어줍니다(메모리 누수 방지)
        return () => unsubscribe();
    }, [serverId, allianceId]);

    // --- 여러 명을 한꺼번에 저장/수정하는 함수 ---
    const saveMembers = async (newList: { id: string, nickname: string, password?: string }[]) => {
        if (newList.length === 0) return;

        // writeBatch: 파이어베이스에서 여러 개의 문서를 "한 번에" 통째로 쓰고 싶을 때 사용합니다. (네트워크 낭비 방지)
        // 비유치면 문서를 한 장씩 복사기에 넣지 않고, 뭉터기로 넣고 한 번에 복사 버튼을 누르는 것과 같습니다.
        const batch = writeBatch(db);
        const colRef = getCollectionRef();

        newList.forEach((m) => {
            if (!m.id) return;
            // docRef: "이 폴더(colRef) 안의 이 이름(m.id)을 가진 문서"라는 좌표표시
            const docRef = doc(colRef, String(m.id));

            // 뭉터기 복사기 목록에 저장 명령(set)을 하나씩 추가합니다.
            // { merge: true } : 덮어씌울 때 기존 데이터가 날아가지 않고 바뀐 부분만 병합(Merge) 되게 해주는 마법의 주문입니다.
            batch.set(docRef, {
                nickname: m.nickname,
                password: m.password || '',
                updatedAt: Date.now(),
                serverId: serverId || null,
                allianceId: allianceId || null
            }, { merge: true });
        });

        // 뭉터기 복사기에 들어간 서류들을 데이터베이스로 쏘아 올립니다!
        await batch.commit();
    };

    const clearAllMembers = async () => {
        const colRef = getCollectionRef();
        const q = query(colRef);
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
        await batch.commit();
    };

    const deleteMember = async (memberId: string) => {
        try {
            const colRef = getCollectionRef();
            const docRef = doc(colRef, memberId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Delete member error:", error);
            throw error;
        }
    };

    const updateMemberPassword = async (memberId: string, newPassword: string) => {
        try {
            const colRef = getCollectionRef();
            const docRef = doc(colRef, memberId);
            await updateDoc(docRef, {
                password: newPassword,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error("Update password error:", error);
            throw error;
        }
    };

    return { members, loading, saveMembers, clearAllMembers, deleteMember, updateMemberPassword };
};
