#!/bin/bash

# setup.sh - 겟앤쇼 입사지원 백엔드 서버 자동 설치 스크립트

echo "🚀 겟앤쇼 입사지원 백엔드 서버 설치를 시작합니다..."

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "https://nodejs.org 에서 Node.js를 먼저 설치해주세요."
    exit 1
fi

echo "✅ Node.js 버전: $(node -v)"

# 프로젝트 폴더 생성
echo "📁 프로젝트 폴더를 생성합니다..."
mkdir -p getnshow-backend
cd getnshow-backend

# package.json 생성
echo "📦 package.json을 생성합니다..."
cat > package.json << 'EOF'
{
  "name": "getnshow-job-application-server",
  "version": "1.0.0",
  "description": "겟앤쇼 입사지원 시스템 백엔드 서버",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "express": "^4.18.2",
    "nodemailer": "^6.9.7",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

# 패키지 설치
echo "📥 필요한 패키지를 설치합니다..."
npm install

# server.js 파일 생성
echo "💾 server.js 파일을 생성합니다..."
# (server.js 내용은 너무 길어서 생략 - 위의 artifact에서 복사)

# .env 파일 생성
echo "🔐 .env 파일을 생성합니다..."
cat > .env << 'EOF'
# Hiworks 이메일 설정
HIWORKS_EMAIL=hr@getnshow.com
HIWORKS_PASSWORD=your-hiworks-password-here

# 서버 설정
PORT=3001
NODE_ENV=development
EOF

# .gitignore 파일 생성
echo "🚫 .gitignore 파일을 생성합니다..."
cat > .gitignore << 'EOF'
node_modules/
uploads/
.env
.env.local
.DS_Store
*.log
dist/
build/
.idea/
.vscode/
*.swp
*.swo
EOF

# uploads 폴더 생성
echo "📂 uploads 폴더를 생성합니다..."
mkdir -p uploads

echo "✅ 설치가 완료되었습니다!"
echo ""
echo "⚠️  중요: .env 파일을 열어서 hiworks 이메일 정보를 입력해주세요:"
echo "   HIWORKS_EMAIL=hr@getnshow.com"
echo "   HIWORKS_PASSWORD=실제_비밀번호"
echo ""
echo "🚀 서버 실행 방법:"
echo "   개발 모드: npm run dev"
echo "   프로덕션 모드: npm start"
echo ""
echo "📍 서버 주소: http://localhost:3001"
echo "📍 헬스체크: http://localhost:3001/health"