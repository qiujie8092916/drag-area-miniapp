// 示例：如何在页面中使用修改后的 drag-workspace 组件

Page({
  data: {
    canGenerateSnapshot: false,
    frontValid: false,
    backValid: false,
    // ... 其他数据
  },

  onLoad() {
    // 页面加载时可以获取组件的初始状态
    this.checkCanGenerateSnapshot();
  },

  // 监听组件的有效性状态变化
  onValidityChange(e) {
    const { frontValid, backValid, canGenerateSnapshot } = e.detail;
    
    this.setData({
      frontValid,
      backValid,
      canGenerateSnapshot
    });
    
    console.log('正面有效:', frontValid);
    console.log('反面有效:', backValid);
    console.log('可以生成快照:', canGenerateSnapshot);
  },

  // 主动调用生成快照
  onGenerateSnapshotTap() {
    // 获取组件实例
    const dragWorkspace = this.selectComponent('#drag-workspace');
    
    if (!dragWorkspace) {
      wx.showToast({
        title: '组件未找到',
        icon: 'error'
      });
      return;
    }

    // 检查是否可以生成快照
    if (!dragWorkspace.canGenerateSnapshot()) {
      wx.showToast({
        title: '当前状态无法生成快照',
        icon: 'error'
      });
      return;
    }

    // 调用生成快照方法
    dragWorkspace.generateWorkspaceSnapshot()
      .then((result) => {
        console.log('快照生成成功:', result);
        
        // 显示生成成功的提示
        wx.showModal({
          title: '快照生成成功',
          content: `正面和反面快照已生成完成，是否保存到相册？`,
          success: (res) => {
            if (res.confirm) {
              // 保存到相册
              this.saveImagesToAlbum([result.frontImagePath, result.backImagePath]);
            }
          }
        });
      })
      .catch((error) => {
        console.error('快照生成失败:', error);
        wx.showToast({
          title: '生成失败',
          icon: 'error'
        });
      });
  },

  // 检查是否可以生成快照（可选的主动检查方法）
  checkCanGenerateSnapshot() {
    const dragWorkspace = this.selectComponent('#drag-workspace');
    if (dragWorkspace) {
      const canGenerate = dragWorkspace.canGenerateSnapshot();
      this.setData({
        canGenerateSnapshot: canGenerate
      });
    }
  },

  // 保存图片到相册的辅助方法
  saveImagesToAlbum(imagePaths) {
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

  // 其他组件事件处理
  onSnapshotGenerated(e) {
    const { frontImagePath, backImagePath } = e.detail;
    console.log('组件内部生成快照完成:', { frontImagePath, backImagePath });
  },

  onPatchActivate(e) {
    const { uuid } = e.detail;
    console.log('激活贴件:', uuid);
  },

  onPatchDelete(e) {
    const { uuid } = e.detail;
    console.log('删除贴件:', uuid);
    // 处理删除贴件逻辑
  },

  onAreaGuidesChange(e) {
    const { side, show } = e.detail;
    console.log('区域指引状态变化:', side, show);
    // 处理区域指引显示状态变化
  },

  onHideAreaGuidesForSnapshot(e) {
    const { front, back } = e.detail;
    console.log('为快照隐藏区域指引:', { front, back });
    // 临时隐藏区域指引
  },

  onRestoreAreaGuidesAfterSnapshot(e) {
    const { front, back } = e.detail;
    console.log('快照后恢复区域指引:', { front, back });
    // 恢复区域指引显示状态
  }
});
