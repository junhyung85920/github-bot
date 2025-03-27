// index.js
import express from 'express';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Github API 인증 설정
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// JSON 바디 파싱 (Express 4.16 이상은 내장됨)
app.use(express.json());

console.log('Hello World!');

// 웹훅 엔드포인트 설정 (Github App/Webhook을 위한 엔드포인트)
app.post('/webhook', async (req, res) => {
  const event = req.headers['x-github-event'];
  console.log('이벤트 감지:', event);
  if (event === 'pull_request') {
    const pr = req.body.pull_request;
    console.log('Pull Request 이벤트 감지:', pr.number);
    
    // 분석 및 코멘트 작성 함수 호출
    try {
      await analyzeAndComment(pr);
    } catch (error) {
      console.error('분석 중 오류 발생:', error);
    }
  }
  res.sendStatus(200);
});

// PR 변경사항 분석 및 코멘트 달기 함수
async function analyzeAndComment(pr) {
  const owner = junhyung85920;
  const repo = Dynamic_MoE;

  // 변경된 파일 목록 가져오기
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number : pr.number
  });
  console.log(`PR #${pr.number}의 변경된 파일 목록:`, files);
  // 간단한 분석 예시: 변경된 파일 개수
  const analysisComment = `이번 PR에서는 총 ${files.length}개의 파일이 변경되었습니다.`;

  // PR에 코멘트 달기
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr.number,
    body: analysisComment,
  });

  console.log(`PR #${pull_number}에 코멘트를 작성했습니다.`);
}

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});