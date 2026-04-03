// 请根据 PRD.md，创建 stories.ts 文件，包含 5 个海龟汤故事数据。

export type Difficulty = '简单' | '中等' | '较难' | '难' | '超难'

export interface TurtleStory {
  id: string
  title: string
  difficulty: Difficulty
  surface: string
  bottom: string
}

export const stories: TurtleStory[] = [
  {
    id: 'lamp-switch-three-times',
    title: '睡前的三次开关',
    difficulty: '简单',
    surface:
      '卧室里只有一盏灯。他每晚入睡前，一定要把灯开关连续按三次才睡得着，多年如此。',
    bottom:
      '他曾是盲人，做完复明手术后需要逐步适应光线。医生让他用反复开关的方式练习明暗变化，久而久之形成睡前仪式，不做就难以安心入睡。',
  },
  {
    id: 'hall-music-at-night',
    title: '夜里的琴声',
    difficulty: '中等',
    surface:
      '社区活动室每晚固定时间会传出钢琴练习声，可邻居从没见过有人进出那间屋子。后来琴声停了，大家反而松了口气。',
    bottom:
      '那是已故老人留下的电子琴与定时练习程序，家人一直没关。电池耗尽后程序停止，琴声才消失。',
  },
  {
    id: 'lost-girl-and-broadcast',
    title: '广播里的名字',
    difficulty: '较难',
    surface:
      '商场里小女孩走散了。广播一遍遍喊她的「大名」，她却躲在角落哭，不肯应声。',
    bottom:
      '家人平时都喊她小名，她对户口本上的正式姓名很陌生。广播里的名字让她以为是别人，又害怕被陌生人领走。',
  },
  {
    id: 'photo-extra-hand',
    title: '合影里的手',
    difficulty: '难',
    surface:
      '班级春游合影洗出来后，有同学说最后一排多了一只比「耶」的手，可那天最后一排明明只站了五个人。',
    bottom:
      '队伍旁边是一面大玻璃幕墙，比耶的是路过的游客映在玻璃上的倒影，被一起拍进了画面里。',
  },
  {
    id: 'umbrella-and-elevator',
    title: '雨天与电梯',
    difficulty: '超难',
    surface:
      '他住高层。晴天时电梯能直达他家楼层；一到雨天，他却只乘到中间某一层，再爬楼梯上去。',
    bottom:
      '他个子偏矮，晴天够不到更高的楼层按钮；雨天带着长柄伞，才能用伞尖按到自家那一层。',
  },
  {
    id: 'scale-relief-after-weight',
    title: '称上的轻松',
    difficulty: '简单',
    surface:
      '站上体重秤，数字比上次体检重了不少，他却像卸了担子一样明显松了口气。',
    bottom:
      '他按医嘱增重备战献血指标，长期偏瘦不达标；这次终于达到合格范围，所以反而安心。',
  },
  {
    id: 'aquarium-night-light',
    title: '睡前的鱼缸灯',
    difficulty: '简单',
    surface:
      '他睡觉时卧室里总留着一盏很小很暗的灯，关了整晚都睡不踏实。',
    bottom:
      '床头摆着海水小缸，夜灯是配合造浪与温控的稳定光，突然全黑会惊扰鱼况；他习惯亮着才安心。',
  },
  {
    id: 'bus-bag-on-seat',
    title: '没人坐的空位',
    difficulty: '简单',
    surface:
      '早高峰车里挤得水泄不通，他身旁明明有个空座，却一停站就有人小声骂他不懂事。',
    bottom:
      '座位上放的是他刚买的汤圆外卖，怕挤碎不敢挪开，空位其实是给盒子占的，旁人误会他霸座。',
  },
  {
    id: 'winter-window-stray-cat',
    title: '寒夜留缝的窗',
    difficulty: '中等',
    surface:
      '数九寒天，他仍给阳台推拉门留一条窄缝，冷风流进客厅也不关死。',
    bottom:
      '小区流浪猫每晚来他家阳台避寒进食，缝是留给猫进出用的；关严了猫会扒门嚎，邻里更吵。',
  },
  {
    id: 'empty-frame-gallery-tour',
    title: '空画框的讲解',
    difficulty: '中等',
    surface:
      '导览员对着一面墙讲了一刻钟，游客认真拍照，墙上却只挂着几个空画框。',
    bottom:
      '这是“预留复制品席位”的布展：真迹送去联名修护，框位与讲解词先保留，观众拍的是展签与灯光布局的导览记录。',
  },
  {
    id: 'parking-lot-retakes',
    title: '空旷处的反复倒车',
    difficulty: '中等',
    surface:
      '停车场几乎没车，他却把同一侧方入库进退了二十多分钟才熄火。',
    bottom:
      '他在给线上课补录素材，需要多遍剪辑“打方向的错误示范与纠正”，故意重复演示。',
  },
  {
    id: 'civil-affairs-photo-laugh',
    title: '办证那天的合照',
    difficulty: '中等',
    surface:
      '两人从办事大厅出来，请人拍了张笑脸合影，当天却不是结婚登记的日子。',
    bottom:
      '他们是失散多年的姐弟，刚办完户籍更正与身份证换领，合影纪念终于能对上户口本信息。',
  },
  {
    id: 'funeral-shoulder-shake',
    title: '葬礼上的抖肩',
    difficulty: '较难',
    surface:
      '祖母的追悼礼上，少年全程低头、肩膀不住抖动，长辈们却互相点头说他孝顺。',
    bottom:
      '祖母生前与他约好告别礼上不准哭出声，要偷偷做个搞笑鬼脸；他想起约定的表情，忍笑忍到肩膀发抖，旁人误以为是克制痛哭。',
  },
  {
    id: 'burn-last-page-library',
    title: '借书后烧掉的一页',
    difficulty: '较难',
    surface:
      '从图书馆借回一本旧画册，读完他在院子里只烧掉了最后一页纸，其余准时归还。',
    bottom:
      '末页与封底夹层窝了蜂巢残片，还书检查时被馆员指为虫害风险页；馆方让他按规章剔除该页并登记，他只好焚毁以防虫卵扩散。',
  },
  {
    id: 'storm-open-all-windows',
    title: '雷雨夜推开窗',
    difficulty: '难',
    surface:
      '雷雨交加，他冲进家门却不关窗，反而把面向小区的窗子一扇扇全推开。',
    bottom:
      '出门忘关加湿器又堵了下水，回家已有霉味与电器异味；他判断是潮气与挥发物积聚，趁暴雨对流开窗强换气，宁可淋湿台面也要先通风。',
  },
]

/** 随机选一题；可传入当前 id 尽量避免连续重复（仅一题时仍会返回该题） */
export function pickRandomStory(excludeId?: string): TurtleStory {
  const pool = excludeId
    ? stories.filter((s) => s.id !== excludeId)
    : stories
  const list = pool.length > 0 ? pool : stories
  return list[Math.floor(Math.random() * list.length)] as TurtleStory
}
