// server.js
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'https://heejin-jo-momo.github.io',
    'https://getn.show',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('PDF 파일만 업로드 가능합니다.'));
    }
  }
});

// Hiworks SMTP 설정
const transporter = nodemailer.createTransport({
  host: 'smtp.hiworks.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.HIWORKS_EMAIL, // hr@getnshow.com
    pass: process.env.HIWORKS_PASSWORD // hiworks 비밀번호
  }
});

// 이메일 템플릿 생성 함수
function createEmailTemplate(data) {
  const careerHtml = data.careers && data.careers.length > 0 
    ? `
      <h3>경력사항</h3>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th>기간</th>
            <th>회사</th>
            <th>직급</th>
            <th>주업무</th>
            <th>주요성과</th>
          </tr>
        </thead>
        <tbody>
          ${data.careers.map(career => `
            <tr>
              <td>${career.period || '-'}</td>
              <td>${career.company || '-'}</td>
              <td>${career.position || '-'}</td>
              <td>${career.mainWork || '-'}</td>
              <td>${career.achievement || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(45deg, #00ffff, #ff00ff); color: white; padding: 20px; text-align: center; border-radius: 5px; }
        .content { background: #f9f9f9; padding: 20px; margin-top: 20px; border-radius: 5px; }
        .info-group { margin-bottom: 15px; }
        .label { font-weight: bold; color: #555; }
        table { width: 100%; margin-top: 10px; }
        th { background-color: #f0f0f0; padding: 8px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>입사지원서</h1>
          <p>${data.job}</p>
        </div>
        
        <div class="content">
          <h2>지원자 정보</h2>
          
          <div class="info-group">
            <span class="label">이름:</span> ${data.nameKo} (${data.nameEn})
          </div>
          
          <div class="info-group">
            <span class="label">이메일:</span> ${data.email}
          </div>
          
          <div class="info-group">
            <span class="label">연락처:</span> ${data.phone}
          </div>
          
          <div class="info-group">
            <span class="label">경력구분:</span> ${data.careerType}
          </div>
          
          ${careerHtml}
          
          <h3>자기소개</h3>
          <p style="background: white; padding: 15px; border-radius: 5px;">
            ${data.introduction ? data.introduction.replace(/\n/g, '<br>') : '없음'}
          </p>
          
          <h3>보유기술</h3>
          <p style="background: white; padding: 15px; border-radius: 5px;">
            ${data.skills || '없음'}
          </p>
          
          <div class="info-group">
            <span class="label">첨부파일:</span>
            <ul>
              ${data.portfolioFile ? `<li>포트폴리오: ${data.portfolioFile}</li>` : ''}
              ${data.resumeFile ? `<li>이력서: ${data.resumeFile}</li>` : ''}
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>지원일시: ${new Date().toLocaleString('ko-KR')}</p>
          <p>IP: ${data.ip || 'Unknown'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상적으로 실행중입니다.' });
});

// 입사지원 제출 엔드포인트
app.post('/api/applications', upload.fields([
  { name: 'portfolio', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), async (req, res) => {
  try {
    const applicationData = req.body;
    
    // 경력사항 파싱
    if (applicationData.careers && typeof applicationData.careers === 'string') {
      applicationData.careers = JSON.parse(applicationData.careers);
    }
    
    // 파일 정보 추가
    if (req.files) {
      if (req.files.portfolio) {
        applicationData.portfolioFile = req.files.portfolio[0].originalname;
        applicationData.portfolioPath = req.files.portfolio[0].path;
      }
      if (req.files.resume) {
        applicationData.resumeFile = req.files.resume[0].originalname;
        applicationData.resumePath = req.files.resume[0].path;
      }
    }
    
    // IP 주소 추가
    applicationData.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // 이메일 옵션 설정
    const mailOptions = {
      from: `"겟앤쇼 입사지원" <${process.env.HIWORKS_EMAIL}>`,
      to: process.env.HIWORKS_EMAIL, // hr@getnshow.com
      subject: `[입사지원] ${applicationData.job} - ${applicationData.nameKo}`,
      html: createEmailTemplate(applicationData),
      attachments: []
    };
    
    // 첨부파일 추가
    if (applicationData.portfolioPath) {
      mailOptions.attachments.push({
        filename: applicationData.portfolioFile,
        path: applicationData.portfolioPath
      });
    }
    if (applicationData.resumePath) {
      mailOptions.attachments.push({
        filename: applicationData.resumeFile,
        path: applicationData.resumePath
      });
    }
    
    // 이메일 전송
    const info = await transporter.sendMail(mailOptions);
    console.log('이메일 전송 성공:', info.messageId);
    
    // 지원자에게 확인 이메일 전송 (선택사항)
    const confirmMailOptions = {
      from: `"겟앤쇼 채용팀" <${process.env.HIWORKS_EMAIL}>`,
      to: applicationData.email,
      subject: `[겟앤쇼] ${applicationData.job} 지원이 완료되었습니다`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>입사지원이 정상적으로 접수되었습니다.</h2>
          <p>${applicationData.nameKo}님, 안녕하세요.</p>
          <p>겟앤쇼 ${applicationData.job} 포지션에 지원해 주셔서 감사합니다.</p>
          <p>제출하신 서류는 순차적으로 검토 후 2주 이내에 결과를 안내드리겠습니다.</p>
          <br>
          <p>감사합니다.</p>
          <p>겟앤쇼 채용팀 드림</p>
        </div>
      `
    };
    
    await transporter.sendMail(confirmMailOptions);
    
    // 업로드된 파일 삭제 (이메일 전송 후)
    if (applicationData.portfolioPath) {
      await fs.unlink(applicationData.portfolioPath).catch(console.error);
    }
    if (applicationData.resumePath) {
      await fs.unlink(applicationData.resumePath).catch(console.error);
    }
    
    res.json({ 
      success: true, 
      message: '지원서가 성공적으로 제출되었습니다.' 
    });
    
  } catch (error) {
    console.error('에러 발생:', error);
    res.status(500).json({ 
      success: false, 
      message: '제출 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: '파일 크기는 10MB를 초과할 수 없습니다.' 
      });
    }
  }
  res.status(500).json({ 
    success: false, 
    message: error.message || '서버 오류가 발생했습니다.' 
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행중입니다.`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});

// package.json
/*
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
*/

// .env 파일 예시
/*
# Hiworks 이메일 설정
HIWORKS_EMAIL=hr@getnshow.com
HIWORKS_PASSWORD=your-hiworks-password

# 서버 설정
PORT=3001
NODE_ENV=production
*/

// .gitignore
/*
node_modules/
uploads/
.env
.env.local
.DS_Store
*.log
*/