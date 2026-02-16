
import re

file_path = r'e:\project\workspace\WOS-Commander\app\growth\events.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add WheelPicker Component
wheel_picker_code = r'''
const WheelPicker = ({ options, value, onChange, isDark, width, showHighlight = true }: any) => {
    const itemHeight = 44;
    const flatListRef = useRef<FlatList>(null);

    const infiniteOptions = useMemo(() => [...options, ...options, ...options], [options]);
    const centerOffset = options.length;

    useEffect(() => {
        const realIndex = options.indexOf(value);
        if (flatListRef.current && realIndex !== -1) {
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: realIndex + centerOffset,
                    animated: false,
                    viewPosition: 0.5
                });
            }, 50);
        }
    }, [value, options.length]);

    const handleScrollEnd = (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.y / itemHeight) + 1;
        const selectedItem = infiniteOptions[index];
        if (selectedItem !== undefined && selectedItem !== value) {
            onChange(selectedItem);
        }
    };

    return (
        <View style={{ width, height: itemHeight * 3, overflow: 'hidden' }} className="relative">
            {/* 3D Wheel Shadow Effects */}
            <LinearGradient
                colors={isDark ? ['#0f172a', 'transparent'] : ['#f8fafc', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: itemHeight, zIndex: 20 }}
                pointerEvents="none"
            />
            <LinearGradient
                colors={isDark ? ['transparent', '#0f172a'] : ['transparent', '#f8fafc']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: itemHeight, zIndex: 20 }}
                pointerEvents="none"
            />
            {showHighlight && (
                <View pointerEvents="none" style={{ position: 'absolute', top: itemHeight, left: 4, right: 4, height: itemHeight, backgroundColor: isDark ? '#38bdf810' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf820' : '#38bdf815', zIndex: 10 }} />
            )}

            <FlatList
                ref={flatListRef}
                data={infiniteOptions}
                keyExtractor={(_, idx) => idx.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: itemHeight }}
                onMomentumScrollEnd={handleScrollEnd}
                getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
                renderItem={({ item, index }) => {
                    const isCenter = (index >= centerOffset && index < centerOffset * 2);
                    const isSelected = value === item && isCenter;
                    return (
                        <View style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
                            <Text className={`font-black ${isSelected ? (isDark ? 'text-sky-400 text-xl' : 'text-sky-600 text-xl') : (isDark ? 'text-slate-700 text-sm' : 'text-slate-300 text-sm')}`} style={{ opacity: isSelected ? 1 : 0.4 }}>
                                {item}
                            </Text>
                        </View>
                    );
                }}
            />
        </View>
    );
};
'''

content = content.replace(
    'onLayout: (y: number) => void;\n}',
    'onLayout: (y: number) => void;\n}\n' + wheel_picker_code
)

# 2. Responsive Header
old_header = r'''                        <View className="flex-row items-center mb-4">
                            <TouchableOpacity
                                onPress={() => router.replace({ pathname: '/', params: { viewMode: params.viewMode } })}
                                className={`mr-4 w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                            >
                                <Ionicons name="arrow-back-outline" size={20} color={isDark ? "white" : "#1e293b"} />
                            </TouchableOpacity>
                            <View className="flex-1">
                                <Text className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('events.title')}</Text>
                                <Text className={`text-sm font-semibold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('events.subtitle')}</Text>
                            </View>

                            {/* Timezone Toggle */}
                            <View className={`flex-row p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                <Pressable
                                    onPress={() => setTimezone('LOCAL')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: timezone === 'LOCAL'
                                                ? (isDark ? '#2563eb' : '#3b82f6')
                                                : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                            borderColor: timezone === 'LOCAL' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Text className={`text-[11px] font-black ${timezone === 'LOCAL' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('events.timezone_local')}</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setTimezone('UTC')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: timezone === 'UTC'
                                                ? (isDark ? '#2563eb' : '#3b82f6')
                                                : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                            borderColor: timezone === 'UTC' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Text className={`text-[11px] font-black ${timezone === 'UTC' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('events.timezone_utc')}</Text>
                                </Pressable>
                            </View>

                            {/* View Switcher: Card vs Timeline */}
                            <View className={`flex-row ml-4 p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                <Pressable
                                    onPress={() => setViewMode('card')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: viewMode === 'card' ? '#f97316' : 'transparent',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Ionicons name="apps" size={14} color={viewMode === 'card' ? 'white' : (isDark ? '#475569' : '#94a3b8')} />
                                </Pressable>
                                <Pressable
                                    onPress={() => setViewMode('timeline')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: viewMode === 'timeline' ? '#f97316' : 'transparent',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Ionicons name="list" size={14} color={viewMode === 'timeline' ? 'white' : (isDark ? '#475569' : '#94a3b8')} />
                                </Pressable>
                            </View>
                        </View>'''

