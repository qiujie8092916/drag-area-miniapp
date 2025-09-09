const app = getApp();

Page({
  data: {
    baseWidth: 0,
    baseHeight: 0,
    zoomLevel: 100,
    maxZoomLevel: 200,
    minZoomLevel: 100,
    showZoomHint: false,
    patches: [],
    selectedPatchIndex: null,
    allValid: true,
    showAreaGuides: true, // 控制是否显示区域指引
    movableArea: {
      left: 0,
      top: 0,
      width: 0,
      height: 0
    },
    nonMovableAreas: [],
    
    // 工作区缩放和移动相关
    transformOriginX: 0,
    transformOriginY: 0,
    workspaceOffsetX: 0,
    workspaceOffsetY: 0
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

  // 初始化底件尺寸
  initBaseSize: function() {
    const query = wx.createSelectorQuery();
    query.select('#base-container').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        const baseWidth = res[0].width;
        const baseHeight = res[0].height;
        
        this.setData({
          baseWidth,
          baseHeight,
          movableArea: this.calculateMovableArea(baseWidth, baseHeight),
          nonMovableAreas: this.calculateNonMovableAreas(baseWidth, baseHeight),
          zoomLevel: 100,
          transformOriginX: 0,
          transformOriginY: 0,
          workspaceOffsetX: 0,
          workspaceOffsetY: 0
        });
        
        // 缓存容器尺寸到私有变量
        this._containerWidth = res[0].width;
        this._containerHeight = res[0].height;
        
        // 初始添加一个贴件
        if (this.data.patches.length === 0) {
          this.addPatch({ currentTarget: { dataset: { size: 'small' } } });
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

  // 容器触摸开始（用于工作区缩放和拖动）
  onContainerTouchStart: function(e) {
    // 如果正在旋转，则不处理容器触摸
    if (this._rotating) return;
    
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
          this._initialZoomLevel = this.data.zoomLevel;
          
          this.setData({
            transformOriginX: originX,
            transformOriginY: originY,
            showZoomHint: true
          });
          
          // 2秒后隐藏提示
          setTimeout(() => {
            this.setData({ showZoomHint: false });
          }, 2000);
        }
      });
    } else if (e.touches.length === 1 && this.data.zoomLevel > 100) {
      // 单指手势开始 - 工作区拖动（只在放大状态下）
      this._workspaceDragging = true;
      this._workspaceStartX = e.touches[0].clientX;
      this._workspaceStartY = e.touches[0].clientY;
      this._workspaceInitialOffsetX = this.data.workspaceOffsetX;
      this._workspaceInitialOffsetY = this.data.workspaceOffsetY;
      this._workspaceMoved = false;
    }
  },

  // 容器触摸移动（用于工作区缩放和拖动）
  onContainerTouchMove: function(e) {
    // 如果正在旋转，则不处理容器移动
    if (this._rotating) return;
    
    if (e.touches.length === 2 && this._isWorkspaceZooming) {
      // 双指缩放工作区
      const currentDistance = this.calculateDistance(
        e.touches[0].clientX, e.touches[0].clientY,
        e.touches[1].clientX, e.touches[1].clientY
      );

      // 计算缩放比例，允许小数，最大200%
      const scaleChange = currentDistance / this._workspaceInitialDistance;
      let newZoom = this._initialZoomLevel * scaleChange;
      newZoom = Math.max(this.data.minZoomLevel, Math.min(this.data.maxZoomLevel, newZoom));

      // 保留两位小数，防止精度误差
      newZoom = Math.round(newZoom * 100) / 100;

      if (newZoom !== this.data.zoomLevel) {
        this.setData({ 
          zoomLevel: newZoom
        });
        
        // 如果缩放回100%，重置位移
        if (newZoom === 100) {
          this.setData({
            workspaceOffsetX: 0,
            workspaceOffsetY: 0
          });
        }
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
      const zoomScale = this.data.zoomLevel / 100;
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
      
      // 直接更新，不使用异步查询
      this.setData({
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
    const patch = this.data.patches[index];
    
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
    const patches = this.data.patches;
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
    
    this.setData({ patches });
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
    const patch = this.data.patches[index];
    
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
    const patches = this.data.patches;
    const patch = patches[index];
    
    const dx = e.touches[0].clientX - this._patchStartX;
    const dy = e.touches[0].clientY - this._patchStartY;
    
    let newLeft = this._patchInitialLeft + dx / (this.data.zoomLevel / 100);
    let newTop = this._patchInitialTop + dy / (this.data.zoomLevel / 100);
    
    // 严格限制在底件范围内（不能超出四个边缘）
    newLeft = Math.max(0, Math.min(this.data.baseWidth - patch.width, newLeft));
    newTop = Math.max(0, Math.min(this.data.baseHeight - patch.height, newTop));
    
    // 更新贴件
    patches[index] = {
      ...patch,
      left: newLeft,
      top: newTop
    };
    
    this.setData({ patches });
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
    const patches = this.data.patches.map((patch, i) => ({
      ...patch,
      selected: i === index
    }));
    
    this.setData({ 
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
    
    const patches = this.data.patches.map(patch => ({
      ...patch,
      selected: false
    }));
    
    patches.push(newPatch);
    
    this.setData({ 
      patches,
      selectedPatchIndex: patches.length - 1
    });
    
    this.checkPatchConditions();
  },

  // 切换区域指引显示
  toggleAreaGuides: function() {
    this.setData({
      showAreaGuides: !this.data.showAreaGuides
    });
  },

  // 检查贴件是否满足条件
  checkPatchConditions: function() {
    const patches = this.data.patches;
    let allValid = true;
    
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      
      // 获取旋转后的贴件边界（考虑旋转后的实际占用区域）
      const patchBounds = this.getRotatedPatchBounds(patch);
      
      // 条件1: 贴件是否完全在可移动区域内（考虑旋转）
      const inMovableArea = this.isInsideMovableArea(patchBounds);
      
      // 条件2: 贴件是否不在任何不可移动区域内（考虑旋转）
      const outsideNonMovable = this.isOutsideNonMovableAreas(patchBounds);
      
      // 条件3: 贴件重叠部分最多只能由两个贴件组成（考虑旋转）
      const validOverlap = this.checkOverlapCondition(i, patchBounds);
      
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
    
    this.setData({ 
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
  isInsideMovableArea: function(patchBounds) {
    const movableRect = {
      left: this.data.movableArea.left,
      top: this.data.movableArea.top,
      right: this.data.movableArea.left + this.data.movableArea.width,
      bottom: this.data.movableArea.top + this.data.movableArea.height
    };
    
    return (
      patchBounds.left >= movableRect.left &&
      patchBounds.top >= movableRect.top &&
      patchBounds.right <= movableRect.right &&
      patchBounds.bottom <= movableRect.bottom
    );
  },

  // 检查是否不在不可移动区域内
  isOutsideNonMovableAreas: function(patchBounds) {
    for (let i = 0; i < this.data.nonMovableAreas.length; i++) {
      const area = this.data.nonMovableAreas[i];
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
  checkOverlapCondition: function(currentIndex, currentBounds) {
    const patches = this.data.patches;
    
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