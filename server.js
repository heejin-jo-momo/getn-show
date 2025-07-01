// server.js - 개선된 버전
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 📊 통계 저장용 (메모리)
const stats = {
  totalSubmissions: 0,
  dailySubmissions: {},
  lastReset: new Date().toDateString()
};

// Middleware
app.use(cors({
  origin: [
    'https://heejin-jo-momo.github.io',
    'https://getn.show',
    'https://www.getn.show',  // www 추가
    'https://jobkit.kr',      // jobkit 추가
    'https://www.jobkit.kr',  // www.jobkit 추가
    'https://api.jobkit.kr',  // api.jobkit 추가
    'http://localhost:3000',
    'http://localhost:3001',  // 로컬 백엔드
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));  // 용량 제한 증가
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 📁 파일 업로드 설정 개선
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('Upload 디렉토리 생성 실패:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9가-힣.-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeFileName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB로 증가
  },
  fileFilter: (req, file, cb) => {
    // 허용 파일 타입 확장
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`${file.fieldname === 'portfolio' ? '포트폴리오' : '이력서'}는 PDF, Word, 이미지, ZIP 파일만 업로드 가능합니다.`));
    }
  }
});

// Hiworks SMTP 설정 (재시도 로직 추가)
const transporter = nodemailer.createTransport({
  host: 'smtps.hiworks.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.HIWORKS_EMAIL,
    pass: process.env.HIWORKS_PASSWORD
  },
  tls: {
    rejectUnauthorized: false  // 인증서 문제 방지
  },
  pool: true,  // 연결 풀 사용
  maxConnections: 5,
  maxMessages: 100
});

// 🔄 이메일 전송 재시도 함수
async function sendEmailWithRetry(mailOptions, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ 이메일 전송 성공 (시도 ${i + 1}/${maxRetries}):`, info.messageId);
      return info;
    } catch (error) {
      lastError = error;
      console.error(`❌ 이메일 전송 실패 (시도 ${i + 1}/${maxRetries}):`, error.message);
      
      if (i < maxRetries - 1) {
        // 재시도 전 대기 (지수 백오프)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
}

// 📧 이메일 템플릿 생성 함수 (개선)
function createEmailTemplate(data) {
  const careerHtml = data.careers && data.careers.length > 0 
    ? `
      <h3 style="color: #333; margin-top: 30px;">경력사항</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="text-align: left;">기간</th>
            <th style="text-align: left;">회사</th>
            <th style="text-align: left;">직급</th>
            <th style="text-align: left;">주업무</th>
            <th style="text-align: left;">주요성과</th>
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { 
          background: linear-gradient(135deg, #00d4ff 0%, #ff00ff 100%); 
          color: white; 
          padding: 30px; 
          text-align: center; 
          border-radius: 10px; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; font-size: 18px; opacity: 0.9; }
        .content { 
          background: #ffffff; 
          padding: 30px; 
          margin-top: 20px; 
          border-radius: 10px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid #e0e0e0;
        }
        .info-group { 
          margin-bottom: 20px; 
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
          border-left: 4px solid #00d4ff;
        }
        .label { 
          font-weight: bold; 
          color: #555; 
          display: inline-block;
          width: 100px;
        }
        .value { color: #222; }
        .section-title {
          color: #333;
          margin-top: 30px;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e0e0e0;
        }
        .text-content {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          white-space: pre-wrap;
          word-wrap: break-word;
          border: 1px solid #e0e0e0;
        }
        table { 
          width: 100%; 
          margin-top: 10px;
          border: 1px solid #ddd;
        }
        th { 
          background-color: #f0f0f0; 
          padding: 10px; 
          text-align: left;
          font-weight: bold;
        }
        td { 
          padding: 10px; 
          border-bottom: 1px solid #eee;
        }
        .footer { 
          margin-top: 40px; 
          padding: 20px; 
          background: #f8f9fa;
          border-radius: 5px;
          font-size: 13px; 
          color: #666;
          text-align: center;
        }
        .attachments {
          margin-top: 20px;
          padding: 15px;
          background: #e8f4f8;
          border-radius: 5px;
          border: 1px solid #b8e0ea;
        }
        .attachments ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .attachments li {
          margin: 5px 0;
          color: #0066cc;
        }
        .meta-info {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 12px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 새로운 입사지원서</h1>
          <p>${data.job}</p>
        </div>
        
        <div class="content">
          <h2 style="margin-top: 0;">📋 지원자 정보</h2>
          
          <div class="info-group">
            <div><span class="label">이름:</span> <span class="value">${data.nameKo} (${data.nameEn})</span></div>
          </div>
          
          <div class="info-group">
            <div><span class="label">이메일:</span> <span class="value">${data.email}</span></div>
          </div>
          
          <div class="info-group">
            <div><span class="label">연락처:</span> <span class="value">${data.phone}</span></div>
          </div>
          
          <div class="info-group">
            <div><span class="label">경력구분:</span> <span class="value">${data.careerType}</span></div>
          </div>
          
          ${careerHtml}
          
          <h3 class="section-title">💡 자기소개</h3>
          <div class="text-content">
            ${data.introduction ? data.introduction.replace(/\n/g, '<br>') : '작성하지 않음'}
          </div>
          
          <h3 class="section-title">🛠️ 보유기술</h3>
          <div class="text-content">
            ${data.skills || '작성하지 않음'}
          </div>
          
          ${data.portfolioFile || data.resumeFile ? `
            <div class="attachments">
              <h3 style="margin-top: 0;">📎 첨부파일</h3>
              <ul>
                ${data.portfolioFile ? `<li>포트폴리오: ${data.portfolioFile}</li>` : ''}
                ${data.resumeFile ? `<li>이력서: ${data.resumeFile}</li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <div class="meta-info">
            <span>📅 지원일시: ${new Date().toLocaleString('ko-KR')}</span>
            <span>🌐 IP: ${data.ip || 'Unknown'}</span>
          </div>
          <p style="margin-top: 10px;">
            이 이메일은 getn.show 채용 페이지에서 자동으로 발송되었습니다.
          </p>
          <p style="margin: 5px 0;">
            <strong>JobKit DB 동기화 상태:</strong> ${data.jobkitSync ? '✅ 완료' : '⏳ 대기중'}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// 📊 통계 업데이트 함수
function updateStats() {
  const today = new Date().toDateString();
  
  // 날짜가 바뀌면 일일 통계 리셋
  if (stats.lastReset !== today) {
    stats.dailySubmissions = {};
    stats.lastReset = today;
  }
  
  stats.totalSubmissions++;
  stats.dailySubmissions[today] = (stats.dailySubmissions[today] || 0) + 1;
}

// 🏠 헬스체크 엔드포인트 (개선)
app.get('/health', async (req, res) => {
  try {
    // SMTP 연결 테스트
    await transporter.verify();
    
    res.json({ 
      status: 'ok', 
      message: '서버가 정상적으로 실행중입니다.',
      stats: {
        totalSubmissions: stats.totalSubmissions,
        todaySubmissions: stats.dailySubmissions[new Date().toDateString()] || 0,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB'
      },
      smtp: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'SMTP 연결 실패',
      error: error.message
    });
  }
});

// 📊 통계 엔드포인트 (새로 추가)
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      total: stats.totalSubmissions,
      daily: stats.dailySubmissions,
      lastReset: stats.lastReset
    }
  });
});

