Component({
  properties: {
    // 当前显示的面
    currentSide: {
      type: String,
      value: "front",
    },

    // 是否显示区域指引
    showAreaGuidesPrimitive: {
      type: Object,
      value: { front: true, back: true },
    },

    // 底件图片信息
    mainPrimitive: {
      type: Object,
      value: {
        width: 10, // 厘米
        height: 8, // 厘米
        front: { src: "" },
        back: { src: "" },
      },
    },

    // 贴件信息
    patchesPrimitive: {
      type: Object,
      value: {
        front: [],
        back: [],
      },
    },

    // 可移动区域
    movableAreaPrimitive: {
      type: Object,
      value: {
        front: { left: "1/8", top: "1/8", width: "3/4", height: "3/4" },
        back: { left: "1/6", top: "1/6", width: "2/3", height: "2/3" },
      },
    },

    // 不可移动区域
    nonMovableAreasPrimitive: {
      type: Object,
      value: {
        front: [
          { left: "1/3", top: "1/3", width: "1/4", height: "1/4" },
          { left: "3/5", top: "3/5", width: "1/6", height: "1/6" },
        ],
        back: [
          { left: "1/4", top: "1/4", width: "1/5", height: "1/5" },
          { left: "3/4", top: "1/2", width: "1/8", height: "1/8" },
        ],
      },
    },
  },

  data: {
    // 固定工作区尺寸
    workspaceWidth: 0,
    workspaceHeight: 0,

    generating: false, // 控制生成图片的状态

    // 当前激活的贴件ID
    activePatchId: null,

    // 正面数据
    frontSide: {
      zoomLevel: 100,
      maxZoomLevel: 200,
      minZoomLevel: 100,
      showZoomHint: false,
      patches: [], // 基于UUID的贴件数组
      patchesMap: {}, // UUID到贴件数据的映射
      allValid: true,
      // 图片尺寸和位置信息
      imageInfo: {
        loaded: false,
        originalWidth: 0,
        originalHeight: 0,
        displayWidth: 0,
        displayHeight: 0,
        left: 0,
        top: 0,
      },
      movableArea: { left: 0, top: 0, width: 0, height: 0 },
      nonMovableAreas: [],
      transformOriginX: 0,
      transformOriginY: 0,
      workspaceOffsetX: 0,
      workspaceOffsetY: 0,
    },

    // 反面数据
    backSide: {
      zoomLevel: 100,
      maxZoomLevel: 200,
      minZoomLevel: 100,
      showZoomHint: false,
      patches: [], // 基于UUID的贴件数组
      patchesMap: {}, // UUID到贴件数据的映射
      allValid: true,
      // 图片尺寸和位置信息
      imageInfo: {
        loaded: false,
        originalWidth: 0,
        originalHeight: 0,
        displayWidth: 0,
        displayHeight: 0,
        left: 0,
        top: 0,
      },
      movableArea: { left: 0, top: 0, width: 0, height: 0 },
      nonMovableAreas: [],
      transformOriginX: 0,
      transformOriginY: 0,
      workspaceOffsetX: 0,
      workspaceOffsetY: 0,
    },
  },

  // 私有变量，不需要触发视图更新
  lifetimes: {
    async attached() {
      // 获取工作区尺寸
      await this.getWorkspaceInfo();

      this._isWorkspaceZooming = false;
      this._isWorkspaceMoving = false;
      this._workspaceInitialDistance = null;
      this._initialZoomLevel = 100;

      // 工作区拖动相关私有变量
      this._workspaceDragging = false;
      this._workspaceStartX = 0;
      this._workspaceStartY = 0;
      this._workspaceInitialOffsetX = 0;
      this._workspaceInitialOffsetY = 0;
      this._workspaceMoved = false;
      this._containerTapped = false; // 容器点击标记

      // 缓存容器尺寸，避免频繁查询DOM
      this._containerWidth = this.data.workspaceWidth;
      this._containerHeight = this.data.workspaceHeight;

      // 拖动优化相关
      this._lastUpdateTime = 0;
      this._updateThrottle = 16; // 约60fps的更新频率

      // 贴件拖动相关私有变量
      this._patchDragging = false;
      this._patchStartX = 0;
      this._patchStartY = 0;
      this._patchInitialLeft = 0;
      this._patchInitialTop = 0;
      this._patchDraggingId = null;
      this._patchJustDragged = false; // 标记是否刚刚完成贴件拖拽

      // 旋转相关私有变量
      this._rotating = false;
      this._rotateStartAngle = 0;
      this._rotateInitialRotation = 0;
      this._rotatingId = null;
      this._rotateCenterX = 0;
      this._rotateCenterY = 0;

      this.initWorkspace();
    },
  },

  observers: {
    "mainPrimitive, patchesPrimitive, movableAreaPrimitive, nonMovableAreasPrimitive":
      function () {
        this.initWorkspace();
      },
    currentSide: function (newSide, oldSide) {
      // 切换面时不重新初始化，只是更新当前显示的面
      // 这样可以保留每一面的状态：贴件位置、旋转角度、缩放等
      console.log("切换面：", oldSide, "->", newSide);
    },
  },

  methods: {
    // 获取工作区尺寸
    getWorkspaceInfo: function () {
      const query = this.createSelectorQuery();
      query.select('#base-container').boundingClientRect();
      query.exec((res) => {
        if (res[0]) {
          const { width, height } = res[0];
          this.setData({
            workspaceWidth: width,
            workspaceHeight: height,
          });

          // 缓存容器尺寸，避免频繁查询DOM
          this._containerWidth = width;
          this._containerHeight = height;
        }
      });
    },

    async a() {
      const { frontImagePath, backImagePath } = await this.generateSnapshot();

      this.saveImagesToAlbum([frontImagePath, backImagePath]);
    },

    // 获取当前面的数据
    getCurrentSide: function () {
      return this.data.currentSide === "front"
        ? this.data.frontSide
        : this.data.backSide;
    },

    // 获取当前面的数据路径
    getCurrentSidePath: function () {
      return this.data.currentSide === "front" ? "frontSide" : "backSide";
    },

    // 对外暴露的生成快照方法
    generateWorkspaceSnapshot: function () {
      return this.generateSnapshot();
    },

    // 获取当前是否可以生成快照
    canGenerateSnapshot: function () {
      return (
        this.data.frontSide.allValid &&
        this.data.backSide.allValid &&
        !this.data.generating
      );
    },

    // 更新当前面的数据
    updateCurrentSide: function (updateData) {
      const sidePath = this.getCurrentSidePath();
      const currentSide = this.getCurrentSide();
      const newSideData = Object.assign({}, currentSide, updateData);

      this.setData({
        [sidePath]: newSideData,
      });
    },

    // 生成UUID
    generateUUID: function () {
      return (
        "patch-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9)
      );
    },

    // 将分数字符串转换为数字
    // 返回数字(整数) 或 [分子, 分母]（小数）
    fractionToNumber: function (fractionStr) {
      if (!fractionStr || typeof fractionStr !== "string") {
        return Number(fractionStr) || 0;
      }

      // 处理整数情况
      if (!fractionStr.includes("/")) {
        return Number(fractionStr);
      }

      // 处理分数形式
      const [numerator, denominator] = fractionStr.split("/").map(Number);

      if (denominator === 0) {
        throw new Error("分母不能为零");
      }

      return [numerator, denominator];
    },

    // 根据分数计算实际值
    // fraction 参数为 fractionToNumber 方法的返回值
    calcActualByfraction: function (value, fraction) {
      if (Array.isArray(fraction)) {
        return (value * fraction[0]) / fraction[1];
      }
      return value * fraction;
    },

    // 初始化工作区
    initWorkspace: function () {
      if (
        !this.properties.mainPrimitive.front.src &&
        !this.properties.mainPrimitive.back.src
      ) {
        return;
      }

      // 初始化图片信息
      this.loadImageInfo("front", this.properties.mainPrimitive.front.src);
      this.loadImageInfo("back", this.properties.mainPrimitive.back.src);

      // 初始化贴件数据
      this.initPatchesData();
    },

    // 加载图片信息
    loadImageInfo: function (sideType, imageUrl) {
      if (!imageUrl) return;

      wx.getImageInfo({
        src: imageUrl,
        success: (res) => {
          const originalWidth = res.width;
          const originalHeight = res.height;

          // 计算图片在工作区中的显示尺寸和位置（居中显示）
          const displayInfo = this.calculateImageDisplayInfo(
            originalWidth,
            originalHeight
          );

          const sidePath = sideType === "front" ? "frontSide" : "backSide";
          const currentSide = this.data[sidePath];

          // 检查是否是首次加载图片
          const isFirstLoad = !currentSide.imageInfo.loaded;

          // 更新图片信息，保留缩放和偏移状态（除非是首次加载）
          const newSideData = Object.assign({}, currentSide, {
            imageInfo: {
              loaded: true,
              originalWidth,
              originalHeight,
              displayWidth: displayInfo.width,
              displayHeight: displayInfo.height,
              left: displayInfo.left,
              top: displayInfo.top,
            },
          });

          // 只在首次加载时重置缩放和偏移
          if (isFirstLoad) {
            newSideData.zoomLevel = 100;
            newSideData.transformOriginX = 0;
            newSideData.transformOriginY = 0;
            newSideData.workspaceOffsetX = 0;
            newSideData.workspaceOffsetY = 0;
          }

          this.setData({
            [sidePath]: newSideData,
          });

          // 计算该面的区域数据
          this.calculateAreasForSide(sideType, displayInfo);

          // 重新计算该面贴件的显示尺寸
          this.recalculatePatchSizes(sideType);

          // 通知有效性状态变化
          this.notifyValidityChange();
        },
        fail: (error) => {
          console.error(`加载${sideType}面图片失败:`, error);
        },
      });
    },

    // 重新计算指定面贴件的显示尺寸
    recalculatePatchSizes: function (sideType) {
      const patchesConfig = this.properties.patchesPrimitive[sideType] || [];
      const sidePath = sideType + "Side";
      const currentSide = this.data[sidePath];

      if (!currentSide.patches || currentSide.patches.length === 0) {
        return;
      }

      // 重新计算每个贴件的尺寸，但保留位置和旋转
      const updatedPatches = currentSide.patches.map((patch) => {
        // 从配置中找到对应的贴件
        const patchConfig = patchesConfig.find(
          (config) => config.uuid === patch.uuid
        );
        if (!patchConfig) {
          return patch; // 如果找不到配置，保持原样
        }

        // 重新计算显示尺寸
        const newSize = this.calculatePatchDisplaySize(patchConfig, sideType);

        return Object.assign({}, patch, {
          width: newSize.width,
          height: newSize.height,
          // 保留 left, top, rotation, isValid 等状态
        });
      });

      // 更新映射表
      const updatedPatchesMap = {};
      updatedPatches.forEach((patch) => {
        updatedPatchesMap[patch.uuid] = patch;
      });

      // 更新数据
      this.setData({
        [sidePath]: Object.assign({}, currentSide, {
          patches: updatedPatches,
          patchesMap: updatedPatchesMap,
        }),
      });
    },

    // 计算图片在工作区中的显示信息（居中显示）
    calculateImageDisplayInfo: function (originalWidth, originalHeight) {
      const workspaceWidth = this.data.workspaceWidth;
      const workspaceHeight = this.data.workspaceHeight;

      let displayWidth, displayHeight;

      // 根据图片宽高比决定缩放方式
      const imageRatio = originalWidth / originalHeight;
      const workspaceRatio = workspaceWidth / workspaceHeight;

      if (imageRatio > workspaceRatio) {
        // 图片更宽，以宽度为准
        displayWidth = workspaceWidth;
        displayHeight = workspaceWidth / imageRatio;
      } else {
        // 图片更高或比例相同，以高度为准
        displayHeight = workspaceHeight;
        displayWidth = workspaceHeight * imageRatio;
      }

      // 计算图片在工作区中的居中位置
      const left = (workspaceWidth - displayWidth) / 2;
      const top = (workspaceHeight - displayHeight) / 2;

      return {
        width: displayWidth,
        height: displayHeight,
        left: left,
        top: top,
      };
    },

    // 为指定面计算区域数据
    calculateAreasForSide: function (sideType, imageDisplayInfo) {
      const movableAreaConfig = this.properties.movableAreaPrimitive[sideType];
      const nonMovableAreasConfig =
        this.properties.nonMovableAreasPrimitive[sideType];

      // 计算可移动区域
      const movableArea = {
        left: this.calcActualByfraction(
          imageDisplayInfo.width,
          this.fractionToNumber(movableAreaConfig.left)
        ),
        top: this.calcActualByfraction(
          imageDisplayInfo.height,
          this.fractionToNumber(movableAreaConfig.top)
        ),
        width: this.calcActualByfraction(
          imageDisplayInfo.width,
          this.fractionToNumber(movableAreaConfig.width)
        ),
        height: this.calcActualByfraction(
          imageDisplayInfo.height,
          this.fractionToNumber(movableAreaConfig.height)
        ),
      };

      // 计算不可移动区域
      const nonMovableAreas = nonMovableAreasConfig.map((area) => ({
        left: this.calcActualByfraction(
          imageDisplayInfo.width,
          this.fractionToNumber(area.left)
        ),
        top: this.calcActualByfraction(
          imageDisplayInfo.height,
          this.fractionToNumber(area.top)
        ),
        width: this.calcActualByfraction(
          imageDisplayInfo.width,
          this.fractionToNumber(area.width)
        ),
        height: this.calcActualByfraction(
          imageDisplayInfo.height,
          this.fractionToNumber(area.height)
        ),
      }));

      const sidePath = sideType === "front" ? "frontSide" : "backSide";
      const currentSide = this.data[sidePath];

      this.setData({
        [sidePath]: Object.assign({}, currentSide, {
          movableArea: movableArea,
          nonMovableAreas: nonMovableAreas,
        }),
      });
    },

    // 初始化贴件数据
    initPatchesData: function () {
      ["front", "back"].forEach((sideType) => {
        const patchesConfig = this.properties.patchesPrimitive[sideType] || [];
        const sidePath = sideType + "Side";
        const currentSide = this.data[sidePath];

        const patches = [];
        const patchesMap = {};

        patchesConfig.forEach((patchConfig) => {
          // 检查该贴件是否已存在（基于UUID）
          const existingPatch = currentSide.patchesMap[patchConfig.uuid];

          // 计算贴件的实际显示尺寸
          const patchDisplaySize = this.calculatePatchDisplaySize(
            patchConfig,
            sideType
          );

          // 计算贴件在工作区的初始位置（居中）
          let initialLeft = 50; // 默认位置
          let initialTop = 50;

          // 计算贴件相对于底件图片的居中位置
          // 工作区中心位置减去图片偏移，再减去贴件尺寸的一半
          const workspaceCenterX = this.data.workspaceWidth / 2;
          const workspaceCenterY = this.data.workspaceHeight / 2;

          if (currentSide.imageInfo && currentSide.imageInfo.loaded) {
            // 计算贴件在图片坐标系中的位置
            // 工作区中心 - 图片偏移 - 贴件尺寸的一半
            initialLeft =
              workspaceCenterX -
              currentSide.imageInfo.left -
              patchDisplaySize.width / 2;
            initialTop =
              workspaceCenterY -
              currentSide.imageInfo.top -
              patchDisplaySize.height / 2;

            // 确保贴件不超出图片边界
            const imageWidth = currentSide.imageInfo.displayWidth;
            const imageHeight = currentSide.imageInfo.displayHeight;
            initialLeft = Math.max(
              0,
              Math.min(imageWidth - patchDisplaySize.width, initialLeft)
            );
            initialTop = Math.max(
              0,
              Math.min(imageHeight - patchDisplaySize.height, initialTop)
            );
          }

          const patch = {
            id: patchConfig.id,
            uuid: patchConfig.uuid,
            // 如果贴件已存在，保留其位置和旋转；否则使用居中位置
            left: existingPatch ? existingPatch.left : initialLeft,
            top: existingPatch ? existingPatch.top : initialTop,
            rotation: existingPatch ? existingPatch.rotation : 0,
            // 尺寸和有效性状态总是重新计算
            width: patchDisplaySize.width,
            height: patchDisplaySize.height,
            src: patchConfig.src,
            isValid: existingPatch ? existingPatch.isValid : true,
          };

          patches.push(patch);
          patchesMap[patch.uuid] = patch;
        });

        this.setData({
          [sidePath]: Object.assign({}, currentSide, {
            patches: patches,
            patchesMap: patchesMap,
          }),
        });
      });

      this.checkPatchConditions();
    },

    // 计算贴件在视图中的显示尺寸
    // 根据底件图片在工作区展示的宽高，通过底件图片的实际width和height，和贴件的width、height，计算出贴件实际在视图里展示的具体像素
    calculatePatchDisplaySize: function (patchConfig, sideType) {
      const sideData = this.data[sideType + "Side"];
      const mainPrimitive = this.properties.mainPrimitive;

      // 如果图片信息还没加载完成，返回临时尺寸（会在图片加载完成后重新计算）
      if (!sideData.imageInfo || !sideData.imageInfo.loaded) {
        return {
          width: 50, // 临时默认宽度
          height: 50, // 临时默认高度
        };
      }

      // 获取底件图片在工作区的显示尺寸（像素）- 这是底件图片在视图中的实际显示大小
      const imageDisplayWidth = sideData.imageInfo.displayWidth;
      const imageDisplayHeight = sideData.imageInfo.displayHeight;

      // 获取底件图片的实际物理尺寸（厘米）
      const mainPhysicalWidth = mainPrimitive.width; // 厘米
      const mainPhysicalHeight = mainPrimitive.height; // 厘米

      // 计算显示尺寸与实际物理尺寸的比例（像素/厘米）
      const pixelPerCmWidth = imageDisplayWidth / mainPhysicalWidth;
      const pixelPerCmHeight = imageDisplayHeight / mainPhysicalHeight;

      // 根据贴件的实际物理尺寸（厘米）计算其在视图中的显示尺寸（像素）
      const patchDisplayWidth = patchConfig.width * pixelPerCmWidth;
      const patchDisplayHeight = patchConfig.height * pixelPerCmHeight;

      return {
        width: patchDisplayWidth,
        height: patchDisplayHeight,
      };
    },

    // 厘米转像素（简化转换，实际项目中需要根据DPI计算）
    // 注意：这个方法现在主要用作fallback，正常情况下应该使用 calculatePatchDisplaySize
    cmToPx: function (cm) {
      return cm * 37.8; // 1cm ≈ 37.8px in standard DPI
    },

    // 切换区域指引显示
    toggleAreaGuides: function () {
      const currentShowState =
        this.properties.showAreaGuidesPrimitive[this.data.currentSide];
      const newShowState = !currentShowState;

      // 触发父组件更新
      this.triggerEvent("areaGuidesChange", {
        side: this.data.currentSide,
        show: newShowState,
      });
    },

    // 容器触摸开始（用于工作区缩放和拖动）
    onContainerTouchStart: function (e) {
      // 如果正在旋转，则不处理容器触摸
      if (this._rotating) return;

      const currentSide = this.getCurrentSide();

      if (e.touches.length === 2) {
        // 双指手势开始 - 工作区缩放
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        // 获取容器位置
        const query = this.createSelectorQuery();
        query.select("#base-container").boundingClientRect();
        query.exec((res) => {
          if (res[0]) {
            const container = res[0];
            // 计算相对于容器的原点坐标
            const originX = centerX - container.left;
            const originY = centerY - container.top;

            this._isWorkspaceZooming = true;
            this._workspaceInitialDistance = this.calculateDistance(
              e.touches[0].clientX,
              e.touches[0].clientY,
              e.touches[1].clientX,
              e.touches[1].clientY
            );
            this._initialZoomLevel = currentSide.zoomLevel;

            this.updateCurrentSide({
              transformOriginX: originX,
              transformOriginY: originY,
              showZoomHint: true,
            });

            // 2秒后隐藏提示
            setTimeout(() => {
              this.updateCurrentSide({ showZoomHint: false });
            }, 2000);
          }
        });
      } else if (e.touches.length === 1 && currentSide.zoomLevel > 100) {
        // 单指手势开始 - 工作区拖动（只在放大状态下）
        this._workspaceDragging = true;
        this._workspaceStartX = e.touches[0].clientX;
        this._workspaceStartY = e.touches[0].clientY;
        this._workspaceInitialOffsetX = currentSide.workspaceOffsetX;
        this._workspaceInitialOffsetY = currentSide.workspaceOffsetY;
        this._workspaceMoved = false;
      } else if (e.touches.length === 1) {
        // 单指点击空白区域 - 取消激活状态
        this._workspaceMoved = false;
        this._containerTapped = true;
      }
    },

    // 容器触摸移动（用于工作区缩放和拖动）
    onContainerTouchMove: function (e) {
      // 如果正在旋转，则不处理容器移动
      if (this._rotating) return;

      const currentSide = this.getCurrentSide();

      if (e.touches.length === 2 && this._isWorkspaceZooming) {
        // 双指缩放工作区
        const currentDistance = this.calculateDistance(
          e.touches[0].clientX,
          e.touches[0].clientY,
          e.touches[1].clientX,
          e.touches[1].clientY
        );

        // 计算缩放比例，允许小数，最大200%
        const scaleChange = currentDistance / this._workspaceInitialDistance;
        let newZoom = this._initialZoomLevel * scaleChange;
        newZoom = Math.max(
          currentSide.minZoomLevel,
          Math.min(currentSide.maxZoomLevel, newZoom)
        );

        // 保留两位小数，防止精度误差
        newZoom = Math.round(newZoom * 100) / 100;

        if (newZoom !== currentSide.zoomLevel) {
          const updateData = { zoomLevel: newZoom };

          // 如果缩放回100%，重置位移
          if (newZoom === 100) {
            updateData.workspaceOffsetX = 0;
            updateData.workspaceOffsetY = 0;
          }

          this.updateCurrentSide(updateData);
        }
      } else if (e.touches.length === 1 && this._workspaceDragging) {
        // 单指拖动工作区
        const currentTime = Date.now();

        // 节流：限制更新频率，提高性能
        if (currentTime - this._lastUpdateTime < this._updateThrottle) {
          return;
        }

        const dx = e.touches[0].clientX - this._workspaceStartX;
        const dy = e.touches[0].clientY - this._workspaceStartY;

        // 检测是否发生了有效的拖动（移动距离超过阈值）
        const moveDistance = Math.sqrt(dx * dx + dy * dy);
        if (moveDistance > 5 && !this._workspaceMoved) {
          this._workspaceMoved = true;
        }

        let newOffsetX = this._workspaceInitialOffsetX + dx;
        let newOffsetY = this._workspaceInitialOffsetY + dy;

        // 使用固定的工作区尺寸计算拖动限制范围
        const zoomScale = currentSide.zoomLevel / 100;
        const scaledWidth = this.data.workspaceWidth * zoomScale;
        const scaledHeight = this.data.workspaceHeight * zoomScale;
        const containerWidth = this._containerWidth;
        const containerHeight = this._containerHeight;

        // 当放大时，计算可拖动的最大范围
        // 确保底件的边缘不会超出容器视窗
        let maxOffsetX = 0;
        let maxOffsetY = 0;

        if (scaledWidth > containerWidth) {
          maxOffsetX = (scaledWidth - containerWidth) / 2;
        }
        if (scaledHeight > containerHeight) {
          maxOffsetY = (scaledHeight - containerHeight) / 2;
        }

        // 限制偏移量，防止底件拖出视窗
        newOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX));
        newOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, newOffsetY));

        // 直接更新当前面的数据
        this.updateCurrentSide({
          workspaceOffsetX: newOffsetX,
          workspaceOffsetY: newOffsetY,
        });

        this._lastUpdateTime = currentTime;
      }
    },

    // 容器触摸结束
    onContainerTouchEnd: function (e) {
      // 如果是点击空白区域且没有发生拖动，并且当前没有贴件在拖拽，并且刚刚没有完成贴件拖拽，取消激活状态
      if (this._containerTapped && !this._workspaceMoved && !this._patchDragging && !this._patchJustDragged) {
        this.setData({
          activePatchId: null,
        });
      }

      this._isWorkspaceZooming = false;
      this._workspaceInitialDistance = null;
      this._workspaceDragging = false;
      this._workspaceMoved = false;
      this._containerTapped = false;
      this._patchJustDragged = false; // 重置贴件拖拽标记
    },

    // 贴件点击
    onPatchTap: function (e) {
      // 如果工作区刚刚发生了拖动，则不处理贴件点击
      if (this._workspaceMoved) return;

      const uuid = e.currentTarget.dataset.uuid;
      this.activatePatch(uuid);
    },

    // 激活贴件
    activatePatch: function (uuid) {
      // 取消所有贴件的激活状态
      this.setData({
        activePatchId: uuid,
      });

      // 重置容器点击状态，防止激活后立即取消
      this._containerTapped = false;

      // 触发父组件更新
      this.triggerEvent("patchActivate", { uuid: uuid });
    },

    // 贴件触摸开始
    onPatchTouchStart: function (e) {
      // 如果正在旋转，则不处理贴件触摸
      if (this._rotating) return;

      const uuid = e.currentTarget.dataset.uuid;
      const currentSide = this.getCurrentSide();
      const patch = currentSide.patchesMap[uuid];

      if (!patch) return;

      // 重置相关标记，防止激活状态被立即取消
      this._containerTapped = false;
      this._workspaceMoved = false;
      this._patchJustDragged = false;

      this._patchDragging = true;
      this._patchDraggingId = uuid;
      this._patchStartX = e.touches[0].clientX;
      this._patchStartY = e.touches[0].clientY;
      this._patchInitialLeft = patch.left;
      this._patchInitialTop = patch.top;

      // 激活当前贴件
      this.activatePatch(uuid);
    },

    // 贴件触摸移动
    onPatchTouchMove: function (e) {
      // 如果正在旋转，则不处理贴件移动
      if (this._rotating) return;

      if (!this._patchDragging || !this._patchDraggingId) return;

      // 节流优化
      const currentTime = Date.now();
      if (currentTime - this._lastUpdateTime < this._updateThrottle) {
        return;
      }

      const uuid = this._patchDraggingId;
      const currentSide = this.getCurrentSide();
      const patch = currentSide.patchesMap[uuid];

      if (!patch) return;

      const dx = e.touches[0].clientX - this._patchStartX;
      const dy = e.touches[0].clientY - this._patchStartY;

      let newLeft = this._patchInitialLeft + dx / (currentSide.zoomLevel / 100);
      let newTop = this._patchInitialTop + dy / (currentSide.zoomLevel / 100);

      // 严格限制在图片区域内（不能超出四个边缘）
      const imageInfo = currentSide.imageInfo;
      if (imageInfo.loaded) {
        newLeft = Math.max(
          0,
          Math.min(imageInfo.displayWidth - patch.width, newLeft)
        );
        newTop = Math.max(
          0,
          Math.min(imageInfo.displayHeight - patch.height, newTop)
        );
      }

      // 更新贴件
      const newPatchesMap = Object.assign({}, currentSide.patchesMap);
      newPatchesMap[uuid] = Object.assign({}, patch, {
        left: newLeft,
        top: newTop,
      });

      const newPatches = currentSide.patches.map((p) =>
        p.uuid === uuid ? newPatchesMap[uuid] : p
      );

      this.updateCurrentSide({
        patches: newPatches,
        patchesMap: newPatchesMap,
      });

      this._lastUpdateTime = currentTime;
      this.checkPatchConditions();
    },

    // 贴件触摸结束
    onPatchTouchEnd: function (e) {
      // 如果刚刚在拖拽，标记为刚完成拖拽
      if (this._patchDragging) {
        this._patchJustDragged = true;
      }
      
      this._patchDragging = false;
      this._patchDraggingId = null;
    },

    // 删除图标点击
    onDeleteHandleTap: function (e) {
      const uuid = e.currentTarget.dataset.uuid;

      console.log('删除按钮被点击，UUID:', uuid);

      // 触发父组件删除贴件事件
      this.triggerEvent("patchDelete", { uuid: uuid });

      // 取消激活状态
      this.setData({
        activePatchId: null,
      });

      // catchtap 本身就会阻止事件冒泡，不需要额外处理
    },

    // 旋转图标触摸开始
    onRotateHandleTouchStart: function (e) {
      const uuid = e.currentTarget.dataset.uuid;
      const currentSide = this.getCurrentSide();
      const patch = currentSide.patchesMap[uuid];

      if (!patch) return;

      // 获取容器位置
      const query = this.createSelectorQuery();
      query.select("#base-container").boundingClientRect();
      query.exec((res) => {
        if (res[0]) {
          const container = res[0];
          const imageInfo = currentSide.imageInfo;

          // 计算贴件中心点在屏幕上的坐标
          const patchCenterX =
            container.left + imageInfo.left + patch.left + patch.width / 2;
          const patchCenterY =
            container.top + imageInfo.top + patch.top + patch.height / 2;

          // 计算初始角度（从中心点到触摸点的角度）
          const startAngle = Math.atan2(
            e.touches[0].clientY - patchCenterY,
            e.touches[0].clientX - patchCenterX
          );

          this._rotating = true;
          this._rotatingId = uuid;
          this._rotateStartAngle = startAngle;
          this._rotateInitialRotation = patch.rotation;
          this._rotateCenterX = patchCenterX;
          this._rotateCenterY = patchCenterY;
        }
      });
    },

    // 旋转图标触摸移动
    onRotateHandleTouchMove: function (e) {
      if (!this._rotating || !this._rotatingId) return;

      // 节流优化
      const currentTime = Date.now();
      if (currentTime - this._lastUpdateTime < this._updateThrottle) {
        return;
      }

      const uuid = this._rotatingId;
      const currentSide = this.getCurrentSide();
      const patch = currentSide.patchesMap[uuid];

      if (!patch) return;

      // 计算当前角度（从中心点到当前触摸点的角度）
      const currentAngle = Math.atan2(
        e.touches[0].clientY - this._rotateCenterY,
        e.touches[0].clientX - this._rotateCenterX
      );

      // 计算角度变化（弧度转换为角度）
      const angleChange =
        ((currentAngle - this._rotateStartAngle) * 180) / Math.PI;

      // 应用旋转
      const newRotation = (this._rotateInitialRotation + angleChange) % 360;

      // 更新贴件
      const newPatchesMap = Object.assign({}, currentSide.patchesMap);
      newPatchesMap[uuid] = Object.assign({}, patch, {
        rotation: newRotation,
      });

      const newPatches = currentSide.patches.map((p) =>
        p.uuid === uuid ? newPatchesMap[uuid] : p
      );

      this.updateCurrentSide({
        patches: newPatches,
        patchesMap: newPatchesMap,
      });

      this._lastUpdateTime = currentTime;

      // 实时检查条件（旋转过程中）
      this.checkPatchConditions();
    },

    // 旋转图标触摸结束
    onRotateHandleTouchEnd: function (e) {
      this._rotating = false;
      this._rotatingId = null;

      // 最终检查一次条件
      this.checkPatchConditions();
    },

    // 检查贴件是否满足条件
    checkPatchConditions: function () {
      ["front", "back"].forEach((sideType) => {
        const sidePath = sideType + "Side";
        const sideData = this.data[sidePath];
        const patches = [...sideData.patches];
        const patchesMap = Object.assign({}, sideData.patchesMap);
        let allValid = true;

        for (let i = 0; i < patches.length; i++) {
          const patch = patches[i];

          // 获取旋转后的贴件边界（考虑旋转后的实际占用区域）
          const patchBounds = this.getRotatedPatchBounds(patch);

          // 条件1: 贴件是否完全在可移动区域内（考虑旋转）
          const inMovableArea = this.isInsideMovableArea(patchBounds, sideData);

          // 条件2: 贴件是否不在任何不可移动区域内（考虑旋转）
          const outsideNonMovable = this.isOutsideNonMovableAreas(
            patchBounds,
            sideData
          );

          // 条件3: 贴件重叠部分最多只能由两个贴件组成（考虑旋转）
          const validOverlap = this.checkOverlapCondition(
            i,
            patchBounds,
            patches
          );

          // 所有条件必须同时满足
          const isValid = inMovableArea && outsideNonMovable && validOverlap;

          if (!isValid) {
            allValid = false;
          }

          patches[i] = Object.assign({}, patch, { isValid });
          patchesMap[patch.uuid] = patches[i];
        }

        this.setData({
          [sidePath]: Object.assign({}, sideData, {
            patches,
            patchesMap,
            allValid,
          }),
        });
      });

      // 检查完成后，通知外部引用处状态变化
      this.notifyValidityChange();
    },

    // 通知外部引用处有效性状态变化
    notifyValidityChange: function () {
      const canGenerate = this.canGenerateSnapshot();
      this.triggerEvent("validityChange", {
        frontValid: this.data.frontSide.allValid,
        backValid: this.data.backSide.allValid,
        canGenerateSnapshot: canGenerate,
      });
    },

    // 获取旋转后的贴件边界矩形
    getRotatedPatchBounds: function (patch) {
      if (patch.rotation === 0 || patch.rotation % 360 === 0) {
        return {
          left: patch.left,
          top: patch.top,
          right: patch.left + patch.width,
          bottom: patch.top + patch.height,
        };
      }

      const centerX = patch.left + patch.width / 2;
      const centerY = patch.top + patch.height / 2;
      const angle = (patch.rotation * Math.PI) / 180;

      const corners = [
        { x: patch.left, y: patch.top },
        { x: patch.left + patch.width, y: patch.top },
        { x: patch.left + patch.width, y: patch.top + patch.height },
        { x: patch.left, y: patch.top + patch.height },
      ];

      const rotatedCorners = corners.map((corner) => {
        const relX = corner.x - centerX;
        const relY = corner.y - centerY;

        const rotatedX = relX * Math.cos(angle) - relY * Math.sin(angle);
        const rotatedY = relX * Math.sin(angle) + relY * Math.cos(angle);

        return {
          x: rotatedX + centerX,
          y: rotatedY + centerY,
        };
      });

      const xs = rotatedCorners.map((corner) => corner.x);
      const ys = rotatedCorners.map((corner) => corner.y);

      return {
        left: Math.min(...xs),
        top: Math.min(...ys),
        right: Math.max(...xs),
        bottom: Math.max(...ys),
      };
    },

    // 检查是否在可移动区域内
    isInsideMovableArea: function (patchBounds, sideData) {
      const movableRect = {
        left: sideData.movableArea.left,
        top: sideData.movableArea.top,
        right: sideData.movableArea.left + sideData.movableArea.width,
        bottom: sideData.movableArea.top + sideData.movableArea.height,
      };

      return (
        patchBounds.left >= movableRect.left &&
        patchBounds.top >= movableRect.top &&
        patchBounds.right <= movableRect.right &&
        patchBounds.bottom <= movableRect.bottom
      );
    },

    // 检查是否不在不可移动区域内
    isOutsideNonMovableAreas: function (patchBounds, sideData) {
      for (let i = 0; i < sideData.nonMovableAreas.length; i++) {
        const area = sideData.nonMovableAreas[i];
        const nonMovableRect = {
          left: area.left,
          top: area.top,
          right: area.left + area.width,
          bottom: area.top + area.height,
        };

        // 如果贴件与任何不可移动区域有重叠，返回false
        if (
          patchBounds.left < nonMovableRect.right &&
          patchBounds.right > nonMovableRect.left &&
          patchBounds.top < nonMovableRect.bottom &&
          patchBounds.bottom > nonMovableRect.top
        ) {
          return false;
        }
      }

      return true;
    },

    // 检查重叠条件
    checkOverlapCondition: function (currentIndex, currentBounds, patches) {
      // 检查当前贴件与其他贴件的重叠情况
      for (let i = 0; i < patches.length; i++) {
        if (i === currentIndex) continue;

        const otherBounds = this.getRotatedPatchBounds(patches[i]);

        // 检查当前贴件与otherPatch是否有重叠
        if (!this.doOverlap(currentBounds, otherBounds)) continue;

        // 如果当前贴件与otherPatch重叠，检查是否有第三个贴件也与这个重叠区域重叠
        for (let j = i + 1; j < patches.length; j++) {
          if (j === currentIndex) continue;

          const otherBounds2 = this.getRotatedPatchBounds(patches[j]);

          // 检查这三个贴件是否有共同重叠区域
          if (
            this.doThreePatchesOverlap(currentBounds, otherBounds, otherBounds2)
          ) {
            return false; // 三个贴件有共同重叠区域，不符合条件
          }
        }
      }

      return true;
    },

    // 计算两点之间的距离
    calculateDistance: function (x1, y1, x2, y2) {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },

    // 检查两个矩形是否重叠
    doOverlap: function (rect1, rect2) {
      return (
        rect1.left < rect2.right &&
        rect1.right > rect2.left &&
        rect1.top < rect2.bottom &&
        rect1.bottom > rect2.top
      );
    },

    // 检查三个矩形是否有共同重叠区域
    doThreePatchesOverlap: function (rect1, rect2, rect3) {
      // 计算三个矩形的重叠区域
      const left = Math.max(rect1.left, rect2.left, rect3.left);
      const right = Math.min(rect1.right, rect2.right, rect3.right);
      const top = Math.max(rect1.top, rect2.top, rect3.top);
      const bottom = Math.min(rect1.bottom, rect2.bottom, rect3.bottom);

      // 如果有有效的重叠区域，返回true
      return left < right && top < bottom;
    },

    // 生成工作区快照
    generateSnapshot: function () {
      // 检查正反面是否都满足条件
      if (!this.canGenerateSnapshot()) {
        wx.showToast({
          title: "当前状态无法生成快照",
          icon: "error",
        });
        return Promise.reject("无法生成快照");
      }

      wx.showLoading({
        title: "生成图片中...",
        mask: true,
      });

      this.setData({ generating: true });

      // 临时隐藏区域指引
      const originalFrontShowAreaGuides =
        this.properties.showAreaGuidesPrimitive.front;
      const originalBackShowAreaGuides =
        this.properties.showAreaGuidesPrimitive.back;

      // 触发父组件隐藏区域指引
      this.triggerEvent("hideAreaGuidesForSnapshot", {
        front: originalFrontShowAreaGuides,
        back: originalBackShowAreaGuides,
      });

      // 等待UI更新完成后再生成图片
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          Promise.all([
            this.createCanvasSnapshot("front"),
            this.createCanvasSnapshot("back"),
          ])
            .then((imagePaths) => {
              wx.hideLoading();
              this.setData({ generating: false });

              // 恢复区域指引显示状态
              this.triggerEvent("restoreAreaGuidesAfterSnapshot", {
                front: originalFrontShowAreaGuides,
                back: originalBackShowAreaGuides,
              });

              // 触发父组件事件，传递正反面快照路径
              this.triggerEvent("snapshotGenerated", {
                frontImagePath: imagePaths[0],
                backImagePath: imagePaths[1],
              });

              // 通知有效性状态变化
              this.notifyValidityChange();

              resolve({
                frontImagePath: imagePaths[0],
                backImagePath: imagePaths[1],
              });
            })
            .catch((error) => {
              wx.hideLoading();
              this.setData({ generating: false });

              // 恢复区域指引显示状态
              this.triggerEvent("restoreAreaGuidesAfterSnapshot", {
                front: originalFrontShowAreaGuides,
                back: originalBackShowAreaGuides,
              });

              // 通知有效性状态变化
              this.notifyValidityChange();

              reject(error);
            });
        }, 100);
      });
    },

    // 保存图片到相册
    saveImagesToAlbum: function (imagePaths) {
      let savedCount = 0;
      const totalCount = imagePaths.length;

      imagePaths.forEach((imagePath, index) => {
        const sideName = index === 0 ? "正面" : "反面";

        wx.saveImageToPhotosAlbum({
          filePath: imagePath,
          success: () => {
            savedCount++;
            wx.showToast({
              title: `${sideName}已保存`,
              icon: "success",
              duration: 1000,
            });

            if (savedCount === totalCount) {
              setTimeout(() => {
                wx.showToast({
                  title: "全部保存完成",
                  icon: "success",
                });
              }, 1200);
            }
          },
          fail: () => {
            wx.showToast({
              title: `${sideName}保存失败`,
              icon: "error",
            });
          },
        });
      });
    },

    // 创建Canvas快照
    createCanvasSnapshot: function (sideType) {
      return new Promise((resolve, reject) => {
        // 确保只获取指定面的数据
        const sideData = sideType === "front" ? this.data.frontSide : this.data.backSide;
        const mainImageSrc = this.properties.mainPrimitive[sideType].src;

        // 验证数据正确性
        console.log(`=== 生成${sideType}面快照 ===`);
        console.log(`底件图片源:`, mainImageSrc);
        console.log(`贴件数量:`, sideData.patches.length);
        console.log(`贴件数据:`, sideData.patches.map(p => ({ uuid: p.uuid, src: p.src })));

        // 检查Canvas尺寸是否有效
        if (!sideData.imageInfo.loaded || !sideData.imageInfo.displayWidth || !sideData.imageInfo.displayHeight) {
          console.error(`${sideType}面图片信息无效:`, sideData.imageInfo);
          reject(`${sideType}面图片信息无效`);
          return;
        }

        // 使用底件图片的实际显示尺寸作为Canvas尺寸，而不是工作区尺寸
        const canvasWidth = sideData.imageInfo.displayWidth;
        const canvasHeight = sideData.imageInfo.displayHeight;

        console.log(`Canvas尺寸: ${canvasWidth} x ${canvasHeight}`);

        // 创建离屏Canvas
        this.createSelectorQuery()
          .select("#snapshot-canvas")
          .fields({ node: true, size: true })
          .exec((canvasRes) => {
            if (!canvasRes[0]) {
              reject("无法获取Canvas节点");
              return;
            }

            const canvas = canvasRes[0].node;
            const ctx = canvas.getContext("2d");

            // 设置Canvas尺寸
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // 不设置背景色，保持透明
            // ctx.fillStyle = "#ecf0f1";
            // ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 如果该面图片已加载，绘制对应面的底件图片
            if (sideData.imageInfo.loaded && mainImageSrc) {
              const image = canvas.createImage();

              image.onload = () => {
                // 绘制该面的底件图片，填充整个Canvas
                ctx.drawImage(
                  image,
                  0, // 从Canvas的原点开始绘制
                  0,
                  canvasWidth,  // 填充整个Canvas宽度
                  canvasHeight  // 填充整个Canvas高度
                );

                // 绘制该面的贴件
                this.drawPatchesOnCanvasRelativeToImage(ctx, sideData, sideType)
                  .then(() => {
                    // 生成图片
                    wx.canvasToTempFilePath({
                      canvas,
                      success: (result) => {
                        console.log(`${sideType}面快照生成成功:`, result.tempFilePath);
                        resolve(result.tempFilePath);
                      },
                      fail: (error) => {
                        console.error(`${sideType}面快照生成失败:`, error);
                        reject(error);
                      },
                    });
                  })
                  .catch(reject);
              };

              image.onerror = () => {
                console.error(`${sideType}面底件图片加载失败:`, mainImageSrc);
                // 如果底件图片加载失败，只绘制贴件
                this.drawPatchesOnCanvasRelativeToImage(ctx, sideData, sideType)
                  .then(() => {
                    wx.canvasToTempFilePath({
                      canvas,
                      success: (result) => {
                        console.log(`${sideType}面快照生成成功（无底件图片）:`, result.tempFilePath);
                        resolve(result.tempFilePath);
                      },
                      fail: (error) => {
                        console.error(`${sideType}面快照生成失败:`, error);
                        reject(error);
                      },
                    });
                  })
                  .catch(reject);
              };

              image.src = mainImageSrc;
            } else {
              console.warn(`${sideType}面图片未加载，只绘制贴件`);
              // 如果图片未加载，只绘制贴件
              this.drawPatchesOnCanvasRelativeToImage(ctx, sideData, sideType)
                .then(() => {
                  wx.canvasToTempFilePath({
                    canvas,
                    success: (result) => {
                      console.log(`${sideType}面快照生成成功（无底件图片）:`, result.tempFilePath);
                      resolve(result.tempFilePath);
                    },
                    fail: (error) => {
                      console.error(`${sideType}面快照生成失败:`, error);
                      reject(error);
                    },
                  });
                })
                .catch(reject);
            }
          });
      });
    },

    // 在Canvas上绘制贴件（基于图片相对位置）
    drawPatchesOnCanvasRelativeToImage: function (ctx, sideData, sideType) {
      return new Promise((resolve) => {
        const patches = sideData.patches;
        const imageInfo = sideData.imageInfo;
        let drawCount = 0;

        console.log(`=== 绘制${sideType}面贴件 ===`);
        console.log(`贴件数量:`, patches.length);
        console.log(`贴件详情:`, patches.map(p => ({ 
          uuid: p.uuid, 
          src: p.src, 
          position: { left: p.left, top: p.top },
          size: { width: p.width, height: p.height },
          rotation: p.rotation 
        })));

        if (patches.length === 0) {
          console.log(`${sideType}面没有贴件，跳过绘制`);
          resolve();
          return;
        }

        patches.forEach((patch, index) => {
          console.log(`开始绘制${sideType}面第${index + 1}个贴件:`, patch.uuid, patch.src);
          
          // 加载贴件图片
          const patchImage = wx.createOffscreenCanvas().createImage();

          patchImage.onload = () => {
            console.log(`${sideType}面贴件图片加载成功:`, patch.src);
            
            // 创建贴件矩形
            ctx.save();

            // 计算贴件在Canvas上的位置（相对于底件图片，不需要加上图片在工作区的偏移）
            const centerX = patch.left + patch.width / 2;
            const centerY = patch.top + patch.height / 2;

            console.log(`${sideType}面贴件绘制位置:`, { centerX, centerY, rotation: patch.rotation });

            // 移动到中心点并旋转
            ctx.translate(centerX, centerY);
            ctx.rotate((patch.rotation * Math.PI) / 180);

            // 绘制贴件图片
            ctx.drawImage(
              patchImage,
              -patch.width / 2,
              -patch.height / 2,
              patch.width,
              patch.height
            );

            // 设置边框颜色（根据有效性）
            ctx.strokeStyle = patch.isValid ? "#2ecc71" : "#e74c3c";
            ctx.lineWidth = 2;
            ctx.strokeRect(
              -patch.width / 2,
              -patch.height / 2,
              patch.width,
              patch.height
            );

            ctx.restore();

            drawCount++;
            console.log(`${sideType}面贴件绘制完成: ${drawCount}/${patches.length}`);
            if (drawCount === patches.length) {
              console.log(`${sideType}面所有贴件绘制完成`);
              resolve();
            }
          };

          patchImage.onerror = () => {
            console.error(`${sideType}面贴件图片加载失败:`, patch.src);
            // 如果贴件图片加载失败，绘制默认矩形
            ctx.save();

            const centerX = patch.left + patch.width / 2;
            const centerY = patch.top + patch.height / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate((patch.rotation * Math.PI) / 180);

            // 设置贴件颜色（根据有效性）
            ctx.fillStyle = patch.isValid
              ? "rgba(52, 152, 219, 0.7)"
              : "rgba(231, 76, 60, 0.7)";
            ctx.strokeStyle = patch.isValid ? "#2ecc71" : "#e74c3c";
            ctx.lineWidth = 2;

            // 绘制贴件矩形
            ctx.fillRect(
              -patch.width / 2,
              -patch.height / 2,
              patch.width,
              patch.height
            );
            ctx.strokeRect(
              -patch.width / 2,
              -patch.height / 2,
              patch.width,
              patch.height
            );

            // 绘制贴件文字
            ctx.fillStyle = "white";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`P${index + 1}`, 0, 0);

            ctx.restore();

            drawCount++;
            console.log(`${sideType}面贴件绘制完成（默认矩形）: ${drawCount}/${patches.length}`);
            if (drawCount === patches.length) {
              console.log(`${sideType}面所有贴件绘制完成`);
              resolve();
            }
          };

          patchImage.src = patch.src;
        });
      });
    },
  },
});
