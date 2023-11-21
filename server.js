const express = require('express');
const app = express();
const { MongoClient, ObjectId } = require('mongodb');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');
const { DateTime } = require('luxon');

const { createServer } = require('http');
const { Server } = require('socket.io');
const server = createServer(app);
const io = new Server(server);

require('dotenv').config();

app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');

app.use(passport.initialize());
app.use(
  session({
    secret: '암호화에 쓸 비번',
    resave: false,
    saveUninitialized: false,
    // 여기서 쿠키의 유효기간을 변경가능
    cookie: { maxAge: 60 * 60 * 1000 },
    store: MongoStore.create({
      mongoUrl: process.env.DB_URL,
      dbName: 'forum',
    }),
  })
);
app.use(passport.session());

const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = new S3Client({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'minku1234',
    key: function (요청, file, cb) {
      //업로드시 파일명 변경가능
      // 파일명은 겹치면 안됨, 날짜 많이 사용
      cb(null, Date.now().toString());
    },
  }),
});

let db;
const url = process.env.DB_URL;
new MongoClient(url)
  .connect()
  .then((client) => {
    console.log('DB연결성공');
    db = client.db('forum');

    server.listen(process.env.PORT, () => {
      console.log('  에서 서버 실행중');
    });
  })
  .catch((err) => {
    console.log(err);
  });

function loginCheck(요청, 응답, next) {
  if (!요청.user) {
    응답.send('로그인하세요 ');
  }

  // next()는 미들웨어 코드실행 끝났으니 다음으로 이동해주세요 라는뜻 대충 return같은거
  next();
}

function inputCheck(요청, 응답, next) {}

// 메인페이지에 접속시 반갑다 를 유저에게 보내줌
// 미들웨어는 요청과 응답 사이에 실행됨 (여기선 logincheck)
// 바로 함수를 만들어서도 사용 가능
// [함수1, 함수2, 함수3] 을 통해 미들웨어 여러개 넣기도 가능
// Q. 만약 API 100개에 미들웨어를 전부 적용 하고 싶다
// app.use(loginCheck); 이거 사용이 이코드 밑에 있는 모든 api에 미들웨어를 적용함 순서가 중요
// app.use('/url'.loginCheck); 또한 url에 제한 사항을 걸수있음 이런식으로 url을 넣으면 해당 url과
// 하위 url모두에 적용함 이걸로 원하는 라우팅에만 적용 가능

app.get('/', (요청, 응답) => {
  //   응답.send('반갑다');
  응답.render('index.ejs');
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
  // 5개씩 가져옴
  let data = await db.collection('post').find().limit(5).toArray();
  let postCount = await db.collection('post').count();
  응답.render('list.ejs', {
    posts: data,
    postCount: Math.ceil(postCount / 5),
    currentPage: 1,
  });
});

app.get('/write', (요청, 응답) => {
  // 만약 로그인 정보가 없으면 401 있으면 200
  if (!요청.user) {
    return 응답.status(401).send('Unauthorized');
  }
  // 여기서 파일을 랜더함
  응답.status(200).render('write.ejs');
});

