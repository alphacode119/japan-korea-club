import { ImageResponse } from 'next/og'

// 파비콘 메타데이터 크기 설정
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: '#4f46e5', // 교류회 메인 인디고 컬러 배경
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
        }}
      >
        🤝
      </div>
    ),
    {
      ...size,
    }
  )
}