new_header = r'''                        <View className={`flex-row items-center flex-wrap mb-4`}>
                            <View className={`flex-row items-center ${isDesktop ? 'flex-1' : 'w-full'} mr-4 mb-3`}>
                                <TouchableOpacity
                                    onPress={() => router.replace({ pathname: '/', params: { viewMode: params.viewMode } })}
                                    className={`mr-4 w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                                >
                                    <Ionicons name="arrow-back-outline" size={20} color={isDark ? "white" : "#1e293b"} />
                                </TouchableOpacity>
                                <View className="flex-1">
                                    <Text className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('events.title')}</Text>
                                    <Text className={`text-sm font-semibold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('events.subtitle')}</Text>
                                </View>
                            </View>

                            <View className={`flex-row items-center ${isDesktop ? 'ml-4' : 'w-full justify-between'}`}>
                                {/* Timezone Toggle */}
                                <View className={`flex-row p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                    <Pressable
                                        onPress={() => setTimezone('LOCAL')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: timezone === 'LOCAL'
                                                    ? (isDark ? '#2563eb' : '#3b82f6')
                                                    : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                                borderColor: timezone === 'LOCAL' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                                borderWidth: 1,
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Text className={`text-[11px] font-black ${timezone === 'LOCAL' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('events.timezone_local')}</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setTimezone('UTC')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: timezone === 'UTC'
                                                    ? (isDark ? '#2563eb' : '#3b82f6')
                                                    : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                                borderColor: timezone === 'UTC' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                                borderWidth: 1,
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Text className={`text-[11px] font-black ${timezone === 'UTC' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('events.timezone_utc')}</Text>
                                    </Pressable>
                                </View>

                                {/* View Switcher: Card vs Timeline */}
                                <View className={`flex-row ml-4 p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                    <Pressable
                                        onPress={() => setViewMode('card')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: viewMode === 'card' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Ionicons name="apps" size={14} color={viewMode === 'card' ? 'white' : (isDark ? '#475569' : '#94a3b8')} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setViewMode('timeline')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: viewMode === 'timeline' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Ionicons name="list" size={14} color={viewMode === 'timeline' ? 'white' : (isDark ? '#475569' : '#94a3b8')} />
                                    </Pressable>
                                </View>
                            </View>
                        </View>'''

content = content.replace(old_header, new_header)

# 3. 155px Slot Width & Padding
content = content.replace(
    '<View className="px-6 flex-1" style={{ overflow: \'visible\'',
    '<View className="px-4 flex-1" style={{ overflow: \'visible\''
)

old_slot = r'''                                                    {(editingEvent?.id === 'a_fortress' ? fortressList : citadelList).map(slot => (
                                                        <TouchableOpacity key={slot.id} onPress={() => {
                                                            if (editingSlotId === slot.id) {
                                                                // Deselect if already editing this slot
                                                                setEditingSlotId(null);
                                                                setSelectedFortressName('');
                                                            } else {
                                                                // Select this slot for editing
                                                                setEditingSlotId(slot.id);
                                                                setSelectedFortressName(slot.name);
                                                                setSelectedDayForSlot(slot.day || '토');
                                                                setEditHour(slot.h);
                                                                setEditMinute(slot.m);
                                                            }
                                                        }} className={`border px-3 py-1.5 rounded-xl flex-row items-center ${editingSlotId === slot.id ? 'bg-brand-accent/30 border-brand-accent' : 'bg-brand-accent/10 border-brand-accent/20'}`}>
                                                            <Text className="text-white text-xs font-bold mr-2">{slot.name} {t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(slot.day || '토')]}`)}({slot.h}:{slot.m})</Text>'''

