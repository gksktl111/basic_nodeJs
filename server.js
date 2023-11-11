const express = require('express');
const app = express();

app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded());

const { MongoClient } = require('mongodb');

let db;
const url =
  'mongodb+srv://gksktl111:AYya9Y7m2FqdLIFn@cluster0.dgak6l9.mongodb.net/?retryWrites=true&w=majority';
new MongoClient(url)
  .connect()
  .then((client) => {
    console.log('DB연결성공');
    db = client.db('forum');

    app.listen(8080, () => {
      console.log('  에서 서버 실행중');
    });
  })
  .catch((err) => {
    console.log(err);
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

app.get('/news', (요청, 응답) => {
  db.collection('post').insertOne({ title: '어쩌구' });
});

app.get('/list', async (요청, 응답) => {
  let data = await db.collection('post').find().toArray();
  응답.render('list.ejs', { posts: data });
});

app.post('/write', (요청, 응답) => {
  응답.render('write.ejs');
});

app.post('/newpost', async (요청, 응답) => {
  console.log(요청.body);

  try {
    if (요청.body.title === '') {
      응답.send('제목 입력 안함');
    } else {
      await db.collection('post').insertOne({
        title: 요청.body.title,
        content: 요청.body.content,
      });
      응답.redirect('./list');
    }
  } catch (error) {
    console.log(error);
    요청.statusCode(500).send('에러남');
  }
});

app.get('/time', (요청, 응답) => {
  응답.render('time.ejs', { date: new Date() });
});
