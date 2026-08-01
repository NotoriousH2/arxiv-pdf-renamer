# ArXiv PDF Renamer

> [English Version](README.en.md)

ArXiv에서 논문 PDF를 다운로드하면 파일명이 코드번호(예: `2301.07041.pdf`)로 저장됩니다. 

이 Chrome 확장 프로그램은 논문의 **실제 제목**으로 PDF를 저장할 수 있게 해줍니다.

![사용 예시](example.png)

## 기능

- **파일명 템플릿**: 제목, 저자, 날짜, ArXiv ID, 카테고리를 원하는 순서로 조합
- **빠른 다운로드**: 페이지·링크 우클릭 또는 `Alt+Shift+D` 단축키 지원
- **일괄 다운로드**: 검색·목록 페이지에서 최대 50개 논문을 선택해 순차 저장
- **안정적인 메타데이터**: 페이지 분석 실패 시 공식 ArXiv API로 자동 전환
- **버전 및 이력 관리**: 현재 URL 버전/최신 버전 선택과 중복 처리 지원
- **저장 폴더 기억**: 사용자가 승인한 폴더에 이후 논문을 바로 저장
- Modern 형식(`2301.07041`) 및 Legacy 형식(`hep-th/9901001`) 지원
- 설정과 메타데이터 캐시를 브라우저에 로컬 저장

## 설치 방법

1. 이 저장소를 클론합니다:
   ```
   git clone https://github.com/NotoriousH2/arxiv-pdf-renamer.git
   ```
2. Chrome에서 `chrome://extensions`로 이동합니다.
3. 우측 상단의 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다** 버튼을 클릭합니다.
5. 클론한 폴더를 선택합니다.

## 사용 방법

1. ArXiv 논문 페이지(abs 또는 pdf)에 접속합니다.
2. 브라우저 툴바에서 ArXiv PDF Renamer 아이콘을 클릭합니다.
3. 논문 제목이 자동으로 표시됩니다.
4. PDF 버전, 중복 처리, 저장 위치와 파일명 형식을 선택합니다.
5. **Download PDF**를 클릭합니다.

사용자 템플릿에서는 `{title}`, `{firstAuthor}`, `{authors}`, `{year}`,
`{year2}`, `{month}`, `{arxivId}`, `{category}` 토큰을 사용할 수 있습니다.
고정 저장 폴더는 확장 프로그램 설정의 **Choose Folder**에서 지정합니다.
ArXiv 논문 링크가 여러 개 있는 페이지에서는 아이콘을 클릭해 일괄 다운로드
목록을 열 수 있습니다.

## 개발 및 테스트

별도 빌드 과정은 필요하지 않습니다. `npm test`로 단위 테스트를 실행하고,
`npm run check`로 JavaScript 구문을 확인합니다.

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
