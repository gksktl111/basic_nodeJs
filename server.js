const express = require('express');
const app = express();
const { MongoClient, ObjectId } = require('mongodb');
const methodOverride = require('method-override');

app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded());

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
  let data = await db.collection('post').find().limit(5).toArray();
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

app.get('/detail/:id', async (요청, 응답) => {
  try {
    // db의 해당 collection에서 맞는 document를 가져옴
    const post = await db
      .collection('post')
      .findOne({ _id: new ObjectId(요청.params.id) });
    // console.log(post);
    // console.log(요청.params.id);

    if (post == null) {
      throw new Error();
    }

    응답.render('detail.ejs', { post: post });
  } catch (error) {
    console.log(error);
    // 400클라문제, 500서버문제
    응답.status(400).send('이상한 url 입력함');
  }
});

app.get('/edit/:id', async (요청, 응답) => {
  const post = await db
    .collection('post')
    .findOne({ _id: new ObjectId(요청.params.id) });

  응답.render('edit.ejs', { post: post });
});

app.post('/edit/:id', async (요청, 응답) => {
  try {
    await db
      .collection('post')
      .updateOne(
        { _id: new ObjectId(요청.params.id) },
        { $set: { title: 요청.body.title, content: 요청.body.content } }
      );

    응답.redirect('/list');
  } catch (error) {
    응답.status(500).send(error);
  }
});

app.put('/edit/:id', async (요청, 응답) => {
  try {
    await db
      .collection('post')
      .updateOne(
        { _id: new ObjectId(요청.params.id) },
        { $set: { title: 요청.body.title, content: 요청.body.content } }
      );

    응답.redirect('/list');
  } catch (error) {
    응답.status(500).send(error);
  }
});

app.delete('/delete', async (요청, 응답) => {
  try {
    await db.collection('post').deleteOne({ _id: new ObjectId(요청.body.id) });
    응답.sendStatus(200);
  } catch (error) {
    응답.sendStatus(500);
  }
});

app.get('/list/:page', async (요청, 응답) => {
  let data = await db
    .collection('post')
    .find()
    // 스킵 성능 않좋은 너무 많은 데이터 관리에는 사용 X
    .skip((요청.params.page - 1) * 5)
    .limit(5)
    .toArray();
  응답.render('list.ejs', { posts: data });
});
