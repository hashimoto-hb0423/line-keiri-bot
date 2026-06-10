const express = require('express');
const line = require('@line/bot-sdk');
const Tesseract = require('tesseract.js');

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

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
    const buffer = Buffer.from(await response.arrayBuffer());

    const { data: { text } } = await Tesseract.recognize(buffer, 'jpn+eng', {
      logger: () => {},
    });

    if (!text.trim()) {
      throw new Error('テキストを読み取れませんでした');
    }

    const reply = `読み取り結果:\n\n${text.trim()}`;
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: reply.substring(0, 5000) }],
    });
  } catch (err) {
    console.error('画像処理エラー:', err.message);
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '読み取りに失敗しました。もう一度お試しください。' }],
    });
  }
}

async function handleText(replyToken, text) {
  await client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: '領収書や請求書の写真を送ってください。読み取ります。' }],
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
