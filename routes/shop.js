// 기본 설정
const router = require('express').Router();

// api를 만들었는데 이 api가 웹페이지를 보내준다? 그럼 route라고 함
router.get('/shop/shirts', (요청, 응답) => {
  응답.send('셔츠파는 페이지임');
});

router.get('/shop/pants', (요청, 응답) => {
  응답.send('바지파는 페이지임');
});

// exports 문법
module.exports = router;
