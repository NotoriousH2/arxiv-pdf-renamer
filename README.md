# ArXiv PDF Renamer

> [English Version](README.en.md)

ArXiv에서 논문 PDF를 다운로드하면 파일명이 코드번호(예: `2301.07041.pdf`)로 저장됩니다. 이 Chrome 확장 프로그램은 논문의 **실제 제목**으로 PDF를 저장할 수 있게 해줍니다.

## 기능

- ArXiv abs/pdf 페이지에서 논문 제목을 자동 추출
- 제목을 파일명으로 사용하여 PDF 다운로드
- **날짜 접두사 지원**: `[YYYY.MM]` 또는 `[YY.MM]` 형식으로 파일명 앞에 게시 날짜 추가 (예: `[2023.01] Attention Is All You Need.pdf`)
- 접두사 설정이 자동 저장되어 다음 사용 시에도 유지
- Modern 형식(`2301.07041`) 및 Legacy 형식(`hep-th/9901001`) 지원
- 버전 번호가 포함된 URL 지원 (`2301.07041v2`)

## 설치 방법

1. 이 저장소를 클론합니다:
   ```
   git clone https://github.com/YOUR_USERNAME/arxiv-pdf-renamer.git
   ```
2. Chrome에서 `chrome://extensions`로 이동합니다.
3. 우측 상단의 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다** 버튼을 클릭합니다.
5. 클론한 폴더를 선택합니다.

## 사용 방법

1. ArXiv 논문 페이지(abs 또는 pdf)에 접속합니다.
2. 브라우저 툴바에서 ArXiv PDF Renamer 아이콘을 클릭합니다.
3. 논문 제목이 자동으로 표시됩니다.
4. **Date Prefix** 드롭다운에서 원하는 날짜 형식을 선택합니다:
   - `[YYYY.MM]` — 예: `[2023.01] Paper Title.pdf` (기본값)
   - `[YY.MM]` — 예: `[23.01] Paper Title.pdf`
   - `None` — 날짜 접두사 없이 제목만
5. **Download PDF** 버튼을 클릭하면 선택한 형식의 파일명으로 저장됩니다.

## 지원 URL 형식

| 형식 | 예시 |
|------|------|
| Modern abs | `arxiv.org/abs/2301.07041` |
| Modern pdf | `arxiv.org/pdf/2301.07041` |
| PDF 확장자 | `arxiv.org/pdf/2301.07041.pdf` |
| 버전 포함 | `arxiv.org/pdf/2301.07041v2` |
| Legacy | `arxiv.org/abs/hep-th/9901001` |

## 라이선스

[MIT](LICENSE)