// 미들웨어로 꽃아줌
// name이 img1을 가진 이미지가 들어오면 s3에 자동 업로드 해줌
// 만약 multiple 속성으로 여러장의 이미지를 받아 올때는
// upload.array('img1', 최대이미지 개수) 로 사용 여기선 2개 초과시 업로드 안해줌
app.post('/newpost', upload.single('img1'), async (요청, 응답) => {
  // 또한 업로드 완료시 url을 생성해줌 그 url은 다음 코드로 반환 받을 수 있음
  console.log(요청.file);

  // 여러장 업로드시에는 요청.files로 받기

  // 이미지 업로드 에러처리 방법
  // 우선 미들웨어가 아닌 함수 내부에 만들어야함
  // upload.single('img1')(요청, 응답, (error) => {
  //   // 아래에 에러시 실행할 코드 실행
  //   if (error) return 응답.send('업로드에러');
  // });

  try {
    if (요청.body.title === '') {
      응답.send('제목 입력 안함');
    } else {
      await db.collection('post').insertOne({
        title: 요청.body.title,
        content: 요청.body.content,
        // 이미지 파일 자체는 클라우드에 넣고 url만 db에 저장 후 가져다 쓰기
        img: 요청.file ? 요청.file.location : '',
        user_id: 요청.user._id,
        user_name: 요청.user.username,
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

    const comments = await db
      .collection('comments')
      .find({
        post_id: 요청.params.id,
      })
      .toArray();

    console.log(comments);

    if (post == null) {
      throw new Error();
    }

    응답.render('detail.ejs', { post: post, comments: comments });
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
    const a = await db.collection('post').deleteOne({
      _id: new ObjectId(요청.body.id),
      user: new ObjectId(요청.user._id),
    });

    console.log(a.deletedCount);

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
  let postCount = await db.collection('post').count();
  응답.render('list.ejs', {
    posts: data,
    postCount: Math.ceil(postCount / 5),
    currentPage: 요청.params.page,
  });
});

// 제출한 아이디/비번 검사하는 코드
passport.use(
  // passport.authenticate('local')() 로 실행
  // 아이디 비번 받아와서 체크
  // 예외처리 하면 좋을듯
  // 만약 다른 정보를 제출받아서 검증하고 싶으면 passReqtoCallBack 옵션 찾아보기
  new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    let result = await db
      .collection('user')
      .findOne({ username: 입력한아이디 });
    // 아이디 조회후 없으면 아래 실행
    if (!result) {
      return cb(null, false, { message: '아이디 DB에 없음' });
    }
    // 아이디 통과시 비번 체크
    // 비번이 해싱된 경우 아래로 체크
    if (await bcrypt.compare(입력한비번, result.password)) {
      return cb(null, result);
    } else {
      return cb(null, false, { message: '비번불일치' });
    }
  })
);

//  로그인성공시 세션만들어주고 유저 브라우저 쿠키에 저장
passport.serializeUser((user, done) => {
  console.log(user);
  // 노드js에서 특정 코드를 비동기적으로 처리하기 위해서 사용하는 코드
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username });
  });
});

// 유저가 보낸 쿠키 분석
// 쿠키가 이상 없으면 현재 로그인된 유저정보를 알려줌
// 아무대서나 요청.user로 유저의 정보를 가져올 수 있음

// 비효율 적 특정 API에서만 실행되게 바꾸기

passport.deserializeUser(async (user, done) => {
  // 문제점 유저의 정보가 최신화가 안되어있는 경우가 있음 이를 방지하기위해 디비에
  // 저장된 유저 정보와 현재 세션 document와  일치 여부를 판단한 후 결과를 반환 해주면 좋음

  let result = await db
    .collection('user')
    .findOne({ _id: new ObjectId(user.id) });

  // 비번 항목은 삭제후 넘겨줌
  delete result.password;

  process.nextTick(() => {
    return done(null, result);
  });
});

app.get('/login', async (요청, 응답) => {
  console.log(요청.user);
  응답.render('login.ejs', {
    messageFromServer: null,
  });
});

app.post('/login', async (요청, 응답, next) => {
  passport.authenticate('local', (error, user, info) => {
    // 비교 작업이 끝나면 실행할 함수
    // 매개변수는 각각 에러정보, 성공시 로그인한 유저정보, 실패시 이유 가 들어감
    if (error) return 응답.status(500), json(error);
    if (!user) {
      return 응답.render('login.ejs', {
        messageFromServer: '존재하지 않는 아이디 입니다',
      });
    }

    // 에러가 없으면 로그인 요청
    요청.logIn(user, (error) => {
      if (error) return next(error);
      응답.redirect('/');
    });
  })(요청, 응답, next);
});

app.get('/my-page', (요청, 응답) => {
  console.log(요청.user);
  if (!요청.user) {
    응답.redirect('/login');
  } else {
    응답.render('myPage.ejs');
  }
});

app.get('/register', (요청, 응답) => {
  응답.render('register.ejs', { messageFromServer: null });
});

