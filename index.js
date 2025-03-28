// index.js
import express from 'express';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    // const { data: files } = await octokit.pulls.listFiles({
    //     owner: pr.base.repo.owner.login,
    //     repo : pr.base.repo.name,
    //     pull_number: pr.number,
    // });

    // console.log('변경된 파일 목록:', files);

    const changedFiles = await octokit.rest.pulls.listFiles({
        owner: pr.base.repo.owner.login,
        repo : pr.base.repo.name,
        pull_number: pr.number,
    });

    const blobContentPromises = changedFiles.data.map(async file => await octokit.rest.git.getBlob({
            owner: pr.base.repo.owner.login,
            repo : pr.base.repo.name,
            file_sha: file.sha,
        }).then(blob => blob.data.content));
    const blobContents = await Promise.all(blobContentPromises);
    // decode base64 content
    const decodedBlobContents = blobContents.map(content => Buffer.from(content, 'base64').toString('utf-8'));
    // console.log('Blob Contents:', blobContents);


    // // Gemini API를 통해 코드 분석 수행
    // let geminiAnalysis;
    // try {
    //     geminiAnalysis = await analyzeWithGemini(blobContents);
    //     console.log('Gemini 분석 결과:', geminiAnalysis);
    // } catch (err) {
    //     console.error('Gemini 분석 에러:', err);
    //     geminiAnalysis = "Gemini 분석에 실패하였습니다.";
    // }

    // const analysisComment = `## 코드 분석 결과\n\n${geminiAnalysis}`;

    // // PR에 코멘트 달기
    // await octokit.issues.createComment({
    //     owner: pr.base.repo.owner.login,
    //     repo : pr.base.repo.name,
    //     issue_number: pr.number,
    //     body: analysisComment,
    // });

    const reviews = await generateReviewByGemini(blobContents);
    console.log('Gemini 분석 결과:', reviews);
    const analysisComment = `## 코드 분석 결과\n\n${reviews}`;
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

export const generateReviewByGemini = async (blobContents) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    var reviews = [];


    for (const content of blobContents) {
        const prompt =
        `
            You are a senior developer. Please review the following code and provide your feedback in Korean.
            Use Markdown formatting.
            Be concise and to the point.
            Use emojis if helpful.
            Include code examples if possible.

            Here is the code:
            ${content}
        `
        const result = await model.generateContent(prompt);
        console.log(result.response.text());
        reviews.push(result.response.text());
    }

    
    return reviews;
}