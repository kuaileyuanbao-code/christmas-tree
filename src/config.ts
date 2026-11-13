// 在这里修改树名、欢迎语与题目。correct 是正确选项下标，从 0 开始。
export const treeConfig = {
  title: '快乐源宝的圣诞树',
  owner: '快乐源宝的',
  greeting: '把小小的心意，挂在冬日的枝头。',
};
export interface Question { id: string; title: string; options: [string,string,string,string]; correct: number; difficulty: 'easy'|'medium'|'hard' }
export const questions: Question[] = [
  { id: 'q1', difficulty: 'easy', title: '上课我喜欢坐哪里？', options: ['前排', '中间', '后排', '哪有位置坐哪'], correct: 2 },
  { id: 'q2', difficulty: 'easy', title: '我平时用哪个软件听歌？', options: ['网易云音乐', 'QQ 音乐', '汽水音乐', '酷狗音乐'], correct: 0 },
  { id: 'q3', difficulty: 'easy', title: '周末没事，我通常会？', options: ['出去探店拍照', '在宿舍休息、玩游戏', '约人去健身房', '去图书馆学习'], correct: 1 },
  { id: 'q4', difficulty: 'medium', title: '我最不爱吃什么？', options: ['香菜', '榴莲', '苦瓜', '茄子'], correct: 2 },
  { id: 'q5', difficulty: 'medium', title: '我最喜欢哪部电视剧？', options: ['偷偷藏不住', '当我飞奔向你', '以爱为营', '致我们暖暖的小时光'], correct: 1 },
  { id: 'q6', difficulty: 'medium', title: '我起床一般设几个闹钟？', options: ['一个', '两个', '三个', '四个及以上'], correct: 3 },
  { id: 'q7', difficulty: 'medium', title: '出去玩时，我更喜欢？', options: ['逛商场、随便走走', '去热门景点打卡', '去游乐园玩项目', '爬山看自然风景'], correct: 0 },
  { id: 'q8', difficulty: 'hard', title: '我一般用哪种键盘打字？', options: ['九键拼音', '26 键拼音', '手写输入', '语音输入'], correct: 1 },
  { id: 'q9', difficulty: 'hard', title: '我更喜欢哪种旅行方式？', options: ['只规划大致路线', '提前做好详细攻略', '到当地随便逛', '完全跟着朋友安排'], correct: 0 },
  { id: 'q10', difficulty: 'hard', title: '哪组游戏我都玩过？', options: ['猫和老鼠＋重返未来：1999', '第五人格＋光遇', '英雄联盟＋和平精英', '崩铁＋蛋仔派对'], correct: 3 },
];
export const isDemoQuestions = false;
// 修改题目或选项顺序时同时递增，避免旧网页把旧答案交给新题库计分。
export const QUIZ_VERSION = 'formal-v1-order2';