// 📝 입사지원 제출 엔드포인트 (개선)
app.post('/api/applications', upload.fields([
  { name: 'portfolio', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log(`📨 [${new Date().toISOString()}] 새 지원서 접수 시작`);
    
    const applicationData = req.body;
    
    // 경력사항 파싱
    if (applicationData.careers && typeof applicationData.careers === 'string') {
      try {
        applicationData.careers = JSON.parse(applicationData.careers);
      } catch (parseError) {
        console.error('경력사항 파싱 실패:', parseError);
        applicationData.careers = [];
      }
    }
    
    // 파일 정보 추가
    if (req.files) {
      if (req.files.portfolio) {
        applicationData.portfolioFile = req.files.portfolio[0].originalname;
        applicationData.portfolioPath = req.files.portfolio[0].path;
        applicationData.portfolioSize = (req.files.portfolio[0].size / 1024 / 1024).toFixed(2) + ' MB';
      }
      if (req.files.resume) {
        applicationData.resumeFile = req.files.resume[0].originalname;
        applicationData.resumePath = req.files.resume[0].path;
        applicationData.resumeSize = (req.files.resume[0].size / 1024 / 1024).toFixed(2) + ' MB';
      }
    }
    
    // IP 주소 추가
    applicationData.ip = req.headers['x-forwarded-for'] || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress ||
                        'Unknown';
    
    // JobKit 동기화 상태 (클라이언트에서 전달받을 수 있음)
    applicationData.jobkitSync = req.body.jobkitSync || false;
    
    // 📧 관리자에게 이메일 전송
    const mailOptions = {
      from: `"겟앤쇼 입사지원" <${process.env.HIWORKS_EMAIL}>`,
      to: process.env.HIWORKS_EMAIL,
      cc: process.env.CC_EMAILS ? process.env.CC_EMAILS.split(',') : [], // 참조 이메일
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
    
    // 이메일 전송 (재시도 포함)
    await sendEmailWithRetry(mailOptions);
    
    // 📧 지원자에게 확인 이메일 전송
    const confirmMailOptions = {
      from: `"겟앤쇼 채용팀" <${process.env.HIWORKS_EMAIL}>`,
      to: applicationData.email,
      subject: `[겟앤쇼] ${applicationData.job} 지원이 완료되었습니다`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00d4ff 0%, #ff00ff 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
            <h1 style="margin: 0;">지원이 완료되었습니다! 🎉</h1>
          </div>
          
          <div style="background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="font-size: 16px;">${applicationData.nameKo}님, 안녕하세요.</p>
            
            <p>겟앤쇼 <strong>${applicationData.job}</strong> 포지션에 지원해 주셔서 진심으로 감사합니다.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">📋 다음 단계 안내</h3>
              <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                <li>제출하신 서류를 꼼꼼히 검토하겠습니다</li>
                <li>서류 합격 시 <strong>2주 이내</strong>에 면접 일정을 안내드립니다</li>
                <li>결과는 이메일 또는 전화로 개별 연락드립니다</li>
              </ol>
            </div>
            
            <p>지원해 주신 모든 분들께 좋은 결과를 드리고 싶지만, 제한된 채용 인원으로 인해 아쉬운 결과를 받으실 수도 있습니다.</p>
            
            <p>결과와 관계없이 겟앤쇼에 관심을 가져주신 것에 감사드리며, 앞으로도 좋은 기회로 만날 수 있기를 희망합니다.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
            
            <p style="color: #666; font-size: 14px;">
              문의사항이 있으시면 언제든지 연락 주시기 바랍니다.<br>
              📧 hr@getnshow.com
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #888; font-size: 12px;">
            <p>본 메일은 발신 전용입니다.</p>
            <p>© 2024 GetNShow. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    // 지원자 확인 메일은 실패해도 무시
    try {
      await sendEmailWithRetry(confirmMailOptions, 2);
      console.log('✅ 지원자 확인 이메일 발송 완료');
    } catch (confirmError) {
      console.error('⚠️ 지원자 확인 이메일 발송 실패 (무시):', confirmError.message);
    }
    
    // 📁 업로드된 파일 삭제 (이메일 전송 후)
    const fileCleanupPromises = [];
    if (applicationData.portfolioPath) {
      fileCleanupPromises.push(
        fs.unlink(applicationData.portfolioPath).catch(err => 
          console.error('포트폴리오 파일 삭제 실패:', err)
        )
      );
    }
    if (applicationData.resumePath) {
      fileCleanupPromises.push(
        fs.unlink(applicationData.resumePath).catch(err => 
          console.error('이력서 파일 삭제 실패:', err)
        )
      );
    }
    await Promise.all(fileCleanupPromises);
    
    // 통계 업데이트
    updateStats();
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [${new Date().toISOString()}] 지원서 처리 완료 (${processingTime}ms)`);
    console.log(`   - 지원자: ${applicationData.nameKo}`);
    console.log(`   - 직무: ${applicationData.job}`);
    console.log(`   - 이메일: ${applicationData.email}`);
    
    res.json({ 
      success: true, 
      message: '지원서가 성공적으로 제출되었습니다.',
      processingTime: processingTime + 'ms',
      submissionId: Date.now() // 간단한 제출 ID
    });
    
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] 에러 발생:`, error);
    
    // 파일 정리 (에러 발생 시에도)
    try {
      if (req.files) {
        const cleanupPromises = [];
        if (req.files.portfolio) {
          cleanupPromises.push(fs.unlink(req.files.portfolio[0].path).catch(() => {}));
        }
        if (req.files.resume) {
          cleanupPromises.push(fs.unlink(req.files.resume[0].path).catch(() => {}));
        }
        await Promise.all(cleanupPromises);
      }
    } catch (cleanupError) {
      console.error('파일 정리 실패:', cleanupError);
    }
    
    res.status(500).json({ 
      success: false, 
      message: '제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🛡️ 에러 핸들링 미들웨어 (개선)
app.use((error, req, res, next) => {
  console.error('미들웨어 에러:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: '파일 크기는 20MB를 초과할 수 없습니다.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        success: false, 
        message: '예상치 못한 파일 필드입니다.',
        code: 'UNEXPECTED_FILE'
      });
    }
  }
  
  res.status(500).json({ 
    success: false, 
    message: error.message || '서버 오류가 발생했습니다.',
    code: 'SERVER_ERROR'
  });
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `요청하신 경로를 찾을 수 없습니다: ${req.method} ${req.url}`,
    code: 'NOT_FOUND'
  });
});

// 🚀 서버 시작
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 겟앤쇼 입사지원 서버 시작`);
  console.log(`📍 포트: ${PORT}`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 이메일: ${process.env.HIWORKS_EMAIL}`);
  console.log(`🕐 시작시간: ${new Date().toLocaleString('ko-KR')}`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 수신, 서버를 안전하게 종료합니다...');
  server.close(() => {
    console.log('서버가 종료되었습니다.');
    process.exit(0);
  });
});

// 처리되지 않은 Promise rejection 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise rejection:', reason);
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error);
  process.exit(1);
});