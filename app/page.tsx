'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface EventItem {
  id: string
  title: string
  event_date: string
  location: string
  max_count: number
  current_count: number
  description?: string
}

interface ApplicationItem {
  id: string
  event_id: string
  user_id: string
  name: string
  age: number
  gender: string
  nationality: string
  instagram_id: string
  korean_level?: string
  japanese_level?: string
  is_first: boolean
  participation_count?: number
  created_at: string
}

interface MemberProfile {
  id: string
  name: string
  age?: number
  gender?: string
  nationality?: string
  instagram_id?: string
  korean_level?: string
  japanese_level?: string
  role?: string
  created_at?: string
}

export default function ClubMainDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [applications, setApplications] = useState<ApplicationItem[]>([])
  const [allMembers, setAllMembers] = useState<MemberProfile[]>([])
  const [myApplications, setMyApplications] = useState<{ [eventId: string]: string }>({})
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [activeTab, setActiveTab] = useState<'applications' | 'members'>('applications')
  const [loading, setLoading] = useState(true)

  // 남성 판별 함수
  const isMale = (gender?: string) => {
    if (!gender) return false
    const g = gender.trim().toLowerCase()
    return g === 'male' || g === '남' || g === '남자' || g === 'm'
  }

  // 어학 등급 매핑 함수
  const normalizeLevel = (lvl?: string, defaultVal: string = '중급') => {
    if (!lvl) return defaultVal
    const clean = lvl.trim()
    if (clean.includes('원어민') || clean.includes('모국어') || clean.includes('네이티브')) return '원어민'
    if (clean.includes('상') || clean.includes('고급')) return '고급'
    if (clean.includes('중') || clean.includes('중급')) return '중급'
    if (clean.includes('하') || clean.includes('초급')) return '초급'
    return defaultVal
  }

  // 화면 표시용 날짜 변환 함수
  const formatDisplayDate = (rawDate: string) => {
    if (!rawDate) return ''
    const dt = new Date(rawDate)
    if (isNaN(dt.getTime())) return rawDate

    const year = dt.getFullYear()
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const dayOfWeek = days[dt.getDay()]
    const hours = String(dt.getHours()).padStart(2, '0')
    const minutes = String(dt.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} (${dayOfWeek}) ${hours}:${minutes}`
  }

  // 신청 폼 상태
  const [applyForm, setApplyForm] = useState({
    name: '',
    age: '',
    gender: '남',
    nationality: '한국',
    instagram_id: '',
    korean_level: '고급',
    japanese_level: '중급',
    participation_type: 'first' as 'first' | 'repeat',
    participation_count: 2,
  })

  // 신규 모임 생성 폼 (관리자용)
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    location: '',
    max_count: 20,
    description: '',
  })

  useEffect(() => {
    initDashboard()
  }, [])

  const initDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // 내 프로필 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserProfile(profile)
        setApplyForm((prev) => ({
          ...prev,
          name: profile.name || '',
          age: profile.age ? String(profile.age) : prev.age,
          gender: isMale(profile.gender) ? '남' : '여',
          nationality: profile.nationality || '한국',
          instagram_id: profile.instagram_id ? profile.instagram_id.replace(/^@/, '').trim() : '',
          korean_level: normalizeLevel(profile.korean_level, '고급'),
          japanese_level: normalizeLevel(profile.japanese_level, '중급'),
        }))
      }

      await loadAllData(user.id, profile?.role === 'ADMIN')
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllData = async (userId: string, isAdmin: boolean) => {
    // 1. 모임 목록 조회
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })

    if (eventData) setEvents(eventData)

    // 2. 내가 신청한 모임 목록 및 신청 ID 조회
    const { data: myApps } = await supabase
      .from('event_applications')
      .select('id, event_id')
      .eq('user_id', userId)

    if (myApps) {
      const mapping: { [eventId: string]: string } = {}
      myApps.forEach((item: any) => {
        mapping[item.event_id] = item.id
      })
      setMyApplications(mapping)
    }

    // 3. 관리자일 경우 전체 신청 명부 및 전체 회원 목록 조회
    if (isAdmin) {
      const { data: allApps } = await supabase
        .from('event_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (allApps) setApplications(allApps)

      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (members) setAllMembers(members)
    }
  }

  // 참가 신청 모달 열기
  const openApplyModal = (ev: EventItem) => {
    if (userProfile) {
      setApplyForm((prev) => ({
        ...prev,
        name: userProfile.name || '',
        age: userProfile.age ? String(userProfile.age) : prev.age,
        gender: isMale(userProfile.gender) ? '남' : '여',
        nationality: userProfile.nationality || '한국',
        instagram_id: userProfile.instagram_id ? userProfile.instagram_id.replace(/^@/, '').trim() : '',
        korean_level: normalizeLevel(userProfile.korean_level, '고급'),
        japanese_level: normalizeLevel(userProfile.japanese_level, '중급'),
        participation_type: 'first',
        participation_count: 2,
      }))
    }
    setSelectedEvent(ev)
  }

  // 모임 신청 처리
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent || !currentUser) return

    const cleanInsta = applyForm.instagram_id.replace(/^@/, '').trim()
    const isFirstTime = applyForm.participation_type === 'first'

    const { error } = await supabase.from('event_applications').insert([
      {
        event_id: selectedEvent.id,
        user_id: currentUser.id,
        name: applyForm.name,
        age: parseInt(applyForm.age) || 20,
        gender: applyForm.gender,
        nationality: applyForm.nationality,
        instagram_id: cleanInsta,
        korean_level: applyForm.korean_level,
        japanese_level: applyForm.japanese_level,
        is_first: isFirstTime,
        participation_count: isFirstTime ? 1 : Number(applyForm.participation_count) || 2,
      },
    ])

    if (error) {
      alert('신청 실패: ' + error.message)
    } else {
      await supabase
        .from('events')
        .update({ current_count: (selectedEvent.current_count || 0) + 1 })
        .eq('id', selectedEvent.id)

      alert('참가 신청이 완료되었습니다!')
      setSelectedEvent(null)
      loadAllData(currentUser.id, userProfile?.role === 'ADMIN')
    }
  }

  // 참가 신청 취소 기능 (개인용)
  const handleCancelApplication = async (eventId: string) => {
    if (!confirm('정말로 모임 참가 신청을 취소하시겠습니까?')) return

    const applicationId = myApplications[eventId]
    if (!applicationId) return

    const { error } = await supabase
      .from('event_applications')
      .delete()
      .eq('id', applicationId)

    if (error) {
      alert('신청 취소 실패: ' + error.message)
      return
    }

    const targetEvent = events.find((e) => e.id === eventId)
    if (targetEvent) {
      const updatedCount = Math.max((targetEvent.current_count || 1) - 1, 0)
      await supabase
        .from('events')
        .update({ current_count: updatedCount })
        .eq('id', eventId)
    }

    alert('모임 참가 신청이 취소되었습니다.')
    loadAllData(currentUser.id, userProfile?.role === 'ADMIN')
  }

  // ★ 모임 자체 취소/삭제 기능 (관리자 전용) ★
  const handleDeleteEvent = async (event: EventItem) => {
    const confirmMessage = `[경고] "${event.title}" 모임을 완전히 취소(삭제)하시겠습니까?\n\n※ 등록된 모임 정보와 참가 신청자 내역이 모두 함께 삭제됩니다.`
    if (!confirm(confirmMessage)) return

    try {
      // 1. 해당 모임에 신청된 내역 먼저 삭제
      await supabase
        .from('event_applications')
        .delete()
        .eq('event_id', event.id)

      // 2. 모임 자체 삭제
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id)

      if (error) {
        alert('모임 삭제 실패: ' + error.message)
      } else {
        alert(`"${event.title}" 모임이 정상적으로 취소 및 삭제되었습니다.`)
        loadAllData(currentUser.id, true)
      }
    } catch (err: any) {
      console.error(err)
      alert('오류가 발생했습니다: ' + err.message)
    }
  }

  // 모임 생성 (관리자용)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvent.title || !newEvent.event_date) {
      alert('모임명과 일시를 모두 입력해주세요.')
      return
    }

    const isoDate = new Date(newEvent.event_date).toISOString()

    const { error } = await supabase.from('events').insert([
      {
        title: newEvent.title,
        event_date: isoDate,
        location: newEvent.location,
        max_count: Number(newEvent.max_count),
        current_count: 0,
        description: newEvent.description,
      },
    ])

    if (error) {
      alert('모임 등록 실패: ' + error.message)
    } else {
      alert('새 모임 일정이 등록되었습니다!')
      setNewEvent({ title: '', event_date: '', location: '', max_count: 20, description: '' })
      loadAllData(currentUser.id, true)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        교류회 데이터를 불러오는 중...
      </div>
    )
  }

  const isAdmin = userProfile?.role === 'ADMIN'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-20">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤝</span>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">한일 교류회 (日韓交流会)</h1>
              <p className="text-xs text-slate-400">한국인 & 일본인 친목 언어교환 플랫폼</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-semibold text-slate-800">{userProfile?.name || '회원'}</span>
              {isAdmin ? (
                <span className="ml-2 text-[11px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                  👑 총괄 관리자
                </span>
              ) : (
                <span className="ml-2 text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                  일반회원
                </span>
              )}
              {userProfile?.instagram_id && (
                <p className="text-xs text-pink-600 font-medium">@{userProfile.instagram_id.replace(/^@/, '')}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-8">
        {/* 모임 목록 섹션 */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📅</span> 예정된 교류회 일정
            </h2>
            <span className="text-xs text-slate-500">자유롭게 신청 및 취소가 가능합니다</span>
          </div>

          {events.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border text-center text-slate-400 text-sm">
              현재 예정된 모임 일정이 없습니다. 아래에서 새 모임을 등록해 보세요.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((ev) => {
                const isApplied = !!myApplications[ev.id]
                const isFull = ev.max_count > 0 && ev.current_count >= ev.max_count

                return (
                  <div
                    key={ev.id}
                    className="relative bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* 카드 상단: 날짜 + 정원 + (관리자용 모임 자체 삭제 버튼) */}
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                          {formatDisplayDate(ev.event_date)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              isFull ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {ev.max_count === 0 ? '정원 무제한' : `${ev.current_count} / ${ev.max_count}명`}
                          </span>

                          {/* ★ 관리자 전용: 모임 자체 취소/삭제 버튼 ★ */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteEvent(ev)}
                              title="모임 일정 자체 삭제"
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition text-xs flex items-center"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="font-bold text-base text-slate-900 mb-1">{ev.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <span>📍</span> {ev.location}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100">
                      {isApplied ? (
                        <div className="flex gap-2">
                          <button
                            disabled
                            className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 cursor-default"
                          >
                            ✓ 참가 확정
                          </button>
                          <button
                            onClick={() => handleCancelApplication(ev.id)}
                            className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition"
                          >
                            신청 취소
                          </button>
                        </div>
                      ) : isFull ? (
                        <button
                          disabled
                          className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed"
                        >
                          정원 마감
                        </button>
                      ) : (
                        <button
                          onClick={() => openApplyModal(ev)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-[0.99]"
                        >
                          참가 신청하기
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 참가 신청 모달 */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base text-slate-900">모임 참가 신청</h3>
                <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600 text-lg">
                  ✕
                </button>
              </div>

              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                <p className="font-bold">{selectedEvent.title}</p>
                <p className="text-indigo-600 mt-0.5">
                  일시: {formatDisplayDate(selectedEvent.event_date)} | 장소: {selectedEvent.location}
                </p>
              </div>

              <form onSubmit={handleApply} className="space-y-3 text-xs">
                {/* 기본 정보 */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">이름</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={applyForm.name}
                    className="w-full p-2 border rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">나이</label>
                    <input
                      type="text"
                      readOnly
                      value={applyForm.age ? `${applyForm.age}세` : '-'}
                      className="w-full p-2 border rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">성별</label>
                    <input
                      type="text"
                      readOnly
                      value={applyForm.gender === '남' ? '남 (男)' : '여 (女)'}
                      className="w-full p-2 border rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">국적</label>
                    <input
                      type="text"
                      readOnly
                      value={applyForm.nationality}
                      className="w-full p-2 border rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">인스타그램</label>
                    <input
                      type="text"
                      readOnly
                      value={applyForm.instagram_id ? `@${applyForm.instagram_id}` : '-'}
                      className="w-full p-2 border rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* 어학 실력 선택 */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      한국어 실력 <span className="text-indigo-600">*</span>
                    </label>
                    <select
                      value={applyForm.korean_level}
                      onChange={(e) => setApplyForm({ ...applyForm, korean_level: e.target.value })}
                      className="w-full p-2 border rounded-lg bg-white font-medium text-slate-800 focus:border-indigo-500"
                    >
                      <option value="초급">초급 (간단한 인사)</option>
                      <option value="중급">중급 (일상 회화)</option>
                      <option value="고급">고급 (원활한 대화)</option>
                      <option value="원어민">원어민 (모국어)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      일본어 실력 <span className="text-indigo-600">*</span>
                    </label>
                    <select
                      value={applyForm.japanese_level}
                      onChange={(e) => setApplyForm({ ...applyForm, japanese_level: e.target.value })}
                      className="w-full p-2 border rounded-lg bg-white font-medium text-slate-800 focus:border-indigo-500"
                    >
                      <option value="초급">초급 (간단한 인사)</option>
                      <option value="중급">중급 (일상 회화)</option>
                      <option value="고급">고급 (원활한 대화)</option>
                      <option value="원어민">원어민 (모국어)</option>
                    </select>
                  </div>
                </div>

                {/* 첫 참가 vs N회차 라디오 선택 영역 */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 mt-2">
                  <span className="block font-semibold text-slate-700 mb-1">참가 이력 구분</span>
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                        applyForm.participation_type === 'first'
                          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="participation_type"
                        value="first"
                        checked={applyForm.participation_type === 'first'}
                        onChange={() => setApplyForm({ ...applyForm, participation_type: 'first' })}
                        className="text-indigo-600"
                      />
                      <span>🌱 첫 참가</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                        applyForm.participation_type === 'repeat'
                          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="participation_type"
                        value="repeat"
                        checked={applyForm.participation_type === 'repeat'}
                        onChange={() => setApplyForm({ ...applyForm, participation_type: 'repeat' })}
                        className="text-indigo-600"
                      />
                      <span>🔁 N회차 (재참가)</span>
                    </label>
                  </div>

                  {applyForm.participation_type === 'repeat' && (
                    <div className="pt-2 flex items-center justify-between bg-white p-2.5 rounded-lg border border-indigo-100">
                      <span className="text-slate-700 font-medium">이번 참가 회차:</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={applyForm.participation_count}
                          onChange={(e) =>
                            setApplyForm({ ...applyForm, participation_count: Number(e.target.value) })
                          }
                          className="p-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-bold text-center"
                        >
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30].map((num) => (
                            <option key={num} value={num}>
                              {num}회차
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400 text-[11px]">(직접입력:</span>
                        <input
                          type="number"
                          min={2}
                          value={applyForm.participation_count}
                          onChange={(e) =>
                            setApplyForm({ ...applyForm, participation_count: Math.max(2, Number(e.target.value)) })
                          }
                          className="w-14 p-1 border rounded text-center font-bold"
                        />
                        <span className="text-slate-400 text-[11px]">회)</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3">
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

        {/* 관리자(ADMIN) 전용 섹션 */}
        {isAdmin && (
          <div className="space-y-8 pt-6 border-t border-slate-200">
            {/* 1. 관리자: 새 모임 생성 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
                <span>➕</span> 새 모임 스케줄 생성 (관리자)
              </h3>
              <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">모임명</label>
                    <input
                      type="text"
                      required
                      placeholder="예: 홍대 한일 교류회"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full p-2.5 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">일시 (달력/시간 선택)</label>
                    <input
                      type="datetime-local"
                      required
                      value={newEvent.event_date}
                      onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                      className="w-full p-2.5 border rounded-xl bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">장소</label>
                    <input
                      type="text"
                      required
                      placeholder="예: 홍대입구역 인근 카페 / 신오쿠보 라운지"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full p-2.5 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">모집 정원 (명)</label>
                    <input
                      type="number"
                      required
                      placeholder="20 (0 입력시 무제한)"
                      value={newEvent.max_count}
                      onChange={(e) => setNewEvent({ ...newEvent, max_count: Number(e.target.value) })}
                      className="w-full p-2.5 border rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">상세 안내 (선택)</label>
                  <textarea
                    rows={2}
                    placeholder="참가비, 진행 방식 등 안내사항을 적어주세요."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition shadow-sm"
                >
                  모임 일정 게시하기
                </button>
              </form>
            </div>

            {/* 2. 관리자 탭 명부: [모임별 신청 명부] / [전체 회원 목록] */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('applications')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      activeTab === 'applications'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    📋 모임별 참가 신청 명부 ({applications.length}건)
                  </button>
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      activeTab === 'members'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    👥 전체 회원 명부 ({allMembers.length}명)
                  </button>
                </div>
                <span className="text-xs text-slate-400">아이디 클릭 시 상대방 인스타로 바로 연결됩니다</span>
              </div>

              {/* 탭 1: 모임별 참가 신청 명부 */}
              {activeTab === 'applications' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b">
                        <th className="p-3">모임명</th>
                        <th className="p-3">이름</th>
                        <th className="p-3">나이</th>
                        <th className="p-3">성별</th>
                        <th className="p-3">국적</th>
                        <th className="p-3">인스타그램</th>
                        <th className="p-3">어학 실력 (한국어 / 일본어)</th>
                        <th className="p-3">참가 이력</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {applications.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            접수된 모임 참가 신청이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        applications.map((app) => {
                          const matchedEvent = events.find((e) => e.id === app.event_id)
                          const cleanInsta = app.instagram_id ? app.instagram_id.replace(/^@/, '').trim() : ''

                          return (
                            <tr key={app.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-semibold text-slate-800">{matchedEvent?.title || '모임'}</td>
                              <td className="p-3 font-medium text-slate-900">{app.name}</td>
                              <td className="p-3 text-slate-600">{app.age}세</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                                    isMale(app.gender) ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                                  }`}
                                >
                                  {isMale(app.gender) ? '남 男' : '여 女'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-700">{app.nationality}</td>
                              <td className="p-3">
                                {cleanInsta ? (
                                  <a
                                    href={`https://instagram.com/${cleanInsta}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-pink-600 hover:text-pink-700 font-medium hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>@{cleanInsta}</span>
                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-600">
                                <span className="font-medium text-slate-700">KR:</span> {normalizeLevel(app.korean_level, '-')} /{' '}
                                <span className="font-medium text-slate-700">JP:</span> {normalizeLevel(app.japanese_level, '-')}
                              </td>
                              <td className="p-3">
                                {app.is_first ? (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[11px] font-semibold">
                                    첫참가
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                                    {app.participation_count ? `${app.participation_count}회차` : '재참가'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 탭 2: 전체 회원 명부 */}
              {activeTab === 'members' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b">
                        <th className="p-3">이름 / 닉네임</th>
                        <th className="p-3">성별</th>
                        <th className="p-3">국적</th>
                        <th className="p-3">인스타그램</th>
                        <th className="p-3">어학 실력 (한국어 / 일본어)</th>
                        <th className="p-3">회원 등급</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            등록된 회원이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        allMembers.map((member) => {
                          const cleanInsta = member.instagram_id ? member.instagram_id.replace(/^@/, '').trim() : ''

                          return (
                            <tr key={member.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-semibold text-slate-900">{member.name || '미설정'}</td>
                              <td className="p-3">
                                {member.gender ? (
                                  <span
                                    className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                                      isMale(member.gender) ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                                    }`}
                                  >
                                    {isMale(member.gender) ? '남 男' : '여 女'}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-700">{member.nationality || '-'}</td>
                              <td className="p-3">
                                {cleanInsta ? (
                                  <a
                                    href={`https://instagram.com/${cleanInsta}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-pink-600 hover:text-pink-700 font-medium hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>@{cleanInsta}</span>
                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-600">
                                <span className="font-medium text-slate-700">KR:</span> {normalizeLevel(member.korean_level, '-')} /{' '}
                                <span className="font-medium text-slate-700">JP:</span> {normalizeLevel(member.japanese_level, '-')}
                              </td>
                              <td className="p-3">
                                {member.role === 'ADMIN' ? (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-bold rounded text-[11px]">
                                    👑 총괄 관리자
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">
                                    일반 회원
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}