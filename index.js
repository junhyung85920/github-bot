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
    
    console.log(pr.base.repo.owner.login);
    console.log(pr.base.repo.name);
    console.log(pr.number);

    // 변경된 파일 목록 가져오기
    const { data: files } = await octokit.pulls.listFiles({
        owner: pr.base.repo.owner.login,
        repo : pr.base.repo.name,
        pull_number: pr.number,
    });



    // Gemini API를 통해 코드 분석 수행
    let geminiAnalysis;
    try {
        geminiAnalysis = await analyzeWithGemini(files);
        console.log('Gemini 분석 결과:', geminiAnalysis);
    } catch (err) {
        console.error('Gemini 분석 에러:', err);
        geminiAnalysis = "Gemini 분석에 실패하였습니다.";
    }

    const analysisComment = `## 코드 분석 결과\n\n${geminiAnalysis}`;

    // PR에 코멘트 달기
    await octokit.issues.createComment({
        owner: pr.base.repo.owner.login,
        repo : pr.base.repo.name,
        issue_number: pr.number,
        body: analysisComment,
    });

    console.log(`PR #${pr.number}에 코멘트를 작성했습니다.`);
}

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});

// Gemini API를 호출하여 코드 분석을 수행하는 함수
async function analyzeWithGemini(files) {
    // 각 파일의 patch(변경된 diff) 정보를 결합하여 분석에 사용할 텍스트 생성
    const codeDiff = files
        .map(file => file.patch)
        .filter(Boolean)
        .join("\n\n");

    if (!codeDiff) {
        return "변경된 코드에 분석할 내용이 없습니다.";
    }

    console.log('codeDiff:', codeDiff.json);

    // Gemini API 엔드포인트 (환경변수 GEMINI_API_URL에 설정되어 있거나 기본값 사용)
    const geminiApiUrl = process.env.GEMINI_URL + process.env.GEMINI_KEY;
    const prompt =
    `
        You are a senior developer. Please review the following code and provide your feedback in Korean.
        Use Markdown formatting.
        Be concise and to the point.
        Use emojis if helpful.
        Include code examples if possible.

        Here is the code:
        ${codeDiff}
    `

    // Gemini API 호출 (Node.js v20 이상에서는 global fetch 사용 가능)
    const response = await fetch(geminiApiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
    });

    if (!response.ok) {
        throw new Error(`Gemini API 에러: ${response.statusText}`);
    }

    console.log('response:', response.text);

    const data = await response.json();
    // Gemini API 응답에서 분석 결과를 data.analysis 필드로 반환한다고 가정합니다.
    return data.analysis;
}