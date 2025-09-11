const app = getApp();

Page({
  data: {
    currentSide: "front", // 当前显示的面

    // 是否显示区域指引
    showAreaGuidesPrimitive: {
      front: true,
      back: true,
    },

    // 底件图片信息（mock数据）
    mainPrimitive: {
      width: 18, // 厘米
      height: 12, // 厘米
      front: {
        src: "https://636c-cloud1-0gmrb87c23c03912-1354727986.tcb.qcloud.la/1756965413593-E5BEAEE4BFA1E59BBEE78987_2025-09-01_132211_984.png",
      },
      back: {
        src: "https://636c-cloud1-0gmrb87c23c03912-1354727986.tcb.qcloud.la/1756965160533-E5BEAEE4BFA1E59BBEE78987_2025-09-01_132218_243.png",
      },
    },

    // 贴件信息（mock数据）
    patchesPrimitive: {
      front: [
        // 袜子
        {
          id: "patch-front-1",
          uuid: "patch-front-uuid-1",
          width: 1.92, // 厘米
          height: 2.93, // 厘米
          src: "https://636c-cloud1-0gmrb87c23c03912-1354727986.tcb.qcloud.la/1754445676428-E5BEAEE4BFA1E59BBEE78987_20250806100059.png",
        },
        // 字母 E
        {
          id: "patch-front-2",
          uuid: "patch-front-uuid-2",
          width: 2, // 厘米
          height: 2.33, // 厘米
          src: "https://636c-cloud1-0gmrb87c23c03912-1354727986.tcb.qcloud.la/1756530314164-106f333ffdf8bb7d9d5f43cea183486d.PNG",
        },
      ],
      back: [
        // 袜子
        {
          id: "patch-front-1",
          uuid: "patch-front-uuid-1",
          width: 1.92, // 厘米
          height: 2.93, // 厘米
          src: "https://636c-cloud1-0gmrb87c23c03912-1354727986.tcb.qcloud.la/1754445676428-E5BEAEE4BFA1E59BBEE78987_20250806100059.png",
        },
      ],
    },

    // 可移动区域（使用分数表示相对位置和尺寸）
    movableAreaPrimitive: {
      front: {
        left: "0",
        top: "5087/52700",
        width: "1/1",
        height: "47613/52700",
      },
      back: {
        left: "1327/15800",
        top: "1863/11200",
        width: "21743/31600",
        height: "197/350",
      },
    },

    // 不可移动区域
    nonMovableAreasPrimitive: {
      front: [
        {
          left: "0",
          top: "175/2108",
          width: "1/1",
          height: "997/10540",
        },
        { left: "0", top: "22891/26350", width: "1/1", height: "3459/26350" },
      ],
      back: [
        {
          left: "677/3160",
          top: "8611/28000",
          width: "13457/31600",
          height: "2031/7000",
        },
        {
          left: "1529/1975",
          top: "22691/56000",
          width: "4677/63200",
          height: "331/3500",
        },
      ],
    },
  },

  onLoad: function () {
    // 页面加载时的初始化
  },

  // 切换正反面
  switchSide: function (e) {
    const targetSide = e.currentTarget.dataset.side;
    if (targetSide === this.data.currentSide) return;

    this.setData({
      currentSide: targetSide,
    });
  },

  // 处理区域指引显示变化
  onAreaGuidesChange: function (e) {
    const { side, show } = e.detail;
    const newShowAreaGuides = Object.assign(
      {},
      this.data.showAreaGuidesPrimitive
    );
    newShowAreaGuides[side] = show;

    this.setData({
      showAreaGuidesPrimitive: newShowAreaGuides,
    });
  },

  // 处理贴件激活
  onPatchActivate: function (e) {
    const { uuid } = e.detail;
    console.log("贴件激活:", uuid);

    // 这里可以处理贴件激活的逻辑
    // 例如更新UI状态、发送事件等
  },

  // 处理贴件删除
  onPatchDelete: function (e) {
    const { uuid } = e.detail;
    console.log("删除贴件:", uuid);

    // 从当前面和另一面中找到并删除对应的贴件
    const newPatches = Object.assign({}, this.data.patchesPrimitive);

    // 检查正面
    if (newPatches.front) {
      newPatches.front = newPatches.front.filter(
        (patch) => patch.uuid !== uuid
      );
    }

    // 检查反面
    if (newPatches.back) {
      newPatches.back = newPatches.back.filter((patch) => patch.uuid !== uuid);
    }

    this.setData({
      patchesPrimitive: newPatches,
    });
  },

  // 为快照生成临时隐藏区域指引
  onHideAreaGuidesForSnapshot: function (e) {
    const { front, back } = e.detail;
    this.setData({
      showAreaGuidesPrimitive: {
        front: false,
        back: false,
      },
    });
  },

  // 快照生成后恢复区域指引显示状态
  onRestoreAreaGuidesAfterSnapshot: function (e) {
    const { front, back } = e.detail;
    this.setData({
      showAreaGuidesPrimitive: {
        front: front,
        back: back,
      },
    });
  },

  // 处理快照生成完成事件
  onSnapshotGenerated: function (e) {
    const { frontImagePath, backImagePath } = e.detail;
    console.log("快照生成完成:");
    console.log("正面快照:", frontImagePath);
    console.log("反面快照:", backImagePath);

    this.selectComponent("#drag-workspace").saveImagesToAlbum([]);

    // 这里可以处理快照生成完成后的逻辑
    // 例如上传到服务器、显示预览等
  },

  // 添加贴件
  addPatch: function (e) {
    const size = e.currentTarget.dataset.size;
    let width, height;

    if (size === "small") {
      width = 2;
      height = 1.5;
    } else if (size === "medium") {
      width = 3;
      height = 2;
    } else {
      width = 4;
      height = 3;
    }

    const currentSide = this.data.currentSide;
    const newPatch = {
      id: "patch-" + currentSide + "-" + Date.now(),
      uuid:
        "patch-uuid-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substr(2, 9),
      width: width,
      height: height,
      src: "https://636c-cloud1-0gmrb87c23c03912-1354727986.tcb.qcloud.la/1756965413593-E5BEAEE4BFA1E59BBEE78987_2025-09-01_132211_984.png",
    };

    const newPatches = Object.assign({}, this.data.patchesPrimitive);
    newPatches[currentSide] = [...newPatches[currentSide], newPatch];

    this.setData({
      patchesPrimitive: newPatches,
    });
  },
});
