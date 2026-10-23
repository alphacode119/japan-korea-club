'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ClubMainDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [eventApplications, setEventApplications] = useState<any[]>([]) // 모임 신청 명부
  const [allMembers, setAllMembers] = useState<any[]>([]) // 전체 가입 회원
  const [myApplications, setMyApplications] = useState<any[]>([]) // 내 신청 내역
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // 신청하기 모달 상태
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [applyKoreanLevel, setApplyKoreanLevel] = useState('HIGH')
  const [applyJapaneseLevel, setApplyJapaneseLevel] = useState('MID')
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [attendanceCount, setAttendanceCount] = useState(1)

  // 새 모임 생성 폼 (관리자용)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newMax, setNewMax] = useState(20)

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    setIsLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // 프로필 조회
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)

      if (profileData.role === 'ADMIN') {
        // 관리자: 모임 신청자 명부 + 전체 가입 회원 명부 모두 조회
        await Promise.all([fetchEvents(), fetchEventApplications(), fetchAllMembersList()])
      } else {
        // 일반 회원: 모임 스케줄 + 내 신청 내역만 조회
        await Promise.all([fetchEvents(), fetchMyApplications(user.id)])
      }
    }

    setIsLoading(false)
  }

  // 모임 목록 조회
  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })

    setEvents(data || [])
    if (data && data.length > 0 && selectedEventId === 'ALL') {
      setSelectedEventId(data[0].id) // 기본값으로 첫 번째 모임 자동 선택
    }
  }

  // [관리자 전용] 해당 모임별 참가 신청자 명부 조회 (profiles 테이블과 조인)
  const fetchEventApplications = async () => {
    const { data, error } = await supabase
      .from('event_applications')
      .select(`
        id,
        event_id,
        user_id,
        korean_level,
        japanese_level,
        is_first_time,
        attendance_count,
        events:event_id ( id, title, event_date, location ),
        profiles:user_id (
          id,
          name,
          age,
          gender,
          instagram_id,
          nationality,
          is_blocked,
          role
        )
      `)
      .order('applied_at', { ascending: false })

    if (!error && data) {
      setEventApplications(data)
    }
  }

  // [관리자 전용] 전체 가입 회원 명단 (신청 여부 무관)
  const fetchAllMembersList = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    setAllMembers(data || [])
  }

  // [일반 회원 전용] 본인 신청 내역만 조회
  const fetchMyApplications = async (userId: string) => {
    const { data } = await supabase
      .from('event_applications')
      .select(`
        id,
        event_id,
        korean_level,
        japanese_level,
        is_first_time,
        attendance_count,
        events ( title, event_date, location )
      `)
      .eq('user_id', userId)
      .order('applied_at', { ascending: false })

    setMyApplications(data || [])
  }

  // 회원 차단/해제 토글 (관리자)
  const handleToggleBlockUser = async (targetUserId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: !currentStatus })
      .eq('id', targetUserId)

    if (error) {
      alert('차단 상태 변경 실패: ' + error.message)
    } else {
      setStatusMessage(`회원 상태가 [${!currentStatus ? '차단(Blacklist)' : '정상'}]으로 변경되었습니다.`)
      fetchEventApplications()
      fetchAllMembersList()
      if (targetUserId === profile.id) {
        setProfile((prev: any) => ({ ...prev, is_blocked: !currentStatus }))
      }
    }
  }

  // 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 신청 모달 열기
  const handleOpenApplyModal = (ev: any) => {
    if (profile?.is_blocked) {
      alert('관리자에 의해 참가가 제한된 계정입니다. 신청할 수 없습니다.')
      return
    }
    setSelectedEvent(ev)
    setApplyKoreanLevel(profile.korean_level)
    setApplyJapaneseLevel(profile.japanese_level)
    setIsFirstTime(true)
    setAttendanceCount(1)
  }

  // 참가 신청 제출
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent || !profile) return

    if (profile.is_blocked) {
      alert('차단된 계정은 모임에 참가할 수 없습니다.')
      return
    }

    const newAppPayload = {
      event_id: selectedEvent.id,
      user_id: profile.id,
      korean_level: applyKoreanLevel,
      japanese_level: applyJapaneseLevel,
      is_first_time: isFirstTime,
      attendance_count: isFirstTime ? 1 : attendanceCount,
    }

    const { error } = await supabase.from('event_applications').insert([newAppPayload])

    if (error) {
      if (error.code === '23505') {
        alert('이미 이 모임에 참가 신청을 완료하셨습니다!')
      } else {
        alert('신청 실패: ' + error.message)
      }
      return
    }

    setStatusMessage(`[${selectedEvent.title}] 모임 참가 신청이 완료되었습니다!`)
    setSelectedEvent(null)
    if (profile.role === 'ADMIN') {
      fetchEventApplications()
    } else {
      fetchMyApplications(profile.id)
    }
  }

  // 모임 스케줄 생성 (관리자)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle || !newDate || !newLocation) return

    const { error } = await supabase.from('events').insert([
      {
        title: newTitle,
        event_date: new Date(newDate).toISOString(),
        location: newLocation,
        max_participants: newMax,
      },
    ])

    if (error) {
      alert('모임 등록 실패: ' + error.message)
      return
    }

    setStatusMessage('새 교류회 스케줄이 등록되었습니다!')
    setNewTitle('')
    setNewDate('')
    setNewLocation('')
    fetchEvents()
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-xs text-slate-500 font-medium">
        사용자 정보 확인 중...
      </div>
    )
  }

  const isAdmin = profile.role === 'ADMIN'

  // 선택된 모임에 신청한 명단 필터링
  const currentEventApps = selectedEventId === 'ALL'
    ? eventApplications
    : eventApplications.filter((app) => app.event_id === selectedEventId)

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-20">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🇰🇷🤝🇯🇵</span>
            <span className="font-bold text-base text-slate-900 tracking-tight">한일 교류회 관리</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isAdmin ? '👑 총괄 관리자' : '일반 회원'}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 상태 알림 메시지 */}
      {statusMessage && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl text-xs flex justify-between items-center shadow-md">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage('')} className="text-indigo-200 hover:text-white font-bold ml-2">✕</button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        {/* 1. 내 프로필 요약 카드 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shrink-0">
              {profile.nationality === 'KR' ? '🇰🇷' : '🇯🇵'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">{profile.name}</h2>
                <span className="text-xs px-2 py-0.2 rounded-full bg-slate-100 font-medium text-slate-600">
                  {profile.age}세
                </span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${profile.gender === 'MALE' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>
                  {profile.gender === 'MALE' ? '남 (男)' : profile.gender === 'FEMALE' ? '여 (女)' : '-'}
                </span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${profile.nationality === 'KR' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                  {profile.nationality === 'KR' ? '한국인' : '일본인'}
                </span>
              </div>
              <p className="text-xs text-indigo-600 font-medium mt-0.5">📷 @{profile.instagram_id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 text-[10px] block">한국어</span>
              <span className="font-bold text-slate-700">{profile.korean_level === 'HIGH' ? '상' : profile.korean_level === 'MID' ? '중' : '하'}</span>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 text-[10px] block">일본어</span>
              <span className="font-bold text-slate-700">{profile.japanese_level === 'HIGH' ? '상' : profile.japanese_level === 'MID' ? '중' : '하'}</span>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-slate-400 text-[10px] block">활동 상태</span>
              <span className={`font-bold ${profile.is_blocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                {profile.is_blocked ? '차단됨' : '정상'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. 모임 스케줄 목록 (모든 회원 공통 열람 및 참가 신청) */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>📅</span> 진행 예정 모임 스케줄
            </h3>
            <button onClick={fetchEvents} className="text-xs text-indigo-600 hover:underline">새로고침</button>
          </div>

          {events.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl text-center text-xs text-slate-400 border border-slate-200/80">
              현재 예정된 모임이 없습니다.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {events.map((ev) => (
                <div key={ev.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{ev.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">
                        정원 {ev.max_participants}명
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">📍 {ev.location}</p>
                    <p className="text-xs text-slate-400 mt-0.5">🕒 {new Date(ev.event_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  <button
                    onClick={() => handleOpenApplyModal(ev)}
                    disabled={profile.is_blocked}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-[0.99] ${
                      profile.is_blocked
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {profile.is_blocked ? '참가 불가 (차단된 회원)' : '이 모임 참가 신청하기'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3-A. [👑 관리자 전용] 해당 모임별 참가 신청자 명부 표 (핵심 복구) */}
        {isAdmin && (
          <section className="bg-white rounded-2xl shadow-sm border border-indigo-200/90 overflow-hidden space-y-0">
            <div className="p-4 border-b border-indigo-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-indigo-50/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>📋</span> 모임별 참가 신청 명부 (관리자 전용)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  조회할 모임을 선택하면 해당 모임의 신청자 명단이 아래 표에 즉시 표시됩니다.
                </p>
              </div>

              {/* 모임 선택 셀렉트 박스 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 font-semibold">모임 선택:</span>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="p-2 border border-indigo-200 rounded-xl bg-white font-bold text-indigo-900 shadow-xs focus:outline-indigo-500"
                >
                  <option value="ALL">전체 모임 신청자 보기 ({eventApplications.length}명)</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={fetchEventApplications}
                  className="p-2 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                >
                  새로고침
                </button>
              </div>
            </div>

            {/* 모임 참가 신청자 가로 표 (신청일시 제외 / 성별 포함) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-3 px-4">번호</th>
                    <th className="py-3 px-4">이름 (나이)</th>
                    <th className="py-3 px-4 text-center">성별 (性別)</th>
                    <th className="py-3 px-4 text-center">국적</th>
                    <th className="py-3 px-4">인스타그램 ID</th>
                    <th className="py-3 px-4">신청 모임 타이틀</th>
                    <th className="py-3 px-4 text-center">어학 실력 (한/일)</th>
                    <th className="py-3 px-4 text-center">참가 이력</th>
                    <th className="py-3 px-4 text-center">계정 제어</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentEventApps.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        이 모임에 신청한 회원이 아직 없습니다.
                      </td>
                    </tr>
                  ) : (
                    currentEventApps.map((app, index) => {
                      const member = app.profiles || {}
                      const isBlocked = member.is_blocked

                      return (
                        <tr
                          key={app.id}
                          className={`hover:bg-slate-50/80 transition ${isBlocked ? 'bg-rose-50/40 text-slate-400' : ''}`}
                        >
                          {/* 번호 */}
                          <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>

                          {/* 이름 (나이) */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{member.name || '미등록'}</span>
                            <span className="text-slate-400 ml-1">({member.age ? `${member.age}세` : '-'})</span>
                            {member.role === 'ADMIN' && (
                              <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">운영자</span>
                            )}
                          </td>

                          {/* 성별 (남 男 / 여 女) */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                member.gender === 'MALE'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : member.gender === 'FEMALE'
                                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                  : 'text-slate-400'
                              }`}
                            >
                              {member.gender === 'MALE' ? '남 (男)' : member.gender === 'FEMALE' ? '여 (女)' : '-'}
                            </span>
                          </td>

                          {/* 국적 */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                member.nationality === 'KR'
                                  ? 'bg-blue-100 text-blue-700'
                                  : member.nationality === 'JP'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {member.nationality === 'KR' ? '🇰🇷 한국' : member.nationality === 'JP' ? '🇯🇵 일본' : '-'}
                            </span>
                          </td>

                          {/* 인스타그램 ID */}
                          <td className="py-3 px-4">
                            {member.instagram_id ? (
                              <a
                                href={`https://instagram.com/${member.instagram_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                              >
                                @{member.instagram_id}
                                <span className="text-[10px] text-slate-400">↗</span>
                              </a>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* 신청 모임 */}
                          <td className="py-3 px-4 font-medium text-slate-700 max-w-[200px] truncate">
                            {app.events?.title || '모임 정보 없음'}
                          </td>

                          {/* 어학 실력 */}
                          <td className="py-3 px-4 text-center font-mono">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">
                              한:{app.korean_level === 'HIGH' ? '상' : app.korean_level === 'MID' ? '중' : '하'}
                            </span>
                            <span className="mx-1 text-slate-300">/</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">
                              일:{app.japanese_level === 'HIGH' ? '상' : app.japanese_level === 'MID' ? '중' : '하'}
                            </span>
                          </td>

                          {/* 참가 이력 */}
                          <td className="py-3 px-4 text-center">
                            {app.is_first_time ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                                ✨ 첫 참가
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-bold text-[10px]">
                                {app.attendance_count}회차
                              </span>
                            )}
                          </td>

                          {/* 관리자: 차단/해제 제어 */}
                          <td className="py-3 px-4 text-center">
                            {member.id !== profile.id ? (
                              <button
                                onClick={() => handleToggleBlockUser(member.id, isBlocked)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                  isBlocked
                                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                {isBlocked ? '차단해제' : '차단'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">본인</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3-B. [일반 회원 전용] 나의 참가 신청 내역 (타인 개인정보 차단) */}
        {!isAdmin && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>📋</span> 나의 교류회 참가 신청 내역
              </h3>
              <span className="text-xs text-indigo-600 font-semibold">총 {myApplications.length}건</span>
            </div>

            {myApplications.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                아직 신청한 모임이 없습니다. 위의 스케줄에서 원하는 모임에 참가 신청해 보세요!
              </div>
            ) : (
              <div className="space-y-2">
                {myApplications.map((app) => (
                  <div key={app.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-900">{app.events?.title || '모임 정보'}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        📍 {app.events?.location} • {app.is_first_time ? '✨ 첫 참가' : `누적 ${app.attendance_count}회차`}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[10px]">
                      신청 완료
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 4. [👑 관리자 전용] 가입 회원 전체 관리 & 새 모임 생성 */}
        {isAdmin && (
          <div className="space-y-4 pt-2 border-t-2 border-dashed border-amber-200">
            {/* 전체 가입 회원 리스트 (모임 신청 안 한 사람도 확인 및 차단 가능) */}
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200/80 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                  <span>🛡️</span> 전체 가입 회원 계정 목록 ({allMembers.length}명)
                </h3>
                <button onClick={fetchAllMembersList} className="text-xs text-amber-700 hover:underline">새로고침</button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {allMembers.map((m) => (
                  <div key={m.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{m.name}</span>
                        <span className="text-[10px] text-slate-400">({m.age}세)</span>
                        <span className="text-[10px] text-indigo-600 font-semibold">@{m.instagram_id}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${m.gender === 'MALE' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>
                          {m.gender === 'MALE' ? '남(男)' : '여(女)'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${m.nationality === 'KR' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {m.nationality}
                        </span>
                        {m.role === 'ADMIN' && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">운영자</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        한({m.korean_level})/일({m.japanese_level})
                      </p>
                    </div>

                    {m.id !== profile.id && (
                      <button
                        onClick={() => handleToggleBlockUser(m.id, m.is_blocked)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          m.is_blocked
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {m.is_blocked ? '차단해제' : '차단'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 새 모임 스케줄 생성 */}
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>🛠️</span> 새 모임 스케줄 생성 (관리자)
              </h3>

              <form onSubmit={handleCreateEvent} className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">모임 타이틀</label>
                  <input
                    type="text"
                    placeholder="예: 11월 홍대 한일 회화 모임"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">일시</label>
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">최대 인원</label>
                    <input
                      type="number"
                      value={newMax}
                      onChange={(e) => setNewMax(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">장소</label>
                  <input
                    type="text"
                    placeholder="예: 마포구 서교동 카페 린"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition shadow-sm"
                >
                  모임 스케줄 등록
                </button>
              </form>
            </section>
          </div>
        )}
      </main>

      {/* 참가 신청 입력 모달 */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">{selectedEvent.title}</h3>
              <p className="text-xs text-slate-500 mt-1">현재 어학 실력과 참가 횟수를 확인해 주세요.</p>
            </div>

            <form onSubmit={handleSubmitApplication} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">현재 한국어 실력</label>
                <select
                  value={applyKoreanLevel}
                  onChange={(e) => setApplyKoreanLevel(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50"
                >
                  <option value="HIGH">상 (유창함)</option>
                  <option value="MID">중 (회화가능)</option>
                  <option value="LOW">하 (기초)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">현재 일본어 실력</label>
                <select
                  value={applyJapaneseLevel}
                  onChange={(e) => setApplyJapaneseLevel(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50"
                >
                  <option value="HIGH">상 (유창함)</option>
                  <option value="MID">중 (회화가능)</option>
                  <option value="LOW">하 (기초)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="block text-slate-600 font-semibold mb-1">교류회 참가 이력</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFirstTime(true)}
                    className={`py-2 rounded-xl font-bold border transition ${
                      isFirstTime ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    처음 참가예요 ✨
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFirstTime(false)}
                    className={`py-2 rounded-xl font-bold border transition ${
                      !isFirstTime ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    이전에 와봤어요
                  </button>
                </div>
              </div>

              {!isFirstTime && (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">누적 참가 횟수 (회)</label>
                  <input
                    type="number"
                    min="2"
                    value={attendanceCount}
                    onChange={(e) => setAttendanceCount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50"
                    placeholder="예: 3"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm"
                >
                  신청 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}