app.post('/register', async (요청, 응답) => {
  // 비번은 암호화(해싱) 하는게 좋음
  // 해싱 : 문자를 랜덤문자로 변환 하는것
  // 여러 알고리즘이 존재하므로 맘에드는 라이브러리를 다운 받아서 쓰면 됨
  // 여기선 npm install bcrypt 이거 사용함

  // 문자를 해싱해줌, 매개변수는 변환될 문자, 해싱강도 임 강도가 올라갈수록 시간이걸림
  // 10 정도로 하면 50ms정도 걸림

  // 유저네임 빈칸 검사
  if (요청.body.username.length >= 4) {
    // 유저네임 중복 검사
    const nameCheck = await db
      .collection('user')
      .findOne({ username: 요청.body.username });

    if (nameCheck == null) {
      let hashPassword = await bcrypt.hash(요청.body.password, 10);

      await db
        .collection('user')
        .insertOne({ username: 요청.body.username, password: hashPassword });

      응답.redirect('/');
    } else {
      응답.render('register.ejs', {
        messageFromServer: '아이디가 중복됩니다',
      });
    }
  } else {
    // 유저이름 다시작성
    응답.render('register.ejs', {
      messageFromServer: '아이디를 4글자 이상 작성해 주십시요',
    });
  }
});

// require('./routes/shop.js');

// use의 미들웨어로 박으면 하위 라우트에서 저 route를 모두 사용 가능
app.use('/', require('./routes/shop.js'));

app.post('/search', async (요청, 응답) => {
  let 검색조건 = [
    {
      $search: {
        index: 'title_index',
        text: { query: 요청.body.search, path: 'title' },
      },
    },
  ];

  let data = await db
    .collection('post')
    // $text : text 인덱스를 갖다씀
    // $search : 해당 인덱스에서 검색을 함
    .aggregate(검색조건)
    .toArray();

  응답.render('search.ejs', {
    posts: data,
  });
});

app.post('/newcomment', async (요청, 응답) => {
  if (!요청.user) {
    return 응답.send('로그인 먼저 하십쇼');
  }

  try {
    if (요청.body.comment.trim() === '') {
      응답.send('빈칸임');
    } else {
      await db.collection('comments').insertOne({
        comment: 요청.body.comment,
        post_id: 요청.body.postId,
        writerId: new ObjectId(요청.user._id),
        writer: 요청.user.username,
      });
      응답.redirect(`./detail/${요청.body.postId}`);
    }
  } catch (error) {
    console.log(error);
    요청.statusCode(500).send('에러남');
  }
});

app.get('/chat-list', async (요청, 응답) => {
  if (!요청.user) return 응답.send('로그인 먼저 하십쇼');

  const chat_room_data = await db
    .collection('chatroom')
    .find({
      member: 요청.user._id,
    })
    .toArray();

  응답.render('chatList.ejs', { chat_room_data: chat_room_data });
});

app.get('/chat/:id/:name', async (요청, 응답) => {
  // 글이 본인 글인 경우
  if (요청.user._id.toString() === 요청.params.id) {
    return 응답.send('본인 한테는 채팅할 수 없습니다');
  }

  const chat_log = await db.collection('chatroom').findOne({
    $and: [{ member: 요청.user._id }, { member: new ObjectId(요청.params.id) }],
  });

  // 존재 X 새로운 채팅방 생성후 이동
  if (chat_log == null) {
    const koreaTime = DateTime.now().setZone('Asia/Seoul');
    const formattedTime = koreaTime.toFormat('yyyy-MM-dd HH:mm:ss');

    const chat = await db.collection('chatroom').insertOne({
      member: [요청.user._id, new ObjectId(요청.params.id)],
      title: `${요청.user.username} 님과 ${요청.params.name} 님의 채팅방`,
      date: formattedTime,
    });

    응답.render('chat.ejs', { chat: chat });
  }
  // 채팅내역이 존재한다  채팅방으로 이동,
  else {
    응답.redirect(`/chat/${chat_log._id}`);
  }
});

app.get('/chat/:id', async (요청, 응답) => {
  if (!요청.user) return 응답.send('로그인 먼저 하셈');

  console.log(요청.params.id);

  const chat = await db.collection('chat').findOne({
    _id: 요청.params.id,
  });

  console.log(chat);

  응답.render('chat.ejs', { chat: chat });
});

// 유저가 웹소켓으로 연결을 할때마다 실행
io.on('connection', (socket) => {
  // 방 설정
  socket.on('ask-join', (data) => {
    socket.join(data);
  });

  socket.on('message', (data) => {
    // 특정 방에 emit 할려면 to 사용
    io.to(data.room).emit('broadcast', data.msg);
  });
});