new_slot = r'''                                                    {(editingEvent?.id === 'a_fortress' ? fortressList : citadelList).map(slot => (
                                                        <TouchableOpacity key={slot.id} onPress={() => {
                                                            if (editingSlotId === slot.id) {
                                                                setEditingSlotId(null);
                                                                setSelectedFortressName('');
                                                            } else {
                                                                setEditingSlotId(slot.id);
                                                                setSelectedFortressName(slot.name);
                                                                setSelectedDayForSlot(slot.day || '토');
                                                                setEditHour(slot.h);
                                                                setEditMinute(slot.m);
                                                            }
                                                        }} className={`border px-2 py-1.5 rounded-xl flex-row items-center justify-between w-[155px] ${editingSlotId === slot.id ? 'bg-brand-accent/30 border-brand-accent' : 'bg-brand-accent/10 border-brand-accent/20'}`}>
                                                            <Text className="text-white text-[10px] font-bold flex-1 mr-1" numberOfLines={1} ellipsizeMode="tail">
                                                                {slot.name} {t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(slot.day || '토')]}`)}({slot.h}:{slot.m})
                                                            </Text>'''

content = content.replace(old_slot, new_slot)

# 4. Triple Wheel Picker (Pro)
old_dd = r'''                                                {/* Day Dropdown */}
                                                <View className="mb-3">
                                                    <Text className={`text-xs font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {t('events.day_of_week')}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => setActiveFortressDropdown(activeFortressDropdown === 'day_picker' ? null : 'day_picker')}
                                                        className={`p-3 rounded-lg border flex-row items-center justify-between ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                                                    >
                                                        <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                            {(() => {
                                                                const krDays = ['일', '월', '화', '수', '목', '금', '토'];
                                                                const enKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                                                const idx = krDays.indexOf(selectedDayForSlot);
                                                                return idx >= 0 ? t(`events.days.${enKeys[idx]}`) : t('events.days.mon');
                                                            })()}
                                                        </Text>
                                                        <Ionicons name="chevron-down" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Time Dropdown */}
                                                <View className="mb-4">
                                                    <Text className={`text-xs font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {t('events.modal.set_time')}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => setActiveFortressDropdown(activeFortressDropdown === 'time_picker' ? null : 'time_picker')}
                                                        className={`p-3 rounded-lg border flex-row items-center justify-between ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                                                    >
                                                        <Text className={`text-base font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                            {editHour}:{editMinute}
                                                        </Text>
                                                        <Ionicons name="chevron-down" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                                                    </TouchableOpacity>
                                                </View>'''

new_dd = r'''                                                {/* Triple Wheel Picker (Pro) */}
                                                <View className="mb-6">
                                                    <View className="flex-row items-center justify-between mb-2 px-1">
                                                        <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('events.day_of_week')}</Text>
                                                        <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('events.modal.set_time')}</Text>
                                                    </View>
                                                    <View className={`rounded-2xl border p-2 flex-row items-center justify-around ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'}`} style={{ height: 160 }}>
                                                        {/* Global Highlight Bar */}
                                                        <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: 44, marginTop: -22, backgroundColor: isDark ? '#38bdf815' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf830' : '#38bdf815', zIndex: 10 }} />

                                                        <WheelPicker
                                                            options={['일', '월', '화', '수', '목', '금', '토']}
                                                            value={selectedDayForSlot}
                                                            onChange={setSelectedDayForSlot}
                                                            isDark={isDark}
                                                            width={80}
                                                            showHighlight={false}
                                                        />
                                                        <View className="w-[1px] h-12 bg-slate-700/20" />
                                                        <WheelPicker
                                                            options={Array.from({ length: 24 }, (_, i) => pad(i))}
                                                            value={editHour}
                                                            onChange={setEditHour}
                                                            isDark={isDark}
                                                            width={70}
                                                            showHighlight={false}
                                                        />
                                                        <Text className={`text-lg font-black ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>:</Text>
                                                        <WheelPicker
                                                            options={Array.from({ length: 60 }, (_, i) => pad(i))}
                                                            value={editMinute}
                                                            onChange={setEditMinute}
                                                            isDark={isDark}
                                                            width={70}
                                                            showHighlight={false}
                                                        />
                                                    </View>
                                                </View>'''

content = content.replace(old_dd, new_dd)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied all UI fixes.")
