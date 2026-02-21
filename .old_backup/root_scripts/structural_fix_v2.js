const fs = require('fs');
const path = 'app/growth/events.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// We will replace from the comment line 1802 to the end of ScheduleModal at 2653.
// But we must be VERY careful with the line numbers as they might have shifted slightly.

let startIndex = -1;
let endIndex = -1;

for (let i = 1750; i < 1850; i++) {
    if (lines[i] && lines[i].includes('/* Schedule Edit Modal */')) {
        startIndex = i;
        break;
    }
}

for (let i = 2600; i < 2750; i++) {
    if (lines[i] && lines[i].includes('Attendee Modal')) {
        // The ScheduleModal ends just before this comment and its preceding blank lines.
        // Let's find the closing </Modal> before this.
        for (let j = i - 1; j > i - 20; j--) {
            if (lines[j] && lines[j].includes('</Modal>')) {
                endIndex = j;
                break;
            }
        }
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    console.log(`Replacing ScheduleModal from line ${startIndex + 1} to ${endIndex + 1}`);

    // I will construct the code here. 
    // I'll keep it as clean as possible.
    const newCode = `                {/* Schedule Edit Modal */}
                <Modal visible={scheduleModalVisible} transparent animationType="slide" >
                    <Pressable
                        className="flex-1 bg-black/80 justify-end"
                        onPress={() => {
                            setHourDropdownVisible(false);
                            setMinuteDropdownVisible(false);
                            setActiveDateDropdown(null);
                            setActiveFortressDropdown(null);
                        }}
                    >
                        <Pressable
                            onPress={() => {
                                setHourDropdownVisible(false);
                                setMinuteDropdownVisible(false);
                                setActiveDateDropdown(null);
                                setActiveFortressDropdown(null);
                            }}
                            className={\`p-0 rounded-t-[40px] border-t \${isDark ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-100 shadow-2xl'}\`}
                            style={{ height: editingEvent?.id === 'a_fortress' ? '70%' : 'auto', maxHeight: '90%' }}
                        >
                            <View className="px-6 pt-8 pb-4 flex-row justify-between items-start" style={{ zIndex: (!!activeDateDropdown || hourDropdownVisible || minuteDropdownVisible || !!activeFortressDropdown) ? 1 : 100 }}>
                                <View className="flex-1 mr-4">
                                    {editingEvent?.id !== "a_fortress" && (
                                        <>
                                            <View className="flex-row items-center mb-1">
                                                <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                                <Text className={\`text-3xl font-black \${isDark ? 'text-sky-400' : 'text-sky-600'}\`}>
                                                    {editingEvent?.title}
                                                </Text>
                                            </View>
                                            <Text className={\`text-[13px] font-medium leading-5 ml-4.5 \${isDark ? 'text-slate-400' : 'text-slate-500'}\`}>
                                                {(editingEvent?.category === '개인' || editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon' || editingEvent?.id === 'a_champ' || editingEvent?.id === 'a_operation' || editingEvent?.id === 'alliance_operation') ? '이벤트 진행 기간을 설정하세요.' : '이벤트 진행 요일과 시간을 설정하세요.'}
                                            </Text>
                                        </>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className={\`p-2.5 rounded-full border \${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 shadow-sm'}\`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                            
                            <View className="px-6 flex-1">
                                {editingEvent?.id === 'a_fortress' ? (
                                    <View className="flex-1">
                                        {/* Premium Tab Switcher */}
                                        <View className={\`flex-row mb-8 p-1.5 rounded-[24px] \${isDark ? 'bg-slate-800/80 border border-slate-700/50 shadow-inner' : 'bg-slate-100/80 border border-slate-200'}\`}>
                                            <TouchableOpacity
                                                onPress={() => setActiveFortressTab('fortress')}
                                                className={\`flex-1 flex-row py-4 items-center justify-center rounded-[20px] transition-all duration-300 \${activeFortressTab === 'fortress' ? (isDark ? 'bg-slate-700 shadow-2xl border border-slate-600' : 'bg-white shadow-lg border border-slate-200') : ''}\`}
                                            >
                                                <Ionicons
                                                    name="shield"
                                                    size={18}
                                                    color={activeFortressTab === 'fortress' ? "#38bdf8" : "#64748b"}
                                                    style={{ marginRight: 8 }}
                                                />
                                                <Text className={\`font-black text-sm uppercase tracking-tighter \${activeFortressTab === 'fortress' ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-500' : 'text-slate-400')}\`}>
                                                    요새전
                                                </Text>
                                                {activeFortressTab === 'fortress' && (
                                                    <View className="absolute bottom-1 w-1 h-1 bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8]" />
                                                )}
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => setActiveFortressTab('citadel')}
                                                className={\`flex-1 flex-row py-4 items-center justify-center rounded-[20px] transition-all duration-300 \${activeFortressTab === 'citadel' ? (isDark ? 'bg-slate-700 shadow-2xl border border-slate-600' : 'bg-white shadow-lg border border-slate-200') : ''}\`}
                                            >
                                                <Ionicons
                                                    name="business"
                                                    size={18}
                                                    color={activeFortressTab === 'citadel' ? "#60a5fa" : "#64748b"}
                                                    style={{ marginRight: 8 }}
                                                />
                                                <Text className={\`font-black text-sm uppercase tracking-tighter \${activeFortressTab === 'citadel' ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-500' : 'text-slate-400')}\`}>
                                                    성채전
                                                </Text>
                                                {activeFortressTab === 'citadel' && (
                                                    <View className="absolute bottom-1 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_#60a5fa]" />
                                                )}
                                            </TouchableOpacity>
                                        </View>

                                        {activeFortressTab === 'fortress' ? (
                                            <View className="flex-1">
                                                <View className="flex-row justify-between items-center mt-2 mb-2 px-4">
                                                    <View className="flex-row items-center">
                                                        <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                                        <View>
                                                            <Text className="text-white text-xl font-black tracking-tighter">{editingEvent?.title}</Text>
                                                            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Fortress Strategic Hub</Text>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => setFortressList([...fortressList, {
                                                            id: Date.now().toString(),
                                                            name: '요새 1',
                                                            h: new Date().getHours().toString().padStart(2, '0'),
                                                            m: '00',
                                                            day: '토'
                                                        }])}
                                                        className="bg-brand-accent px-5 py-3 rounded-2xl shadow-xl shadow-brand-accent/30 active:scale-95 flex-row items-center border border-white/20"
                                                    >
                                                        <Ionicons name="add" size={20} color="#0f172a" style={{ marginRight: 4 }} />
                                                        <Text className="text-brand-dark font-black text-sm">추가</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
                                                    {fortressList.length === 0 ? (
                                                        <View className="items-center justify-center py-6 bg-slate-800/20 rounded-[32px] border border-slate-700/30 border-dashed mx-2">
                                                            <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4">
                                                                <Ionicons name="shield-outline" size={32} color="#475569" />
                                                            </View>
                                                            <Text className="text-slate-400 font-bold">등록된 요새가 없습니다.</Text>
                                                            <Text className="text-slate-600 text-xs mt-1">상단의 추가 버튼을 눌러주세요.</Text>
                                                        </View>
                                                    ) : fortressList.map((f, fIdx) => (
                                                        <View key={f.id}>{/* Render Fortress Item - omitting full detail for brevity in script but I will include it below */}</View>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        ) : (
                                            <View className="flex-1">
                                                {/* Citadel Tab Content */}
                                                <View className="flex-row justify-between items-center mt-2 mb-2 px-4">
                                                    <View className="flex-row items-center">
                                                        <View className="w-1.5 h-6 bg-blue-500 rounded-full mr-3" />
                                                        <View>
                                                            <Text className="text-white text-xl font-black tracking-tighter">{editingEvent?.title}</Text>
                                                            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Citadel Strategic Hub</Text>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => setCitadelList([...citadelList, {
                                                            id: Date.now().toString(),
                                                            name: '성채 1',
                                                            h: new Date().getHours().toString().padStart(2, '0'),
                                                            m: '00',
                                                            day: '일'
                                                        }])}
                                                        className="bg-blue-600 px-5 py-3 rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 flex-row items-center border border-white/20"
                                                    >
                                                        <Ionicons name="add" size={20} color="white" style={{ marginRight: 4 }} />
                                                        <Text className="text-white font-black text-sm">추가</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
                                                    {citadelList.length === 0 ? (
                                                        <View className="items-center justify-center py-6 bg-slate-800/20 rounded-[32px] border border-slate-700/30 border-dashed mx-2">
                                                            <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4">
                                                                <Ionicons name="business-outline" size={32} color="#475569" />
                                                            </View>
                                                            <Text className="text-slate-400 font-bold">등록된 성채가 없습니다.</Text>
                                                            <Text className="text-slate-600 text-xs mt-1">상단의 추가 버튼을 눌러주세요.</Text>
                                                        </View>
                                                    ) : citadelList.map((c, cIdx) => (
                                                        <View key={c.id}>{/* Render Citadel Item */}</View>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                ) : (() => {
                                    const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
                                    return (editingEvent?.category === '개인' || dateRangeIDs.includes(editingEvent?.id || ''));
                                })() ? (
                                    <View className="flex-1">
                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
                                            {/* Date Selector Logic */}
                                        </ScrollView>
                                    </View>
                                ) : (
                                    <View className="flex-1">
                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
                                            {/* Alliance Slots UI */}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Fixed Action Footer with background */}
                            <View
                                className={\`px-6 pt-6 pb-10 border-t \${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}\`}
                                style={{ zIndex: 100 }}
                            >
                                <View className="flex-row gap-4">
                                    <TouchableOpacity
                                        onPress={handleDeleteSchedule}
                                        className={\`flex-1 \${isDark ? 'bg-slate-800/30' : 'bg-slate-100'} py-5 rounded-[24px] border \${isDark ? 'border-slate-700' : 'border-slate-200'} items-center active:scale-[0.98] transition-all\`}
                                    >
                                        <Text className={\`\${isDark ? 'text-slate-600' : 'text-slate-400'} font-bold text-lg\`}>설정 초기화</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={saveSchedule}
                                        className="flex-[2] bg-sky-500 py-5 rounded-[24px] items-center shadow-xl shadow-sky-500/40 active:scale-[0.98] transition-all"
                                    >
                                        <Text className="text-white font-black text-xl">저장하기</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>`;

    // Actually, I should probably NOT simplify it this much in the script if I want it to work.
    // I will write a script that does a search and replace for the exact sections.
}
