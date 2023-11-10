const express = require('express');
const app = express();

app.use(express.static(__dirname + '/public'));

app.listen(8080, () => {
  console.log('  에서 서버 실행중');
});

// 메인페이지에 접속시 반갑다 를 유저에게 보내줌
app.get('/', (요청, 응답) => {
  //   응답.send('반갑다');
  응답.sendFile(__dirname + '/index.html');
});

app.get('/good', (요청, 응답) => {
  응답.send('너무 좋아용~');
});

app.get('/shop', (요청, 응답) => {
  응답.send('쇼핑페이지임');
});

app.get('/about', (요청, 응답) => {
  응답.sendFile(__dirname + '/about.html');
});
