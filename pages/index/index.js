const app = getApp();

Page({
  data: {
    baseWidth: 0,
    baseHeight: 0,
    currentSide: 'front', // 当前显示的面：'front' 或 'back'
    generating: false, // 控制生成图片的状态
    
    // 正面数据
    frontSide: {
      zoomLevel: 100,
      maxZoomLevel: 200,
      minZoomLevel: 100,
      showZoomHint: false,
      patches: [],
      selectedPatchIndex: null,
      allValid: true,
      showAreaGuides: true,
      movableArea: {
        left: 0,
        top: 0,
        width: 0,
        height: 0
      },
      nonMovableAreas: [],
      transformOriginX: 0,
      transformOriginY: 0,
      workspaceOffsetX: 0,
      workspaceOffsetY: 0
    },
    
    // 反面数据
    backSide: {
      zoomLevel: 100,
      maxZoomLevel: 200,
      minZoomLevel: 100,
      showZoomHint: false,
      patches: [],
      selectedPatchIndex: null,
      allValid: true,
      showAreaGuides: true,
      movableArea: {
        left: 0,
        top: 0,
        width: 0,
        height: 0
      },
      nonMovableAreas: [],
      transformOriginX: 0,
      transformOriginY: 0,
      workspaceOffsetX: 0,
      workspaceOffsetY: 0
    }
  },

  // 私有变量，不需要触发视图更新
  _isWorkspaceZooming: false,
  _isWorkspaceMoving: false,
  _workspaceInitialDistance: null,
  _initialZoomLevel: 100,
  
  // 工作区拖动相关私有变量
  _workspaceDragging: false,
  _workspaceStartX: 0,
  _workspaceStartY: 0,
  _workspaceInitialOffsetX: 0,
  _workspaceInitialOffsetY: 0,
  _workspaceMoved: false,
  
  // 缓存容器尺寸，避免频繁查询DOM
  _containerWidth: 0,
  _containerHeight: 0,
  
  // 拖动优化相关
  _lastUpdateTime: 0,
  _updateThrottle: 16, // 约60fps的更新频率
  
  // 贴件拖动相关私有变量
  _patchDragging: false,
  _patchStartX: 0,
  _patchStartY: 0,
  _patchInitialLeft: 0,
  _patchInitialTop: 0,
  _patchDraggingIndex: null,
  
  // 旋转相关私有变量
  _rotating: false,
  _rotateStartAngle: 0,
  _rotateInitialRotation: 0,
  _rotatingIndex: null,
  _rotateCenterX: 0,
  _rotateCenterY: 0,

  onLoad: function() {
    this.initBaseSize();
  },

  // 获取当前面的数据
  getCurrentSide: function() {
    return this.data.currentSide === 'front' ? this.data.frontSide : this.data.backSide;
  },

  // 获取当前面的数据路径
  getCurrentSidePath: function() {
    return this.data.currentSide === 'front' ? 'frontSide' : 'backSide';
  },

  // 更新当前面的数据
  updateCurrentSide: function(updateData) {
    const sidePath = this.getCurrentSidePath();
    const currentSide = this.getCurrentSide();
    const newSideData = Object.assign({}, currentSide, updateData);
    
    this.setData({
      [sidePath]: newSideData
    });
  },

  // 切换正反面
  switchSide: function(e) {
    const targetSide = e.currentTarget.dataset.side;
    if (targetSide === this.data.currentSide) return;
    
    this.setData({
      currentSide: targetSide
    });
    
    // 重置工作区缩放状态
    this._isWorkspaceZooming = false;
    this._isWorkspaceMoving = false;
    this._workspaceInitialDistance = null;
    this._workspaceDragging = false;
  },

  // 初始化底件尺寸
  initBaseSize: function() {
    const query = wx.createSelectorQuery();
    query.select('#base-container').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        const baseWidth = res[0].width;
        const baseHeight = res[0].height;
        
        // 计算正面的区域数据
        const frontMovableArea = this.calculateMovableArea(baseWidth, baseHeight);
        const frontNonMovableAreas = this.calculateNonMovableAreas(baseWidth, baseHeight);
        
        // 计算反面的区域数据（可以不同）
        const backMovableArea = this.calculateBackMovableArea(baseWidth, baseHeight);
        const backNonMovableAreas = this.calculateBackNonMovableAreas(baseWidth, baseHeight);
        
        this.setData({
          baseWidth,
          baseHeight,
          frontSide: Object.assign({}, this.data.frontSide, {
            movableArea: frontMovableArea,
            nonMovableAreas: frontNonMovableAreas,
            zoomLevel: 100,
            transformOriginX: 0,
            transformOriginY: 0,
            workspaceOffsetX: 0,
            workspaceOffsetY: 0
          }),
          backSide: Object.assign({}, this.data.backSide, {
            movableArea: backMovableArea,
            nonMovableAreas: backNonMovableAreas,
            zoomLevel: 100,
            transformOriginX: 0,
            transformOriginY: 0,
            workspaceOffsetX: 0,
            workspaceOffsetY: 0
          })
        });
        
        // 缓存容器尺寸到私有变量
        this._containerWidth = res[0].width;
        this._containerHeight = res[0].height;
        
        // 为正面和反面初始添加一个贴件
        if (this.data.frontSide.patches.length === 0) {
          // 为正面添加贴件
          this.setData({
            currentSide: 'front'
          });
          this.addPatch({ currentTarget: { dataset: { size: 'small' } } });
        }
        if (this.data.backSide.patches.length === 0) {
          // 为反面添加贴件
          this.setData({
            currentSide: 'back'
          });
          this.addPatch({ currentTarget: { dataset: { size: 'small' } } });
          // 切换回正面
          this.setData({
            currentSide: 'front'
          });
        } else {
          // 重新检查条件
          this.checkPatchConditions();
        }
      }
    });
  },

  // 计算可移动区域
  calculateMovableArea: function(baseWidth, baseHeight) {
    return {
      left: (1/8) * baseWidth,
      top: (1/8) * baseHeight,
      width: (3/4) * baseWidth,
      height: (3/4) * baseHeight
    };
  },

  // 计算不可移动区域
  calculateNonMovableAreas: function(baseWidth, baseHeight) {
    return [
      {
        left: (1/3) * baseWidth,
        top: (1/3) * baseHeight,
        width: (1/4) * baseWidth,
        height: (1/4) * baseHeight
      },
      {
        left: (3/5) * baseWidth,
        top: (3/5) * baseHeight,
        width: (1/6) * baseWidth,
        height: (1/6) * baseHeight
      }
    ];
  },

  // 计算反面可移动区域（可以与正面不同）
  calculateBackMovableArea: function(baseWidth, baseHeight) {
    return {
      left: (1/6) * baseWidth,
      top: (1/6) * baseHeight,
      width: (2/3) * baseWidth,
      height: (2/3) * baseHeight
    };
  },

  // 计算反面不可移动区域（可以与正面不同）
  calculateBackNonMovableAreas: function(baseWidth, baseHeight) {
    return [
      {
        left: (1/4) * baseWidth,
        top: (1/4) * baseHeight,
        width: (1/5) * baseWidth,
        height: (1/5) * baseHeight
      },
      {
        left: (3/4) * baseWidth,
        top: (1/2) * baseHeight,
        width: (1/8) * baseWidth,
        height: (1/8) * baseHeight
      }
    ];
  },

  // 容器触摸开始（用于工作区缩放和拖动）
  onContainerTouchStart: function(e) {
    // 如果正在旋转，则不处理容器触摸
    if (this._rotating) return;
    
    const currentSide = this.getCurrentSide();
    
    if (e.touches.length === 2) {
      // 双指手势开始 - 工作区缩放
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      // 获取容器位置
      const query = wx.createSelectorQuery();
      query.select('#base-container').boundingClientRect();
      query.exec((res) => {
        if (res[0]) {
          const container = res[0];
          // 计算相对于容器的原点坐标
          const originX = centerX - container.left;
          const originY = centerY - container.top;
          
          this._isWorkspaceZooming = true;
          this._workspaceInitialDistance = this.calculateDistance(
            e.touches[0].clientX, e.touches[0].clientY,
            e.touches[1].clientX, e.touches[1].clientY
          );
          this._initialZoomLevel = currentSide.zoomLevel;
          
          this.updateCurrentSide({
            transformOriginX: originX,
            transformOriginY: originY,
            showZoomHint: true
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
    }
  },

  // 容器触摸移动（用于工作区缩放和拖动）
  onContainerTouchMove: function(e) {
    // 如果正在旋转，则不处理容器移动
    if (this._rotating) return;
    
    const currentSide = this.getCurrentSide();
    
    if (e.touches.length === 2 && this._isWorkspaceZooming) {
      // 双指缩放工作区
      const currentDistance = this.calculateDistance(
        e.touches[0].clientX, e.touches[0].clientY,
        e.touches[1].clientX, e.touches[1].clientY
      );

      // 计算缩放比例，允许小数，最大200%
      const scaleChange = currentDistance / this._workspaceInitialDistance;
      let newZoom = this._initialZoomLevel * scaleChange;
      newZoom = Math.max(currentSide.minZoomLevel, Math.min(currentSide.maxZoomLevel, newZoom));

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
      
      // 使用缓存的容器尺寸计算拖动限制范围
      const zoomScale = currentSide.zoomLevel / 100;
      const scaledWidth = this.data.baseWidth * zoomScale;
      const scaledHeight = this.data.baseHeight * zoomScale;
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
        workspaceOffsetY: newOffsetY
      });
      
      this._lastUpdateTime = currentTime;
    }
  },

  // 容器触摸结束
  onContainerTouchEnd: function(e) {
    this._isWorkspaceZooming = false;
    this._workspaceInitialDistance = null;
    this._workspaceDragging = false;
    this._workspaceMoved = false;
  },

  // 贴件点击
  onPatchTap: function(e) {
    // 如果工作区刚刚发生了拖动，则不处理贴件点击
    if (this._workspaceMoved) return;
    
    const index = e.currentTarget.dataset.index;
    this.selectPatch(index);
  },

  // 旋转图标触摸开始
  onRotateHandleTouchStart: function(e) {
    const index = e.currentTarget.dataset.index;
    const currentSide = this.getCurrentSide();
    const patch = currentSide.patches[index];
    
    // 获取容器位置
    const query = wx.createSelectorQuery();
    query.select('#base-container').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        const container = res[0];
        
        // 计算贴件中心点在屏幕上的坐标
        const patchCenterX = container.left + patch.left + patch.width / 2;
        const patchCenterY = container.top + patch.top + patch.height / 2;
        
        // 计算初始角度（从中心点到触摸点的角度）
        const startAngle = Math.atan2(
          e.touches[0].clientY - patchCenterY,
          e.touches[0].clientX - patchCenterX
        );
        
        this._rotating = true;
        this._rotatingIndex = index;
        this._rotateStartAngle = startAngle;
        this._rotateInitialRotation = patch.rotation;
        this._rotateCenterX = patchCenterX;
        this._rotateCenterY = patchCenterY;
      }
    });
    
    // 阻止事件冒泡
    e.stopPropagation();
  },

  // 旋转图标触摸移动
  onRotateHandleTouchMove: function(e) {
    if (!this._rotating || this._rotatingIndex === null) return;
    
    // 节流优化
    const currentTime = Date.now();
    if (currentTime - this._lastUpdateTime < this._updateThrottle) {
      return;
    }
    
    const index = this._rotatingIndex;
    const currentSide = this.getCurrentSide();
    const patches = [...currentSide.patches];
    const patch = patches[index];
    
    // 计算当前角度（从中心点到当前触摸点的角度）
    const currentAngle = Math.atan2(
      e.touches[0].clientY - this._rotateCenterY,
      e.touches[0].clientX - this._rotateCenterX
    );
    
    // 计算角度变化（弧度转换为角度）
    const angleChange = (currentAngle - this._rotateStartAngle) * 180 / Math.PI;
    
    // 应用旋转
    const newRotation = (this._rotateInitialRotation + angleChange) % 360;
    
    // 更新贴件
    patches[index] = {
      ...patch,
      rotation: newRotation
    };
    
    this.updateCurrentSide({ patches });
    this._lastUpdateTime = currentTime;
    
    // 实时检查条件（旋转过程中）
    this.checkPatchConditions();
    
    // 阻止事件冒泡
    e.stopPropagation();
  },

  // 旋转图标触摸结束
  onRotateHandleTouchEnd: function(e) {
    this._rotating = false;
    this._rotatingIndex = null;
    
    // 最终检查一次条件
    this.checkPatchConditions();
    
    // 阻止事件冒泡
    e.stopPropagation();
  },

  // 贴件触摸开始
  onPatchTouchStart: function(e) {
    // 如果正在旋转，则不处理贴件触摸
    if (this._rotating) return;
    
    const index = e.currentTarget.dataset.index;
    const currentSide = this.getCurrentSide();
    const patch = currentSide.patches[index];
    
    this._patchDragging = true;
    this._patchDraggingIndex = index;
    this._patchStartX = e.touches[0].clientX;
    this._patchStartY = e.touches[0].clientY;
    this._patchInitialLeft = patch.left;
    this._patchInitialTop = patch.top;
    
    // 阻止事件冒泡到容器
    e.stopPropagation();
  },

  // 贴件触摸移动
  onPatchTouchMove: function(e) {
    // 如果正在旋转，则不处理贴件移动
    if (this._rotating) return;
    
    if (!this._patchDragging || this._patchDraggingIndex === null) return;
    
    // 节流优化
    const currentTime = Date.now();
    if (currentTime - this._lastUpdateTime < this._updateThrottle) {
      return;
    }
    
    const index = this._patchDraggingIndex;
    const currentSide = this.getCurrentSide();
    const patches = [...currentSide.patches];
    const patch = patches[index];
    
    const dx = e.touches[0].clientX - this._patchStartX;
    const dy = e.touches[0].clientY - this._patchStartY;
    
    let newLeft = this._patchInitialLeft + dx / (currentSide.zoomLevel / 100);
    let newTop = this._patchInitialTop + dy / (currentSide.zoomLevel / 100);
    
    // 严格限制在底件范围内（不能超出四个边缘）
    newLeft = Math.max(0, Math.min(this.data.baseWidth - patch.width, newLeft));
    newTop = Math.max(0, Math.min(this.data.baseHeight - patch.height, newTop));
    
    // 更新贴件
    patches[index] = {
      ...patch,
      left: newLeft,
      top: newTop
    };
    
    this.updateCurrentSide({ patches });
    this._lastUpdateTime = currentTime;
    this.checkPatchConditions();
    
    // 阻止事件冒泡到容器
    e.stopPropagation();
  },

  // 贴件触摸结束
  onPatchTouchEnd: function(e) {
    this._patchDragging = false;
    this._patchDraggingIndex = null;
    
    // 阻止事件冒泡到容器
    e.stopPropagation();
  },

  // 选择贴件
  selectPatch: function(index) {
    const currentSide = this.getCurrentSide();
    const patches = currentSide.patches.map((patch, i) => ({
      ...patch,
      selected: i === index
    }));
    
    this.updateCurrentSide({ 
      patches,
      selectedPatchIndex: index
    });
  },

  // 添加贴件
  addPatch: function(e) {
    const size = e.currentTarget.dataset.size;
    let width, height;
    
    if (size === 'small') {
      width = 50;
      height = 40;
    } else if (size === 'medium') {
      width = 80;
      height = 60;
    } else {
      width = 110;
      height = 80;
    }
    
    const newPatch = {
      left: (this.data.baseWidth - width) / 2,
      top: (this.data.baseHeight - height) / 2,
      width,
      height,
      rotation: 0,
      selected: true,
      isValid: true
    };
    
    const currentSide = this.getCurrentSide();
    const patches = currentSide.patches.map(patch => ({
      ...patch,
      selected: false
    }));
    
    patches.push(newPatch);
    
    this.updateCurrentSide({ 
      patches,
      selectedPatchIndex: patches.length - 1
    });
    
    this.checkPatchConditions();
  },

  // 切换区域指引显示
  toggleAreaGuides: function() {
    const currentSide = this.getCurrentSide();
    this.updateCurrentSide({
      showAreaGuides: !currentSide.showAreaGuides
    });
  },

  // 生成工作区快照
  generateSnapshot: function() {
    // 检查正反面是否都满足条件
    if (!this.data.frontSide.allValid || !this.data.backSide.allValid || this.data.generating) {
      return;
    }

    wx.showLoading({
      title: '生成图片中...',
      mask: true
    });

    this.setData({ generating: true });

    // 临时隐藏区域指引
    const originalFrontShowAreaGuides = this.data.frontSide.showAreaGuides;
    const originalBackShowAreaGuides = this.data.backSide.showAreaGuides;
    
    this.setData({
      frontSide: Object.assign({}, this.data.frontSide, { showAreaGuides: false }),
      backSide: Object.assign({}, this.data.backSide, { showAreaGuides: false })
    });

    // 等待UI更新完成后再生成图片
    setTimeout(() => {
      Promise.all([
        this.createCanvasSnapshot('front'),
        this.createCanvasSnapshot('back')
      ]).then((imagePaths) => {
        wx.hideLoading();
        this.setData({ 
          generating: false,
          frontSide: Object.assign({}, this.data.frontSide, { showAreaGuides: originalFrontShowAreaGuides }),
          backSide: Object.assign({}, this.data.backSide, { showAreaGuides: originalBackShowAreaGuides })
        });

        // 显示生成成功的提示
        wx.showModal({
          title: '快照生成成功',
          content: `正面和反面快照已生成完成，是否保存到相册？`,
          success: (res) => {
            if (res.confirm) {
              // 依次保存到相册
              this.saveImagesToAlbum(imagePaths);
            }
          }
        });
      }).catch((error) => {
        wx.hideLoading();
        this.setData({ 
          generating: false,
          frontSide: Object.assign({}, this.data.frontSide, { showAreaGuides: originalFrontShowAreaGuides }),
          backSide: Object.assign({}, this.data.backSide, { showAreaGuides: originalBackShowAreaGuides })
        });
        wx.showToast({
          title: '生成失败',
          icon: 'error'
        });
        console.error('生成快照失败:', error);
      });
    }, 100);
  },

  // 保存图片到相册
  saveImagesToAlbum: function(imagePaths) {
    let savedCount = 0;
    const totalCount = imagePaths.length;

    imagePaths.forEach((imagePath, index) => {
      const sideName = index === 0 ? '正面' : '反面';
      
      wx.saveImageToPhotosAlbum({
        filePath: imagePath,
        success: () => {
          savedCount++;
          wx.showToast({
            title: `${sideName}已保存`,
            icon: 'success',
            duration: 1000
          });
          
          if (savedCount === totalCount) {
            setTimeout(() => {
              wx.showToast({
                title: '全部保存完成',
                icon: 'success'
              });
            }, 1200);
          }
        },
        fail: () => {
          wx.showToast({
            title: `${sideName}保存失败`,
            icon: 'error'
          });
        }
      });
    });
  },

  // 创建Canvas快照
  createCanvasSnapshot: function(sideType) {
    return new Promise((resolve, reject) => {
      // 获取指定面的数据
      const sideData = sideType === 'front' ? this.data.frontSide : this.data.backSide;
      
      // 获取工作区尺寸
      const query = wx.createSelectorQuery();
      query.select('#base-container').boundingClientRect();
      query.exec((res) => {
        if (!res[0]) {
          reject('无法获取工作区尺寸');
          return;
        }

        const containerRect = res[0];
        const canvasWidth = containerRect.width;
        const canvasHeight = containerRect.height;

        // 创建离屏Canvas
        this.createSelectorQuery()
          .select('#snapshot-canvas')
          .fields({ node: true, size: true })
          .exec((canvasRes) => {
            if (!canvasRes[0]) {
              reject('无法获取Canvas节点');
              return;
            }

            const canvas = canvasRes[0].node;
            const ctx = canvas.getContext('2d');

            // 设置Canvas尺寸
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // 设置背景色
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 绘制贴件
            this.drawPatchesOnCanvas(ctx, canvasWidth, canvasHeight, sideData).then(() => {
              // 生成图片
              wx.canvasToTempFilePath({
                canvas,
                success: (result) => {
                  resolve(result.tempFilePath);
                },
                fail: (error) => {
                  reject(error);
                }
              });
            }).catch(reject);
          });
      });
    });
  },

  // 在Canvas上绘制贴件
  drawPatchesOnCanvas: function(ctx, canvasWidth, canvasHeight, sideData) {
    return new Promise((resolve) => {
      const patches = sideData.patches;
      let drawCount = 0;

      if (patches.length === 0) {
        resolve();
        return;
      }

      patches.forEach((patch, index) => {
        // 创建贴件矩形
        ctx.save();

        // 计算贴件中心点
        const centerX = patch.left + patch.width / 2;
        const centerY = patch.top + patch.height / 2;

        // 移动到中心点并旋转
        ctx.translate(centerX, centerY);
        ctx.rotate(patch.rotation * Math.PI / 180);

        // 设置贴件颜色（根据有效性）
        ctx.fillStyle = patch.isValid ? 'rgba(52, 152, 219, 0.7)' : 'rgba(231, 76, 60, 0.7)';
        ctx.strokeStyle = patch.isValid ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 2;

        // 绘制贴件矩形
        ctx.fillRect(-patch.width / 2, -patch.height / 2, patch.width, patch.height);
        ctx.strokeRect(-patch.width / 2, -patch.height / 2, patch.width, patch.height);

        // 绘制贴件文字
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${index + 1}`, 0, 0);

        ctx.restore();

        drawCount++;
        if (drawCount === patches.length) {
          resolve();
        }
      });
    });
  },

  // 检查贴件是否满足条件
  checkPatchConditions: function() {
    const currentSide = this.getCurrentSide();
    const patches = [...currentSide.patches];
    let allValid = true;
    
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      
      // 获取旋转后的贴件边界（考虑旋转后的实际占用区域）
      const patchBounds = this.getRotatedPatchBounds(patch);
      
      // 条件1: 贴件是否完全在可移动区域内（考虑旋转）
      const inMovableArea = this.isInsideMovableArea(patchBounds, currentSide);
      
      // 条件2: 贴件是否不在任何不可移动区域内（考虑旋转）
      const outsideNonMovable = this.isOutsideNonMovableAreas(patchBounds, currentSide);
      
      // 条件3: 贴件重叠部分最多只能由两个贴件组成（考虑旋转）
      const validOverlap = this.checkOverlapCondition(i, patchBounds, patches);
      
      // 所有条件必须同时满足
      const isValid = inMovableArea && outsideNonMovable && validOverlap;
      
      if (!isValid) {
        allValid = false;
      }
      
      patches[i] = {
        ...patch,
        isValid
      };
    }
    
    this.updateCurrentSide({ 
      patches,
      allValid
    });
  },

  // 获取旋转后的贴件边界矩形 - 使用 WXS 函数
  getRotatedPatchBounds: function(patch) {
    // 可以考虑将这个函数完全移到 WXS，但由于条件检查逻辑复杂，暂时保留
    if (patch.rotation === 0 || patch.rotation % 360 === 0) {
      return {
        left: patch.left,
        top: patch.top,
        right: patch.left + patch.width,
        bottom: patch.top + patch.height
      };
    }
    
    const centerX = patch.left + patch.width / 2;
    const centerY = patch.top + patch.height / 2;
    const angle = patch.rotation * Math.PI / 180;
    
    const corners = [
      { x: patch.left, y: patch.top },
      { x: patch.left + patch.width, y: patch.top },
      { x: patch.left + patch.width, y: patch.top + patch.height },
      { x: patch.left, y: patch.top + patch.height }
    ];
    
    const rotatedCorners = corners.map(corner => {
      const relX = corner.x - centerX;
      const relY = corner.y - centerY;
      
      const rotatedX = relX * Math.cos(angle) - relY * Math.sin(angle);
      const rotatedY = relX * Math.sin(angle) + relY * Math.cos(angle);
      
      return {
        x: rotatedX + centerX,
        y: rotatedY + centerY
      };
    });
    
    const xs = rotatedCorners.map(corner => corner.x);
    const ys = rotatedCorners.map(corner => corner.y);
    
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys)
    };
  },

  // 检查是否在可移动区域内
  isInsideMovableArea: function(patchBounds, sideData) {
    const movableRect = {
      left: sideData.movableArea.left,
      top: sideData.movableArea.top,
      right: sideData.movableArea.left + sideData.movableArea.width,
      bottom: sideData.movableArea.top + sideData.movableArea.height
    };
    
    return (
      patchBounds.left >= movableRect.left &&
      patchBounds.top >= movableRect.top &&
      patchBounds.right <= movableRect.right &&
      patchBounds.bottom <= movableRect.bottom
    );
  },

  // 检查是否不在不可移动区域内
  isOutsideNonMovableAreas: function(patchBounds, sideData) {
    for (let i = 0; i < sideData.nonMovableAreas.length; i++) {
      const area = sideData.nonMovableAreas[i];
      const nonMovableRect = {
        left: area.left,
        top: area.top,
        right: area.left + area.width,
        bottom: area.top + area.height
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
  checkOverlapCondition: function(currentIndex, currentBounds, patches) {
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
        if (this.doThreePatchesOverlap(currentBounds, otherBounds, otherBounds2)) {
          return false; // 三个贴件有共同重叠区域，不符合条件
        }
      }
    }
    
    return true;
  },

  // 计算两点之间的距离
  calculateDistance: function(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },

  // 检查两个矩形是否重叠
  doOverlap: function(rect1, rect2) {
    return (
      rect1.left < rect2.right &&
      rect1.right > rect2.left &&
      rect1.top < rect2.bottom &&
      rect1.bottom > rect2.top
    );
  },

  // 检查三个矩形是否有共同重叠区域
  doThreePatchesOverlap: function(rect1, rect2, rect3) {
    // 计算三个矩形的重叠区域
    const left = Math.max(rect1.left, rect2.left, rect3.left);
    const right = Math.min(rect1.right, rect2.right, rect3.right);
    const top = Math.max(rect1.top, rect2.top, rect3.top);
    const bottom = Math.min(rect1.bottom, rect2.bottom, rect3.bottom);
    
    // 如果有有效的重叠区域，返回true
    return left < right && top < bottom;
  },

  onReady: function() {
    this.initBaseSize();
  },

  onShow: function() {
    // 页面显示时重新计算尺寸
    setTimeout(() => {
      this.initBaseSize();
    }, 100);
  },

  onResize: function() {
    this.initBaseSize();
  }
});