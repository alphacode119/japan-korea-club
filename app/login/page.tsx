'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 공통 로그인 식별자 (인스타그램 아이디 + 비밀번호)
  const [instagramId, setInstagramId] = useState('')
  const [password, setPassword] = useState('')

  // 신규 가입 시에만 입력받는 프로필 정보
  const [name, setName] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [nationality, setNationality] = useState<'KR' | 'JP'>('KR')
  const [koreanLevel, setKoreanLevel] = useState<'HIGH' | 'MID' | 'LOW'>('MID')
  const [japaneseLevel, setJapaneseLevel] = useState<'HIGH' | 'MID' | 'LOW'>('MID')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    const cleanId = instagramId.trim().replace('@', '').toLowerCase()
    if (!cleanId) {
      setErrorMessage('인스타그램 아이디를 입력해 주세요.')
      setLoading(false)
      return
    }

    const virtualAuthEmail = `${cleanId}@club.com`

    if (isSignUp) {
      if (!name || !age) {
        setErrorMessage('이름과 나이를 모두 입력해 주세요.')
        setLoading(false)
        return
      }

      // 1. 계정 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: virtualAuthEmail,
        password,
      })

      if (authError) {
        setErrorMessage(
          authError.message.includes('already registered')
            ? '이미 등록된 인스타그램 아이디입니다.'
            : authError.message
        )
        setLoading(false)
        return
      }

      if (authData.user) {
        // 2. profiles 테이블에 회원 정보 저장
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            name,
            age: Number(age),
            gender,
            instagram_id: cleanId,
            nationality,
            korean_level: koreanLevel,
            japanese_level: japaneseLevel,
            is_blocked: false,
            role: 'MEMBER',
          },
        ])

        if (profileError) {
          setErrorMessage('프로필 저장 실패: ' + profileError.message)
          setLoading(false)
          return
        }

        alert('회원가입이 완료되었습니다!')
        router.push('/')
        router.refresh()
      }
    } else {
      // ★ 1. 로그인 인증 시도
      const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({
        email: virtualAuthEmail,
        password,
      })

      if (loginError) {
        setErrorMessage('로그인 실패: 아이디(인스타그램) 또는 비밀번호를 확인해 주세요.')
        setLoading(false)
        return
      }

      // ★ 2. 로그인 성공 직후 DB에서 차단 여부(is_blocked) 검사
      if (signInData.user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('is_blocked')
          .eq('id', signInData.user.id)
          .single()

        // 차단된 회원인 경우 즉시 세션을 끊고 강제 튕겨내기
        if (userProfile?.is_blocked) {
          await supabase.auth.signOut()
          setErrorMessage('🚫 운영진에 의해 교류회 이용이 차단된 계정입니다. 로그인할 수 없습니다.')
          setLoading(false)
          return
        }
      }

      // 정상 회원이면 대시보드로 이동
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="text-center space-y-1">
          <span className="text-3xl">🇰🇷🤝🇯🇵</span>
          <h1 className="text-xl font-bold text-slate-900">한일 교류회</h1>
          <p className="text-xs text-slate-500">
            {isSignUp ? '신규 회원 프로필 등록' : '인스타그램 아이디로 간편 로그인'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold leading-relaxed">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-3.5 text-xs">
          {/* 가입 시 입력 항목 */}
          {isSignUp && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">이름 *</label>
                <input
                  type="text"
                  placeholder="홍길동 / 田中"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">나이 *</label>
                <input
                  type="number"
                  placeholder="예: 25"
                  value={age}
                  onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                  required
                />
              </div>
            </div>
          )}

          {/* 인스타그램 아이디 */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              인스타그램 아이디 *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold">@</span>
              <input
                type="text"
                placeholder="instagram_id"
                value={instagramId}
                onChange={(e) => setInstagramId(e.target.value)}
                className="w-full p-2.5 pl-7 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">비밀번호 *</label>
            <input
              type="password"
              placeholder="6자리 이상 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
              required
            />
          </div>

          {/* 가입 시 추가 필수 항목: 성별, 국적, 언어 실력 */}
          {isSignUp && (
            <>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">성별 (性別) *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('MALE')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      gender === 'MALE'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    남 (男)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('FEMALE')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      gender === 'FEMALE'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    여 (女)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">국적 *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNationality('KR')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      nationality === 'KR'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    🇰🇷 한국
                  </button>
                  <button
                    type="button"
                    onClick={() => setNationality('JP')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      nationality === 'JP'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    🇯🇵 일본
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">한국어 실력</label>
                  <select
                    value={koreanLevel}
                    onChange={(e: any) => setKoreanLevel(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="HIGH">상 (유창함)</option>
                    <option value="MID">중 (회화가능)</option>
                    <option value="LOW">하 (기초)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">일본어 실력</label>
                  <select
                    value={japaneseLevel}
                    onChange={(e: any) => setJapaneseLevel(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="HIGH">상 (유창함)</option>
                    <option value="MID">중 (회화가능)</option>
                    <option value="LOW">하 (기초)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-sm transition mt-2"
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입 완료' : '로그인'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMessage('')
            }}
            className="text-xs text-indigo-600 hover:underline font-semibold"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '처음 방문하셨나요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}