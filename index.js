const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  res.status(200).send('OK');
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  const { message, replyToken } = event;

  if (message.type === 'image') {
    await handleImage(replyToken, message.id);
  } else if (message.type === 'text') {
    await handleText(replyToken, message.text);
  }
}

async function handleImage(replyToken, messageId) {
  try {
    const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    const arrayBuffer = await response.arrayBuffer();
    const imageData = Buffer.from(arrayBuffer).toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      },
      `この領収書・請求書を読み取って以下の形式で出力してください：

【日付】
【取引先・店名】
【金額（税込）】
【内容・品目】
【支払方法】（わかる場合）

弥生会計インポート用CSV形式（摘要,金額,日付）も合わせて出力してください。`,
    ]);

    const text = result.response.text();
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    });
  } catch (err) {
    console.error('画像処理エラー:', err.message, err.stack);
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: `エラー: ${err.message}` }],
    });
  }
}

async function handleText(replyToken, text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(
      `あなたは経理の専門家アシスタントです。以下の質問に日本語で答えてください：\n${text}`
    );
    const reply = result.response.text();
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: reply }],
    });
  } catch (err) {
    console.error(err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
